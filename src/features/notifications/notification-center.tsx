import { useContext, useEffect, useRef, useState } from 'react';
import {
  QueryClientContext,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  createNotificationsPredicate,
  notificationsListQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { notificationMessages } from './messages';
import {
  getNotificationTargetPath,
  type NotificationDto,
  type PaginatedNotificationListDto,
} from './notification-schema';
import {
  isAbortError,
  isUncertainNotificationError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-service';

export const DEFAULT_NOTIFICATION_POLL_INTERVAL_MS = 30_000;
const NOTIFICATION_PAGE_SIZE = 20;

export interface NotificationCenterProps {
  /** Polling interval in ms; defaults to 30s. Pass `false` to disable polling. */
  readonly pollIntervalMs?: number | false;
}

function formatNotificationTime(iso: string): string {
  try {
    return formatInstant(iso);
  } catch {
    return iso;
  }
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 fill-none stroke-current stroke-[2]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * In-app notification bell and slide-over tray mounted in `AppShell`.
 * Renders nothing when unauthenticated or when no `QueryClientProvider` is mounted.
 */
export function NotificationCenter({
  pollIntervalMs = DEFAULT_NOTIFICATION_POLL_INTERVAL_MS,
}: NotificationCenterProps = {}) {
  const queryClient = useContext(QueryClientContext);
  const snapshot = useSessionSnapshot();

  if (!queryClient || snapshot.status !== 'authenticated') {
    return null;
  }

  return (
    <NotificationCenterContent
      key={snapshot.user.id}
      userId={snapshot.user.id}
      pollIntervalMs={pollIntervalMs}
    />
  );
}

function NotificationCenterContent({
  userId,
  pollIntervalMs,
}: {
  readonly userId: string;
  readonly pollIntervalMs: number | false;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [markingIds, setMarkingIds] = useState<readonly string[]>([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const markingIdsRef = useRef<Set<string>>(new Set());
  const markingAllRef = useRef(false);
  const skipCloseAutoFocusRef = useRef(false);
  const previousIdsRef = useRef<Set<string> | null>(null);
  const previousUnreadRef = useRef<number | null>(null);
  const unmountAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    unmountAbortRef.current = controller;
    return () => {
      controller.abort();
      unmountAbortRef.current = null;
    };
  }, []);

  const queryKey = notificationsListQueryKey(userId, {
    page,
    pageSize: NOTIFICATION_PAGE_SIZE,
  });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      listNotifications(
        client,
        { page, pageSize: NOTIFICATION_PAGE_SIZE },
        { signal },
      ),
    refetchInterval: pollIntervalMs,
    refetchOnWindowFocus: true,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const unreadCount = items.filter((item) => item.readAt === null).length;

  useEffect(() => {
    if (!query.data) {
      return;
    }
    const currentIds = new Set(query.data.items.map((item) => item.id));
    const prevIds = previousIdsRef.current;
    const prevUnread = previousUnreadRef.current;

    if (prevIds !== null && prevUnread !== null) {
      const hasNewItem = query.data.items.some((item) => !prevIds.has(item.id));
      if (hasNewItem) {
        setLiveAnnouncement(
          `${notificationMessages.liveNewArrivalAnnouncement} ${notificationMessages.liveUnreadAnnouncement(unreadCount)}`,
        );
      } else if (unreadCount > prevUnread) {
        setLiveAnnouncement(
          notificationMessages.liveUnreadAnnouncement(unreadCount),
        );
      } else if (unreadCount < prevUnread) {
        setLiveAnnouncement('');
      }
    }

    previousIdsRef.current = currentIds;
    previousUnreadRef.current = unreadCount;
  }, [query.data, unreadCount]);

  async function reconcileNotifications() {
    await queryClient.invalidateQueries({
      predicate: createNotificationsPredicate(userId),
    });
  }

  async function handleMarkRead(notification: NotificationDto) {
    if (
      notification.readAt !== null ||
      markingAllRef.current ||
      markingIdsRef.current.has(notification.id)
    ) {
      return;
    }
    markingIdsRef.current.add(notification.id);
    setMarkingIds((prev) => [...prev, notification.id]);
    setActionError(null);

    try {
      const updated = await markNotificationRead(client, notification.id, {
        signal: unmountAbortRef.current?.signal,
      });
      queryClient.setQueryData<PaginatedNotificationListDto>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((entry) =>
                  entry.id === updated.id ? updated : entry,
                ),
              }
            : current,
      );
      await reconcileNotifications();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (
        isUncertainNotificationError(error) ||
        (error instanceof ApiError && error.status === 404)
      ) {
        await reconcileNotifications();
      }
      setActionError(
        error instanceof ApiError
          ? error.userMessage
          : notificationMessages.errorDescription,
      );
    } finally {
      markingIdsRef.current.delete(notification.id);
      setMarkingIds((prev) => prev.filter((id) => id !== notification.id));
    }
  }

  async function handleMarkAllRead() {
    if (total === 0 || markingAllRef.current) {
      return;
    }
    markingAllRef.current = true;
    setIsMarkingAll(true);
    setActionError(null);

    try {
      await markAllNotificationsRead(client, {
        signal: unmountAbortRef.current?.signal,
      });
      await reconcileNotifications();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      if (isUncertainNotificationError(error)) {
        await reconcileNotifications();
      }
      setActionError(
        error instanceof ApiError
          ? error.userMessage
          : notificationMessages.errorDescription,
      );
    } finally {
      markingAllRef.current = false;
      setIsMarkingAll(false);
    }
  }

  const badgeText = String(unreadCount);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setActionError(null);
          setOpen(nextOpen);
        }}
      >
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative min-h-11 min-w-11 gap-1.5 px-3"
            aria-label={notificationMessages.bellLabel(unreadCount)}
          >
            <BellIcon />
            {unreadCount > 0 ? (
              <span
                aria-hidden="true"
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold leading-none text-primary-foreground"
              >
                {badgeText}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>

        <SheetContent
          side="right"
          onCloseAutoFocus={(event) => {
            if (skipCloseAutoFocusRef.current) {
              event.preventDefault();
              skipCloseAutoFocusRef.current = false;
            }
          }}
          className="flex flex-col gap-4 overflow-y-auto p-6"
        >
          <div className="space-y-1 pr-10">
            <SheetTitle className="text-xl font-bold text-foreground">
              {notificationMessages.trayTitle}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {notificationMessages.trayDescription}
            </SheetDescription>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={total === 0 || isMarkingAll}
              onClick={() => void handleMarkAllRead()}
            >
              {isMarkingAll
                ? notificationMessages.markingAllLabel
                : notificationMessages.markAllLabel}
            </Button>
          </div>

          {actionError ? (
            <Alert variant="destructive">
              <AlertTitle>{notificationMessages.actionErrorTitle}</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {query.isPending ? (
            <LoadingState label={notificationMessages.loadingLabel} />
          ) : query.isError && !query.data ? (
            <ErrorState
              headingLevel="h3"
              title={notificationMessages.errorTitle}
              description={
                query.error instanceof ApiError
                  ? query.error.userMessage
                  : notificationMessages.errorDescription
              }
              onRetry={() => {
                void query.refetch();
              }}
              isRetrying={query.isRefetching}
              retryLabel={notificationMessages.retryLabel}
            />
          ) : query.data ? (
            <div className="min-w-0 space-y-3">
              {query.isError ? (
                <StaleDataNotice
                  title={notificationMessages.staleTitle}
                  description={notificationMessages.staleDescription}
                  onRetry={() => {
                    void query.refetch();
                  }}
                  isRetrying={query.isRefetching}
                  retryLabel={notificationMessages.retryLabel}
                />
              ) : null}

              {items.length === 0 ? (
                <EmptyState
                  headingLevel="h3"
                  title={notificationMessages.emptyTitle}
                  description={notificationMessages.emptyDescription}
                />
              ) : (
                <>
                  <ul
                    aria-label={notificationMessages.trayTitle}
                    className="min-w-0 space-y-3"
                  >
                    {items.map((item) => {
                      const isUnread = item.readAt === null;
                      const isMarking = markingIds.includes(item.id);
                      const targetPath = getNotificationTargetPath(item);

                      return (
                        <li
                          key={item.id}
                          className="min-w-0 rounded-xl border border-edge bg-card p-3.5 shadow-xs"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {notificationMessages.kindTitles[item.kind]}
                              </p>
                              <Badge
                                variant={isUnread ? 'default' : 'secondary'}
                              >
                                {isUnread
                                  ? notificationMessages.unreadBadge
                                  : notificationMessages.readBadge}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <time dateTime={item.createdAt}>
                                {formatNotificationTime(item.createdAt)}
                              </time>
                              {item.studentId ? (
                                <span>
                                  {notificationMessages.studentContextLabel(
                                    item.studentId,
                                  )}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {targetPath ? (
                                <Link
                                  to={targetPath}
                                  onClick={() => {
                                    skipCloseAutoFocusRef.current = true;
                                    setOpen(false);
                                    if (isUnread) {
                                      void handleMarkRead(item);
                                    }
                                  }}
                                  className="inline-flex min-h-9 items-center rounded-md px-2 text-xs font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
                                >
                                  {notificationMessages.openTargetLabel}
                                </Link>
                              ) : null}

                              {isUnread ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isMarking || isMarkingAll}
                                  onClick={() => void handleMarkRead(item)}
                                >
                                  {isMarking
                                    ? notificationMessages.markingReadLabel
                                    : notificationMessages.markReadLabel}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {query.data.total > query.data.pageSize ? (
                    <PaginationControls
                      page={query.data.page}
                      pageSize={query.data.pageSize}
                      total={query.data.total}
                      onPageChange={(nextPage) => setPage(nextPage)}
                    />
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
