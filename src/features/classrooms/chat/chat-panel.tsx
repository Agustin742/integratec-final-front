import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomChatHistoryQueryKey,
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/dates';
import { useSessionService } from '@/session/provider';
import { classroomMessages as messages } from '../messages';
import { useClassroomContext } from '../use-classroom-capabilities';
import { ChatModerationDialog } from './chat-moderation-dialog';
import type {
  ChatDirectoryMemberDto,
  ChatHistoryMessageDto,
  PaginatedChatHistoryDto,
} from './chat-schema';
import {
  listClassroomChatHistory,
  listClassroomChatMembers,
} from './chat-service';

const CHAT_HISTORY_PAGE_SIZE = 20;

export interface ChatPanelProps {
  /**
   * Send-side composer slot rendered below the history. The read panel owns
   * the history, gating and states; the composer (length limits, mentions,
   * rate-limit and muted behavior) is injected here by the follow-up tasks so
   * both sides share one classroom-scoped view.
   */
  readonly composer?: ReactNode;
}

/**
 * Read side of the classroom chat (`HU-COM-002`, issue #51): server-authorized
 * paginated history rendered as safe plain text, with loading, empty, denied,
 * stale and out-of-range states (`rules/error-handling-and-feedback.md`).
 *
 * Live updates: the committed contract has no per-message broadcast yet
 * (back #48), so new messages arrive by revalidating this panel's queries
 * through the workspace SSE `classroom.context-invalidated` seam
 * (`use-classroom-context-events.ts`). No realtime protocol is invented here.
 *
 * Parents are denied up front without issuing any chat request (S5); a server
 * 403 on history (lost permission) is shown as its own denied state.
 */
export function ChatPanel({ composer }: ChatPanelProps) {
  const { classroomId } = useParams();
  const chat = messages.chat;
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={chat.states.loadErrorTitle}
        description={chat.states.loadErrorDescription}
      />
    );
  }
  return <ChatPanelHost classroomId={classroomId.trim()} composer={composer} />;
}

function ChatPanelHost({
  classroomId,
  composer,
}: {
  readonly classroomId: string;
  readonly composer?: ReactNode;
}) {
  const context = useClassroomContext(classroomId);
  const chat = messages.chat;

  if (context.status === 'error') {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.errorTitle}
        description={messages.errorDescription}
        onRetry={context.retry}
      />
    );
  }

  if (context.status === 'pending') {
    return <LoadingState label={chat.loading} />;
  }

  if (context.classroom.myRole === 'PARENT') {
    // Parents are never offered the classroom chat: deny without issuing any
    // history or directory request (S5).
    return (
      <ErrorState
        headingLevel="h3"
        title={chat.states.parentDeniedTitle}
        description={chat.states.parentDeniedDescription}
      />
    );
  }

  return (
    <ChatPanelConversation
      key={`${context.userId}:${classroomId}`}
      userId={context.userId}
      classroomId={classroomId}
      classroomName={context.classroom.name}
      canListDirectory={context.classroom.capabilities.includes(
        'list_directory',
      )}
      // Moderation is offered only to teacher-level staff of THIS classroom:
      // the gate is the server-granted `moderate_chat` capability on the
      // classroom context, never a role name embedded in client code, and the
      // server still denies every unauthorized hide (S3/S10).
      canModerateChat={context.classroom.capabilities.includes('moderate_chat')}
      composer={composer}
    />
  );
}

interface ChatAuthorPresentation {
  readonly label: string;
  readonly roleLabel: string | null;
  readonly roleVariant: 'default' | 'outline';
}

function resolveChatAuthor(
  authorId: string,
  currentUserId: string,
  membersByUserId: ReadonlyMap<string, ChatDirectoryMemberDto>,
): ChatAuthorPresentation {
  const member = membersByUserId.get(authorId);
  const roleLabel =
    member?.role === 'TEACHER' ? messages.chat.roleTeacherBadge : null;
  const roleVariant = member?.role === 'TEACHER' ? 'default' : 'outline';

  if (authorId === currentUserId) {
    return {
      label: member
        ? `${member.displayName} (${messages.chat.authorSelf})`
        : messages.chat.authorSelf,
      roleLabel,
      roleVariant,
    };
  }

  return {
    label: member?.displayName ?? messages.chat.authorFallback,
    roleLabel,
    roleVariant,
  };
}

