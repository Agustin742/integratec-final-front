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
import { ApiError } from '@/api/errors';
import {
  classroomChatHistoryQueryKey,
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import {
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
import { useChatReadMarker } from '@/features/chat-inbox/use-chat-read-marker';
import { useSessionService } from '@/session/provider';
import { classroomMessages as messages } from '../messages';
import { useClassroomContext } from '../use-classroom-capabilities';
import { ChatComposer } from './chat-composer';
import { ChatModerationDialog } from './chat-moderation-dialog';
import { ChatScrollContext } from './chat-scroll-context';
import { useClassroomChatLive } from './use-classroom-chat-live';
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

export type ChatConversationVariant = 'panel' | 'dock';

export interface ChatConversationProps {
  readonly classroomId: string;
  /**
   * `panel` sizes itself for the workspace dialog; `dock` fills the height of
   * the floating chat window that hosts it.
   */
  readonly variant?: ChatConversationVariant;
  /**
   * Send-side composer slot pinned below the history. The read side owns the
   * history, gating and states; the composer (length limits, mentions,
   * rate-limit and muted behavior) is injected here so both sides share one
   * classroom-scoped view.
   */
  readonly composer?: ReactNode;
}

/**
 * Read side of the classroom chat (`HU-COM-002`, issue #51): server-authorized
 * history rendered as a real conversation (oldest to newest, anchored at the
 * newest message, older pages loaded by scrolling up) as safe plain text, with
 * loading, empty, denied and stale states (`rules/error-handling-and-feedback.md`).
 * One component serves the workspace panel and the floating chat dock.
 *
 * Live updates: `useClassroomChatLive` applies the Colyseus `chat:message`
 * and `chat:message.hidden` events (back #48) to this history through the
 * shared app-level connection, and revalidates it after a reconnect. Because
 * it joins the classroom room only while mounted, hosts mount a conversation
 * only while it is actually open.
 *
 * Read markers: while the newest visible message is in view and the page is
 * visible, the newest message id is reported (`useChatReadMarker`) so unread
 * counts clear.
 *
 * Parents are denied up front without issuing any chat request (S5); a server
 * 403 on history (lost permission) is shown as its own denied state.
 */
export function ChatConversation({
  classroomId,
  variant = 'panel',
  composer,
}: ChatConversationProps) {
  const chat = messages.chat;
  const trimmedClassroomId = classroomId.trim();
  if (trimmedClassroomId === '') {
    return (
      <ErrorState
        headingLevel="h3"
        title={chat.states.loadErrorTitle}
        description={chat.states.loadErrorDescription}
      />
    );
  }
  return (
    <ChatConversationHost
      classroomId={trimmedClassroomId}
      variant={variant}
      composer={composer}
    />
  );
}

/**
 * The conversation with the real composer, the pairing every host uses.
 * `focusComposerOnMount` moves focus into the draft once it mounts (the dock
 * does it when a conversation opens).
 */
export function ChatConversationWithComposer({
  classroomId,
  variant = 'panel',
  focusComposerOnMount = false,
}: {
  readonly classroomId: string;
  readonly variant?: ChatConversationVariant;
  readonly focusComposerOnMount?: boolean;
}) {
  return (
    <ChatConversation
      classroomId={classroomId}
      variant={variant}
      composer={
        <ChatComposer
          classroomId={classroomId}
          focusOnMount={focusComposerOnMount}
        />
      }
    />
  );
}

function ChatConversationHost({
  classroomId,
  variant,
  composer,
}: {
  readonly classroomId: string;
  readonly variant: ChatConversationVariant;
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
    <ChatConversationView
      key={`${context.userId}:${classroomId}`}
      userId={context.userId}
      classroomId={classroomId}
      variant={variant}
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

function ChatConversationView({
  userId,
  classroomId,
  variant,
  canListDirectory,
  canModerateChat,
  composer,
}: {
  readonly userId: string;
  readonly classroomId: string;
  readonly variant: ChatConversationVariant;
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
  // Mirrors `stickToBottomRef` as state: the read marker only advances while
  // the newest message is actually in view.
  const [isAtBottom, setIsAtBottom] = useState(true);
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

  useClassroomChatLive(classroomId, { canModerate: canModerateChat });

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
      // Distinct ids: a live message pushes the last row of a page onto the
      // next one, so the same row can arrive twice and must count once.
      const loaded = new Set(
        allPages.flatMap((page) => page.items.map((item) => item.id)),
      ).size;
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

  // Newest message the reader can have seen: hidden rows (staff only) are not
  // readable by the marker endpoint.
  const newestVisibleId =
    [...historyItems].reverse().find((message) => message.hiddenAt === null)
      ?.id ?? null;
  useChatReadMarker({
    userId,
    classroomId,
    newestMessageId: newestVisibleId,
    inView: isAtBottom,
  });

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

  // The composer grows and shrinks under the list (auto-growing draft): while
  // the reader is at the bottom, keep the latest message in view instead of
  // letting the shrinking list push it out.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) {
        scroller.scrollTop = scroller.scrollHeight;
      }
    });
    observer.observe(scroller);
    return () => {
      observer.disconnect();
    };
  }, [hasHistory]);

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
        setIsAtBottom(true);
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
      {/* Header and composer keep their size and ONLY the message list
          scrolls (`min-h-0` lets the flex child shrink). The host titles the
          conversation (dialog or dock header), so the heading is for
          assistive technology only: no space goes to a repeated header. */}
      <section
        aria-label={chat.heading}
        className={cn(
          'flex min-w-0 flex-col gap-2',
          variant === 'dock'
            ? 'h-full min-h-0'
            : 'h-[calc(100dvh-11rem)] max-h-[44rem] min-h-[18rem]',
        )}
      >
        <h3 className="sr-only">{chat.heading}</h3>

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
          // Same frame as the history, so an empty room still looks like a
          // conversation: a friendly incoming bubble resting at the bottom of
          // the message area, with the composer ready right below.
          <div
            data-testid="chat-empty"
            className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto rounded-xl border border-edge bg-muted/40 px-3 py-3"
          >
            <div className="min-w-0 max-w-[92%] space-y-1 rounded-2xl rounded-tl-md border border-edge bg-card px-4 py-3 text-card-foreground shadow-panel">
              <p className="text-sm font-semibold">{chat.states.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">
                {chat.states.emptyDescription}
              </p>
            </div>
          </div>
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
              const nearBottom =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                STICK_TO_BOTTOM_THRESHOLD_PX;
              stickToBottomRef.current = nearBottom;
              setIsAtBottom(nearBottom);
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
                    {/* The wrapper anchors the moderation control next to the
                        bubble (absolute: it reserves no space inside it, so
                        the bubble is as tall for teachers as for students). */}
                    <div className="group relative min-w-0 max-w-[88%]">
                      <div
                        data-bubble=""
                        className={cn(
                          'min-w-0 space-y-1 rounded-2xl border px-3 py-2 shadow-xs',
                          isOwn
                            ? 'rounded-br-md border-success-edge bg-success text-success-foreground'
                            : 'rounded-bl-md border-edge bg-card text-foreground',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {isOwn ? (
                            // Alignment and tint already say it is you.
                            <span className="sr-only">{chat.authorSelf}</span>
                          ) : (
                            <>
                              <span className="min-w-0 truncate text-xs font-semibold">
                                {author.label}
                              </span>
                              {author.roleLabel !== null ? (
                                <Badge
                                  variant={author.roleVariant}
                                  className="px-2 py-0 text-[10px] shadow-none"
                                >
                                  {author.roleLabel}
                                </Badge>
                              ) : null}
                            </>
                          )}
                          {isHidden ? (
                            <Badge variant="secondary">
                              {chat.hiddenBadge}
                            </Badge>
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
                          className={cn(
                            'absolute top-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-tray hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                            // Outer free side of the bubble.
                            isOwn ? 'right-full mr-1' : 'left-full ml-1',
                            // Hover-capable pointers: hidden until the row is
                            // hovered or focus is inside (opacity only, so
                            // it stays focusable); always visible on touch.
                            'pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-focus-within:pointer-events-auto pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:pointer-events-auto pointer-fine:group-hover:opacity-100',
                          )}
                        >
                          <HideIcon />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {composer !== undefined ? (
          <div className="shrink-0 rounded-xl border border-edge bg-card p-2 shadow-xs">
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
