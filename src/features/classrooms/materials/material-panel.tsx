import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomBotMaterialsQueryKey,
  classroomMaterialsQueryKey,
  createClassroomBotMaterialsPredicate,
  createClassroomMaterialsPredicate,
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
import type {
  BotAllowedMaterialDto,
  BotAllowedMaterialListDto,
} from './material-bot-schema';
import {
  isUncertainBotMaterialError,
  listClassroomBotMaterials,
  setClassroomBotMaterialEnabled,
} from './material-bot-service';
import { MaterialBotToggleSlot } from './material-bot-toggle';
import { MaterialList } from './material-list';
import type { MaterialDto } from './material-schema';
import {
  listClassroomMaterials,
  removeClassroomMaterial,
  requestMaterialDownload,
} from './material-service';
import { MaterialUploadSection } from './material-upload';
import { materialMessages } from './messages';

const PAGE_SIZE = 10;

export interface MaterialPanelProps {
  /** Extension slot for HU-BOT-001 (bot-enabled switch & indexing status). */
  readonly renderItemSlot?: (material: MaterialDto) => ReactNode;
}

export function MaterialPanel({ renderItemSlot }: MaterialPanelProps = {}) {
  const { classroomId } = useParams();
  if (!classroomId) {
    return (
      <ErrorState
        headingLevel="h3"
        title={materialMessages.errorTitle}
        description={materialMessages.errorDescription}
      />
    );
  }
  return (
    <MaterialPanelContent
      classroomId={classroomId}
      renderItemSlot={renderItemSlot}
    />
  );
}

