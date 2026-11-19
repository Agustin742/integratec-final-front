import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  activityForumPostsQueryKey,
  activityForumThreadsQueryKey,
  classroomActivityDetailQueryKey,
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
  createActivityForumPredicate,
  type ForumSortOrder,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import {
  FormField,
  FormRootError,
  useProtectedSubmit,
  useZodForm,
} from '@/components/forms/form-primitives';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { useClassroomContext } from '../../use-classroom-capabilities';
import type { ActivityDetailDto } from '../activity-schema';
import { formatActivityDeadline } from '../format-activity-deadline';
import { forumMessages } from './forum-messages';
import {
  FORUM_POST_BODY_MAX_LENGTH,
  forumComposerSchema,
  type ClassroomDirectoryMemberDto,
  type ForumComposerInput,
} from './forum-schema';
import {
  createActivityForumPost,
  createActivityForumThread,
  isAbortError,
  isUncertainForumWriteError,
  listActivityForumPosts,
  listActivityForumThreads,
  listClassroomDirectoryMembers,
} from './forum-service';

const THREADS_PAGE_SIZE = 10;
const POSTS_PAGE_SIZE = 20;

export interface ActivityForumPanelProps {
  readonly activity: ActivityDetailDto;
  readonly classroomId?: string;
}

interface AuthorPresentation {
  readonly label: string;
  readonly roleLabel: string | null;
  readonly roleVariant: 'default' | 'secondary' | 'outline';
}

function resolveAuthor(
  authorId: string,
  currentUserId: string,
  membersByUserId: ReadonlyMap<string, ClassroomDirectoryMemberDto>,
): AuthorPresentation {
  const directoryEntry = membersByUserId.get(authorId);
  const roleLabel =
    directoryEntry?.role === 'TEACHER'
      ? forumMessages.posts.roleTeacherBadge
      : directoryEntry?.role === 'STUDENT'
        ? forumMessages.posts.roleStudentBadge
        : null;
  const roleVariant =
    directoryEntry?.role === 'TEACHER' ? 'default' : 'outline';

  if (authorId === currentUserId) {
    return {
      label: directoryEntry
        ? `${directoryEntry.displayName} (${forumMessages.posts.authorSelf})`
        : forumMessages.posts.authorSelf,
      roleLabel,
      roleVariant,
    };
  }

  return {
    label: directoryEntry?.displayName ?? forumMessages.posts.authorFallback,
    roleLabel,
    roleVariant,
  };
}

export function ActivityForumPanel({
  activity,
  classroomId: explicitClassroomId,
}: ActivityForumPanelProps) {
  const { classroomId: routeClassroomId } = useParams();
  const classroomId = (explicitClassroomId ?? routeClassroomId ?? '').trim();
  const sessionSnapshot = useSessionSnapshot();
  const userId =
    sessionSnapshot.status === 'authenticated' ? sessionSnapshot.user.id : null;

  return (
    <ActivityForumScoped
      key={`${userId ?? 'anon'}:${classroomId || 'unknown'}:${activity.id}`}
      activity={activity}
      classroomId={classroomId}
      userId={userId}
    />
  );
}

interface ActivityForumScopedProps {
  readonly activity: ActivityDetailDto;
  readonly classroomId: string;
  readonly userId: string | null;
}

