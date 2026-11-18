import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomActivitiesQueryKey,
  classroomDetailQueryKey,
  createClassroomActivitiesPredicate,
  type ActivitySortOrder,
  type ActivityStateFilter,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Button, buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionService } from '@/session/provider';
import { useClassroomContext } from '../use-classroom-capabilities';
import { listClassroomActivities } from './activity-service';
import { formatActivityDeadline } from './format-activity-deadline';
import { activityMessages } from './messages';

const PAGE_SIZE = 10;

export function ActivitiesPanel() {
  const { classroomId } = useParams();
  const normalizedClassroomId = classroomId?.trim();
  if (!normalizedClassroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={activityMessages.errorTitle}
        description={activityMessages.errorDescription}
      />
    );
  }
  return (
    <ActivitiesPanelContent
      key={normalizedClassroomId}
      classroomId={normalizedClassroomId}
    />
  );
}

function ActivitiesPanelContent({ classroomId }: { classroomId: string }) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ActivitySortOrder>('dueAt');
  const [stateFilter, setStateFilter] = useState<ActivityStateFilter | 'ALL'>(
    'ALL',
  );
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
  } | null>(null);

  const userId = context.status === 'ready' ? context.userId : null;
  const isStaff =
    context.status === 'ready' &&
    context.classroom.capabilities.includes('publish_content');
  const effectiveState =
    isStaff && stateFilter !== 'ALL' ? stateFilter : undefined;

  const query = useQuery({
    queryKey: classroomActivitiesQueryKey(userId ?? 'signed-out', classroomId, {
      page,
      pageSize: PAGE_SIZE,
      sort,
      state: effectiveState,
    }),
    queryFn: ({ signal }) =>
      listClassroomActivities(
        client,
        classroomId,
        { page, pageSize: PAGE_SIZE, sort, state: effectiveState },
        { signal },
      ),
    enabled: userId !== null,
  });

  const listError = query.error instanceof ApiError ? query.error : null;
  const isAccessError =
    query.isError && (listError?.status === 403 || listError?.status === 404);

  useEffect(() => {
    if (!query.isError) {
      reconciledErrorRef.current = null;
      if (userId !== null) {
        terminalCleanupRef.current = null;
      }
      return;
    }
    if (userId === null || !isAccessError) {
      return;
    }
    terminalCleanupRef.current = { userId, classroomId };
    // Clear other cached pages/filters without deleting the active query,
    // which would otherwise recreate and refetch in a loop while mounted.
    queryClient.removeQueries({
      predicate: createClassroomActivitiesPredicate(userId, classroomId),
      type: 'inactive',
    });
    if (
      listError?.status === 404 &&
      reconciledErrorRef.current !== query.error
    ) {
      reconciledErrorRef.current = query.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    classroomId,
    isAccessError,
    listError?.status,
    query.error,
    query.isError,
    queryClient,
    userId,
  ]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createClassroomActivitiesPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
      }
    };
  }, [queryClient]);

  if (context.status === 'pending') {
    return <LoadingState label={activityMessages.loadingLabel} />;
  }

  if (context.status === 'error') {
    const isForbidden = context.error.status === 403;
    const isNotFound = context.error.status === 404;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          isForbidden
            ? activityMessages.forbiddenTitle
            : isNotFound
              ? activityMessages.notFoundTitle
              : activityMessages.errorTitle
        }
        description={
          isForbidden
            ? activityMessages.forbiddenDescription
            : isNotFound
              ? activityMessages.notFoundDescription
              : context.error.userMessage
        }
        onRetry={isForbidden || isNotFound ? undefined : context.retry}
        retryLabel={activityMessages.retryLabel}
      />
    );
  }

  const isTerminalListError =
    query.isError &&
    (listError?.status === 403 || listError?.status === 404 || !query.data);

  if (isTerminalListError) {
    const isForbidden = listError?.status === 403;
    const isNotFound = listError?.status === 404;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          isForbidden
            ? activityMessages.forbiddenTitle
            : isNotFound
              ? activityMessages.notFoundTitle
              : activityMessages.errorTitle
        }
        description={
          isForbidden
            ? activityMessages.forbiddenDescription
            : isNotFound
              ? activityMessages.notFoundDescription
              : (listError?.userMessage ?? activityMessages.errorDescription)
        }
        onRetry={
          isForbidden || isNotFound
            ? undefined
            : () => {
                void query.refetch();
              }
        }
        isRetrying={query.isRefetching}
        retryLabel={activityMessages.retryLabel}
      />
    );
  }

  const isOutOfRangePage =
    query.data !== undefined &&
    query.data.items.length === 0 &&
    page > 1 &&
    query.data.total > 0;
  const isFilteredEmpty =
    query.data !== undefined &&
    query.data.items.length === 0 &&
    query.data.total === 0 &&
    effectiveState !== undefined;

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
          {activityMessages.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {activityMessages.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-semibold text-foreground">
          <span>{activityMessages.sortLabel}</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ActivitySortOrder);
              setPage(1);
            }}
            className="min-h-11 rounded-xl border-2 border-field-border bg-card px-3 py-1.5 text-sm font-normal text-card-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
          >
            <option value="dueAt">{activityMessages.sortOptions.dueAt}</option>
            <option value="-dueAt">
              {activityMessages.sortOptions['-dueAt']}
            </option>
            <option value="-createdAt">
              {activityMessages.sortOptions['-createdAt']}
            </option>
            <option value="createdAt">
              {activityMessages.sortOptions.createdAt}
            </option>
          </select>
        </label>

        {isStaff ? (
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            <span>{activityMessages.stateFilterLabel}</span>
            <select
              value={stateFilter}
              onChange={(event) => {
                setStateFilter(
                  event.target.value as ActivityStateFilter | 'ALL',
                );
                setPage(1);
              }}
              className="min-h-11 rounded-xl border-2 border-field-border bg-card px-3 py-1.5 text-sm font-normal text-card-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
            >
              <option value="ALL">{activityMessages.stateFilterAll}</option>
              <option value="PUBLISHED">
                {activityMessages.stateLabels.PUBLISHED}
              </option>
              <option value="DRAFT">
                {activityMessages.stateLabels.DRAFT}
              </option>
            </select>
          </label>
        ) : null}
      </div>

      {query.isPending ? (
        <LoadingState label={activityMessages.loadingLabel} />
      ) : query.data ? (
        <div className="min-w-0 space-y-4">
          {query.isError ? (
            <StaleDataNotice
              title={activityMessages.staleTitle}
              description={activityMessages.staleDescription}
              onRetry={() => {
                void query.refetch();
              }}
              isRetrying={query.isRefetching}
              retryLabel={activityMessages.retryLabel}
            />
          ) : null}

          {query.data.items.length === 0 ? (
            <EmptyState
              headingLevel="h4"
              title={
                isOutOfRangePage
                  ? activityMessages.emptyPageTitle
                  : activityMessages.emptyTitle
              }
              description={
                isOutOfRangePage
                  ? activityMessages.emptyPageDescription
                  : isFilteredEmpty
                    ? activityMessages.emptyFilteredDescription
                    : activityMessages.emptyDescription
              }
              action={
                isOutOfRangePage ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(1)}
                  >
                    {activityMessages.backToFirstPageLabel}
                  </Button>
                ) : isFilteredEmpty ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setStateFilter('ALL');
                      setPage(1);
                    }}
                  >
                    {activityMessages.clearFilterLabel}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul
                aria-label={activityMessages.listRegionLabel}
                className="min-w-0 space-y-3"
              >
                {query.data.items.map((item) => (
                  <li
                    key={item.id}
                    className="min-w-0 rounded-xl border border-edge bg-card p-4 shadow-xs"
                  >
                    <article className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="break-words text-base font-semibold text-foreground">
                            {item.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">
                              {activityMessages.typeLabels[item.type]}
                            </Badge>
                            <Badge variant="outline">
                              {activityMessages.formatLabels[item.format]}
                            </Badge>
                            {isStaff ? (
                              <Badge
                                variant={
                                  item.state === 'PUBLISHED'
                                    ? 'default'
                                    : 'outline'
                                }
                              >
                                {activityMessages.stateLabels[item.state]}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <Link
                          to={`/classrooms/${encodeURIComponent(classroomId)}/activities/${encodeURIComponent(item.id)}`}
                          aria-label={`${activityMessages.openDetailLabel}: ${item.title}`}
                          className={cn(
                            buttonStyles({ variant: 'outline', size: 'sm' }),
                            'shrink-0',
                          )}
                        >
                          {activityMessages.openDetailLabel}
                        </Link>
                      </div>

                      {item.description ? (
                        <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {activityMessages.dueAtLabel}{' '}
                          <time dateTime={item.dueAt}>
                            {formatActivityDeadline(item.dueAt, item.timeZone)}
                          </time>
                        </span>
                        <span>
                          {activityMessages.weightLabel(item.weightMultiplier)}
                        </span>
                        <span>
                          {item.allowLate
                            ? activityMessages.lateAllowedLabel
                            : activityMessages.lateDisallowedLabel}
                        </span>
                        {item.format === 'MULTIPLE_CHOICE' ? (
                          <span>
                            {activityMessages.questionCountLabel(
                              item.questionCount,
                            )}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>

              {query.data.total > query.data.pageSize ? (
                <PaginationControls
                  page={query.data.page}
                  pageSize={query.data.pageSize}
                  total={query.data.total}
                  busy={query.isFetching}
                  onPageChange={(nextPage) => setPage(nextPage)}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
