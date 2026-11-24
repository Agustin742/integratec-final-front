import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomAnnouncementsQueryKey,
  classroomDirectoryMembersQueryKey,
  createClassroomAnnouncementsPredicate,
} from '@/api/query-keys';
import { ErrorState, StaleDataNotice } from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSessionService } from '@/session/provider';
import type { ClassroomDirectoryMemberDto } from '../activities/forum/forum-schema';
import { listClassroomDirectoryMembers } from '../activities/forum/forum-service';
import {
  useClassroomCapabilities,
  useClassroomContext,
} from '../use-classroom-capabilities';
import { AnnouncementForm } from './announcement-form';
import { AnnouncementList } from './announcement-list';
import type { NoticeAuthor } from './announcement-note';
import type { AnnouncementDto } from './announcement-schema';
import {
  isAbortError,
  isUncertainAnnouncementError,
  listClassroomAnnouncements,
  removeClassroomAnnouncement,
} from './announcement-service';
import { announcementMessages } from './messages';
import {
  NoticeBoardEmpty,
  NoticeBoardLoading,
  NoticeBoardSurface,
} from './notice-board-surface';

const PAGE_SIZE = 10;

export function NoticeBoardPanel() {
  const { classroomId } = useParams();
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={announcementMessages.errorTitle}
        description={announcementMessages.errorDescription}
      />
    );
  }
  return (
    <NoticeBoardPanelContent key={classroomId} classroomId={classroomId} />
  );
}

