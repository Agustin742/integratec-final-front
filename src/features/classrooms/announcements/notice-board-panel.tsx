import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomAnnouncementsQueryKey,
  createClassroomAnnouncementsPredicate,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSessionService } from '@/session/provider';
import {
  useClassroomCapabilities,
  useClassroomContext,
} from '../use-classroom-capabilities';
import { AnnouncementForm } from './announcement-form';
import { AnnouncementList } from './announcement-list';
import type { AnnouncementDto } from './announcement-schema';
import {
  isAbortError,
  isUncertainAnnouncementError,
  listClassroomAnnouncements,
  removeClassroomAnnouncement,
} from './announcement-service';
import { announcementMessages } from './messages';

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
      if (
        isUncertainAnnouncementError(error) ||
        (error instanceof ApiError && error.status === 404)
      ) {
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
    return <LoadingState label={announcementMessages.loadingTitle} />;
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

  const showForm =
    canPublish ||
    (editingAnnouncement !== null && canModifyItem(editingAnnouncement));
  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-1">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-foreground focus:outline-none"
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

      {showForm ? (
        <AnnouncementForm
          key={
            editingAnnouncement ? `edit-${editingAnnouncement.id}` : 'create'
          }
          classroomId={classroomId}
          mode={
            editingAnnouncement
              ? { kind: 'edit', announcement: editingAnnouncement }
              : { kind: 'create' }
          }
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
      ) : null}

      {query.isPending ? (
        <LoadingState label={announcementMessages.loadingTitle} />
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
            <EmptyState
              headingLevel="h4"
              title={
                page > 1
                  ? announcementMessages.emptyPageTitle
                  : announcementMessages.emptyTitle
              }
              description={
                page > 1
                  ? announcementMessages.emptyPageDescription
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
              <AnnouncementList
                items={query.data.items}
                canModifyItem={canModifyItem}
                editingId={editingAnnouncement?.id ?? null}
                removingId={removingId}
                actionsLocked={isFormSubmitting}
                pendingConfirmId={pendingConfirmId}
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
