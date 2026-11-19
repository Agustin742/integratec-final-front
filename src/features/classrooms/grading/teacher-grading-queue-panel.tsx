import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomActivitiesQueryKey,
  classroomDetailQueryKey,
  classroomSubmissionsQueueQueryKey,
  createClassroomGradesPredicate,
  createClassroomSubmissionsQueuePredicate,
  type GradingQueueSortOrder,
  type GradingQueueStateFilter,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { listClassroomActivities } from '../activities/activity-service';
import { formatActivityDeadline } from '../activities/format-activity-deadline';
import { useClassroomContext } from '../use-classroom-capabilities';
import { gradingMessages } from './grading-messages';
import { GradingReviewDialog } from './grading-review-dialog';
import type { GradeResponseDto, GradingQueueItemDto } from './grading-schema';
import { listClassroomSubmissions } from './grading-service';

const PAGE_SIZE = 10;
const messages = gradingMessages.panel;
const filterMessages = gradingMessages.filters;

export interface TeacherGradingQueuePanelProps {
  readonly classroomId?: string;
  /** Pre-scopes the queue to a single activity (e.g. ActivityDetailPage review tab). */
  readonly fixedActivityId?: string;
  readonly fixedActivityTitle?: string;
  readonly fixedActivityMaxScore?: number;
  readonly fixedActivityFormat?: 'FILE' | 'MULTIPLE_CHOICE';
  readonly fixedActivityTimeZone?: string;
}

export function TeacherGradingQueuePanel(
  props: TeacherGradingQueuePanelProps = {},
) {
  const { classroomId: routeClassroomId } = useParams();
  const classroomId = (props.classroomId ?? routeClassroomId ?? '').trim();
  const sessionSnapshot = useSessionSnapshot();
  const userId =
    sessionSnapshot.status === 'authenticated' ? sessionSnapshot.user.id : null;

  return (
    <TeacherGradingQueuePanelContent
      key={`${userId ?? 'anon'}:${classroomId}`}
      {...props}
      classroomId={classroomId}
      userId={userId}
    />
  );
}

