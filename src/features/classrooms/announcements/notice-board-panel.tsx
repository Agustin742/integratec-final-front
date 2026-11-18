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
import { getPaginationMeta } from '@/components/pagination/pagination';
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
  return <NoticeBoardPanelContent classroomId={classroomId} />;
}

function NoticeBoardPanelContent({ classroomId }: { classroomId: string }) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  const capabilities = useClassroomCapabilities(classroomId);

  const [page, setPage] = useState(1);
  const [createResetSeq, setCreateResetSeq] = useState(0);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<AnnouncementDto | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    readonly kind: 'success' | 'error';
    readonly title: string;
    readonly description: string;
  } | null>(null);
  const unmountAbortRef = useRef<AbortController | null>(null);

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
  }

  async function handleFormSuccess(
    saved: AnnouncementDto,
    mode: 'create' | 'edit',
  ) {
    setEditingAnnouncement(null);
    if (mode === 'create') {
      setCreateResetSeq((seq) => seq + 1);
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
  }

  async function handleConfirmRemove(item: AnnouncementDto) {
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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setPendingConfirmId(null);
      if (isUncertainAnnouncementError(error)) {
        await reconcileAnnouncements(false);
      } else if (error instanceof ApiError && error.status === 404) {
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
  const paginationMeta = query.data
    ? getPaginationMeta({
        page: query.data.page,
        pageSize: query.data.pageSize,
        total: query.data.total,
      })
    : null;

  return (
    <div className="min-w-0 space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">
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
        <AnnouncementForm
          key={
            editingAnnouncement
              ? `edit-${editingAnnouncement.id}`
              : `create-${createResetSeq}`
          }
          classroomId={classroomId}
          mode={
            editingAnnouncement
              ? { kind: 'edit', announcement: editingAnnouncement }
              : { kind: 'create' }
          }
          onSuccess={(saved, mode) => {
            void handleFormSuccess(saved, mode);
          }}
          onReconcileRequired={() => {
            void reconcileAnnouncements(false);
          }}
          onCancelEdit={() => setEditingAnnouncement(null)}
        />
      ) : null}

      {query.isPending ? (
        <LoadingState label={announcementMessages.loadingTitle} />
      ) : query.isError && !query.data ? (
        <ErrorState
          headingLevel="h3"
          title={
            listError?.status === 403
              ? announcementMessages.forbiddenTitle
              : listError?.status === 404
                ? announcementMessages.notFoundTitle
                : announcementMessages.errorTitle
          }
          description={
            listError?.status === 403
              ? announcementMessages.forbiddenDescription
              : listError?.status === 404
                ? announcementMessages.notFoundDescription
                : (listError?.userMessage ??
                  announcementMessages.errorDescription)
          }
          onRetry={
            listError?.status === 403 || listError?.status === 404
              ? undefined
              : () => {
                  void query.refetch();
                }
          }
          retryLabel={announcementMessages.retryLabel}
        />
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
                pendingConfirmId={pendingConfirmId}
                onStartEdit={(item) => {
                  setActionNotice(null);
                  setPendingConfirmId(null);
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

              {paginationMeta && paginationMeta.totalPages > 1 ? (
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
