import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomActivityMetricsQueryKey,
  classroomDetailQueryKey,
  createClassroomActivityMetricsPredicate,
  createOwnActivityMetricsPredicate,
  createStudentReportCardPredicate,
  ownActivityMetricsQueryKey,
  studentReportCardQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { DEFAULT_PAGE_SIZE } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { formatDateOnly, formatInstant } from '@/lib/dates';
import { WalletPanel } from '@/features/points/wallet-panel';
import { useSessionService } from '@/session/provider';
import { useClassroomContext } from '../use-classroom-capabilities';
import { formatConnectedSeconds } from './format-connected-seconds';
import {
  fetchClassroomMetrics,
  fetchOwnDailyMetrics,
  fetchStudentReportCard,
} from './grades-service';
import type {
  DailyMetricDto,
  ReportCardItemDto,
  StudentMetricSummaryDto,
} from './grades-schema';
import { gradesMessages } from './messages';

const messages = gradesMessages;

/**
 * Grades panel (`#46`, HU-ACT-005): the server-confirmed classroom `grades`
 * panel. Students read their report card (grades, feedback, points per
 * activity), own participation metrics and the wallet component; teaching
 * staff read the raw per-student activity totals of the classroom. Every
 * displayed value comes from the server; the client never computes, grades,
 * or aggregates (`rules/activities-and-grading.md`). Parents reach the panel
 * too (`view_metrics` availability) but the student endpoints answer 403
 * until HU-ACT-006 lands; that refusal is shown honestly.
 */
export function GradesPanel() {
  const params = useParams<{ classroomId: string }>();
  const classroomId = (params.classroomId ?? '').trim();
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={messages.student.errorTitle}
        description={messages.error.unexpected}
      />
    );
  }
  return <GradesPanelContent key={classroomId} classroomId={classroomId} />;
}

function GradesPanelContent({ classroomId }: { classroomId: string }) {
  const context = useClassroomContext(classroomId);

  if (context.status === 'pending') {
    return <LoadingState label={messages.student.loadingLabel} />;
  }

  if (context.status === 'error') {
    const isForbidden = context.error.status === 403;
    const isNotFound = context.error.status === 404;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          isForbidden
            ? messages.context.forbiddenTitle
            : isNotFound
              ? messages.context.notFoundTitle
              : messages.context.errorTitle
        }
        description={
          isForbidden
            ? messages.context.forbiddenDescription
            : isNotFound
              ? messages.context.notFoundDescription
              : context.error.userMessage
        }
        onRetry={isForbidden || isNotFound ? undefined : context.retry}
        retryLabel={messages.context.retryLabel}
      />
    );
  }

  const myRole = context.classroom.myRole;
  if (myRole === 'PARENT') {
    return (
      <EmptyState
        headingLevel="h3"
        title={messages.parent.title}
        description={messages.parent.description}
      />
    );
  }

  const isStaff =
    myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'TEACHER';

  return isStaff ? (
    <TeacherMetricsView
      key={`teacher:${context.userId}:${classroomId}`}
      classroomId={classroomId}
      userId={context.userId}
    />
  ) : (
    <StudentGradesView
      key={`student:${context.userId}:${classroomId}`}
      classroomId={classroomId}
      userId={context.userId}
    />
  );
}

/** Mirrors the roster precedent: raw ISO fallback when a value cannot parse. */
function formatGradedInstant(iso: string): string {
  try {
    return formatInstant(iso);
  } catch {
    return iso;
  }
}

function formatMetricDay(day: string): string {
  try {
    // UTC calendar day (`rules/data-and-time.md`): never shifted by the
    // browser time zone.
    return formatDateOnly(day);
  } catch {
    return day;
  }
}

/** Signed text so the direction is never signaled by color alone. */
function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

