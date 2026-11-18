import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  classroomDetailQueryKey,
  classroomListQueryKey,
  createClassroomListPredicate,
} from '@/api/query-keys';
import { messages as appMessages } from '@/app/messages';
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
import { cn } from '@/lib/utils';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import {
  ClassroomFormDialog,
  type ClassroomFormMode,
  type SchoolContextOption,
} from './classroom-form';
import type {
  ClassroomDetailResponseDto,
  ClassroomListItemDto,
} from './classroom-schema';
import { listAccessibleClassrooms } from './classroom-service';
import { classroomMessages } from './messages';

export interface ClassroomListPageProps {
  readonly title?: string;
}

interface DerivedContextOption {
  readonly key: string;
  readonly kind: 'independent' | 'school';
  readonly schoolId: string | null;
  readonly label: string;
  readonly roleSummary: string;
  readonly canCreate: boolean;
}

const primaryEntryLinkClass =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 font-display text-sm font-semibold text-primary-foreground [--key:var(--key-primary)] key-bevel motion-press focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring';

function canConfigureClassroom(item: ClassroomListItemDto): boolean {
  return item.capabilities.includes('configure_classroom');
}

function getItemContextKey(item: ClassroomListItemDto): string {
  return item.schoolId !== null ? `school:${item.schoolId}` : 'independent';
}

function deriveContextOptions(
  items: readonly ClassroomListItemDto[],
): readonly DerivedContextOption[] {
  const orderedKeys: string[] = [];
  const schoolIds: string[] = [];
  const grouped = new Map<string, ClassroomListItemDto[]>();

  for (const item of items) {
    const key = getItemContextKey(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
      orderedKeys.push(key);
      if (item.schoolId !== null) {
        schoolIds.push(item.schoolId);
      }
    }
    grouped.get(key)!.push(item);
  }

  return orderedKeys.map((key) => {
    const groupItems = grouped.get(key)!;
    const isSchool = key.startsWith('school:');
    const schoolId = isSchool ? groupItems[0].schoolId : null;
    let label: string;
    if (!isSchool) {
      label = classroomMessages.list.contextSwitcher.independentLabel;
    } else if (schoolIds.length <= 1) {
      label = classroomMessages.list.contextSwitcher.schoolSingleLabel;
    } else {
      const index = schoolIds.indexOf(schoolId!) + 1;
      label = classroomMessages.list.contextSwitcher.schoolIndexedLabel(index);
    }

    const uniqueRoles: string[] = [];
    for (const item of groupItems) {
      const roleLabel = classroomMessages.roles[item.myRole];
      if (!uniqueRoles.includes(roleLabel)) {
        uniqueRoles.push(roleLabel);
      }
    }

    return {
      key,
      kind: isSchool ? 'school' : 'independent',
      schoolId,
      label,
      roleSummary: uniqueRoles.join(', '),
      canCreate: groupItems.some(canConfigureClassroom),
    };
  });
}

export function ClassroomListPage({
  title = appMessages.pages.home.title,
}: ClassroomListPageProps) {
  const snapshot = useSessionSnapshot();
  const userId = snapshot.status === 'authenticated' ? snapshot.user.id : null;

  if (userId === null) {
    return null;
  }

  return <ClassroomListWorkspace key={userId} userId={userId} title={title} />;
}

interface ClassroomListWorkspaceProps {
  readonly userId: string;
  readonly title: string;
}

