import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomChatHistoryQueryKey,
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import {
  formatDayLabel,
  formatInstant,
  formatTimeOfDay,
  getSchoolDayKey,
} from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { classroomMessages as messages } from '../messages';
import { useClassroomContext } from '../use-classroom-capabilities';
import { ChatModerationDialog } from './chat-moderation-dialog';
import { ChatScrollContext } from './chat-scroll-context';
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
   * Send-side composer slot pinned below the history. The read panel owns
   * the history, gating and states; the composer (length limits, mentions,
   * rate-limit and muted behavior) is injected here by the follow-up tasks so
   * both sides share one classroom-scoped view.
   */
  readonly composer?: ReactNode;
}

/**
 * Read side of the classroom chat (`HU-COM-002`, issue #51): server-authorized
 * history rendered as a real conversation (oldest to newest, anchored at the
 * newest message, older pages loaded by scrolling up) as safe plain text, with
 * loading, empty, denied and stale states (`rules/error-handling-and-feedback.md`).
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

/** Distance from the bottom (px) within which the view still follows new messages. */
const STICK_TO_BOTTOM_THRESHOLD_PX = 80;

function flattenChatPages(
  pages: readonly PaginatedChatHistoryDto[] | undefined,
): ChatHistoryMessageDto[] {
  // Pages arrive latest first (createdAt DESC, id DESC) and page N+1 holds
  // OLDER messages. Offset pagination shifts when messages arrive between
  // requests, so repeated ids are dropped by their server identity (first
  // occurrence wins, i.e. the freshest page), then the list is reversed to
  // read oldest to newest like a chat.
  const seen = new Set<string>();
  const newestFirst: ChatHistoryMessageDto[] = [];
  for (const page of pages ?? []) {
    for (const message of page.items) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      newestFirst.push(message);
    }
  }
  return newestFirst.reverse();
}

function HideIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-4 fill-none stroke-current stroke-2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.9 4.2A10 10 0 0 1 12 4c6 0 9.5 6 9.5 8a9.8 9.8 0 0 1-2.2 3.2" />
      <path d="M6.6 6.6A9.7 9.7 0 0 0 2.5 12C2.5 14 6 20 12 20a9.6 9.6 0 0 0 4.4-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
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
  const terminalReconciledRef = useRef(false);
  // Moderation target: the row chosen for the hide confirmation. While a
  // confirmation is open (pending included) every row control is disabled so
  // at most one moderation is in flight per panel.
  const [hideTarget, setHideTarget] = useState<ChatHistoryMessageDto | null>(
    null,
  );
  const hideTriggerRef = useRef<HTMLElement | null>(null);
  const historyListRef = useRef<HTMLOListElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Scroll bookkeeping: `stickToBottom` says whether the reader follows the
  // newest message; `prependAnchor` is the scroll height captured right before
  // older messages are requested; `snapshot` tracks the ends of the list.
  const stickToBottomRef = useRef(true);
  const prependAnchorRef = useRef<number | null>(null);
  const snapshotRef = useRef<{
    firstId: string | null;
    lastId: string | null;
  }>({ firstId: null, lastId: null });

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

  const historyQuery = useInfiniteQuery({
    queryKey: classroomChatHistoryQueryKey(userId, classroomId, {
      pageSize: CHAT_HISTORY_PAGE_SIZE,
    }),
    queryFn: ({ signal, pageParam }) =>
      listClassroomChatHistory(
        client,
        classroomId,
        { page: pageParam, pageSize: CHAT_HISTORY_PAGE_SIZE },
        { signal },
      ),
    initialPageParam: 1,
    // Page N + 1 holds OLDER messages: keep asking while fewer rows than the
    // server total were loaded. An empty page ends the walk (rows may have
    // vanished since the total was computed).
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.items.length === 0) return undefined;
      const loaded = allPages.reduce(
        (count, page) => count + page.items.length,
        0,
      );
      return loaded < lastPage.total ? lastPageParam + 1 : undefined;
    },
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

  const historyItems = useMemo(
    () => flattenChatPages(historyQuery.data?.pages),
    [historyQuery.data?.pages],
  );

  // Day separators and time stamps are resolved in the school time zone; the
  // client clock only drives the `Hoy`/`Ayer` presentation labels.
  const timeline = useMemo(() => {
    const now = new Date();
    const entries: (
      | { kind: 'day'; key: string; label: string }
      | { kind: 'message'; key: string; message: ChatHistoryMessageDto }
    )[] = [];
    let previousDay: string | null = null;
    for (const message of historyItems) {
      const day = getSchoolDayKey(message.createdAt);
      if (day !== previousDay) {
        entries.push({
          kind: 'day',
          key: `day:${day}`,
          label: formatDayLabel(message.createdAt, now),
        });
        previousDay = day;
      }
      entries.push({ kind: 'message', key: message.id, message });
    }
    return entries;
  }, [historyItems]);

  const { fetchNextPage, hasNextPage, isFetching, isError } = historyQuery;
  const hasHistory = historyItems.length > 0;
  const canLoadOlder = hasHistory && hasNextPage && !isFetching && !isError;

  // Keep the reader's position through list changes, before paint:
  // - first load: anchor at the newest message (bottom);
  // - a newer message: follow it only when the reader is at the bottom (or just
  //   sent one);
  // - older messages prepended: add the new height above to scrollTop, so the
  //   visible content does not jump (browser scroll anchoring is disabled on
  //   the container to avoid correcting twice).
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const firstId = historyItems[0]?.id ?? null;
    const lastId = historyItems.at(-1)?.id ?? null;
    const previous = snapshotRef.current;
    snapshotRef.current = { firstId, lastId };
    if (scroller === null || lastId === null) return;

    if (previous.lastId === null) {
      scroller.scrollTop = scroller.scrollHeight;
    } else if (lastId !== previous.lastId) {
      if (stickToBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight;
      }
    } else if (firstId !== previous.firstId) {
      const anchor = prependAnchorRef.current;
      if (anchor !== null) {
        scroller.scrollTop += scroller.scrollHeight - anchor;
      }
    }
    prependAnchorRef.current = null;
  }, [historyItems]);

  // Infinite scroll up: when the top sentinel nears the viewport, request the
  // next (older) page. The observer is re-armed after every fetch so a list
  // still shorter than the viewport keeps loading until it overflows.
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (
      !canLoadOlder ||
      root === null ||
      sentinel === null ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        prependAnchorRef.current = root.scrollHeight;
        void fetchNextPage();
      },
      { root, rootMargin: '160px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadOlder, fetchNextPage, historyItems.length]);

  const scrollApi = useMemo(
    () => ({
      scrollToLatest: () => {
        stickToBottomRef.current = true;
        const scroller = scrollRef.current;
        if (scroller !== null) {
          scroller.scrollTop = scroller.scrollHeight;
        }
      },
    }),
    [],
  );

  // Moderation reconciliation: invalidate every chat query of this user and
  // classroom (shared `chat` domain, `createClassroomChatPredicate`) and
  // resolve the revalidated row, so confirmed and uncertain hides read the
  // server truth instead of a local assumption or a blind retry.
  const reconcileModeratedRow = useCallback(
    async (messageId: string): Promise<ChatHistoryMessageDto | null> => {
      await queryClient.invalidateQueries({
        predicate: createClassroomChatPredicate(userId, classroomId),
      });
      const data = queryClient.getQueryData<
        InfiniteData<PaginatedChatHistoryDto, number>
      >(
        classroomChatHistoryQueryKey(userId, classroomId, {
          pageSize: CHAT_HISTORY_PAGE_SIZE,
        }),
      );
      return (
        flattenChatPages(data?.pages).find((item) => item.id === messageId) ??
        null
      );
    },
    [classroomId, queryClient, userId],
  );

  return (
    <ChatScrollContext.Provider value={scrollApi}>
      {/* The panel fills the dialog: header and composer keep their size and
          ONLY the message list scrolls (`min-h-0` lets the flex child shrink). */}
      <section
        aria-label={chat.heading}
        className="flex h-[calc(100dvh-14rem)] max-h-[40rem] min-h-[20rem] min-w-0 flex-col gap-3"
      >
        <div className="shrink-0 space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">
            {chat.heading}
          </h3>
          <p className="text-sm text-muted-foreground">
            {chat.subtitle(classroomName)}
          </p>
        </div>

        {historyQuery.isError &&
        historyQuery.data !== undefined &&
        !isTerminalChatError ? (
          <div className="shrink-0">
            <StaleDataNotice
              headingLevel="h4"
              title={chat.states.staleTitle}
              description={chat.states.staleDescription}
              onRetry={() => {
                void historyQuery.refetch();
              }}
            />
          </div>
        ) : null}

        {historyQuery.isPending ? (
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
        ) : !hasHistory ? (
          <EmptyState
            headingLevel="h4"
            title={chat.states.emptyTitle}
            description={chat.states.emptyDescription}
          />
        ) : (
          <div
            ref={scrollRef}
            data-testid="chat-scroll"
            role="region"
            aria-label={chat.scrollRegionLabel}
            // The named overflow region must be focusable for keyboard scrolling.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            onScroll={(event) => {
              const element = event.currentTarget;
              stickToBottomRef.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                STICK_TO_BOTTOM_THRESHOLD_PX;
            }}
            className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-edge bg-muted/40 px-3 py-2 [overflow-anchor:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              ref={sentinelRef}
              data-testid="chat-history-top"
              aria-hidden="true"
              className="h-px"
            />
            {/* Constant-height row: the indicator never shifts the list. */}
            <p className="flex h-6 items-center justify-center text-xs text-muted-foreground">
              {historyQuery.isFetchingNextPage
                ? chat.loadingOlder
                : !hasNextPage
                  ? chat.startOfConversation
                  : null}
            </p>

            <ol
              ref={historyListRef}
              tabIndex={-1}
              aria-label={chat.listRegionLabel}
              className="space-y-2"
            >
              {timeline.map((entry) => {
                if (entry.kind === 'day') {
                  return (
                    <li
                      key={entry.key}
                      className="flex justify-center py-1 text-xs font-medium text-muted-foreground"
                    >
                      <span className="rounded-full bg-tray px-3 py-0.5">
                        {entry.label}
                      </span>
                    </li>
                  );
                }
                const { message } = entry;
                const author = resolveChatAuthor(
                  message.authorId,
                  userId,
                  membersByUserId,
                );
                const isOwn = message.authorId === userId;
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
                    data-own={isOwn ? 'true' : 'false'}
                    className={cn(
                      'flex min-w-0',
                      isOwn ? 'justify-end' : 'justify-start',
                    )}
                  >
                    <div
                      className={cn(
                        'group min-w-0 max-w-[88%] space-y-1 rounded-2xl border px-3 py-2 shadow-xs',
                        isOwn
                          ? 'rounded-br-md border-success-edge bg-success text-success-foreground'
                          : 'rounded-bl-md border-edge bg-card text-foreground',
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-xs font-semibold">
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
                        {canModerateChat && !isHidden ? (
                          <button
                            type="button"
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
                            // Always visible on touch; on hover-capable
                            // pointers it appears on row hover or keyboard
                            // focus, and stays reachable by Tab either way.
                            className="ml-auto inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-tray hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100"
                          >
                            <HideIcon />
                          </button>
                        ) : null}
                      </div>

                      {/* Strict plain text node rendering (never dangerouslySetInnerHTML). */}
                      <p
                        data-hidden={isHidden ? 'true' : 'false'}
                        className={cn(
                          'whitespace-pre-wrap break-words text-sm',
                          isHidden && 'italic text-muted-foreground',
                        )}
                      >
                        {message.body}
                      </p>

                      <div className="flex flex-wrap items-center justify-end gap-x-2 text-[11px] opacity-80">
                        {hiddenAt !== null ? (
                          <span className="mr-auto">
                            {chat.hiddenAudit(
                              moderator,
                              formatInstant(hiddenAt),
                            )}
                          </span>
                        ) : null}
                        <time
                          dateTime={message.createdAt}
                          title={formatInstant(message.createdAt)}
                        >
                          {formatTimeOfDay(message.createdAt)}
                        </time>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {composer !== undefined ? (
          <div className="shrink-0 rounded-xl border border-edge bg-card p-3 shadow-xs">
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
    </ChatScrollContext.Provider>
  );
}
