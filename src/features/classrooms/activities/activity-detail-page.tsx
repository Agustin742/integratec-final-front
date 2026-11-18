import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomActivityDetailQueryKey,
  classroomDetailQueryKey,
} from '@/api/query-keys';
import { useDocumentTitle } from '@/app/router/document-title';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSessionService } from '@/session/provider';
import { useClassroomContext } from '../use-classroom-capabilities';
import { useClassroomContextEvents } from '../use-classroom-context-events';
import type { ActivityDetailDto } from './activity-schema';
import { getClassroomActivity } from './activity-service';
import { formatActivityDeadline } from './format-activity-deadline';
import { activityMessages } from './messages';

type ActivityDetailTab = 'overview' | 'submission' | 'forum' | 'review';

export interface ActivityDetailPageProps {
  /** Extension slot for student file or multiple-choice submission. */
  readonly renderSubmissionTab?: (activity: ActivityDetailDto) => ReactNode;
  /** Extension slot for the per-activity query forum. */
  readonly renderForumTab?: (activity: ActivityDetailDto) => ReactNode;
  /** Extension slot for teacher review and grading. */
  readonly renderReviewTab?: (activity: ActivityDetailDto) => ReactNode;
}

export function ActivityDetailPage({
  renderSubmissionTab,
  renderForumTab,
  renderReviewTab,
}: ActivityDetailPageProps = {}) {
  const { classroomId, activityId } = useParams();
  const normalizedClassroomId = classroomId?.trim();
  const normalizedActivityId = activityId?.trim();

  if (!normalizedClassroomId || !normalizedActivityId) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-6">
        <ErrorState
          headingLevel="h2"
          title={activityMessages.detail.notFoundTitle}
          description={activityMessages.detail.notFoundDescription}
        />
      </section>
    );
  }

  return (
    <ActivityDetailContent
      key={`${normalizedClassroomId}:${normalizedActivityId}`}
      classroomId={normalizedClassroomId}
      activityId={normalizedActivityId}
      renderSubmissionTab={renderSubmissionTab}
      renderForumTab={renderForumTab}
      renderReviewTab={renderReviewTab}
    />
  );
}