function ChatPanelConversation({
  userId,
  classroomId,
  classroomName,
  canListDirectory,
  canModerateChat,
  composer,
}: {
  readonly userId: string;
  readonly classroomId: string;
  readonly classroomName: string;
  readonly canListDirectory: boolean;
  readonly canModerateChat: boolean;
  readonly composer?: ReactNode;
}) {
  const chat = messages.chat;
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const terminalReconciledRef = useRef(false);
  // Moderation target: the row chosen for the hide confirmation. While a
  // confirmation is open (pending included) every row control is disabled so
  // at most one moderation is in flight per panel.
  const [hideTarget, setHideTarget] = useState<ChatHistoryMessageDto | null>(
    null,
  );
  const hideTriggerRef = useRef<HTMLElement | null>(null);
  const historyListRef = useRef<HTMLOListElement | null>(null);

  // Optional non-blocking directory lookup: server-confirmed display names for
  // authors and moderation auditors. Absent, denied or failed lookups degrade
  // to neutral labels, never to guesses.
  const membersQuery = useQuery({
    queryKey: classroomDirectoryMembersQueryKey(userId, classroomId, {
      page: 1,
      pageSize: 100,
    }),
    queryFn: ({ signal }) =>
      listClassroomChatMembers(
        client,
        classroomId,
        {
          page: 1,
          pageSize: 100,
        },
        { signal },
      ),
    enabled: canListDirectory,
    staleTime: 60_000,
    retry: false,
  });

  const membersByUserId = useMemo(() => {
    const map = new Map<string, ChatDirectoryMemberDto>();
    for (const member of membersQuery.data?.items ?? []) {
      map.set(member.userId, member);
    }
    return map;
  }, [membersQuery.data?.items]);

  const historyQuery = useQuery({
    queryKey: classroomChatHistoryQueryKey(userId, classroomId, {
      page,
      pageSize: CHAT_HISTORY_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      listClassroomChatHistory(
        client,
        classroomId,
        { page, pageSize: CHAT_HISTORY_PAGE_SIZE },
        { signal },
      ),
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const errorStatus =
    historyQuery.error instanceof ApiError ? historyQuery.error.status : null;
  const isTerminalChatError =
    historyQuery.isError && (errorStatus === 403 || errorStatus === 404);

  // A denied or vanished classroom must not keep re-serving a stale denied
  // page: reconcile the classroom context once, bounded, and stop.
  useEffect(() => {
    if (!isTerminalChatError) {
      terminalReconciledRef.current = false;
      return;
    }
    if (!terminalReconciledRef.current) {
      terminalReconciledRef.current = true;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [classroomId, isTerminalChatError, queryClient, userId]);

  // Contract order (createdAt DESC, id DESC) is preserved; repeated ids from a
  // revalidated page are deduplicated by their server identity.
  const historyItems = useMemo(() => {
    const seen = new Set<string>();
    const items: ChatHistoryMessageDto[] = [];
    for (const message of historyQuery.data?.items ?? []) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      items.push(message);
    }
    return items;
  }, [historyQuery.data?.items]);

  const total = historyQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CHAT_HISTORY_PAGE_SIZE));
  const isOutOfRangePage = page > 1 && historyItems.length === 0 && total > 0;

  // Moderation reconciliation: invalidate every chat query of this user and
  // classroom (shared `chat` domain, `createClassroomChatPredicate`) and
  // resolve the revalidated row, so confirmed and uncertain hides read the
  // server truth instead of a local assumption or a blind retry.
  const reconcileModeratedRow = useCallback(
    async (messageId: string): Promise<ChatHistoryMessageDto | null> => {
      await queryClient.invalidateQueries({
        predicate: createClassroomChatPredicate(userId, classroomId),
      });
      const data = queryClient.getQueryData<PaginatedChatHistoryDto>(
        classroomChatHistoryQueryKey(userId, classroomId, {
          page,
          pageSize: CHAT_HISTORY_PAGE_SIZE,
        }),
      );
      return data?.items.find((item) => item.id === messageId) ?? null;
    },
    [classroomId, page, queryClient, userId],
  );

  return (
    <section aria-label={chat.heading} className="min-w-0 space-y-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          {chat.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {chat.subtitle(classroomName)}
        </p>
        <p className="text-xs text-muted-foreground">{chat.newestFirstNote}</p>
      </div>

      {historyQuery.isError &&
      historyQuery.data !== undefined &&
      !isTerminalChatError ? (
        <StaleDataNotice
          headingLevel="h4"
          title={chat.states.staleTitle}
          description={chat.states.staleDescription}
          onRetry={() => {
            void historyQuery.refetch();
          }}
        />
      ) : null}

      {historyQuery.isPending && historyQuery.data === undefined ? (
        <LoadingState label={chat.loading} />
      ) : isTerminalChatError ? (
        <ErrorState
          headingLevel="h4"
          title={
            errorStatus === 403
              ? chat.states.forbiddenTitle
              : chat.states.notFoundTitle
          }
          description={
            errorStatus === 403
              ? chat.states.forbiddenDescription
              : chat.states.notFoundDescription
          }
        />
      ) : historyQuery.isError && historyQuery.data === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={chat.states.loadErrorTitle}
          description={chat.states.loadErrorDescription}
          onRetry={() => {
            void historyQuery.refetch();
          }}
        />
      ) : isOutOfRangePage ? (
        <EmptyState
          headingLevel="h4"
          title={chat.states.outOfRangeTitle}
          description={chat.states.outOfRangeDescription}
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setPage(1)}
            >
              {chat.states.backToFirstPage}
            </Button>
          }
        />
      ) : historyItems.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={chat.states.emptyTitle}
          description={chat.states.emptyDescription}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {chat.resultsSummary(historyItems.length, total)}
          </p>

          <ol
            ref={historyListRef}
            tabIndex={-1}
            aria-label={chat.listRegionLabel}
            className="space-y-3"
          >
            {historyItems.map((message) => {
              const author = resolveChatAuthor(
                message.authorId,
                userId,
                membersByUserId,
              );
              const isHidden = message.hiddenAt !== null;
              const hiddenAt = message.hiddenAt;
              const moderator =
                message.hiddenById !== null
                  ? (membersByUserId.get(message.hiddenById)?.displayName ??
                    chat.hiddenModeratorFallback)
                  : chat.hiddenModeratorFallback;
              return (
                <li
                  key={message.id}
                  className="space-y-2 rounded-xl border border-edge bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {author.label}
                      </span>
                      {author.roleLabel !== null ? (
                        <Badge variant={author.roleVariant}>
                          {author.roleLabel}
                        </Badge>
                      ) : null}
                      {isHidden ? (
                        <Badge variant="secondary">{chat.hiddenBadge}</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {chat.createdAtPrefix}{' '}
                        {formatInstant(message.createdAt)}
                      </span>
                      {canModerateChat && !isHidden ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={chat.moderation.hideAriaLabel(
                            author.label,
                            formatInstant(message.createdAt),
                          )}
                          aria-expanded={hideTarget?.id === message.id}
                          disabled={hideTarget !== null}
                          onClick={(event) => {
                            hideTriggerRef.current = event.currentTarget;
                            setHideTarget(message);
                          }}
                        >
                          {chat.moderation.hideAction}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Strict plain text node rendering (never dangerouslySetInnerHTML). */}
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {message.body}
                  </p>

                  {hiddenAt !== null ? (
                    <p className="text-xs text-muted-foreground">
                      {chat.hiddenAudit(moderator, formatInstant(hiddenAt))}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>

          {totalPages > 1 ? (
            <PaginationControls
              page={page}
              pageSize={CHAT_HISTORY_PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      )}

      {composer !== undefined ? (
        <div className="space-y-2 rounded-xl border border-edge bg-card p-4 shadow-xs">
          {composer}
        </div>
      ) : null}

      <ChatModerationDialog
        open={hideTarget !== null}
        message={hideTarget}
        classroomId={classroomId}
        userId={userId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setHideTarget(null);
          }
        }}
        onReconcile={reconcileModeratedRow}
        getTriggerElement={() => hideTriggerRef.current}
        fallbackFocus={() => historyListRef.current}
      />
    </section>
  );
}