function MaterialPanelContent({
  classroomId,
  renderItemSlot,
}: {
  classroomId: string;
  renderItemSlot?: (material: MaterialDto) => ReactNode;
}) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  const capabilities = useClassroomCapabilities(classroomId);

  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    readonly kind: 'success' | 'error';
    readonly title: string;
    readonly description: string;
  } | null>(null);
  const [togglingBotIds, setTogglingBotIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const togglingBotRef = useRef<Set<string>>(new Set());
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
  const canManage =
    capabilities.status === 'ready' && capabilities.can('publish_content');
  const canConfigureBot =
    capabilities.status === 'ready' && capabilities.can('configure_bot');

  const query = useQuery({
    queryKey: classroomMaterialsQueryKey(userId ?? 'signed-out', classroomId, {
      page,
      pageSize: PAGE_SIZE,
      sort: '-createdAt',
    }),
    queryFn: ({ signal }) =>
      listClassroomMaterials(
        client,
        classroomId,
        { page, pageSize: PAGE_SIZE, sort: '-createdAt' },
        { signal },
      ),
    enabled: userId !== null,
  });

  const botQuery = useQuery({
    queryKey: classroomBotMaterialsQueryKey(
      userId ?? 'signed-out',
      classroomId,
    ),
    queryFn: ({ signal }) =>
      listClassroomBotMaterials(client, classroomId, { signal }),
    enabled: userId !== null && canConfigureBot,
    refetchInterval: (currentQuery) => {
      const hasPending = currentQuery.state.data?.items.some(
        (entry) => entry.indexingStatus === 'pending',
      );
      return hasPending ? 4000 : false;
    },
  });

  async function reconcileMaterials(resetPage = false) {
    if (resetPage) {
      setPage(1);
    }
    if (userId === null) return;
    await queryClient.invalidateQueries({
      predicate: createClassroomMaterialsPredicate(userId, classroomId),
    });
    if (canConfigureBot) {
      await queryClient.invalidateQueries({
        predicate: createClassroomBotMaterialsPredicate(userId, classroomId),
      });
    }
  }

  async function handleToggleBotMaterial(
    material: MaterialDto,
    nextEnabled: boolean,
  ) {
    if (userId === null || !canConfigureBot) return;
    if (togglingBotRef.current.has(material.id)) return;
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return;

    togglingBotRef.current.add(material.id);
    setTogglingBotIds((prev) => new Set(prev).add(material.id));
    setActionNotice(null);

    try {
      const confirmed = await setClassroomBotMaterialEnabled(
        client,
        classroomId,
        material.id,
        { enabled: nextEnabled },
        { signal },
      );
      if (signal?.aborted) return;

      queryClient.setQueryData<BotAllowedMaterialListDto>(
        classroomBotMaterialsQueryKey(userId, classroomId),
        (previous) => {
          const existing = previous?.items ?? [];
          const withoutCurrent = existing.filter(
            (entry) => entry.materialId !== confirmed.materialId,
          );
          return {
            items: [...withoutCurrent, confirmed],
          };
        },
      );

      setActionNotice({
        kind: 'success',
        title: confirmed.botEnabled
          ? materialMessages.list.bot.confirmedEnabledTitle
          : materialMessages.list.bot.confirmedDisabledTitle,
        description: confirmed.botEnabled
          ? materialMessages.list.bot.confirmedEnabledDescription(
              material.filename,
            )
          : materialMessages.list.bot.confirmedDisabledDescription(
              material.filename,
            ),
      });
    } catch (error) {
      if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === 'AbortError'
      ) {
        return;
      }
      const description =
        error instanceof ApiError
          ? error.userMessage
          : materialMessages.list.bot.toggleErrors.unexpected;
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.bot.toggleErrorTitle,
        description,
      });
      if (
        isUncertainBotMaterialError(error) ||
        (error instanceof ApiError && error.kind === 'not-found')
      ) {
        await reconcileMaterials();
      }
    } finally {
      togglingBotRef.current.delete(material.id);
      if (!signal?.aborted) {
        setTogglingBotIds((prev) => {
          const next = new Set(prev);
          next.delete(material.id);
          return next;
        });
      }
    }
  }

  async function handleUploaded(filename: string) {
    setActionNotice({
      kind: 'success',
      title: materialMessages.upload.confirmedTitle,
      description: materialMessages.upload.confirmedDescription(filename),
    });
    await reconcileMaterials(true);
  }

  async function handleDownload(material: MaterialDto) {
    if (downloadingId !== null) return;
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return;
    setActionNotice(null);
    setDownloadingId(material.id);
    try {
      const { url } = await requestMaterialDownload(
        client,
        classroomId,
        material.id,
        { signal },
      );
      if (signal?.aborted) return;
      // Open server-issued short-lived signed URL without storing or logging it.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      if (
        (error instanceof Error || error instanceof DOMException) &&
        error.name === 'AbortError'
      ) {
        return;
      }
      const description =
        error instanceof ApiError
          ? error.userMessage
          : materialMessages.list.downloadErrors.unexpected;
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.downloadErrorTitle,
        description,
      });
    } finally {
      if (!signal?.aborted) {
        setDownloadingId(null);
      }
    }
  }

  async function handleConfirmRemove(material: MaterialDto) {
    if (removingId !== null) return;
    setActionNotice(null);
    setRemovingId(material.id);
    try {
      await removeClassroomMaterial(client, classroomId, material.id);
      setPendingConfirmId(null);
      setActionNotice({
        kind: 'success',
        title: materialMessages.list.confirmedRemovedTitle,
        description: materialMessages.list.confirmedRemovedDescription(
          material.filename,
        ),
      });
      await reconcileMaterials();
    } catch (error) {
      setPendingConfirmId(null);
      const description =
        error instanceof ApiError
          ? error.userMessage
          : materialMessages.list.removeErrors.unexpected;
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.removeErrorTitle,
        description,
      });
      if (error instanceof ApiError && error.kind === 'not-found') {
        await reconcileMaterials();
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (context.status === 'error') {
    return (
      <ErrorState
        headingLevel="h3"
        title={materialMessages.errorTitle}
        description={context.error.userMessage}
        onRetry={context.retry}
      />
    );
  }

  if (context.status === 'pending' || query.isPending) {
    return <LoadingState label={materialMessages.loading} />;
  }

  if (query.isError && query.data === undefined) {
    const errorDescription =
      query.error instanceof ApiError
        ? query.error.userMessage
        : materialMessages.errorDescription;
    return (
      <ErrorState
        headingLevel="h3"
        title={materialMessages.errorTitle}
        description={errorDescription}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  if (!data) {
    return <LoadingState label={materialMessages.loading} />;
  }

  const pagination = getPaginationMeta({
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
  });

  const botStateByMaterialId = new Map<string, BotAllowedMaterialDto>(
    (botQuery.data?.items ?? []).map((entry) => [entry.materialId, entry]),
  );

  const effectiveRenderItemSlot =
    renderItemSlot ??
    (canConfigureBot
      ? (material: MaterialDto) => (
          <MaterialBotToggleSlot
            material={material}
            botState={botStateByMaterialId.get(material.id)}
            isConfigPending={botQuery.isPending}
            isConfigError={botQuery.isError}
            isToggling={togglingBotIds.has(material.id)}
            onToggle={(target, nextEnabled) =>
              void handleToggleBotMaterial(target, nextEnabled)
            }
          />
        )
      : undefined);

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">
        {materialMessages.subtitle}
      </p>

      {canManage && (
        <MaterialUploadSection
          client={client}
          classroomId={classroomId}
          onUploaded={handleUploaded}
          onReconcileRequired={() => reconcileMaterials(true)}
          onInteraction={() => setActionNotice(null)}
        />
      )}

      {actionNotice && (
        <Alert
          variant={actionNotice.kind === 'error' ? 'destructive' : 'default'}
          role={actionNotice.kind === 'error' ? 'alert' : 'status'}
        >
          <AlertTitle>{actionNotice.title}</AlertTitle>
          <AlertDescription>{actionNotice.description}</AlertDescription>
        </Alert>
      )}

      {canConfigureBot && botQuery.isError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{materialMessages.list.bot.toggleErrorTitle}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{materialMessages.list.bot.loadErrorNotice}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void botQuery.refetch()}
            >
              {materialMessages.list.bot.retryLoadAction}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {query.isError && (
        <StaleDataNotice
          title={materialMessages.staleTitle}
          description={materialMessages.staleDescription}
          onRetry={() => void query.refetch()}
        />
      )}

      {data.items.length === 0 ? (
        page > 1 ? (
          <EmptyState
            title={materialMessages.emptyPageTitle}
            description={materialMessages.emptyPageDescription}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
              >
                {materialMessages.goToFirstPageAction}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={materialMessages.emptyTitle}
            description={
              canManage
                ? materialMessages.emptyTeacherDescription
                : materialMessages.emptyStudentDescription
            }
          />
        )
      ) : (
        <div className="space-y-4">
          <MaterialList
            items={data.items}
            canManage={canManage}
            downloadingId={downloadingId}
            removingId={removingId}
            pendingConfirmId={pendingConfirmId}
            onDownload={(material) => void handleDownload(material)}
            onRequestRemove={(materialId) => setPendingConfirmId(materialId)}
            onConfirmRemove={(material) => void handleConfirmRemove(material)}
            onCancelRemove={() => setPendingConfirmId(null)}
            renderItemSlot={effectiveRenderItemSlot}
          />

          {pagination.totalPages > 1 && (
            <PaginationControls
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(nextPage: number) => {
                setPendingConfirmId(null);
                setPage(nextPage);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
