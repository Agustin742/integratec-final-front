import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
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
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useSessionService } from '@/session/provider';
import { useClassroomContext } from '../use-classroom-capabilities';
import { ActivityRow } from './activity-row';
import { groupActivities } from './activity-board-model';
import {
  ActivityEditorDialog,
  type ActivityEditorMode,
} from './activity-editor-dialog';
import type {
  ActivitySummaryDto,
  TeacherActivityResponseDto,
} from './activity-schema';
import {
  deactivateClassroomActivity,
  isAbortError,
  isUncertainWriteError,
  listClassroomActivities,
} from './activity-service';
import { activityMessages } from './messages';
import {
  PublishActivityDialog,
  type PublishActivityTarget,
} from './publish-activity-dialog';

const PAGE_SIZE = 10;

export interface ActivitiesPanelProps {
  readonly classroomId?: string;
}

export function ActivitiesPanel({
  classroomId: propClassroomId,
}: ActivitiesPanelProps = {}) {
  const { classroomId: routeClassroomId } = useParams();
  const normalizedClassroomId = (
    propClassroomId ??
    routeClassroomId ??
    ''
  ).trim();
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
  const panelId = useId();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ActivitySortOrder>('dueAt');
  const [stateFilter, setStateFilter] = useState<ActivityStateFilter | 'ALL'>(
    'ALL',
  );
  const [confirmTarget, setConfirmTarget] = useState<ActivitySummaryDto | null>(
    null,
  );
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [editorMode, setEditorMode] = useState<ActivityEditorMode | null>(null);
  const [editorFormKey, setEditorFormKey] = useState(0);
  const [publishTarget, setPublishTarget] =
    useState<PublishActivityTarget | null>(null);

  const activitiesHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const createActionRef = useRef<HTMLButtonElement>(null);
  const editorTriggerRef = useRef<HTMLElement | null>(null);
  const publishTriggerRef = useRef<HTMLElement | null>(null);
  const menuTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const restoreTriggerActivityIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const isDeactivatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
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
      menuTriggerRefs.current.get(triggerActivityId)?.focus();
    }
  }, [confirmTarget]);

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
    // Clear other cached pages/filters/details without deleting the active
    // mounted query, which would otherwise recreate and refetch in a loop.
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

  const reconcileActivities = useCallback((): void => {
    if (userId === null) {
      return;
    }
    void queryClient.invalidateQueries({
      predicate: createClassroomActivitiesPredicate(userId, classroomId),
    });
  }, [classroomId, queryClient, userId]);

  const resetPendingConfirmation = (): void => {
    setConfirmTarget(null);
    setDeactivateError(null);
  };

  const handleOpenCreateEditor = (): void => {
    if (isDeactivatingRef.current) {
      return;
    }
    editorTriggerRef.current = createActionRef.current;
    setEditorFormKey((key) => key + 1);
    setEditorMode({ kind: 'create' });
  };

  const handleOpenEditEditor = (activity: ActivitySummaryDto): void => {
    if (isDeactivatingRef.current) {
      return;
    }
    editorTriggerRef.current = menuTriggerRefs.current.get(activity.id) ?? null;
    setEditorFormKey((key) => key + 1);
    setEditorMode({ kind: 'edit', activityId: activity.id });
  };

  const handleOpenPublishConfirmation = (
    activity: PublishActivityTarget,
  ): void => {
    if (isDeactivatingRef.current) {
      return;
    }
    publishTriggerRef.current =
      menuTriggerRefs.current.get(activity.id) ?? null;
    setPublishTarget(activity);
  };

  const handleEditorSaved = (
    saved: TeacherActivityResponseDto,
    modeKind: 'create' | 'edit',
  ): void => {
    setEditorMode(null);
    reconcileActivities();

    const editorCopy = activityMessages.editor;
    const confirmationTitle =
      modeKind === 'create' ? editorCopy.createdTitle : editorCopy.updatedTitle;
    const confirmationDescription =
      modeKind === 'create'
        ? editorCopy.createdDescription(saved.title)
        : editorCopy.updatedDescription(saved.title);
    setLiveAnnouncement(`${confirmationTitle}: ${confirmationDescription}`);
    toast.success(confirmationTitle, {
      description: confirmationDescription,
    });

    if (saved.state === 'DRAFT') {
      // Offer one-way publication right after a confirmed draft save.
      publishTriggerRef.current = editorTriggerRef.current;
      setPublishTarget(saved);
    } else {
      activitiesHeadingRef.current?.focus();
    }
  };

  const handlePublished = (published: TeacherActivityResponseDto): void => {
    setPublishTarget(null);
    reconcileActivities();

    const editorCopy = activityMessages.editor;
    const confirmationDescription = editorCopy.publishedDescription(
      published.title,
    );
    setLiveAnnouncement(
      `${editorCopy.publishedTitle}: ${confirmationDescription}`,
    );
    toast.success(editorCopy.publishedTitle, {
      description: confirmationDescription,
    });
  };

  const registerMenuTrigger =
    (activityId: string) =>
    (node: HTMLButtonElement | null): void => {
      if (node) {
        menuTriggerRefs.current.set(activityId, node);
      } else {
        menuTriggerRefs.current.delete(activityId);
      }
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
      userId === null
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
      await deactivateClassroomActivity(client, classroomId, target.id, {
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      restoreTriggerActivityIdRef.current = null;
      setConfirmTarget(null);
      setDeactivateError(null);
      const confirmationDescription =
        activityMessages.actions.deactivatedDescription(target.title);
      setLiveAnnouncement(
        `${activityMessages.actions.deactivatedTitle}: ${confirmationDescription}`,
      );
      toast.success(activityMessages.actions.deactivatedTitle, {
        description: confirmationDescription,
      });

      reconcileActivities();
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
          : activityMessages.write.deactivateUnexpected;
      setDeactivateError(errorMessage);

      if (
        error instanceof ApiError &&
        (error.kind === 'not-found' || error.status === 404)
      ) {
        reconcileActivities();
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      } else if (
        (error instanceof ApiError &&
          (error.kind === 'forbidden' ||
            error.status === 403 ||
            error.kind === 'conflict' ||
            error.status === 409)) ||
        isUncertainWriteError(error)
      ) {
        reconcileActivities();
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

  // Last confirmed server fetch: a pure, stable instant for phrasing and
  // grouping deadlines (the server stays the authority on expiry).
  const now = query.dataUpdatedAt;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <h3
            ref={activitiesHeadingRef}
            tabIndex={-1}
            className="sr-only outline-none focus:not-sr-only focus:font-display focus:text-lg focus:font-semibold"
          >
            {activityMessages.heading}
          </h3>
          <p className="text-sm text-muted-foreground">
            {query.data
              ? activityMessages.board.summary(query.data.total)
              : activityMessages.subtitle}
          </p>
        </div>
        {isStaff ? (
          <Button
            ref={createActionRef}
            type="button"
            variant="default"
            disabled={isDeactivating}
            onClick={handleOpenCreateEditor}
            className="shrink-0"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {activityMessages.actions.createAction}
          </Button>
        ) : null}
      </div>

      <LiveRegion message={liveAnnouncement} visuallyHidden />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-tray px-4 py-3">
        <label className="grid gap-1 text-xs font-semibold text-foreground">
          <span>{activityMessages.sortLabel}</span>
          <select
            value={sort}
            disabled={isDeactivating}
            onChange={(event) => {
              resetPendingConfirmation();
              setSort(event.target.value as ActivitySortOrder);
              setPage(1);
            }}
            className="min-h-11 rounded-xl border-2 border-field-border bg-card px-3 py-1.5 text-sm font-normal text-card-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={isDeactivating}
              onChange={(event) => {
                resetPendingConfirmation();
                setStateFilter(
                  event.target.value as ActivityStateFilter | 'ALL',
                );
                setPage(1);
              }}
              className="min-h-11 rounded-xl border-2 border-field-border bg-card px-3 py-1.5 text-sm font-normal text-card-foreground focus-visible:border-primary focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
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
                  : isStaff
                    ? activityMessages.emptyTitleStaff
                    : activityMessages.emptyTitle
              }
              description={
                isOutOfRangePage
                  ? activityMessages.emptyPageDescription
                  : isFilteredEmpty
                    ? activityMessages.emptyFilteredDescription
                    : isStaff
                      ? activityMessages.emptyDescriptionStaff
                      : activityMessages.emptyDescription
              }
              action={
                isOutOfRangePage ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeactivating}
                    onClick={() => {
                      resetPendingConfirmation();
                      setPage(1);
                    }}
                  >
                    {activityMessages.backToFirstPageLabel}
                  </Button>
                ) : isFilteredEmpty ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeactivating}
                    onClick={() => {
                      resetPendingConfirmation();
                      setStateFilter('ALL');
                      setPage(1);
                    }}
                  >
                    {activityMessages.clearFilterLabel}
                  </Button>
                ) : isStaff ? (
                  <Button
                    type="button"
                    variant="default"
                    disabled={isDeactivating}
                    onClick={handleOpenCreateEditor}
                  >
                    {activityMessages.board.emptyAction}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div
                role="group"
                aria-label={activityMessages.listRegionLabel}
                className="space-y-6"
              >
                {groupActivities(query.data.items, { isStaff, now }).map(
                  (group) => {
                    const headingId = `${panelId}-group-${group.key}`;
                    return (
                      <section
                        key={group.key}
                        aria-labelledby={headingId}
                        className="min-w-0 space-y-2"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 px-1">
                          <h4
                            id={headingId}
                            className="font-display text-base font-semibold text-foreground"
                          >
                            {activityMessages.board.groupLabels[group.key]}
                          </h4>
                          <span className="text-sm text-muted-foreground">
                            {group.items.length}
                          </span>
                          <p className="basis-full text-xs text-muted-foreground sm:basis-auto sm:before:mr-2 sm:before:content-['·']">
                            {activityMessages.board.groupHints[group.key]}
                          </p>
                        </div>
                        <ul className="min-w-0 divide-y divide-edge overflow-hidden rounded-2xl border border-edge bg-card shadow-xs">
                          {group.items.map((item) => {
                            const isConfirmingThis =
                              confirmTarget?.id === item.id;
                            const confirmHeadingId = `${panelId}-confirm-${item.id}`;
                            const confirmDescId = `${panelId}-desc-${item.id}`;
                            return (
                              <ActivityRow
                                key={item.id}
                                item={item}
                                classroomId={classroomId}
                                isStaff={isStaff}
                                now={now}
                                menuDisabled={
                                  isDeactivating || isConfirmingThis
                                }
                                registerMenuTrigger={registerMenuTrigger(
                                  item.id,
                                )}
                                onEdit={handleOpenEditEditor}
                                onPublish={handleOpenPublishConfirmation}
                                onDeactivate={handleOpenConfirmation}
                              >
                                {isConfirmingThis ? (
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
                                      {activityMessages.actions.deactivateConfirmTitle(
                                        item.title,
                                      )}
                                    </h4>
                                    <p
                                      id={confirmDescId}
                                      className="text-sm text-pretty text-muted-foreground"
                                    >
                                      {
                                        activityMessages.actions
                                          .deactivateConfirmDescription
                                      }
                                    </p>

                                    {deactivateError !== null ? (
                                      <Alert variant="destructive" role="alert">
                                        <AlertTitle>
                                          {
                                            activityMessages.actions
                                              .deactivateErrorTitle
                                          }
                                        </AlertTitle>
                                        <AlertDescription>
                                          {deactivateError}
                                        </AlertDescription>
                                      </Alert>
                                    ) : null}

                                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isDeactivating}
                                        onClick={handleCancelConfirmation}
                                        className="min-h-11"
                                      >
                                        {
                                          activityMessages.actions
                                            .deactivateConfirmCancel
                                        }
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        busy={isDeactivating}
                                        onClick={() =>
                                          void handleConfirmDeactivation()
                                        }
                                        className="min-h-11"
                                      >
                                        {isDeactivating
                                          ? activityMessages.actions
                                              .deactivateConfirmPending
                                          : activityMessages.actions
                                              .deactivateConfirmSubmit}
                                      </Button>
                                    </div>
                                  </section>
                                ) : null}
                              </ActivityRow>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  },
                )}
              </div>

              {query.data.total > query.data.pageSize ? (
                <PaginationControls
                  page={query.data.page}
                  pageSize={query.data.pageSize}
                  total={query.data.total}
                  busy={query.isFetching}
                  disabled={isDeactivating}
                  onPageChange={(nextPage) => {
                    if (isDeactivatingRef.current) {
                      return;
                    }
                    resetPendingConfirmation();
                    setPage(nextPage);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {isStaff ? (
        <>
          <ActivityEditorDialog
            open={editorMode !== null}
            formKey={`${editorMode?.kind ?? 'closed'}-${editorMode?.kind === 'edit' ? editorMode.activityId : 'new'}-${editorFormKey}`}
            classroomId={classroomId}
            mode={editorMode}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setEditorMode(null);
              }
            }}
            onSaved={handleEditorSaved}
            onReconcileRequired={reconcileActivities}
            getTriggerElement={() => editorTriggerRef.current}
            fallbackFocus={() => activitiesHeadingRef.current}
          />
          <PublishActivityDialog
            key={publishTarget?.id ?? 'none'}
            open={publishTarget !== null}
            classroomId={classroomId}
            target={publishTarget}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setPublishTarget(null);
              }
            }}
            onPublished={handlePublished}
            onReconcileRequired={reconcileActivities}
            getTriggerElement={() => publishTriggerRef.current}
            fallbackFocus={() => activitiesHeadingRef.current}
          />
        </>
      ) : null}
    </div>
  );
}
