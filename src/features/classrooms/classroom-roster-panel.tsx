import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  classroomRosterQueryKey,
  createClassroomRosterPredicate,
  type ClassroomRosterStateFilter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { classroomMessages } from './messages';
import {
  ROSTER_SEARCH_MAX_LENGTH,
  type RosterStudentDto,
} from './roster-schema';
import {
  isAbortError,
  isUncertainWriteError,
  listClassroomRoster,
  removeClassroomStudent,
} from './roster-service';

type RosterStateSelection = 'ALL' | ClassroomRosterStateFilter;

const STATE_FILTER_OPTIONS: readonly RosterStateSelection[] = [
  'ALL',
  'ACTIVE',
  'INACTIVE',
];

function formatRemovedTimestamp(isoInstant: string): string {
  try {
    return formatInstant(isoInstant);
  } catch {
    return isoInstant;
  }
}

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

export interface ClassroomRosterPanelProps {
  readonly classroomId?: string;
}

/**
 * Staff-only classroom student roster (`HU-AUL-003`) mounted in the `members`
 * workspace panel. Displays paginated student states and linked guardians,
 * supports status/name filtering, and performs idempotent logical removal with
 * an inline confirmation explaining that academic history is preserved.
 */
export function ClassroomRosterPanel({
  classroomId: propClassroomId,
}: ClassroomRosterPanelProps = {}) {
  const params = useParams<{ classroomId: string }>();
  const resolvedClassroomId = propClassroomId ?? params.classroomId ?? '';
  const { client } = useSessionService();
  const snapshot = useSessionSnapshot();
  const queryClient = useQueryClient();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  const rosterHeadingId = useId();
  const searchInputId = useId();
  const filterGroupLabelId = useId();

  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState<RosterStateSelection>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<RosterStudentDto | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const rosterHeadingRef = useRef<HTMLHeadingElement>(null);
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null);
  const removeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const restoreTriggerUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const isRemovingRef = useRef(false);
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
    const triggerUserId = restoreTriggerUserIdRef.current;
    if (triggerUserId !== null) {
      restoreTriggerUserIdRef.current = null;
      removeButtonRefs.current.get(triggerUserId)?.focus();
    }
  }, [confirmTarget]);

  const queryParams = {
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    ...(stateFilter !== 'ALL' ? { state: stateFilter } : {}),
    ...(searchQuery.trim() !== '' ? { q: searchQuery.trim() } : {}),
  };

  const enabled = userId !== null && resolvedClassroomId.trim() !== '';

  const rosterQuery = useQuery({
    queryKey: classroomRosterQueryKey(
      userId ?? 'signed-out',
      resolvedClassroomId || 'missing',
      queryParams,
    ),
    queryFn: ({ signal }) =>
      listClassroomRoster(client, resolvedClassroomId, queryParams, {
        signal,
      }),
    enabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (
      userId === null ||
      resolvedClassroomId.trim() === '' ||
      !rosterQuery.isError
    ) {
      return;
    }
    if (
      isNotFoundApiError(rosterQuery.error) &&
      reconciledContextErrorRef.current !== rosterQuery.error
    ) {
      reconciledContextErrorRef.current = rosterQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, resolvedClassroomId),
        exact: true,
      });
    }
  }, [
    queryClient,
    resolvedClassroomId,
    rosterQuery.error,
    rosterQuery.isError,
    userId,
  ]);

  const messages = classroomMessages.roster;

  const setRemoveButtonRef =
    (studentUserId: string) =>
    (node: HTMLButtonElement | null): void => {
      if (node) {
        removeButtonRefs.current.set(studentUserId, node);
      } else {
        removeButtonRefs.current.delete(studentUserId);
      }
    };

  const resetPendingConfirmation = (): void => {
    setConfirmTarget(null);
    setRemoveError(null);
  };

  const handleStateFilterChange = (nextState: RosterStateSelection): void => {
    if (isRemovingRef.current || nextState === stateFilter) {
      return;
    }
    resetPendingConfirmation();
    setStateFilter(nextState);
    setPage(1);
  };

  const handleSearchChange = (nextValue: string): void => {
    if (isRemovingRef.current) {
      return;
    }
    resetPendingConfirmation();
    setSearchQuery(nextValue);
    setPage(1);
  };

  const handleClearFilters = (): void => {
    if (isRemovingRef.current) {
      return;
    }
    resetPendingConfirmation();
    setStateFilter('ALL');
    setSearchQuery('');
    setPage(1);
  };

  const handleOpenConfirmation = (student: RosterStudentDto): void => {
    if (isRemovingRef.current) {
      return;
    }
    restoreTriggerUserIdRef.current = null;
    setRemoveError(null);
    setConfirmTarget(student);
  };

  const handleCancelConfirmation = (): void => {
    if (isRemovingRef.current || confirmTarget === null) {
      return;
    }
    restoreTriggerUserIdRef.current = confirmTarget.userId;
    setConfirmTarget(null);
    setRemoveError(null);
  };

  const handleConfirmRemoval = async (): Promise<void> => {
    if (
      isRemovingRef.current ||
      confirmTarget === null ||
      userId === null ||
      resolvedClassroomId.trim() === ''
    ) {
      return;
    }

    const target = confirmTarget;
    isRemovingRef.current = true;
    setIsRemoving(true);
    setRemoveError(null);

    const controller = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;

    try {
      await removeClassroomStudent(client, resolvedClassroomId, target.userId, {
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }

      restoreTriggerUserIdRef.current = null;
      setConfirmTarget(null);
      setRemoveError(null);
      const confirmationDescription = messages.removedDescription(
        target.displayName,
      );
      setLiveAnnouncement(
        `${messages.removedTitle}: ${confirmationDescription}`,
      );
      toast.success(messages.removedTitle, {
        description: confirmationDescription,
      });

      void queryClient.invalidateQueries({
        predicate: createClassroomRosterPredicate(userId, resolvedClassroomId),
      });
      rosterHeadingRef.current?.focus();
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
          : messages.removeUnexpected;
      setRemoveError(errorMessage);

      if (isNotFoundApiError(error)) {
        void queryClient.invalidateQueries({
          predicate: createClassroomRosterPredicate(
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
          predicate: createClassroomRosterPredicate(
            userId,
            resolvedClassroomId,
          ),
        });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      isRemovingRef.current = false;
      if (isMountedRef.current) {
        setIsRemoving(false);
      }
    }
  };

  const hasActiveFilters =
    stateFilter !== 'ALL' || searchQuery.trim().length > 0;
  const isForbiddenError =
    rosterQuery.isError && isForbiddenApiError(rosterQuery.error);
  const isNotFoundError =
    rosterQuery.isError && isNotFoundApiError(rosterQuery.error);
  const isRevokedAccess = isForbiddenError || isNotFoundError;
  const data = isRevokedAccess ? undefined : rosterQuery.data;

  return (
    <section
      aria-labelledby={rosterHeadingId}
      className="min-w-0 space-y-5 pt-2"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id={rosterHeadingId}
          ref={rosterHeadingRef}
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

      {!isRevokedAccess && (
        <div className="min-w-0 space-y-3 rounded-2xl border border-edge bg-tray/40 p-3.5">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor={searchInputId}>{messages.searchLabel}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={searchInputId}
                type="search"
                value={searchQuery}
                maxLength={ROSTER_SEARCH_MAX_LENGTH}
                placeholder={messages.searchPlaceholder}
                disabled={isRemoving}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="flex-1"
              />
              {searchQuery !== '' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRemoving}
                  onClick={() => handleSearchChange('')}
                  className="min-h-11"
                >
                  {messages.searchClearAction}
                </Button>
              )}
            </div>
          </div>

          <div
            role="group"
            aria-labelledby={filterGroupLabelId}
            className="min-w-0 space-y-1.5"
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
                    disabled={isRemoving}
                    onClick={() => handleStateFilterChange(option)}
                    className="min-h-11"
                  >
                    {messages.stateOptions[option]}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {rosterQuery.isPending && data === undefined && (
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

      {rosterQuery.isError && !isRevokedAccess && data === undefined && (
        <ErrorState
          headingLevel="h4"
          title={messages.errorTitle}
          description={messages.errorDescription}
          onRetry={() => void rosterQuery.refetch()}
          isRetrying={rosterQuery.isRefetching}
        />
      )}

      {rosterQuery.isError && !isRevokedAccess && data !== undefined && (
        <StaleDataNotice
          headingLevel="h4"
          title={messages.staleTitle}
          description={messages.staleDescription}
          onRetry={() => void rosterQuery.refetch()}
          isRetrying={rosterQuery.isRefetching}
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
                : messages.emptyTitle
          }
          description={
            data.total > 0 && page > 1
              ? messages.emptyPageDescription
              : hasActiveFilters
                ? messages.emptyFilteredDescription
                : messages.emptyDescription
          }
          action={
            hasActiveFilters && data.total === 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isRemoving}
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
          {data.items.map((student) => {
            const isActive = student.state === 'ACTIVE';
            const isConfirmingThis = confirmTarget?.userId === student.userId;
            const confirmHeadingId = `${rosterHeadingId}-confirm-${student.userId}`;
            const confirmDescId = `${rosterHeadingId}-desc-${student.userId}`;

            return (
              <li
                key={student.membershipId}
                className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 text-card-foreground shadow-panel"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-semibold text-foreground wrap-anywhere">
                        {student.displayName}
                      </span>
                      <Badge variant={isActive ? 'success' : 'secondary'}>
                        {messages.states[student.state]}
                      </Badge>
                    </div>
                    {!isActive && student.deletedAt !== null && (
                      <p className="text-xs text-muted-foreground">
                        {messages.removedAt(
                          formatRemovedTimestamp(student.deletedAt),
                        )}
                      </p>
                    )}
                  </div>

                  {isActive && (
                    <Button
                      ref={setRemoveButtonRef(student.userId)}
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={messages.removeAriaLabel(student.displayName)}
                      aria-expanded={isConfirmingThis}
                      disabled={isRemoving || isConfirmingThis}
                      onClick={() => handleOpenConfirmation(student)}
                      className="min-h-11 shrink-0"
                    >
                      {messages.removeAction}
                    </Button>
                  )}
                </div>

                <div className="min-w-0 space-y-1.5 border-t border-edge/60 pt-2.5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {messages.guardiansHeading}
                  </p>
                  {student.guardians.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {messages.guardiansEmpty}
                    </p>
                  ) : (
                    <ul className="min-w-0 space-y-1.5">
                      {student.guardians.map((guardian) => (
                        <li
                          key={guardian.id}
                          className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-tray/45 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 font-medium text-foreground wrap-anywhere">
                            {guardian.displayName}
                          </span>
                          <Badge
                            variant={
                              guardian.state === 'ACTIVE' ? 'info' : 'outline'
                            }
                            title={messages.guardianHistoricalNote}
                          >
                            {messages.guardianStates[guardian.state]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
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
                      {messages.confirmTitle(student.displayName)}
                    </h4>
                    <p
                      id={confirmDescId}
                      className="text-sm text-pretty text-muted-foreground"
                    >
                      {messages.confirmDescription}
                    </p>

                    {removeError !== null && (
                      <Alert variant="destructive" role="alert">
                        <AlertTitle>{messages.removeErrorTitle}</AlertTitle>
                        <AlertDescription>{removeError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRemoving}
                        onClick={handleCancelConfirmation}
                        className="min-h-11"
                      >
                        {messages.confirmCancel}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        busy={isRemoving}
                        onClick={() => void handleConfirmRemoval()}
                        className="min-h-11"
                      >
                        {isRemoving
                          ? messages.confirmPending
                          : messages.confirmSubmit}
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
            if (isRemovingRef.current) {
              return;
            }
            resetPendingConfirmation();
            setPage(nextPage);
          }}
          busy={rosterQuery.isFetching}
          disabled={isRemoving}
        />
      )}
    </section>
  );
}