function ReportCardItem({ item }: { readonly item: ReportCardItemDto }) {
  const student = messages.student;
  const ratio = item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
  return (
    <li className="min-w-0">
      <article className="grid min-w-0 gap-4 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col justify-center gap-2 rounded-xl bg-tray px-3 py-3 text-center shadow-inset">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {student.scoreLabel}
          </p>
          <p className="font-display text-3xl leading-none font-semibold text-foreground">
            {item.score} / {item.maxScore}
          </p>
          <div
            role="meter"
            aria-label={student.meterLabel(item.score, item.maxScore)}
            aria-valuemin={0}
            aria-valuemax={item.maxScore}
            aria-valuenow={item.score}
            className="h-2 overflow-hidden rounded-full bg-edge"
          >
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${ratio}%` }}
            />
          </div>
        </div>
        <div className="min-w-0 space-y-2.5">
          <div className="min-w-0 space-y-1.5">
            <h4 className="font-display text-base font-semibold break-words text-foreground">
              {item.activityTitle}
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {student.typeLabels[item.activityType]}
              </Badge>
              {item.isLate ? (
                <Badge variant="outline">{student.lateBadge}</Badge>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 space-y-1 border-t border-edge/60 pt-2.5">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {student.feedbackLabel}
            </p>
            {/* The server-written feedback is rendered verbatim, never reinvented. */}
            <p className="text-sm text-pretty text-foreground wrap-anywhere">
              {item.feedback}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {student.pointsLabel} {formatPoints(item.pointsAwarded)}
            </span>
            <span>
              {student.gradedLabel}{' '}
              <time dateTime={item.gradedAt}>
                {formatGradedInstant(item.gradedAt)}
              </time>
            </span>
          </div>
        </div>
      </article>
    </li>
  );
}

function DailyMetricsTable({
  items,
}: {
  readonly items: readonly DailyMetricDto[];
}) {
  const metrics = messages.student.metrics;
  const cell = 'border-b border-edge/60 px-3 py-2';
  return (
    <div
      role="region"
      aria-label={metrics.tableCaption}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The named overflow region must be focusable for keyboard scrolling.
      tabIndex={0}
      className="max-h-80 min-w-0 overflow-auto rounded-2xl border border-edge bg-card shadow-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <table className="w-full min-w-[22rem] border-separate border-spacing-0 text-sm tabular-nums">
        <caption className="sr-only">{metrics.tableCaption}</caption>
        <thead>
          <tr className="text-left">
            {[
              metrics.dayColumn,
              metrics.connectedColumn,
              metrics.submissionsColumn,
              metrics.messagesColumn,
            ].map((label) => (
              <th
                key={label}
                scope="col"
                className="sticky top-0 z-10 border-b-2 border-edge bg-tray px-3 py-2 font-semibold"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.day} className="hover:bg-row-hover">
              <th scope="row" className={`${cell} text-left font-normal`}>
                {formatMetricDay(row.day)}
              </th>
              <td className={cell}>
                {formatConnectedSeconds(row.connectedSeconds)}
              </td>
              <td className={cell}>{row.submissionCount}</td>
              <td className={cell}>{row.messageCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentGradesView({
  classroomId,
  userId,
}: {
  readonly classroomId: string;
  readonly userId: string;
}) {
  const student = messages.student;
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [reportCardPage, setReportCardPage] = useState(1);
  const [metricsPage, setMetricsPage] = useState(1);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
  } | null>(null);

  const reportCard = useQuery({
    queryKey: studentReportCardQueryKey(userId, classroomId, {
      page: reportCardPage,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      fetchStudentReportCard(
        client,
        classroomId,
        { page: reportCardPage, pageSize: DEFAULT_PAGE_SIZE },
        { signal },
      ),
  });

  const metrics = useQuery({
    queryKey: ownActivityMetricsQueryKey(userId, classroomId, {
      page: metricsPage,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      fetchOwnDailyMetrics(
        client,
        classroomId,
        { page: metricsPage, pageSize: DEFAULT_PAGE_SIZE },
        { signal },
      ),
  });

  const reportCardError =
    reportCard.error instanceof ApiError ? reportCard.error : null;
  const metricsError = metrics.error instanceof ApiError ? metrics.error : null;
  const isReportCardAccessError =
    reportCard.isError &&
    (reportCardError?.status === 403 || reportCardError?.status === 404);
  const isMetricsAccessError =
    metrics.isError &&
    (metricsError?.status === 403 || metricsError?.status === 404);
  const isAccessError = isReportCardAccessError || isMetricsAccessError;
  const accessNotFoundError =
    reportCardError?.status === 404
      ? reportCard.error
      : metricsError?.status === 404
        ? metrics.error
        : null;

  useEffect(() => {
    if (!isAccessError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    terminalCleanupRef.current = { userId, classroomId };
    // Clear other cached pages without deleting the active query, which would
    // otherwise recreate and refetch in a loop while mounted.
    queryClient.removeQueries({
      predicate: createStudentReportCardPredicate(userId, classroomId),
      type: 'inactive',
    });
    queryClient.removeQueries({
      predicate: createOwnActivityMetricsPredicate(userId, classroomId),
      type: 'inactive',
    });
    if (
      accessNotFoundError !== null &&
      reconciledErrorRef.current !== accessNotFoundError
    ) {
      reconciledErrorRef.current = accessNotFoundError;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [accessNotFoundError, classroomId, isAccessError, queryClient, userId]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createStudentReportCardPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
        queryClient.removeQueries({
          predicate: createOwnActivityMetricsPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
      }
    };
  }, [queryClient]);

  if (reportCard.isPending) {
    return <LoadingState label={student.loadingLabel} />;
  }

  if (metricsError?.status === 404) {
    return (
      <ErrorState
        headingLevel="h3"
        title={student.notFoundTitle}
        description={student.notFoundDescription}
      />
    );
  }

  const isTerminalReportCardError =
    reportCard.isError &&
    (reportCardError?.status === 403 ||
      reportCardError?.status === 404 ||
      !reportCard.data);

  if (isTerminalReportCardError) {
    const isForbidden = reportCardError?.status === 403;
    const isNotFound = reportCardError?.status === 404;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          isForbidden
            ? student.forbiddenTitle
            : isNotFound
              ? student.notFoundTitle
              : student.errorTitle
        }
        description={
          isForbidden
            ? student.forbiddenDescription
            : isNotFound
              ? student.notFoundDescription
              : (reportCardError?.userMessage ?? student.errorDescription)
        }
        onRetry={
          isForbidden || isNotFound
            ? undefined
            : () => {
                void reportCard.refetch();
              }
        }
        isRetrying={reportCard.isRefetching}
        retryLabel={student.retryLabel}
      />
    );
  }

  const data = reportCard.data;
  const isOutOfRangeReportCardPage =
    data !== undefined && data.items.length === 0 && reportCardPage > 1;

  const isMetricsForbidden = metrics.isError && metricsError?.status === 403;
  const isMetricsNotFound = metrics.isError && metricsError?.status === 404;
  const isMetricsTerminalError = isMetricsForbidden || isMetricsNotFound;

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {student.heading}
        </h3>
        <p className="text-sm text-muted-foreground">{student.subtitle}</p>
      </div>

      {reportCard.isError && data !== undefined ? (
        <StaleDataNotice
          title={student.staleTitle}
          description={student.staleDescription}
          onRetry={() => {
            void reportCard.refetch();
          }}
          isRetrying={reportCard.isRefetching}
          retryLabel={student.retryLabel}
        />
      ) : null}

      {data !== undefined && data.items.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={
            isOutOfRangeReportCardPage
              ? student.emptyPageTitle
              : student.emptyTitle
          }
          description={
            isOutOfRangeReportCardPage
              ? student.emptyPageDescription
              : student.emptyDescription
          }
          action={
            isOutOfRangeReportCardPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setReportCardPage(1)}
              >
                {student.backToFirstPageLabel}
              </Button>
            ) : undefined
          }
        />
      ) : data !== undefined ? (
        <div className="min-w-0 space-y-3">
          <ul
            aria-label={student.reportCardListLabel}
            className="min-w-0 space-y-4"
          >
            {data.items.map((item) => (
              <ReportCardItem key={item.activityId} item={item} />
            ))}
          </ul>
          {data.total > data.pageSize ? (
            <PaginationControls
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              busy={reportCard.isFetching}
              onPageChange={(nextPage) => setReportCardPage(nextPage)}
            />
          ) : null}
        </div>
      ) : null}

      <section className="min-w-0 space-y-3 border-t border-edge/60 pt-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">
            {student.metrics.heading}
          </h4>
          <p className="text-sm text-muted-foreground">
            {student.metrics.subtitle}
          </p>
        </div>
        {metrics.isPending ? (
          <LoadingState
            label={student.metrics.loadingLabel}
            skeletonLines={3}
          />
        ) : metrics.isError && metrics.data === undefined ? (
          <ErrorState
            headingLevel="h4"
            title={student.metrics.errorTitle}
            description={
              isMetricsForbidden
                ? student.metrics.forbiddenDescription
                : isMetricsNotFound
                  ? student.metrics.notFoundDescription
                  : student.metrics.errorDescription
            }
            onRetry={
              isMetricsTerminalError
                ? undefined
                : () => {
                    void metrics.refetch();
                  }
            }
            isRetrying={metrics.isRefetching}
            retryLabel={student.metrics.retryLabel}
          />
        ) : metrics.data !== undefined ? (
          <div className="min-w-0 space-y-3">
            {metrics.isError ? (
              <StaleDataNotice
                title={student.staleTitle}
                description={student.staleDescription}
                onRetry={() => {
                  void metrics.refetch();
                }}
                isRetrying={metrics.isRefetching}
                retryLabel={student.metrics.retryLabel}
              />
            ) : null}
            {metrics.data.items.length === 0 ? (
              <EmptyState
                headingLevel="h4"
                title={student.metrics.emptyTitle}
                description={student.metrics.emptyDescription}
              />
            ) : (
              <>
                <DailyMetricsTable items={metrics.data.items} />
                {metrics.data.total > metrics.data.pageSize ? (
                  <PaginationControls
                    page={metrics.data.page}
                    pageSize={metrics.data.pageSize}
                    total={metrics.data.total}
                    busy={metrics.isFetching}
                    onPageChange={(nextPage) => setMetricsPage(nextPage)}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="min-w-0 space-y-3 border-t border-edge/60 pt-4">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">
            {student.wallet.heading}
          </h4>
          <p className="text-sm text-muted-foreground">
            {student.wallet.subtitle}
          </p>
        </div>
        <WalletPanel classroomId={classroomId} />
      </section>
    </div>
  );
}

function ClassroomMetricsTable({
  items,
}: {
  readonly items: readonly StudentMetricSummaryDto[];
}) {
  const columns = messages.teacher.columns;
  const head =
    'sticky top-0 z-10 min-w-[5.5rem] border-b-2 border-edge bg-tray px-3 py-2.5 text-right font-semibold';
  const cell = 'border-b border-edge/60 px-3 py-2.5 text-right';
  return (
    <div
      role="region"
      aria-label={messages.teacher.tableCaption}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The named overflow region must be focusable for keyboard scrolling.
      tabIndex={0}
      className="max-h-[60vh] min-w-0 overflow-auto rounded-2xl border border-edge bg-card shadow-panel focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <table className="w-full min-w-[38rem] border-separate border-spacing-0 text-sm tabular-nums">
        <caption className="sr-only">{messages.teacher.tableCaption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-20 min-w-[9rem] border-b-2 border-edge bg-tray px-3 py-2.5 text-left font-semibold"
            >
              {columns.student}
            </th>
            <th scope="col" className={head}>
              {columns.connected}
            </th>
            <th scope="col" className={head}>
              {columns.submissions}
            </th>
            <th scope="col" className={head}>
              {columns.messages}
            </th>
            <th scope="col" className={head}>
              {columns.graded}
            </th>
            <th scope="col" className={head}>
              {columns.ungraded}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.studentId} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-b border-edge/60 bg-card px-3 py-2.5 text-left font-normal group-hover:bg-row-hover"
              >
                <span className="flex items-center gap-2.5">
                  <InitialsAvatar name={row.displayName} size="sm" />
                  <span className="font-semibold text-foreground">
                    {row.displayName}
                  </span>
                </span>
              </th>
              <td className={cell}>
                {formatConnectedSeconds(row.connectedSeconds)}
              </td>
              <td className={cell}>{row.submissionCount}</td>
              <td className={cell}>{row.messageCount}</td>
              <td className={cell}>{row.gradedCount}</td>
              <td
                className={
                  row.ungradedCount > 0
                    ? `${cell} bg-warning/60 font-semibold text-warning-foreground`
                    : cell
                }
              >
                {row.ungradedCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeacherMetricsView({
  classroomId,
  userId,
}: {
  readonly classroomId: string;
  readonly userId: string;
}) {
  const teacher = messages.teacher;
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
  } | null>(null);

  const query = useQuery({
    queryKey: classroomActivityMetricsQueryKey(userId, classroomId, {
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
    queryFn: ({ signal }) =>
      fetchClassroomMetrics(
        client,
        classroomId,
        { page, pageSize: DEFAULT_PAGE_SIZE },
        { signal },
      ),
  });

  const listError = query.error instanceof ApiError ? query.error : null;
  const isAccessError =
    query.isError && (listError?.status === 403 || listError?.status === 404);

  useEffect(() => {
    if (!query.isError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    if (!isAccessError) {
      return;
    }
    terminalCleanupRef.current = { userId, classroomId };
    queryClient.removeQueries({
      predicate: createClassroomActivityMetricsPredicate(userId, classroomId),
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
          predicate: createClassroomActivityMetricsPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
      }
    };
  }, [queryClient]);

  if (query.isPending) {
    return <LoadingState label={teacher.loadingLabel} />;
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
            ? teacher.forbiddenTitle
            : isNotFound
              ? teacher.notFoundTitle
              : teacher.errorTitle
        }
        description={
          isForbidden
            ? teacher.forbiddenDescription
            : isNotFound
              ? teacher.notFoundDescription
              : (listError?.userMessage ?? teacher.errorDescription)
        }
        onRetry={
          isForbidden || isNotFound
            ? undefined
            : () => {
                void query.refetch();
              }
        }
        isRetrying={query.isRefetching}
        retryLabel={teacher.retryLabel}
      />
    );
  }

  const data = query.data;
  const isOutOfRangePage =
    data !== undefined && data.items.length === 0 && page > 1;

  return (
    <div className="min-w-0 space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {teacher.heading}
          </h3>
          {data !== undefined && data.total > 0 ? (
            <Badge variant="secondary">
              {teacher.studentCount(data.total)}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{teacher.subtitle}</p>
      </div>

      {query.isError && data !== undefined ? (
        <StaleDataNotice
          title={teacher.staleTitle}
          description={teacher.staleDescription}
          onRetry={() => {
            void query.refetch();
          }}
          isRetrying={query.isRefetching}
          retryLabel={teacher.retryLabel}
        />
      ) : null}

      {data !== undefined && data.items.length === 0 ? (
        <EmptyState
          headingLevel="h4"
          title={isOutOfRangePage ? teacher.emptyPageTitle : teacher.emptyTitle}
          description={
            isOutOfRangePage
              ? teacher.emptyPageDescription
              : teacher.emptyDescription
          }
          action={
            isOutOfRangePage ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage(1)}
              >
                {teacher.backToFirstPageLabel}
              </Button>
            ) : undefined
          }
        />
      ) : data !== undefined ? (
        <div className="min-w-0 space-y-3">
          <ClassroomMetricsTable items={data.items} />
          {data.total > data.pageSize ? (
            <PaginationControls
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              busy={query.isFetching}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