function ActivityDetailContent({
  classroomId,
  activityId,
  renderSubmissionTab,
  renderForumTab,
  renderReviewTab,
}: ActivityDetailPageProps & {
  readonly classroomId: string;
  readonly activityId: string;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  useClassroomContextEvents(classroomId);

  const [activeTab, setActiveTab] = useState<ActivityDetailTab>('overview');
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
    readonly activityId: string;
  } | null>(null);

  const userId = context.status === 'ready' ? context.userId : null;
  const isStaff =
    context.status === 'ready' &&
    context.classroom.capabilities.includes('publish_content');
  const canParticipate =
    context.status === 'ready' &&
    context.classroom.capabilities.includes('participate_activities');

  const query = useQuery({
    queryKey: classroomActivityDetailQueryKey(
      userId ?? 'signed-out',
      classroomId,
      activityId,
    ),
    queryFn: ({ signal }) =>
      getClassroomActivity(client, classroomId, activityId, { signal }),
    enabled: userId !== null,
  });

  const apiError = query.error instanceof ApiError ? query.error : null;
  const isAccessError =
    query.isError && (apiError?.status === 403 || apiError?.status === 404);
  const isTerminalError =
    query.isError &&
    (apiError?.status === 403 || apiError?.status === 404 || !query.data);

  useDocumentTitle(
    context.status === 'ready' && !isTerminalError && query.data
      ? query.data.title
      : activityMessages.heading,
  );

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
    terminalCleanupRef.current = { userId, classroomId, activityId };
    if (
      apiError?.status === 404 &&
      reconciledErrorRef.current !== query.error
    ) {
      reconciledErrorRef.current = query.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    activityId,
    apiError?.status,
    classroomId,
    isAccessError,
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
          queryKey: classroomActivityDetailQueryKey(
            cleanup.userId,
            cleanup.classroomId,
            cleanup.activityId,
          ),
          exact: true,
        });
      }
    };
  }, [queryClient]);

  const backLink = (
    <Link
      to={`/classrooms/${encodeURIComponent(classroomId)}`}
      className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
    >
      {activityMessages.detail.backToClassroomLabel}
    </Link>
  );

  if (context.status === 'pending') {
    return (
      <section className="mx-auto max-w-4xl px-4 py-6">
        <LoadingState label={activityMessages.detail.loadingLabel} />
      </section>
    );
  }

  if (context.status === 'error') {
    const isForbidden = context.error.status === 403;
    const isNotFound = context.error.status === 404;
    return (
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {backLink}
        <ErrorState
          headingLevel="h2"
          title={
            isForbidden
              ? activityMessages.detail.forbiddenTitle
              : isNotFound
                ? activityMessages.detail.notFoundTitle
                : activityMessages.detail.errorTitle
          }
          description={
            isForbidden
              ? activityMessages.detail.forbiddenDescription
              : isNotFound
                ? activityMessages.detail.notFoundDescription
                : context.error.userMessage
          }
          onRetry={isForbidden || isNotFound ? undefined : context.retry}
          retryLabel={activityMessages.retryLabel}
        />
      </section>
    );
  }

  if (query.isPending) {
    return (
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {backLink}
        <LoadingState label={activityMessages.detail.loadingLabel} />
      </section>
    );
  }

  if (isTerminalError) {
    const isForbidden = apiError?.status === 403;
    const isNotFound = apiError?.status === 404;
    return (
      <section className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {backLink}
        <ErrorState
          headingLevel="h2"
          title={
            isForbidden
              ? activityMessages.detail.forbiddenTitle
              : isNotFound
                ? activityMessages.detail.notFoundTitle
                : activityMessages.detail.errorTitle
          }
          description={
            isForbidden
              ? activityMessages.detail.forbiddenDescription
              : isNotFound
                ? activityMessages.detail.notFoundDescription
                : (apiError?.userMessage ?? activityMessages.errorDescription)
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
      </section>
    );
  }

  const activity = query.data;
  if (!activity) {
    return null;
  }

  const effectiveTab: ActivityDetailTab =
    (activeTab === 'submission' && !canParticipate) ||
    (activeTab === 'review' && !isStaff)
      ? 'overview'
      : activeTab;

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="space-y-3">
        {backLink}
        <div className="space-y-2">
          <h2 className="break-words font-display text-2xl font-bold text-foreground">
            {activity.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {activityMessages.typeLabels[activity.type]}
            </Badge>
            <Badge variant="outline">
              {activityMessages.formatLabels[activity.format]}
            </Badge>
            {isStaff ? (
              <Badge
                variant={activity.state === 'PUBLISHED' ? 'default' : 'outline'}
              >
                {activityMessages.stateLabels[activity.state]}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

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

      <Tabs
        value={effectiveTab}
        onValueChange={(value) => setActiveTab(value as ActivityDetailTab)}
        className="min-w-0 space-y-4"
      >
        <TabsList aria-label={activityMessages.detail.tabsLabel}>
          <TabsTrigger value="overview" className="min-h-11">
            {activityMessages.detail.tabs.overview}
          </TabsTrigger>
          {canParticipate ? (
            <TabsTrigger value="submission" className="min-h-11">
              {activityMessages.detail.tabs.submission}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="forum" className="min-h-11">
            {activityMessages.detail.tabs.forum}
          </TabsTrigger>
          {isStaff ? (
            <TabsTrigger value="review" className="min-h-11">
              {activityMessages.detail.tabs.review}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="space-y-4 rounded-xl border border-edge bg-card p-5 shadow-xs">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-foreground">
                  {activityMessages.detail.dueAtTerm}
                </dt>
                <dd className="text-muted-foreground">
                  <time dateTime={activity.dueAt}>
                    {formatActivityDeadline(activity.dueAt, activity.timeZone)}
                  </time>
                </dd>
              </div>
              {activity.opensAt ? (
                <div>
                  <dt className="font-semibold text-foreground">
                    {activityMessages.detail.opensAtTerm}
                  </dt>
                  <dd className="text-muted-foreground">
                    <time dateTime={activity.opensAt}>
                      {formatActivityDeadline(
                        activity.opensAt,
                        activity.timeZone,
                      )}
                    </time>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="font-semibold text-foreground">
                  {activityMessages.detail.maxScoreTerm}
                </dt>
                <dd className="text-muted-foreground">{activity.maxScore}</dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">
                  {activityMessages.detail.weightTerm}
                </dt>
                <dd className="text-muted-foreground">
                  {activityMessages.detail.weightValue(
                    activity.weightMultiplier,
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-foreground">
                  {activityMessages.detail.latePolicyTerm}
                </dt>
                <dd className="text-muted-foreground">
                  {activity.allowLate
                    ? activityMessages.lateAllowedLabel
                    : activityMessages.lateDisallowedLabel}
                </dd>
              </div>
            </dl>

            {activity.description ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {activity.description}
              </p>
            ) : null}
          </div>

          {activity.format === 'MULTIPLE_CHOICE' &&
          activity.questions.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                {activityMessages.detail.questionsHeading}
              </h3>
              <ol className="space-y-3">
                {activity.questions.map((question) => (
                  <li
                    key={question.id}
                    className="space-y-2 rounded-xl border border-edge bg-card p-4 shadow-xs"
                  >
                    <p className="font-semibold text-foreground">
                      {question.position}. {question.prompt}
                    </p>
                    <ul className="space-y-1 pl-4 text-sm text-muted-foreground">
                      {question.options.map((option) => (
                        <li
                          key={option.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span>{option.label}</span>
                          {isStaff &&
                          'isCorrect' in option &&
                          option.isCorrect ? (
                            <Badge variant="default">
                              {activityMessages.detail.correctOptionBadge}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </TabsContent>

        {canParticipate ? (
          <TabsContent value="submission">
            {renderSubmissionTab ? (
              renderSubmissionTab(activity)
            ) : (
              <EmptyState
                headingLevel="h3"
                title={activityMessages.detail.pendingTabTitle}
                description={
                  activityMessages.detail.submissionPendingDescription
                }
              />
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="forum">
          {renderForumTab ? (
            renderForumTab(activity)
          ) : (
            <EmptyState
              headingLevel="h3"
              title={activityMessages.detail.pendingTabTitle}
              description={activityMessages.detail.forumPendingDescription}
            />
          )}
        </TabsContent>

        {isStaff ? (
          <TabsContent value="review">
            {renderReviewTab ? (
              renderReviewTab(activity)
            ) : (
              <EmptyState
                headingLevel="h3"
                title={activityMessages.detail.pendingTabTitle}
                description={activityMessages.detail.reviewPendingDescription}
              />
            )}
          </TabsContent>
        ) : null}
      </Tabs>
    </section>
  );
}
