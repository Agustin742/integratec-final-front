import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import { classroomActivityDetailQueryKey } from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDeadline } from '@/lib/dates';
import { useSessionService } from '@/session/provider';
import {
  useClassroomCapabilities,
  useClassroomContext,
} from '../use-classroom-capabilities';
import type { ActivityDetailDto } from './activity-schema';
import { getClassroomActivity } from './activity-service';
import { activityMessages } from './messages';

export interface ActivityDetailPageProps {
  /** Extension slot for HU-ACT-003 (student file/MC submission). */
  readonly renderSubmissionTab?: (activity: ActivityDetailDto) => ReactNode;
  /** Extension slot for HU-COM-003 (per-activity query forum). */
  readonly renderForumTab?: (activity: ActivityDetailDto) => ReactNode;
  /** Extension slot for HU-ACT-004 (teacher review & grading). */
  readonly renderReviewTab?: (activity: ActivityDetailDto) => ReactNode;
}

function formatActivityDeadline(iso: string, timeZone: string): string {
  try {
    return formatDeadline(iso, { timeZone });
  } catch {
    return `${iso} (${timeZone})`;
  }
}

export function ActivityDetailPage({
  renderSubmissionTab,
  renderForumTab,
  renderReviewTab,
}: ActivityDetailPageProps = {}) {
  const { classroomId, activityId } = useParams();

  if (!classroomId || !activityId) {
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
      key={`${classroomId}:${activityId}`}
      classroomId={classroomId}
      activityId={activityId}
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
  const context = useClassroomContext(classroomId);
  const capabilities = useClassroomCapabilities(classroomId);

  const userId = context.status === 'ready' ? context.userId : null;
  const isStaff =
    capabilities.status === 'ready' && capabilities.can('publish_content');

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

  if (context.status === 'pending' || query.isPending) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-6">
        <LoadingState label={activityMessages.detail.loadingLabel} />
      </section>
    );
  }

  const backLink = (
    <Link
      to={`/classrooms/${classroomId}`}
      className="inline-flex min-h-10 items-center text-sm font-semibold text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring"
    >
      {activityMessages.detail.backToClassroomLabel}
    </Link>
  );

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

  if (query.isError || !query.data) {
    const apiError = query.error instanceof ApiError ? query.error : null;
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

      <Tabs defaultValue="overview" className="min-w-0 space-y-4">
        <TabsList aria-label={activityMessages.detail.tabsLabel}>
          <TabsTrigger value="overview">
            {activityMessages.detail.tabs.overview}
          </TabsTrigger>
          <TabsTrigger value="submission">
            {activityMessages.detail.tabs.submission}
          </TabsTrigger>
          <TabsTrigger value="forum">
            {activityMessages.detail.tabs.forum}
          </TabsTrigger>
          {isStaff ? (
            <TabsTrigger value="review">
              {activityMessages.detail.tabs.review}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-xl border border-edge bg-card p-5 shadow-xs space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-foreground">
                  {activityMessages.dueAtLabel}
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
                    {activityMessages.opensAtLabel}
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
                  {activityMessages.maxScoreLabel(activity.maxScore)}
                </dt>
                <dd className="text-muted-foreground">
                  {activityMessages.weightLabel(activity.weightMultiplier)} ·{' '}
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
                    className="rounded-xl border border-edge bg-card p-4 shadow-xs space-y-2"
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
                          {'isCorrect' in option && option.isCorrect ? (
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

        <TabsContent value="submission">
          {renderSubmissionTab ? (
            renderSubmissionTab(activity)
          ) : (
            <EmptyState
              headingLevel="h3"
              title={activityMessages.detail.pendingTabTitle}
              description={activityMessages.detail.submissionPendingDescription}
            />
          )}
        </TabsContent>

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
