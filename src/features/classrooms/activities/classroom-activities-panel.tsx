import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  classroomActivitiesQueryKey,
  createClassroomActivitiesPredicate,
  type ClassroomActivitiesStateFilter,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { DEFAULT_PAGE_SIZE } from '@/components/pagination/pagination';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { classroomMessages } from '../messages';
import { useClassroomCapabilities } from '../use-classroom-capabilities';
import {
  isAbortError,
  isUncertainWriteError,
  listClassroomActivities,
  deactivateClassroomActivity,
} from './activity-service';
import type { ActivitySummaryDto } from './activity-schema';

type ActivityStateSelection = 'ALL' | ClassroomActivitiesStateFilter;

const STATE_FILTER_OPTIONS: readonly ActivityStateSelection[] = [
  'ALL',
  'DRAFT',
  'PUBLISHED',
];

function isForbiddenApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'forbidden' || error.status === 403)
  );
}

function isNotFoundApiError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'not-found' || error.status === 404)
  );
}

/** Formats one summary instant in the school time zone reported by the server. */
function formatSchoolInstant(
  isoInstant: string,
  timeZone: string,
  label: string,
): string {
  try {
    return `${label}: ${formatInstant(isoInstant, { timeZone })}`;
  } catch {
    return `${label}: ${isoInstant}`;
  }
}

export interface ClassroomActivitiesPanelProps {
  readonly classroomId?: string;
}

/**
 * Classroom activities panel (`HU-ACT-001`, part 1/2) mounted in the
 * `activities` workspace panel. Lists activities with status, dates in the
 * school time zone and scores. Students see published activities only
 * (server-decided); teacher-level users additionally manage logical
 * deactivation with an inline confirmation that explains history preservation,
 * and the server's refusal (`409` with submissions) is surfaced as an
 * explanation instead of a silent failure.
 */