function ClassroomListWorkspace({
  userId,
  title,
}: ClassroomListWorkspaceProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const isDialogDirtyRef = useRef(false);

  const [page, setPage] = useState(1);
  const [activeContextKey, setActiveContextKey] = useState<string>('all');
  const [formMode, setFormMode] = useState<ClassroomFormMode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creationForbidden, setCreationForbidden] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const query = useQuery({
    queryKey: classroomListQueryKey(userId, {
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: '-createdAt',
    }),
    queryFn: ({ signal }) =>
      listAccessibleClassrooms(
        client,
        { page, pageSize: DEFAULT_PAGE_SIZE, sort: '-createdAt' },
        { signal },
      ),
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const contexts = deriveContextOptions(items);
  const showContextSwitcher = contexts.length > 1;
  const effectiveContextKey =
    activeContextKey === 'all' ||
    contexts.some((context) => context.key === activeContextKey)
      ? activeContextKey
      : 'all';

  const visibleItems =
    effectiveContextKey === 'all'
      ? items
      : items.filter((item) => getItemContextKey(item) === effectiveContextKey);

  const activeContext =
    contexts.find((context) => context.key === effectiveContextKey) ?? null;

  const staffSchoolOptions: readonly SchoolContextOption[] = contexts
    .filter(
      (context): context is DerivedContextOption & { schoolId: string } =>
        context.kind === 'school' &&
        context.schoolId !== null &&
        context.canCreate,
    )
    .map((context) => ({
      schoolId: context.schoolId,
      label: `${context.label} (${context.roleSummary})`,
    }));

  const canCreateInScope =
    !creationForbidden &&
    (items.length === 0
      ? true
      : effectiveContextKey === 'all'
        ? items.some(canConfigureClassroom)
        : visibleItems.some(canConfigureClassroom));

  const showHeaderCreateButton =
    query.data !== undefined && items.length > 0 && canCreateInScope;

  const openCreateDialog = (trigger?: HTMLElement | null) => {
    triggerRef.current = trigger ?? null;
    const defaultSchoolId =
      activeContext?.kind === 'school' && activeContext.schoolId
        ? activeContext.schoolId
        : staffSchoolOptions.length === 1
          ? staffSchoolOptions[0].schoolId
          : undefined;
    setFormMode({ kind: 'create', defaultSchoolId });
    setDialogOpen(true);
  };

  const openEditDialog = (
    classroom: ClassroomListItemDto,
    trigger: HTMLElement | null,
  ) => {
    triggerRef.current = trigger;
    setFormMode({ kind: 'edit', classroom });
    setDialogOpen(true);
  };

  const handleContextSelect = (nextKey: string) => {
    if (nextKey === effectiveContextKey) {
      return;
    }
    if (
      dialogOpen &&
      isDialogDirtyRef.current &&
      !window.confirm(classroomMessages.form.actions.unsavedChanges)
    ) {
      return;
    }
    setDialogOpen(false);
    setFormMode(null);
    isDialogDirtyRef.current = false;
    setActiveContextKey(nextKey);
    setStatusMessage('');
  };

  const reconcileListFromServer = () => {
    void queryClient.invalidateQueries({
      predicate: createClassroomListPredicate(userId),
    });
  };

  const handleFormSuccess = (
    saved: ClassroomDetailResponseDto,
    mode: 'create' | 'edit',
  ) => {
    isDialogDirtyRef.current = false;
    setDialogOpen(false);
    setFormMode(null);

    if (mode === 'create') {
      const confirmationTitle = classroomMessages.list.confirmedCreatedTitle;
      const confirmationDescription =
        classroomMessages.list.confirmedCreatedDescription(saved.name);
      setStatusMessage(`${confirmationTitle}: ${confirmationDescription}`);
      toast.success(confirmationTitle, {
        description: confirmationDescription,
      });
      setPage(1);
    } else {
      const confirmationTitle = classroomMessages.list.confirmedUpdatedTitle;
      const confirmationDescription =
        classroomMessages.list.confirmedUpdatedDescription(saved.name);
      setStatusMessage(`${confirmationTitle}: ${confirmationDescription}`);
      toast.success(confirmationTitle, {
        description: confirmationDescription,
      });
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, saved.id),
      });
    }

    reconcileListFromServer();
  };

  const handleFormForbidden = (mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setCreationForbidden(true);
    }
  };

  const formKey = `${userId}:${effectiveContextKey}:${formMode?.kind ?? 'closed'}:${
    formMode?.kind === 'edit'
      ? formMode.classroom.id
      : (formMode?.defaultSchoolId ?? 'none')
  }`;

  return (
    <section className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold tracking-tight text-foreground outline-none wrap-anywhere"
          >
            {title}
          </h2>
          <p className="max-w-prose text-sm text-pretty text-muted-foreground">
            {classroomMessages.list.subtitle}
          </p>
        </div>

        {showHeaderCreateButton && (
          <Button
            type="button"
            onClick={(event) => openCreateDialog(event.currentTarget)}
          >
            {classroomMessages.list.createAction}
          </Button>
        )}
      </div>

      <LiveRegion message={statusMessage} visuallyHidden />

      {creationForbidden && (
        <Alert variant="destructive" role="alert">
          <AlertTitle as="h3">
            {classroomMessages.list.forbiddenAlertTitle}
          </AlertTitle>
          <AlertDescription>
            {classroomMessages.list.forbiddenAlertDescription}
          </AlertDescription>
        </Alert>
      )}

      {query.isPending && (
        <LoadingState label={classroomMessages.list.loading} />
      )}

      {query.isError && query.data === undefined && (
        <ErrorState
          headingLevel="h3"
          title={classroomMessages.list.errorTitle}
          description={classroomMessages.list.errorDescription}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {query.isError && query.data !== undefined && (
        <StaleDataNotice
          headingLevel="h3"
          title={classroomMessages.list.staleTitle}
          description={classroomMessages.list.staleDescription}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      )}

      {query.data !== undefined && (
        <div className="min-w-0 space-y-5">
          {showContextSwitcher && (
            <section
              aria-label={classroomMessages.list.contextSwitcher.regionLabel}
              className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-4 shadow-panel"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-foreground">
                  {classroomMessages.list.contextSwitcher.heading}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {classroomMessages.list.contextSwitcher.activeSummaryPrefix}{' '}
                  <span className="font-semibold text-foreground">
                    {activeContext
                      ? `${activeContext.label} (${activeContext.roleSummary})`
                      : classroomMessages.list.contextSwitcher.allLabel}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    effectiveContextKey === 'all' ? 'default' : 'outline'
                  }
                  aria-pressed={effectiveContextKey === 'all'}
                  onClick={() => handleContextSelect('all')}
                >
                  {classroomMessages.list.contextSwitcher.allLabel}
                </Button>
                {contexts.map((context) => {
                  const selected = effectiveContextKey === context.key;
                  return (
                    <Button
                      key={context.key}
                      type="button"
                      size="sm"
                      variant={selected ? 'default' : 'outline'}
                      aria-pressed={selected}
                      onClick={() => handleContextSelect(context.key)}
                    >
                      {`${context.label} · ${context.roleSummary}`}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {classroomMessages.list.contextSwitcher.discardNotice}
              </p>
            </section>
          )}

          {items.length === 0 ? (
            <EmptyState
              headingLevel="h3"
              title={classroomMessages.list.emptyTitle}
              description={
                creationForbidden
                  ? classroomMessages.list.emptyForbiddenDescription
                  : classroomMessages.list.emptyTeacherDescription
              }
              action={
                !creationForbidden ? (
                  <Button
                    type="button"
                    onClick={(event) => openCreateDialog(event.currentTarget)}
                  >
                    {classroomMessages.list.createFirstAction}
                  </Button>
                ) : undefined
              }
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              headingLevel="h3"
              title={classroomMessages.list.emptyFilteredTitle}
              description={classroomMessages.list.emptyFilteredDescription}
            />
          ) : (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {visibleItems.map((classroom) => {
                const canConfigure = canConfigureClassroom(classroom);
                const pathLabel =
                  classroom.schoolId !== null
                    ? classroomMessages.list.paths.school
                    : classroomMessages.list.paths.independent;
                const modeLabel = classroom.adultMode
                  ? classroomMessages.list.modes.adult
                  : classroomMessages.list.modes.school;

                return (
                  <article
                    key={classroom.id}
                    className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel"
                  >
                    <div className="min-w-0 space-y-2.5">
                      <h3 className="font-display text-lg font-semibold text-foreground wrap-anywhere">
                        {classroom.name}
                      </h3>
                      <p className="text-sm text-pretty text-muted-foreground wrap-anywhere">
                        {classroom.subject ?? classroomMessages.list.noSubject}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <Badge variant="secondary">
                          {classroomMessages.roles[classroom.myRole]}
                        </Badge>
                        <Badge variant="outline">{pathLabel}</Badge>
                        <Badge
                          variant={classroom.adultMode ? 'warning' : 'info'}
                        >
                          {modeLabel}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Link
                        to={`/classrooms/${encodeURIComponent(classroom.id)}`}
                        className={cn(primaryEntryLinkClass)}
                      >
                        {classroomMessages.list.enterAction}
                      </Link>
                      {canConfigure && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(event) =>
                            openEditDialog(classroom, event.currentTarget)
                          }
                        >
                          {classroomMessages.list.configureAction}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {(total > DEFAULT_PAGE_SIZE || page > 1) && (
            <PaginationControls
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              total={total}
              busy={query.isFetching}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          )}
        </div>
      )}

      <ClassroomFormDialog
        open={dialogOpen}
        formKey={formKey}
        mode={formMode}
        availableSchools={staffSchoolOptions}
        onOpenChange={(nextOpen) => {
          setDialogOpen(nextOpen);
          if (!nextOpen) {
            isDialogDirtyRef.current = false;
            setFormMode(null);
          }
        }}
        onSuccess={handleFormSuccess}
        onForbidden={handleFormForbidden}
        onReconcileRequired={reconcileListFromServer}
        onDirtyStateChange={(dirty) => {
          isDialogDirtyRef.current = dirty;
        }}
        fallbackFocus={() => headingRef.current}
        getTriggerElement={() => triggerRef.current}
      />
    </section>
  );
}