function TeacherGradingQueuePanelContent({
  classroomId,
  userId,
  fixedActivityId,
  fixedActivityTitle,
  fixedActivityMaxScore,
  fixedActivityFormat,
  fixedActivityTimeZone,
}: TeacherGradingQueuePanelProps & {
  readonly classroomId: string;
  readonly userId: string | null;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);

  const canGrade =
    context.status === 'ready' &&
    context.classroom.capabilities.includes('publish_content');

  const [selectedActivityId, setSelectedActivityId] = useState<string>(
    fixedActivityId ?? '',
  );
  const [stateFilter, setStateFilter] = useState<GradingQueueStateFilter | ''>(
    '',
  );
  const [sortOrder, setSortOrder] =
    useState<GradingQueueSortOrder>('submittedAt');
  const [page, setPage] = useState(1);
  const [activeSubmission, setActiveSubmission] =
    useState<GradingQueueItemDto | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const activityFilterId = useId();
  const stateFilterId = useId();
  const sortSelectId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const reconciledErrorRef = useRef<unknown>(null);

  const effectiveActivityId = fixedActivityId ?? selectedActivityId;

  // Populate classroom activities selector + activity maxScore/format map in classroom-wide mode.
  const activitiesLookupQuery = useQuery({
    queryKey: classroomActivitiesQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      { page: 1, pageSize: 100 },
    ),
    queryFn: ({ signal }) =>
      listClassroomActivities(
        client,
        classroomId,
        { page: 1, pageSize: 100 },
        { signal },
      ),
    enabled:
      Boolean(userId && classroomId) &&
      canGrade &&
      fixedActivityId === undefined,
    staleTime: 60_000,
    retry: false,
  });

  const activityMetaById = useMemo(() => {
    const map = new Map<
      string,
      {
        readonly maxScore: number;
        readonly format: 'FILE' | 'MULTIPLE_CHOICE';
        readonly timeZone: string;
      }
    >();
    if (fixedActivityId && fixedActivityMaxScore !== undefined) {
      map.set(fixedActivityId, {
        maxScore: fixedActivityMaxScore,
        format: fixedActivityFormat ?? 'FILE',
        timeZone: fixedActivityTimeZone ?? DEFAULT_SCHOOL_TIME_ZONE,
      });
    }
    for (const item of activitiesLookupQuery.data?.items ?? []) {
      map.set(item.id, {
        maxScore: item.maxScore,
        format: item.format,
        timeZone: item.timeZone,
      });
    }
    return map;
  }, [
    activitiesLookupQuery.data?.items,
    fixedActivityFormat,
    fixedActivityId,
    fixedActivityMaxScore,
    fixedActivityTimeZone,
  ]);

  const schoolTimeZone =
    fixedActivityTimeZone ??
    activitiesLookupQuery.data?.items[0]?.timeZone ??
    DEFAULT_SCHOOL_TIME_ZONE;

  const queueQueryParams = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(effectiveActivityId ? { activityId: effectiveActivityId } : {}),
      ...(stateFilter ? { state: stateFilter } : {}),
      sort: sortOrder,
    }),
    [effectiveActivityId, page, sortOrder, stateFilter],
  );

  const queueQueryKey = useMemo(
    () =>
      classroomSubmissionsQueueQueryKey(
        userId ?? 'anonymous',
        classroomId || 'unknown',
        queueQueryParams,
      ),
    [classroomId, queueQueryParams, userId],
  );

  const queueQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: ({ signal }) =>
      listClassroomSubmissions(client, classroomId, queueQueryParams, {
        signal,
      }),
    enabled: Boolean(userId && classroomId) && canGrade,
    placeholderData: (previousData, previousQuery) => {
      const prevScope = (
        previousQuery?.queryKey[0] as
          | {
              readonly scope?: {
                readonly userId?: string;
                readonly classroomId?: string;
              };
            }
          | undefined
      )?.scope;
      return prevScope?.userId === (userId ?? 'anonymous') &&
        prevScope?.classroomId === (classroomId || 'unknown')
        ? previousData
        : undefined;
    },
    retry: false,
  });

  // Evict private cache immediately on live SSE role demotion.
  useEffect(() => {
    if (!userId || !classroomId) {
      return;
    }
    if (context.status === 'ready' && !canGrade) {
      queryClient.removeQueries({
        predicate: createClassroomGradesPredicate(userId, classroomId),
      });
    }
  }, [canGrade, classroomId, context.status, queryClient, userId]);

  const errorStatus =
    queueQuery.error instanceof ApiError ? queueQuery.error.status : null;
  const isTerminalAccessError = errorStatus === 403 || errorStatus === 404;

  // Bounded non-looping 403/404 cleanup: remove inactive cached pages and
  // invalidate classroomDetailQueryKey at most once per error instance.
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
  } | null>(null);

  useEffect(() => {
    if (!queueQuery.isError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    if (!isTerminalAccessError || !userId || !classroomId) {
      return;
    }
    terminalCleanupRef.current = { userId, classroomId };
    queryClient.removeQueries({
      predicate: createClassroomSubmissionsQueuePredicate(userId, classroomId),
      type: 'inactive',
    });
    if (reconciledErrorRef.current !== queueQuery.error) {
      reconciledErrorRef.current = queueQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    classroomId,
    isTerminalAccessError,
    queryClient,
    queueQuery.error,
    queueQuery.isError,
    userId,
  ]);

  // Evict errored active queue query on unmount so re-entry starts cleanly.
  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createClassroomGradesPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
      }
    };
  }, [queryClient]);

  const reconcileGrades = useCallback(() => {
    if (!userId || !classroomId) {
      return;
    }
    void queryClient.invalidateQueries({
      predicate: createClassroomGradesPredicate(userId, classroomId),
    });
  }, [classroomId, queryClient, userId]);

  const handleGraded = useCallback(
    (grade: GradeResponseDto) => {
      setActiveSubmission((current) => {
        if (!current || current.id !== grade.submissionId) {
          return current;
        }
        return {
          ...current,
          status: 'graded',
          grade: {
            id: grade.id,
            graderId: grade.graderId,
            score: grade.score,
            feedback: grade.feedback,
            pointsAwarded: grade.pointsAwarded,
            version: grade.version,
            gradedAt: grade.gradedAt,
          },
        };
      });
      setAnnouncement(messages.liveQueueUpdated);
      reconcileGrades();
    },
    [reconcileGrades],
  );

  if (context.status === 'pending') {
    return <LoadingState label={messages.loading} />;
  }

  if (!canGrade) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.forbiddenTitle}
        description={messages.forbiddenDescription}
      />
    );
  }

  const effectiveActiveSubmission = isTerminalAccessError
    ? null
    : activeSubmission;

  const data = queueQuery.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOutOfRangePage = page > 1 && items.length === 0 && total > 0;
  const hasActiveFilters =
    stateFilter !== '' ||
    (fixedActivityId === undefined && selectedActivityId !== '');

  const selectedMeta = effectiveActiveSubmission
    ? activityMetaById.get(effectiveActiveSubmission.activityId)
    : undefined;

  return (
    <section
      aria-label={
        fixedActivityId ? messages.activityScopedHeading : messages.heading
      }
      className="space-y-4"
    >
      <LiveRegion message={announcement} visuallyHidden />

      <div className="space-y-1">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-foreground outline-none"
        >
          {fixedActivityId ? messages.activityScopedHeading : messages.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {fixedActivityId
            ? fixedActivityTitle
              ? `${messages.activityScopedDescription} (${fixedActivityTitle})`
              : messages.activityScopedDescription
            : messages.description}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fixedActivityId === undefined ? (
          <div className="space-y-1 sm:col-span-2">
            <label
              htmlFor={activityFilterId}
              className="block text-xs font-medium text-muted-foreground"
            >
              {filterMessages.activityLabel}
            </label>
            <select
              id={activityFilterId}
              value={selectedActivityId}
              onChange={(event) => {
                setSelectedActivityId(event.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{filterMessages.allActivities}</option>
              {(activitiesLookupQuery.data?.items ?? []).map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1">
          <label
            htmlFor={stateFilterId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {filterMessages.stateLabel}
          </label>
          <select
            id={stateFilterId}
            value={stateFilter}
            onChange={(event) => {
              const next = event.target.value;
              setStateFilter(
                next === 'submitted' || next === 'graded' ? next : '',
              );
              setPage(1);
            }}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{filterMessages.stateAll}</option>
            <option value="submitted">{filterMessages.stateSubmitted}</option>
            <option value="graded">{filterMessages.stateGraded}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label
            htmlFor={sortSelectId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {filterMessages.sortLabel}
          </label>
          <select
            id={sortSelectId}
            value={sortOrder}
            onChange={(event) => {
              const next = event.target.value;
              if (
                next === 'submittedAt' ||
                next === '-submittedAt' ||
                next === 'gradedAt' ||
                next === '-gradedAt'
              ) {
                setSortOrder(next);
                setPage(1);
              }
            }}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="submittedAt">
              {filterMessages.sortSubmittedAsc}
            </option>
            <option value="-submittedAt">
              {filterMessages.sortSubmittedDesc}
            </option>
            <option value="-gradedAt">{filterMessages.sortGradedDesc}</option>
            <option value="gradedAt">{filterMessages.sortGradedAsc}</option>
          </select>
        </div>
      </div>

      {queueQuery.isError && data !== undefined && !isTerminalAccessError ? (
        <StaleDataNotice
          title={messages.staleTitle}
          description={messages.staleDescription}
          onRetry={() => {
            void queueQuery.refetch();
          }}
        />
      ) : null}

      {queueQuery.isPending && data === undefined ? (
        <LoadingState label={messages.loading} />
      ) : isTerminalAccessError ? (
        <ErrorState
          headingLevel="h4"
          title={
            errorStatus === 403
              ? messages.forbiddenTitle
              : messages.notFoundTitle
          }
          description={
            errorStatus === 403
              ? messages.forbiddenDescription
              : messages.notFoundDescription
          }
        />
      ) : queueQuery.isError && data === undefined ? (
        <ErrorState
          headingLevel="h4"
          title={messages.loadErrorTitle}
          description={messages.loadErrorDescription}
          onRetry={() => {
            void queueQuery.refetch();
          }}
        />
      ) : isOutOfRangePage ? (
        <EmptyState
          headingLevel="h4"
          title={messages.outOfRangeTitle}
          description={messages.outOfRangeDescription}
          action={
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setPage(1)}
            >
              {messages.backToFirstPage}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={
            hasActiveFilters ? messages.filteredEmptyTitle : messages.emptyTitle
          }
          description={
            hasActiveFilters
              ? messages.filteredEmptyDescription
              : messages.emptyDescription
          }
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  if (fixedActivityId === undefined) {
                    setSelectedActivityId('');
                  }
                  setStateFilter('');
                  setPage(1);
                }}
              >
                {messages.clearFilters}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {messages.resultsSummary(items.length, total)}
          </p>

          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="space-y-3 rounded-xl border border-border bg-surface p-4"
              >
                {/* Full-width header above action row so titles never wrap narrowly on mobile 360px. */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={
                        item.status === 'graded' ? 'success' : 'secondary'
                      }
                    >
                      {item.status === 'graded'
                        ? gradingMessages.badges.graded
                        : gradingMessages.badges.submitted}
                    </Badge>
                    <Badge variant="outline">
                      {item.activityType === 'EXAM'
                        ? gradingMessages.badges.exam
                        : gradingMessages.badges.tp}
                    </Badge>
                    {item.isLate ? (
                      <Badge variant="warning">
                        {gradingMessages.badges.late}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="break-words text-sm font-semibold text-foreground">
                    {item.studentDisplayName}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {item.activityTitle}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {messages.submittedAtLabel}{' '}
                    <time dateTime={item.submittedAt}>
                      {formatActivityDeadline(
                        item.submittedAt,
                        activityMetaById.get(item.activityId)?.timeZone ??
                          schoolTimeZone,
                      )}
                    </time>
                  </span>
                  <span>{messages.fileCount(item.fileCount)}</span>
                  {item.grade ? (
                    <>
                      <span className="font-medium text-foreground">
                        {messages.scoreSummary(item.grade.score)}
                      </span>
                      <span>
                        {messages.pointsAwardedSummary(
                          item.grade.pointsAwarded,
                        )}
                      </span>
                      <span>{messages.versionLabel(item.grade.version)}</span>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant={item.grade ? 'outline' : 'default'}
                    size="sm"
                    className="min-h-11"
                    onClick={(event) => {
                      triggerElementRef.current = event.currentTarget;
                      setActiveSubmission(item);
                    }}
                  >
                    {item.grade
                      ? messages.openRegradeAction
                      : messages.openReviewAction}
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <PaginationControls
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      )}

      {userId && classroomId ? (
        <GradingReviewDialog
          key={effectiveActiveSubmission?.id ?? 'closed'}
          open={effectiveActiveSubmission !== null}
          classroomId={classroomId}
          userId={userId}
          submission={effectiveActiveSubmission}
          maxScore={selectedMeta?.maxScore ?? fixedActivityMaxScore}
          activityFormat={selectedMeta?.format ?? fixedActivityFormat}
          schoolTimeZone={selectedMeta?.timeZone ?? schoolTimeZone}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setActiveSubmission(null);
            }
          }}
          onGraded={handleGraded}
          onReconcileRequired={reconcileGrades}
          getTriggerElement={() => triggerElementRef.current}
          fallbackFocus={() => headingRef.current}
        />
      ) : null}
    </section>
  );
}