export function ClassroomActivitiesPanel({
  classroomId: propClassroomId,
}: ClassroomActivitiesPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const capabilities = useClassroomCapabilities(resolvedClassroomId);
  const canPublish =
    capabilities.status === 'ready' && capabilities.can('publish_content');

  const activitiesHeadingId = useId();
  const filterGroupLabelId = useId();

  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState<ActivityStateSelection>('ALL');
  const [confirmTarget, setConfirmTarget] = useState<ActivitySummaryDto | null>(
    null,
  );
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const activitiesHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const deactivateButtonRefs = useRef<Map<string, HTMLButtonElement>>(
    new Map(),
  );
  const restoreTriggerActivityIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const isDeactivatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconciledContextErrorRef = useRef<unknown>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (confirmTarget !== null) {
      confirmHeadingRef.current?.focus();
      return;
    }
    const triggerActivityId = restoreTriggerActivityIdRef.current;
    if (triggerActivityId !== null) {
      restoreTriggerActivityIdRef.current = null;
      deactivateButtonRefs.current.get(triggerActivityId)?.focus();
    }
  }, [confirmTarget]);

  const queryParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    ...(stateFilter !== 'ALL' ? { state: stateFilter } : {}),
  };

  const enabled = userId !== null && resolvedClassroomId.trim() !== '';

  const activitiesQuery = useQuery({
    queryKey: classroomActivitiesQueryKey(
      userId ?? 'signed-out',
      resolvedClassroomId || 'missing',
      queryParams,
    ),
    queryFn: ({ signal }) =>
      listClassroomActivities(client, resolvedClassroomId, queryParams, {
        signal,
      }),
    enabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (
      userId === null ||
      resolvedClassroomId.trim() === '' ||
      !activitiesQuery.isError
    ) {
      return;
    }
    if (
      isNotFoundApiError(activitiesQuery.error) &&
      reconciledContextErrorRef.current !== activitiesQuery.error
    ) {
      reconciledContextErrorRef.current = activitiesQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, resolvedClassroomId),
        exact: true,
      });
    }
  }, [
    queryClient,
    resolvedClassroomId,
    activitiesQuery.error,
    activitiesQuery.isError,
    userId,
  ]);

  const messages = classroomMessages.activities.panel;

  const setDeactivateButtonRef =
    (activityId: string) =>
    (node: HTMLButtonElement | null): void => {
      if (node) {
        deactivateButtonRefs.current.set(activityId, node);
      } else {
        deactivateButtonRefs.current.delete(activityId);
      }
    };

  const resetPendingConfirmation = (): void => {
    setConfirmTarget(null);
    setDeactivateError(null);
  };

  const handleStateFilterChange = (nextState: ActivityStateSelection): void => {
    if (isDeactivatingRef.current || nextState === stateFilter) {
      return;
    }
    resetPendingConfirmation();
    setStateFilter(nextState);
    setPage(1);
  };

  const handleClearFilters = (): void => {
    if (isDeactivatingRef.current) {
      return;
    }
    resetPendingConfirmation();
    setStateFilter('ALL');
    setPage(1);
  };

  const handleOpenConfirmation = (activity: ActivitySummaryDto): void => {
    if (isDeactivatingRef.current) {
      return;
    }
    restoreTriggerActivityIdRef.current = null;
    setDeactivateError(null);
    setConfirmTarget(activity);
  };

  const handleCancelConfirmation = (): void => {
    if (isDeactivatingRef.current || confirmTarget === null) {
      return;
    }
    restoreTriggerActivityIdRef.current = confirmTarget.id;
    setConfirmTarget(null);
    setDeactivateError(null);
  };

  const handleConfirmDeactivation = async (): Promise<void> => {
    if (
      isDeactivatingRef.current ||
      confirmTarget === null ||
      userId === null ||
      resolvedClassroomId.trim() === ''
    ) {
      return;
    }

    const target = confirmTarget;
    isDeactivatingRef.current = true;
    setIsDeactivating(true);
    setDeactivateError(null);

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    try {
      await deactivateClassroomActivity(
        client,
        resolvedClassroomId,
        target.id,
        { signal: controller.signal },
      );

      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      restoreTriggerActivityIdRef.current = null;
      setConfirmTarget(null);
      setDeactivateError(null);
      const confirmationDescription = messages.deactivatedDescription(
        target.title,
      );
      setLiveAnnouncement(
        `${messages.deactivatedTitle}: ${confirmationDescription}`,
      );
      toast.success(messages.deactivatedTitle, {
        description: confirmationDescription,
      });

      void queryClient.invalidateQueries({
        predicate: createClassroomActivitiesPredicate(
          userId,
          resolvedClassroomId,
        ),
      });
      activitiesHeadingRef.current?.focus();
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        !isMountedRef.current
      ) {
        return;
      }

      const errorMessage =
        error instanceof ApiError
          ? error.userMessage
          : classroomMessages.activities.write.deactivateUnexpected;
      setDeactivateError(errorMessage);

      if (isNotFoundApiError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomActivitiesPredicate(
            userId,
            resolvedClassroomId,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, resolvedClassroomId),
          exact: true,
        });
      } else if (isForbiddenApiError(error) || isUncertainWriteError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomActivitiesPredicate(
            userId,
            resolvedClassroomId,
          ),
        });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      isDeactivatingRef.current = false;
      if (isMountedRef.current) {
        setIsDeactivating(false);
      }
    }
  };

  const hasActiveFilters = stateFilter !== 'ALL';
  const isForbiddenError =
    activitiesQuery.isError && isForbiddenApiError(activitiesQuery.error);
  const isNotFoundError =
    activitiesQuery.isError && isNotFoundApiError(activitiesQuery.error);
  const isRevokedAccess = isForbiddenError || isNotFoundError;
  const data = isRevokedAccess ? undefined : activitiesQuery.data;

  return (
    <section
      aria-labelledby={activitiesHeadingId}
      className="min-w-0 space-y-5 pt-2"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id={activitiesHeadingId}
          ref={activitiesHeadingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-foreground outline-none"
        >
          {messages.heading}
        </h3>
        <p className="text-sm text-pretty text-muted-foreground">
          {messages.subtitle}
        </p>
      </div>

      <LiveRegion message={liveAnnouncement} visuallyHidden />

      {canPublish && !isRevokedAccess && (
        <div
          role="group"
          aria-labelledby={filterGroupLabelId}
          className="min-w-0 space-y-1.5 rounded-2xl border border-edge bg-tray/40 p-3.5"
        >
          <p
            id={filterGroupLabelId}
            className="text-sm font-medium text-foreground"
          >
            {messages.stateFilterLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {STATE_FILTER_OPTIONS.map((option) => {
              const pressed = stateFilter === option;
              return (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={pressed ? 'default' : 'outline'}
                  aria-pressed={pressed}
                  disabled={isDeactivating}
                  onClick={() => handleStateFilterChange(option)}
                  className="min-h-11"
                >
                  {messages.stateOptions[option]}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {activitiesQuery.isPending && data === undefined && (
        <LoadingState label={messages.loading} skeletonLines={4} />
      )}

      {isForbiddenError && (
        <ErrorState
          headingLevel="h4"
          title={messages.forbiddenTitle}
          description={messages.forbiddenDescription}
        />
      )}

      {isNotFoundError && (
        <ErrorState
          headingLevel="h4"
          title={messages.notFoundTitle}
          description={messages.notFoundDescription}
        />
      )}

      {activitiesQuery.isError && !isRevokedAccess && data === undefined && (
        <ErrorState
          headingLevel="h4"
          title={messages.errorTitle}
          description={classroomMessages.activities.list.errorDescription}
          onRetry={() => void activitiesQuery.refetch()}
          isRetrying={activitiesQuery.isRefetching}
        />
      )}

      {activitiesQuery.isError && !isRevokedAccess && data !== undefined && (
        <StaleDataNotice
          headingLevel="h4"
          title={messages.staleTitle}
          description={messages.staleDescription}
          onRetry={() => void activitiesQuery.refetch()}
          isRetrying={activitiesQuery.isRefetching}
        />
      )}

      {data !== undefined && data.items.length === 0 && (
        <EmptyState
          headingLevel="h4"
          title={
            data.total > 0 && page > 1
              ? messages.emptyPageTitle
              : hasActiveFilters
                ? messages.emptyFilteredTitle
                : canPublish
                  ? messages.emptyTitleStaff
                  : messages.emptyTitleStudent
          }
          description={
            data.total > 0 && page > 1
              ? messages.emptyPageDescription
              : hasActiveFilters
                ? messages.emptyFilteredDescription
                : canPublish
                  ? messages.emptyDescriptionStaff
                  : messages.emptyDescriptionStudent
          }
          action={
            hasActiveFilters && data.total === 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isDeactivating}
                onClick={handleClearFilters}
              >
                {messages.clearFiltersAction}
              </Button>
            ) : undefined
          }
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <ul className="min-w-0 space-y-3" aria-label={messages.heading}>
          {data.items.map((activity) => {
            const isConfirmingThis = confirmTarget?.id === activity.id;
            const confirmHeadingId = `${activitiesHeadingId}-confirm-${activity.id}`;
            const confirmDescId = `${activitiesHeadingId}-desc-${activity.id}`;

            return (
              <li
                key={activity.id}
                className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-semibold text-foreground wrap-anywhere">
                        {activity.title}
                      </span>
                      <Badge
                        variant={
                          activity.state === 'PUBLISHED' ? 'success' : 'outline'
                        }
                      >
                        {messages.states[activity.state]}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">
                        {messages.types[activity.type]}
                      </Badge>
                      <Badge variant="secondary">
                        {messages.formats[activity.format]}
                      </Badge>
                    </div>
                  </div>

                  {canPublish && (
                    <Button
                      ref={setDeactivateButtonRef(activity.id)}
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={messages.deactivateAriaLabel(activity.title)}
                      aria-expanded={isConfirmingThis}
                      disabled={isDeactivating || isConfirmingThis}
                      onClick={() => handleOpenConfirmation(activity)}
                      className="min-h-11 shrink-0"
                    >
                      {messages.deactivateAction}
                    </Button>
                  )}
                </div>

                <div className="min-w-0 space-y-1.5 border-t border-edge/60 pt-2.5 text-sm text-muted-foreground">
                  <p className="text-pretty">
                    {formatSchoolInstant(
                      activity.dueAt,
                      activity.timeZone,
                      messages.dueAtLabel,
                    )}
                  </p>
                  {activity.opensAt !== null && (
                    <p className="text-pretty">
                      {formatSchoolInstant(
                        activity.opensAt,
                        activity.timeZone,
                        messages.opensAtLabel,
                      )}
                    </p>
                  )}
                  {activity.allowLate && (
                    <p className="text-pretty">{messages.allowLateLabel}</p>
                  )}
                  {activity.format === 'MULTIPLE_CHOICE' && (
                    <p className="text-pretty">
                      {messages.questionCountLabel(activity.questionCount)}
                    </p>
                  )}
                  <p className="text-pretty">
                    {messages.maxScoreLabel(activity.maxScore)} ·{' '}
                    {messages.weightLabel(activity.weightMultiplier)}
                  </p>
                </div>

                {isConfirmingThis && (
                  <section
                    aria-labelledby={confirmHeadingId}
                    aria-describedby={confirmDescId}
                    className="min-w-0 space-y-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3.5"
                  >
                    <h4
                      id={confirmHeadingId}
                      ref={confirmHeadingRef}
                      tabIndex={-1}
                      className="font-display text-base font-semibold text-foreground outline-none wrap-anywhere"
                    >
                      {messages.deactivateConfirmTitle(activity.title)}
                    </h4>
                    <p
                      id={confirmDescId}
                      className="text-sm text-pretty text-muted-foreground"
                    >
                      {messages.deactivateConfirmDescription}
                    </p>

                    {deactivateError !== null && (
                      <Alert variant="destructive" role="alert">
                        <AlertTitle>{messages.deactivateErrorTitle}</AlertTitle>
                        <AlertDescription>{deactivateError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDeactivating}
                        onClick={handleCancelConfirmation}
                        className="min-h-11"
                      >
                        {messages.deactivateConfirmCancel}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        busy={isDeactivating}
                        onClick={() => void handleConfirmDeactivation()}
                        className="min-h-11"
                      >
                        {isDeactivating
                          ? messages.deactivateConfirmPending
                          : messages.deactivateConfirmSubmit}
                      </Button>
                    </div>
                  </section>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {data !== undefined && data.total > 0 && (
        <PaginationControls
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPageChange={(nextPage) => {
            if (isDeactivatingRef.current) {
              return;
            }
            resetPendingConfirmation();
            setPage(nextPage);
          }}
          busy={activitiesQuery.isFetching}
          disabled={isDeactivating}
        />
      )}
    </section>
  );
}