function NoticeBoardPanelContent({ classroomId }: { classroomId: string }) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  const capabilities = useClassroomCapabilities(classroomId);

  const [page, setPage] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);
  // Relative ages tick once a minute; the client clock only phrases them.
  const [now, setNow] = useState(() => Date.now());
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<AnnouncementDto | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    readonly kind: 'success' | 'error';
    readonly title: string;
    readonly description: string;
  } | null>(null);

  const removingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const unmountAbortRef = useRef<AbortController | null>(null);
  const editPageRef = useRef(1);

  useEffect(() => {
    const controller = new AbortController();
    unmountAbortRef.current = controller;
    return () => {
      controller.abort();
      unmountAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const userId = context.status === 'ready' ? context.userId : null;
  const canPublish =
    capabilities.status === 'ready' && capabilities.can('publish_content');
  const canManageSchool =
    capabilities.status === 'ready' && capabilities.can('manage_school');

  const canModifyItem = (item: AnnouncementDto): boolean => {
    if (userId === null) return false;
    return (canPublish && item.authorId === userId) || canManageSchool;
  };

  const query = useQuery({
    queryKey: classroomAnnouncementsQueryKey(
      userId ?? 'signed-out',
      classroomId,
      {
        page,
        pageSize: PAGE_SIZE,
      },
    ),
    queryFn: ({ signal }) =>
      listClassroomAnnouncements(
        client,
        classroomId,
        { page, pageSize: PAGE_SIZE },
        { signal },
      ),
    enabled: userId !== null,
  });

  // Optional, non-blocking lookup so notices can name their author and role.
  const canListDirectory =
    capabilities.status === 'ready' && capabilities.can('list_directory');
  const directoryQuery = useQuery({
    queryKey: classroomDirectoryMembersQueryKey(
      userId ?? 'anonymous',
      classroomId,
      { page: 1, pageSize: 100 },
    ),
    queryFn: ({ signal }) =>
      listClassroomDirectoryMembers(
        client,
        classroomId,
        { page: 1, pageSize: 100 },
        { signal },
      ),
    enabled: userId !== null && canListDirectory,
    staleTime: 60_000,
    retry: false,
  });
  const membersByUserId = useMemo(() => {
    const map = new Map<string, ClassroomDirectoryMemberDto>();
    for (const member of directoryQuery.data?.items ?? []) {
      map.set(member.userId, member);
    }
    return map;
  }, [directoryQuery.data?.items]);

  function resolveAuthor(item: AnnouncementDto): NoticeAuthor {
    const member = membersByUserId.get(item.authorId);
    if (item.authorId === userId) {
      return {
        name: member?.displayName ?? announcementMessages.list.authorSelf,
        role: member?.role ?? null,
      };
    }
    return {
      name: member?.displayName ?? announcementMessages.list.authorFallback,
      role: member?.role ?? null,
    };
  }

  async function reconcileAnnouncements(resetPage = false) {
    if (resetPage) {
      setPage(1);
    }
    if (userId === null) return;
    await queryClient.invalidateQueries({
      predicate: createClassroomAnnouncementsPredicate(userId, classroomId),
    });
    if (
      editingAnnouncement === null ||
      resetPage ||
      editPageRef.current !== page
    ) {
      return;
    }
    const refreshed = queryClient.getQueryData<{
      readonly items: readonly AnnouncementDto[];
    }>(
      classroomAnnouncementsQueryKey(userId, classroomId, {
        page,
        pageSize: PAGE_SIZE,
      }),
    );
    if (
      refreshed &&
      !refreshed.items.some((item) => item.id === editingAnnouncement.id)
    ) {
      setEditingAnnouncement(null);
      headingRef.current?.focus();
    }
  }

  async function handleUncertainCreate(values: {
    readonly title: string;
    readonly content: string;
  }): Promise<boolean> {
    setPage(1);
    if (userId === null) return false;
    const params = { page: 1, pageSize: PAGE_SIZE };
    let first: { readonly items: readonly AnnouncementDto[] };
    try {
      first = await queryClient.fetchQuery({
        queryKey: classroomAnnouncementsQueryKey(userId, classroomId, params),
        queryFn: ({ signal }) =>
          listClassroomAnnouncements(client, classroomId, params, { signal }),
        staleTime: 0,
      });
    } catch {
      return false;
    }
    void queryClient.invalidateQueries({
      predicate: createClassroomAnnouncementsPredicate(userId, classroomId),
    });
    const match = first.items.find(
      (item) =>
        item.authorId === userId &&
        item.title === values.title &&
        item.content === values.content,
    );
    if (!match) return false;
    setComposerOpen(false);
    headingRef.current?.focus();
    setActionNotice({
      kind: 'success',
      title: announcementMessages.form.publishedNoticeTitle,
      description: announcementMessages.form.publishedNoticeDescription(
        match.title,
      ),
    });
    return true;
  }

  function handleEditTargetMissing() {
    setEditingAnnouncement(null);
    setActionNotice({
      kind: 'error',
      title: announcementMessages.form.editMissingNoticeTitle,
      description: announcementMessages.form.serverErrors.notFound,
    });
    void reconcileAnnouncements(false);
    headingRef.current?.focus();
  }

  async function handleFormSuccess(
    saved: AnnouncementDto,
    mode: 'create' | 'edit',
  ) {
    setEditingAnnouncement(null);
    if (mode === 'create') {
      setComposerOpen(false);
      headingRef.current?.focus();
    }
    setActionNotice({
      kind: 'success',
      title:
        mode === 'create'
          ? announcementMessages.form.publishedNoticeTitle
          : announcementMessages.form.updatedNoticeTitle,
      description:
        mode === 'create'
          ? announcementMessages.form.publishedNoticeDescription(saved.title)
          : announcementMessages.form.updatedNoticeDescription(saved.title),
    });
    await reconcileAnnouncements(mode === 'create');
    if (mode === 'edit') {
      headingRef.current?.focus();
    }
  }

  async function handleConfirmRemove(item: AnnouncementDto) {
    if (removingRef.current) {
      return;
    }
    removingRef.current = true;
    setRemovingId(item.id);
    setActionNotice(null);
    try {
      await removeClassroomAnnouncement(client, classroomId, item.id, {
        signal: unmountAbortRef.current?.signal,
      });
      setPendingConfirmId(null);
      if (editingAnnouncement?.id === item.id) {
        setEditingAnnouncement(null);
      }
      setActionNotice({
        kind: 'success',
        title: announcementMessages.list.removedNoticeTitle,
        description: announcementMessages.list.removedNoticeDescription(
          item.title,
        ),
      });
      await reconcileAnnouncements(false);
      headingRef.current?.focus();
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setPendingConfirmId(null);
      if (error instanceof ApiError && error.status === 404) {
        if (editingAnnouncement?.id === item.id) {
          setEditingAnnouncement(null);
        }
        setActionNotice({
          kind: 'success',
          title: announcementMessages.list.alreadyRemovedNoticeTitle,
          description:
            announcementMessages.list.alreadyRemovedNoticeDescription,
        });
        await reconcileAnnouncements(false);
        headingRef.current?.focus();
        return;
      }
      if (isUncertainAnnouncementError(error)) {
        await reconcileAnnouncements(false);
      }
      setActionNotice({
        kind: 'error',
        title: announcementMessages.list.removeErrorTitle,
        description:
          error instanceof ApiError
            ? error.userMessage
            : announcementMessages.errorDescription,
      });
    } finally {
      removingRef.current = false;
      setRemovingId(null);
    }
  }

  if (context.status === 'pending') {
    return <NoticeBoardLoading />;
  }

  if (context.status === 'error') {
    const isForbidden = context.error.status === 403;
    const isNotFound = context.error.status === 404;
    return (
      <ErrorState
        headingLevel="h3"
        title={
          isForbidden
            ? announcementMessages.forbiddenTitle
            : isNotFound
              ? announcementMessages.notFoundTitle
              : announcementMessages.errorTitle
        }
        description={
          isForbidden
            ? announcementMessages.forbiddenDescription
            : isNotFound
              ? announcementMessages.notFoundDescription
              : context.error.userMessage
        }
        onRetry={isForbidden || isNotFound ? undefined : context.retry}
        retryLabel={announcementMessages.retryLabel}
      />
    );
  }

  const listError = query.error instanceof ApiError ? query.error : null;
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
            ? announcementMessages.forbiddenTitle
            : isNotFound
              ? announcementMessages.notFoundTitle
              : announcementMessages.errorTitle
        }
        description={
          isForbidden
            ? announcementMessages.forbiddenDescription
            : isNotFound
              ? announcementMessages.notFoundDescription
              : (listError?.userMessage ??
                announcementMessages.errorDescription)
        }
        onRetry={
          isForbidden || isNotFound
            ? undefined
            : () => {
                void query.refetch();
              }
        }
        retryLabel={announcementMessages.retryLabel}
      />
    );
  }

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  const editForm = (item: AnnouncementDto) => (
    <AnnouncementForm
      key={`edit-${item.id}`}
      classroomId={classroomId}
      mode={{ kind: 'edit', announcement: item }}
      onSubmitStart={() => {
        setIsFormSubmitting(true);
        setActionNotice(null);
      }}
      onSubmitSettled={() => setIsFormSubmitting(false)}
      onEditTargetMissing={handleEditTargetMissing}
      onSuccess={(saved, mode) => {
        void handleFormSuccess(saved, mode);
      }}
      onReconcileRequired={(resetPage) => {
        void reconcileAnnouncements(resetPage);
      }}
      onUncertainCreate={handleUncertainCreate}
      onCancelEdit={() => {
        setEditingAnnouncement(null);
        headingRef.current?.focus();
      }}
    />
  );

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-1">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-2xl font-semibold text-foreground focus:outline-none"
        >
          {announcementMessages.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {announcementMessages.subtitle}
        </p>
      </div>

      {actionNotice ? (
        <Alert
          variant={actionNotice.kind === 'error' ? 'destructive' : 'default'}
        >
          <AlertTitle>{actionNotice.title}</AlertTitle>
          <AlertDescription>{actionNotice.description}</AlertDescription>
        </Alert>
      ) : null}

      {canPublish ? (
        composerOpen ? (
          <AnnouncementForm
            key="create"
            classroomId={classroomId}
            mode={{ kind: 'create' }}
            onSubmitStart={() => {
              setIsFormSubmitting(true);
              setActionNotice(null);
            }}
            onSubmitSettled={() => setIsFormSubmitting(false)}
            onSuccess={(saved, mode) => {
              void handleFormSuccess(saved, mode);
            }}
            onReconcileRequired={(resetPage) => {
              void reconcileAnnouncements(resetPage);
            }}
            onUncertainCreate={handleUncertainCreate}
            onCancelCreate={() => {
              setComposerOpen(false);
              headingRef.current?.focus();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="group flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl border border-edge bg-card px-4 py-3 text-left shadow-ambient transition-colors hover:bg-row-hover focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring sm:px-5"
          >
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="min-w-0 font-display text-base font-semibold text-foreground">
              {announcementMessages.composer.open}
            </span>
          </button>
        )
      ) : null}

      {query.isPending ? (
        <NoticeBoardLoading />
      ) : query.data ? (
        <div className="min-w-0 space-y-4">
          {query.isError ? (
            <StaleDataNotice
              title={announcementMessages.staleBannerTitle}
              description={announcementMessages.staleBannerDescription}
              onRetry={() => {
                void query.refetch();
              }}
              retryLabel={announcementMessages.retryLabel}
            />
          ) : null}

          {query.data.items.length === 0 ? (
            <NoticeBoardEmpty
              title={
                page > 1
                  ? announcementMessages.emptyPageTitle
                  : announcementMessages.emptyTitle
              }
              description={
                page > 1
                  ? announcementMessages.emptyPageDescription
                  : canPublish
                    ? announcementMessages.emptyTeacherDescription
                    : announcementMessages.emptyDescription
              }
              action={
                page > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(1)}
                  >
                    {announcementMessages.list.paginationPrevious}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <NoticeBoardSurface>
                <AnnouncementList
                  items={query.data.items}
                  resolveAuthor={resolveAuthor}
                  now={now}
                  canModifyItem={canModifyItem}
                  editingId={editingAnnouncement?.id ?? null}
                  removingId={removingId}
                  actionsLocked={isFormSubmitting}
                  pendingConfirmId={pendingConfirmId}
                  renderEditor={editForm}
                  onStartEdit={(item) => {
                    setActionNotice(null);
                    setPendingConfirmId(null);
                    editPageRef.current = page;
                    setEditingAnnouncement(item);
                  }}
                  onRequestRemove={(id) => {
                    setActionNotice(null);
                    setPendingConfirmId(id);
                  }}
                  onConfirmRemove={(item) => {
                    void handleConfirmRemove(item);
                  }}
                  onCancelRemove={() => setPendingConfirmId(null)}
                />
              </NoticeBoardSurface>

              {totalPages > 1 ? (
                <PaginationControls
                  page={query.data.page}
                  pageSize={query.data.pageSize}
                  total={query.data.total}
                  onPageChange={(nextPage) => {
                    setPendingConfirmId(null);
                    setPage(nextPage);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