function ActivityForumScoped({
  activity,
  classroomId,
  userId,
}: ActivityForumScopedProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);

  const canParticipateForum =
    context.status === 'ready' &&
    (context.classroom.capabilities.includes('publish_content') ||
      context.classroom.capabilities.includes('participate_activities'));
  const canListDirectory =
    context.status === 'ready' &&
    context.classroom.capabilities.includes('list_directory');

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadSort, setThreadSort] = useState<ForumSortOrder>('-createdAt');
  const [threadsPage, setThreadsPage] = useState(1);
  const [announcement, setAnnouncement] = useState('');
  const [uncertainCreateNotice, setUncertainCreateNotice] = useState(false);

  const sortSelectId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const returnTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
    readonly activityId: string;
  } | null>(null);

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Optional non-blocking directory lookup for display names and Teacher/Student badges.
  const membersQuery = useQuery({
    queryKey: classroomDirectoryMembersQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      { page: 1, pageSize: 100 },
    ),
    queryFn: ({ signal }) =>
      listClassroomDirectoryMembers(
        client,
        classroomId,
        { page: 1, pageSize: 100 },
        { signal },
      ),
    enabled:
      Boolean(userId && classroomId) && canParticipateForum && canListDirectory,
    staleTime: 60_000,
    retry: false,
  });

  const membersByUserId = useMemo(() => {
    const map = new Map<string, ClassroomDirectoryMemberDto>();
    for (const member of membersQuery.data?.items ?? []) {
      map.set(member.userId, member);
    }
    return map;
  }, [membersQuery.data?.items]);

  const threadsQueryParams = useMemo(
    () => ({
      page: threadsPage,
      pageSize: THREADS_PAGE_SIZE,
      sort: threadSort,
    }),
    [threadSort, threadsPage],
  );

  const threadsQuery = useQuery({
    queryKey: activityForumThreadsQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      activity.id,
      threadsQueryParams,
    ),
    queryFn: ({ signal }) =>
      listActivityForumThreads(
        client,
        classroomId,
        activity.id,
        threadsQueryParams,
        { signal },
      ),
    enabled: Boolean(userId && classroomId) && canParticipateForum,
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const threadsErrorStatus =
    threadsQuery.error instanceof ApiError ? threadsQuery.error.status : null;
  const isTerminalThreadsError =
    threadsErrorStatus === 403 || threadsErrorStatus === 404;

  // Bounded non-looping 403/404 cleanup: evict inactive pages and reconcile activity/classroom.
  useEffect(() => {
    if (!threadsQuery.isError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    if (!isTerminalThreadsError || !userId || !classroomId) {
      return;
    }
    terminalCleanupRef.current = {
      userId,
      classroomId,
      activityId: activity.id,
    };
    queryClient.removeQueries({
      predicate: createActivityForumPredicate(userId, classroomId, activity.id),
      type: 'inactive',
    });
    if (reconciledErrorRef.current !== threadsQuery.error) {
      reconciledErrorRef.current = threadsQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomActivityDetailQueryKey(
          userId,
          classroomId,
          activity.id,
        ),
        exact: true,
      });
      if (threadsErrorStatus === 404) {
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      }
    }
  }, [
    activity.id,
    classroomId,
    isTerminalThreadsError,
    queryClient,
    threadsErrorStatus,
    threadsQuery.error,
    threadsQuery.isError,
    userId,
  ]);

  // Evict forum cache immediately on role demotion or unmount after 403/404.
  useEffect(() => {
    if (!userId || !classroomId) {
      return;
    }
    if (context.status === 'ready' && !canParticipateForum) {
      queryClient.removeQueries({
        predicate: createActivityForumPredicate(
          userId,
          classroomId,
          activity.id,
        ),
      });
    }
  }, [
    activity.id,
    canParticipateForum,
    classroomId,
    context.status,
    queryClient,
    userId,
  ]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createActivityForumPredicate(
            cleanup.userId,
            cleanup.classroomId,
            cleanup.activityId,
          ),
        });
      }
    };
  }, [queryClient]);

  const reconcileForum = useCallback(() => {
    if (!userId || !classroomId) {
      return;
    }
    void queryClient.invalidateQueries({
      predicate: createActivityForumPredicate(userId, classroomId, activity.id),
    });
  }, [activity.id, classroomId, queryClient, userId]);

  const threadForm = useZodForm<ForumComposerInput, { body: string }>({
    schema: forumComposerSchema,
    defaultValues: { body: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const newThreadBodyValue = useWatch({
    control: threadForm.control,
    name: 'body',
  });

  const {
    isSubmitting: isCreatingThread,
    handleSubmit: handleCreateThreadSubmit,
  } = useProtectedSubmit(
    threadForm,
    async (values) => {
      if (!userId || !classroomId) {
        return;
      }
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setUncertainCreateNotice(false);

      try {
        const created = await createActivityForumThread(
          client,
          classroomId,
          activity.id,
          values.body,
          { signal: controller.signal },
        );
        if (!isMountedRef.current) {
          return;
        }
        threadForm.reset({ body: '' });
        toast.success(forumMessages.composer.threadCreatedToast);
        setAnnouncement(forumMessages.composer.threadCreatedToast);
        setThreadsPage(1);
        setSelectedThreadId(created.id);
        reconcileForum();
      } catch (error) {
        if (isAbortError(error) || !isMountedRef.current) {
          return;
        }
        if (isUncertainForumWriteError(error)) {
          setUncertainCreateNotice(true);
          await threadsQuery.refetch();
          if (!isMountedRef.current) {
            return;
          }
          threadForm.setError('root.serverError', {
            type: 'server',
            message: forumMessages.composer.uncertainNotice,
          });
          return;
        }
        if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          reconcileForum();
          void queryClient.invalidateQueries({
            queryKey: classroomActivityDetailQueryKey(
              userId,
              classroomId,
              activity.id,
            ),
            exact: true,
          });
        }
        throw error;
      }
    },
    { knownFields: ['body'] },
  );

  if (context.status === 'pending') {
    return <LoadingState label={forumMessages.threads.loading} />;
  }

  if (!canParticipateForum || !userId || !classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={forumMessages.access.deniedTitle}
        description={forumMessages.access.deniedDescription}
      />
    );
  }

  const effectiveSelectedThreadId = isTerminalThreadsError
    ? null
    : selectedThreadId;

  const threadsData = threadsQuery.data;
  const threadItems = threadsData?.items ?? [];
  const totalThreads = threadsData?.total ?? 0;
  const totalThreadPages = Math.max(
    1,
    Math.ceil(totalThreads / THREADS_PAGE_SIZE),
  );
  const isOutOfRangePage =
    threadsPage > 1 && threadItems.length === 0 && totalThreads > 0;

  if (effectiveSelectedThreadId !== null) {
    const summaryItem =
      threadItems.find((item) => item.id === effectiveSelectedThreadId) ?? null;
    return (
      <ActivityForumThreadDetail
        classroomId={classroomId}
        userId={userId}
        activity={activity}
        threadId={effectiveSelectedThreadId}
        threadSummaryAuthorId={summaryItem?.authorId ?? null}
        membersByUserId={membersByUserId}
        onBack={() => {
          setSelectedThreadId(null);
          requestAnimationFrame(() => {
            if (returnTriggerRef.current?.isConnected) {
              returnTriggerRef.current.focus();
            } else {
              headingRef.current?.focus();
            }
          });
        }}
        onReconcileForum={reconcileForum}
      />
    );
  }

  return (
    <section aria-label={forumMessages.header.title} className="space-y-5">
      <LiveRegion message={announcement} visuallyHidden />

      <div className="space-y-1">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-foreground outline-none"
        >
          {forumMessages.header.title}
        </h3>
        <p className="text-sm text-muted-foreground">
          {forumMessages.header.subtitle}
        </p>
      </div>

      {/* New query thread composer (never shown when forum access is terminally rejected) */}
      {!isTerminalThreadsError ? (
        <form
          onSubmit={(event) => {
            void handleCreateThreadSubmit(event);
          }}
          noValidate
          className="space-y-3 rounded-xl border border-edge bg-card p-4 shadow-xs"
        >
          <h4 className="text-sm font-semibold text-foreground">
            {forumMessages.composer.newThreadTitle}
          </h4>

          {uncertainCreateNotice ? (
            <Alert role="status">
              <AlertDescription>
                {forumMessages.composer.uncertainNotice}
              </AlertDescription>
            </Alert>
          ) : (
            <FormRootError form={threadForm} headingLevel="h5" />
          )}

          {isCreatingThread ? (
            <Alert role="status">
              <AlertDescription>
                {forumMessages.composer.pendingNotice}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            control={threadForm.control}
            name="body"
            label={forumMessages.composer.newThreadLabel}
            description={forumMessages.composer.charCounter(
              newThreadBodyValue.trim().length,
              FORUM_POST_BODY_MAX_LENGTH,
            )}
          >
            {(field) => (
              <textarea
                {...field}
                rows={3}
                maxLength={FORUM_POST_BODY_MAX_LENGTH}
                placeholder={forumMessages.composer.newThreadPlaceholder}
                disabled={isCreatingThread}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  field['aria-invalid'] && 'border-destructive',
                )}
              />
            )}
          </FormField>

          <div className="flex justify-end">
            <Button
              type="submit"
              className="min-h-11"
              disabled={isCreatingThread}
            >
              {isCreatingThread
                ? forumMessages.composer.newThreadSubmitting
                : forumMessages.composer.newThreadSubmit}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">
          {forumMessages.threads.sectionTitle}
        </h4>
        <div className="space-y-1">
          <label
            htmlFor={sortSelectId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {forumMessages.threads.sortLabel}
          </label>
          <select
            id={sortSelectId}
            value={threadSort}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'createdAt' || next === '-createdAt') {
                setThreadSort(next);
                setThreadsPage(1);
              }
            }}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="-createdAt">
              {forumMessages.threads.sortNewest}
            </option>
            <option value="createdAt">
              {forumMessages.threads.sortOldest}
            </option>
          </select>
        </div>
      </div>

      {threadsQuery.isError &&
      threadsData !== undefined &&
      !isTerminalThreadsError ? (
        <StaleDataNotice
          title={forumMessages.threads.staleTitle}
          description={forumMessages.threads.staleDescription}
          onRetry={() => {
            void threadsQuery.refetch();
          }}
        />
      ) : null}

      {threadsQuery.isPending && threadsData === undefined ? (
        <LoadingState label={forumMessages.threads.loading} />
      ) : isTerminalThreadsError ? (
        <ErrorState
          headingLevel="h4"
          title={
            threadsErrorStatus === 403
              ? forumMessages.threads.forbiddenTitle
              : forumMessages.threads.notFoundTitle
          }
          description={
            threadsErrorStatus === 403
              ? forumMessages.threads.forbiddenDescription
              : forumMessages.threads.notFoundDescription
          }
        />
      ) : threadsQuery.isError && threadsData === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={forumMessages.threads.loadErrorTitle}
          description={forumMessages.threads.loadErrorDescription}
          onRetry={() => {
            void threadsQuery.refetch();
          }}
        />
      ) : isOutOfRangePage ? (
        <EmptyState
          headingLevel="h4"
          title={forumMessages.threads.outOfRangeTitle}
          description={forumMessages.threads.outOfRangeDescription}
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setThreadsPage(1)}
            >
              {forumMessages.threads.backToFirstPage}
            </Button>
          }
        />
      ) : threadItems.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={forumMessages.threads.emptyTitle}
          description={forumMessages.threads.emptyDescription}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {forumMessages.threads.resultsSummary(
              threadItems.length,
              totalThreads,
            )}
          </p>

          <ul className="space-y-3">
            {threadItems.map((thread) => {
              const author = resolveAuthor(
                thread.authorId,
                userId,
                membersByUserId,
              );
              return (
                <li
                  key={thread.id}
                  className="space-y-3 rounded-xl border border-edge bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {author.label}
                      </span>
                      {author.roleLabel ? (
                        <Badge variant={author.roleVariant}>
                          {author.roleLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <Badge variant="secondary">
                      {forumMessages.threads.replyCountLabel(thread.replyCount)}
                    </Badge>
                  </div>

                  {/* Strict plain text node rendering (never dangerouslySetInnerHTML) */}
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {thread.firstPostBody}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground">
                      {forumMessages.threads.createdAtPrefix}{' '}
                      {formatActivityDeadline(
                        thread.createdAt,
                        activity.timeZone,
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11"
                      onClick={(event) => {
                        returnTriggerRef.current = event.currentTarget;
                        setSelectedThreadId(thread.id);
                      }}
                    >
                      {forumMessages.threads.openThreadAction}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalThreadPages > 1 ? (
            <PaginationControls
              page={threadsPage}
              pageSize={THREADS_PAGE_SIZE}
              total={totalThreads}
              onPageChange={setThreadsPage}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

interface ActivityForumThreadDetailProps {
  readonly classroomId: string;
  readonly userId: string;
  readonly activity: ActivityDetailDto;
  readonly threadId: string;
  readonly threadSummaryAuthorId: string | null;
  readonly membersByUserId: ReadonlyMap<string, ClassroomDirectoryMemberDto>;
  readonly onBack: () => void;
  readonly onReconcileForum: () => void;
}

function ActivityForumThreadDetail({
  classroomId,
  userId,
  activity,
  threadId,
  membersByUserId,
  onBack,
  onReconcileForum,
}: ActivityForumThreadDetailProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();

  const [postsSort, setPostsSort] = useState<ForumSortOrder>('createdAt');
  const [postsPage, setPostsPage] = useState(1);
  const [announcement, setAnnouncement] = useState('');
  const [uncertainReplyNotice, setUncertainReplyNotice] = useState(false);

  const sortSelectId = useId();
  const detailHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    detailHeadingRef.current?.focus();
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [threadId]);

  const postsQueryParams = useMemo(
    () => ({
      page: postsPage,
      pageSize: POSTS_PAGE_SIZE,
      sort: postsSort,
    }),
    [postsPage, postsSort],
  );

  const postsQuery = useQuery({
    queryKey: activityForumPostsQueryKey(
      userId,
      classroomId,
      activity.id,
      threadId,
      postsQueryParams,
    ),
    queryFn: ({ signal }) =>
      listActivityForumPosts(
        client,
        classroomId,
        activity.id,
        threadId,
        postsQueryParams,
        { signal },
      ),
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const postsErrorStatus =
    postsQuery.error instanceof ApiError ? postsQuery.error.status : null;
  const isTerminalPostsError =
    postsErrorStatus === 403 || postsErrorStatus === 404;

  const replyForm = useZodForm<ForumComposerInput, { body: string }>({
    schema: forumComposerSchema,
    defaultValues: { body: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const replyBodyValue = useWatch({
    control: replyForm.control,
    name: 'body',
  });

  const { isSubmitting: isReplying, handleSubmit: handleReplySubmit } =
    useProtectedSubmit(
      replyForm,
      async (values) => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setUncertainReplyNotice(false);

        try {
          await createActivityForumPost(
            client,
            classroomId,
            activity.id,
            threadId,
            values.body,
            { signal: controller.signal },
          );
          if (!isMountedRef.current) {
            return;
          }
          replyForm.reset({ body: '' });
          toast.success(forumMessages.composer.replyCreatedToast);
          setAnnouncement(forumMessages.composer.replyCreatedToast);
          onReconcileForum();
        } catch (error) {
          if (isAbortError(error) || !isMountedRef.current) {
            return;
          }
          if (isUncertainForumWriteError(error)) {
            setUncertainReplyNotice(true);
            await postsQuery.refetch();
            onReconcileForum();
            if (!isMountedRef.current) {
              return;
            }
            replyForm.setError('root.serverError', {
              type: 'server',
              message: forumMessages.composer.uncertainNotice,
            });
            return;
          }
          if (
            error instanceof ApiError &&
            (error.status === 403 || error.status === 404)
          ) {
            onReconcileForum();
            void queryClient.invalidateQueries({
              queryKey: classroomActivityDetailQueryKey(
                userId,
                classroomId,
                activity.id,
              ),
              exact: true,
            });
          }
          throw error;
        }
      },
      { knownFields: ['body'] },
    );

  const postsData = postsQuery.data;
  const posts = postsData?.items ?? [];
  const totalPosts = postsData?.total ?? 0;
  const totalPostsPages = Math.max(1, Math.ceil(totalPosts / POSTS_PAGE_SIZE));
  const isOutOfRangePage =
    postsPage > 1 && posts.length === 0 && totalPosts > 0;

  return (
    <section
      aria-label={forumMessages.posts.threadHeading}
      className="space-y-5"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={onBack}
          >
            {forumMessages.posts.backToList}
          </Button>
          <h3
            ref={detailHeadingRef}
            tabIndex={-1}
            className="text-base font-semibold text-foreground outline-none"
          >
            {forumMessages.posts.threadHeading}
          </h3>
        </div>

        <div className="space-y-1">
          <label
            htmlFor={sortSelectId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {forumMessages.posts.sortLabel}
          </label>
          <select
            id={sortSelectId}
            value={postsSort}
            onChange={(event) => {
              const next = event.target.value;
              if (next === 'createdAt' || next === '-createdAt') {
                setPostsSort(next);
                setPostsPage(1);
              }
            }}
            className="min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="createdAt">{forumMessages.posts.sortOldest}</option>
            <option value="-createdAt">{forumMessages.posts.sortNewest}</option>
          </select>
        </div>
      </div>

      {postsQuery.isError &&
      postsData !== undefined &&
      !isTerminalPostsError ? (
        <StaleDataNotice
          title={forumMessages.posts.staleTitle}
          description={forumMessages.posts.staleDescription}
          onRetry={() => {
            void postsQuery.refetch();
          }}
        />
      ) : null}

      {postsQuery.isPending && postsData === undefined ? (
        <LoadingState label={forumMessages.posts.loading} />
      ) : isTerminalPostsError ? (
        <ErrorState
          headingLevel="h4"
          title={
            postsErrorStatus === 403
              ? forumMessages.threads.forbiddenTitle
              : forumMessages.posts.notFoundTitle
          }
          description={
            postsErrorStatus === 403
              ? forumMessages.threads.forbiddenDescription
              : forumMessages.posts.notFoundDescription
          }
        />
      ) : postsQuery.isError && postsData === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={forumMessages.posts.loadErrorTitle}
          description={forumMessages.posts.loadErrorDescription}
          onRetry={() => {
            void postsQuery.refetch();
          }}
        />
      ) : isOutOfRangePage ? (
        <EmptyState
          headingLevel="h4"
          title={forumMessages.posts.outOfRangeTitle}
          description={forumMessages.posts.outOfRangeDescription}
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setPostsPage(1)}
            >
              {forumMessages.posts.backToFirstPage}
            </Button>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={forumMessages.posts.emptyTitle}
          description={forumMessages.posts.emptyDescription}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {forumMessages.posts.summary(posts.length, totalPosts)}
          </p>

          <ol className="space-y-3">
            {posts.map((post) => {
              const author = resolveAuthor(
                post.authorId,
                userId,
                membersByUserId,
              );
              return (
                <li
                  key={post.id}
                  className="space-y-2 rounded-xl border border-edge bg-card p-4 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {author.label}
                      </span>
                      {author.roleLabel ? (
                        <Badge variant={author.roleVariant}>
                          {author.roleLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatActivityDeadline(
                        post.createdAt,
                        activity.timeZone,
                      )}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {post.body}
                  </p>
                </li>
              );
            })}
          </ol>

          {totalPostsPages > 1 ? (
            <PaginationControls
              page={postsPage}
              pageSize={POSTS_PAGE_SIZE}
              total={totalPosts}
              onPageChange={setPostsPage}
            />
          ) : null}
        </div>
      )}

      {!isTerminalPostsError ? (
        <form
          onSubmit={(event) => {
            void handleReplySubmit(event);
          }}
          noValidate
          className="space-y-3 rounded-xl border border-edge bg-card p-4 shadow-xs"
        >
          <h4 className="text-sm font-semibold text-foreground">
            {forumMessages.composer.replyTitle}
          </h4>

          {uncertainReplyNotice ? (
            <Alert role="status">
              <AlertDescription>
                {forumMessages.composer.uncertainNotice}
              </AlertDescription>
            </Alert>
          ) : (
            <FormRootError form={replyForm} headingLevel="h5" />
          )}

          {isReplying ? (
            <Alert role="status">
              <AlertDescription>
                {forumMessages.composer.pendingNotice}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            control={replyForm.control}
            name="body"
            label={forumMessages.composer.replyLabel}
            description={forumMessages.composer.charCounter(
              replyBodyValue.trim().length,
              FORUM_POST_BODY_MAX_LENGTH,
            )}
          >
            {(field) => (
              <textarea
                {...field}
                rows={3}
                maxLength={FORUM_POST_BODY_MAX_LENGTH}
                placeholder={forumMessages.composer.replyPlaceholder}
                disabled={isReplying}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
                  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  field['aria-invalid'] && 'border-destructive',
                )}
              />
            )}
          </FormField>

          <div className="flex justify-end">
            <Button type="submit" className="min-h-11" disabled={isReplying}>
              {isReplying
                ? forumMessages.composer.replySubmitting
                : forumMessages.composer.replySubmit}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
