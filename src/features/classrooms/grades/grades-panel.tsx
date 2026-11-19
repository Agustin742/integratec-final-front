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
  return (
    <li className="min-w-0 rounded-xl border border-edge bg-card p-4 shadow-xs">
      <article className="min-w-0 space-y-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {student.activityLabel}
          </p>
          <h4 className="break-words text-base font-semibold text-foreground">
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
            {student.scoreLabel}
          </p>
          <p className="font-display text-base font-semibold text-foreground">
            {item.score} / {item.maxScore}
          </p>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-edge/60 pt-2.5 text-xs text-muted-foreground">
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
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{metrics.tableCaption}</caption>
        <thead>
          <tr className="border-b-2 border-edge text-left">
            <th scope="col" className="px-2 py-2 font-semibold">
              {metrics.dayColumn}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {metrics.connectedColumn}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {metrics.submissionsColumn}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {metrics.messagesColumn}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.day} className="border-b border-edge/60">
              <th scope="row" className="px-2 py-2 text-left font-normal">
                {formatMetricDay(row.day)}
              </th>
              <td className="px-2 py-2">
                {formatConnectedSeconds(row.connectedSeconds)}
              </td>
              <td className="px-2 py-2">{row.submissionCount}</td>
              <td className="px-2 py-2">{row.messageCount}</td>
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
        <h3 className="text-lg font-semibold text-foreground">
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
          <ul className="min-w-0 space-y-3">
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
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{messages.teacher.tableCaption}</caption>
        <thead>
          <tr className="border-b-2 border-edge text-left">
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.student}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.connected}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.submissions}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.messages}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.graded}
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              {columns.ungraded}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.studentId} className="border-b border-edge/60">
              <th scope="row" className="px-2 py-2 text-left font-normal">
                <span className="font-semibold text-foreground">
                  {row.displayName}
                </span>
              </th>
              <td className="px-2 py-2">
                {formatConnectedSeconds(row.connectedSeconds)}
              </td>
              <td className="px-2 py-2">{row.submissionCount}</td>
              <td className="px-2 py-2">{row.messageCount}</td>
              <td className="px-2 py-2">{row.gradedCount}</td>
              <td className="px-2 py-2">{row.ungradedCount}</td>
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
        <h3 className="text-lg font-semibold text-foreground">
          {teacher.heading}
        </h3>
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
