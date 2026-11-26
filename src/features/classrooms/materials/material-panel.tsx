import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomBotMaterialsQueryKey,
  classroomDetailQueryKey,
  classroomMaterialModulesQueryKey,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import {
  useClassroomCapabilities,
  useClassroomContext,
} from '../use-classroom-capabilities';
import type {
  BotAllowedMaterialDto,
  BotAllowedMaterialListDto,
} from './material-bot-schema';
import {
  disableClassroomBotMaterial,
  enableClassroomBotMaterial,
  isUncertainBotMaterialError,
  listClassroomBotMaterials,
} from './material-bot-service';
import { MaterialBotToggleSlot } from './material-bot-toggle';
import {
  MaterialModuleSection,
  type FocusRequest,
  type ModuleSectionTarget,
} from './material-module-section';
import type { MaterialFileActions } from './material-row';
import type { MaterialDto } from './material-schema';
import {
  isUncertainMaterialError,
  listClassroomMaterials,
  moveClassroomMaterial,
  removeClassroomMaterial,
  requestMaterialDownload,
} from './material-service';
import { MaterialUploadSection } from './material-upload';
import {
  DeleteModuleDialog,
  ModuleFormDialog,
  MoveMaterialDialog,
  UploadDialog,
} from './module-dialogs';
import { MODULE_CAP, type MaterialModuleDto } from './module-schema';
import {
  createMaterialModule,
  isUncertainModuleError,
  listMaterialModules,
  removeMaterialModule,
  reorderMaterialModules,
  updateMaterialModule,
} from './module-service';
import { materialMessages } from './messages';

const PAGE_SIZE = 10;
const copy = materialMessages.modules;

export interface MaterialPanelProps {
  /** Extension slot for HU-BOT-001 (bot-enabled switch & indexing status). */
  readonly renderItemSlot?: (material: MaterialDto) => ReactNode;
}

type DialogState =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly module: MaterialModuleDto }
  | { readonly kind: 'delete'; readonly module: MaterialModuleDto }
  | { readonly kind: 'move'; readonly material: MaterialDto }
  | { readonly kind: 'upload'; readonly target: ModuleSectionTarget };

interface ActionNotice {
  readonly kind: 'success' | 'error';
  readonly title: string;
  readonly description: string;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.userMessage : fallback;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === 'AbortError'
  );
}

export function MaterialPanel({ renderItemSlot }: MaterialPanelProps = {}) {
  const { classroomId } = useParams();
  const session = useSessionSnapshot();
  const userId =
    session.status === 'authenticated' ? session.user.id : 'signed-out';
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
      key={`${userId}:${classroomId}`}
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

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingConfirmId, setPendingConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [reordering, setReordering] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [togglingBotIds, setTogglingBotIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const togglingBotRef = useRef<Set<string>>(new Set());
  const removingRef = useRef(false);
  const reorderingRef = useRef(false);
  const terminalBotReconciledRef = useRef(false);
  const terminalMaterialsReconciledRef = useRef(false);
  const unmountAbortRef = useRef<AbortController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusNonceRef = useRef(0);

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

  const [prevCanManage, setPrevCanManage] = useState(canManage);
  if (prevCanManage !== canManage) {
    setPrevCanManage(canManage);
    if (!canManage) {
      setDialog(null);
      setPendingConfirmId(null);
    }
  }

  const modulesKey = classroomMaterialModulesQueryKey(
    userId ?? 'signed-out',
    classroomId,
  );
  const modulesQuery = useQuery({
    queryKey: modulesKey,
    queryFn: ({ signal }) =>
      listMaterialModules(client, classroomId, { signal }),
    enabled: userId !== null,
  });

  // The "Sin módulo" list doubles as the panel-level count: its first page is
  // shared with the section through the same query key.
  const unassignedQuery = useQuery({
    queryKey: classroomMaterialsQueryKey(userId ?? 'signed-out', classroomId, {
      page: 1,
      pageSize: PAGE_SIZE,
      sort: '-createdAt',
      moduleId: 'unassigned',
    }),
    queryFn: ({ signal }) =>
      listClassroomMaterials(
        client,
        classroomId,
        {
          page: 1,
          pageSize: PAGE_SIZE,
          sort: '-createdAt',
          moduleId: 'unassigned',
        },
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
      if (currentQuery.state.status === 'error') {
        return false;
      }
      const hasPending = currentQuery.state.data?.items.some(
        (entry) => entry.indexState === 'PENDING',
      );
      return hasPending ? 4000 : false;
    },
  });

  const isTerminalBotConfigError =
    botQuery.isError &&
    botQuery.error instanceof ApiError &&
    (botQuery.error.kind === 'forbidden' ||
      botQuery.error.kind === 'not-found');

  useEffect(() => {
    if (userId === null) return;
    if (!canConfigureBot) {
      terminalBotReconciledRef.current = false;
      void queryClient.removeQueries({
        predicate: createClassroomBotMaterialsPredicate(userId, classroomId),
      });
      return;
    }
    if (!isTerminalBotConfigError) {
      terminalBotReconciledRef.current = false;
      return;
    }
    if (!terminalBotReconciledRef.current) {
      terminalBotReconciledRef.current = true;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
      });
    }
  }, [
    canConfigureBot,
    classroomId,
    isTerminalBotConfigError,
    queryClient,
    userId,
  ]);

  async function reconcileMaterials() {
    if (userId === null) return;
    await Promise.all([
      queryClient.invalidateQueries({
        predicate: createClassroomMaterialsPredicate(userId, classroomId),
      }),
      queryClient.invalidateQueries({ queryKey: modulesKey, exact: true }),
    ]);
    if (canConfigureBot) {
      await queryClient.invalidateQueries({
        predicate: createClassroomBotMaterialsPredicate(userId, classroomId),
      });
    }
  }

  function openDialog(next: DialogState, trigger: HTMLElement | null) {
    setActionNotice(null);
    returnFocusRef.current = trigger;
    setDialog(next);
  }

  function closeDialog() {
    setDialog(null);
  }

  function restoreFocus(event: Event) {
    event.preventDefault();
    const target = returnFocusRef.current;
    (target?.isConnected ? target : rootRef.current)?.focus();
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
      await queryClient.cancelQueries({
        predicate: createClassroomBotMaterialsPredicate(userId, classroomId),
      });
      // `null` once the server confirmed the material is no longer allowed.
      let confirmed: BotAllowedMaterialDto | null = null;
      if (nextEnabled) {
        confirmed = await enableClassroomBotMaterial(
          client,
          classroomId,
          material.id,
          { signal },
        );
      } else {
        await disableClassroomBotMaterial(client, classroomId, material.id, {
          signal,
        });
      }
      if (signal?.aborted) return;

      await queryClient.cancelQueries({
        predicate: createClassroomBotMaterialsPredicate(userId, classroomId),
      });
      if (signal?.aborted) return;

      queryClient.setQueryData<BotAllowedMaterialListDto>(
        classroomBotMaterialsQueryKey(userId, classroomId),
        (previous) => {
          const others = (previous?.items ?? []).filter(
            (entry) => entry.materialId !== material.id,
          );
          return { items: confirmed ? [...others, confirmed] : others };
        },
      );

      const copyBot = materialMessages.list.bot;
      if (!confirmed) {
        setActionNotice({
          kind: 'success',
          title: copyBot.confirmedDisabledTitle,
          description: copyBot.confirmedDisabledDescription(material.filename),
        });
      } else if (confirmed.indexState === 'FAILED') {
        setActionNotice({
          kind: 'error',
          title: copyBot.indexFailedTitle,
          description: copyBot.indexFailedDescription(material.filename),
        });
      } else {
        setActionNotice({
          kind: 'success',
          title: copyBot.confirmedEnabledTitle,
          description: copyBot.confirmedEnabledDescription(material.filename),
        });
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.bot.toggleErrorTitle,
        description: messageFrom(
          error,
          materialMessages.list.bot.toggleErrors.unexpected,
        ),
      });
      if (
        error instanceof ApiError &&
        (error.kind === 'forbidden' || error.kind === 'not-found')
      ) {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
        if (error.kind === 'not-found') {
          await reconcileMaterials();
        }
      } else if (isUncertainBotMaterialError(error)) {
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
    closeDialog();
    await reconcileMaterials();
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
      if (isAbortError(error)) {
        return;
      }
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.downloadErrorTitle,
        description: messageFrom(
          error,
          materialMessages.list.downloadErrors.unexpected,
        ),
      });
    } finally {
      if (!signal?.aborted) {
        setDownloadingId(null);
      }
    }
  }

  async function handleConfirmRemove(material: MaterialDto) {
    if (userId === null || !canManage || removingRef.current) return;
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return;
    removingRef.current = true;
    setActionNotice(null);
    setRemovingId(material.id);
    try {
      await removeClassroomMaterial(client, classroomId, material.id, {
        signal,
      });
      if (signal?.aborted) return;
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
      if (isAbortError(error) || signal?.aborted) return;
      setPendingConfirmId(null);
      const uncertain = isUncertainMaterialError(error);
      setActionNotice({
        kind: 'error',
        title: materialMessages.list.removeErrorTitle,
        description: uncertain
          ? materialMessages.list.removeErrors.uncertain
          : messageFrom(error, materialMessages.list.removeErrors.unexpected),
      });
      if (error instanceof ApiError && error.kind === 'forbidden') {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
      }
      if (
        uncertain ||
        (error instanceof ApiError && error.kind === 'not-found')
      ) {
        await reconcileMaterials();
      }
    } finally {
      removingRef.current = false;
      if (!signal?.aborted) {
        setRemovingId(null);
      }
    }
  }

  async function handleSubmitModule(
    values: { readonly name: string; readonly description: string },
    editing: MaterialModuleDto | null,
  ): Promise<string | null> {
    if (userId === null || !canManage) {
      return materialMessages.upload.serverErrors.forbidden;
    }
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return null;
    try {
      if (editing) {
        const saved = await updateMaterialModule(
          client,
          classroomId,
          editing.id,
          {
            name: values.name,
            description: values.description === '' ? null : values.description,
          },
          { signal },
        );
        if (signal?.aborted) return null;
        setActionNotice({
          kind: 'success',
          title: copy.updatedTitle,
          description: copy.updatedDescription(saved.name),
        });
      } else {
        const created = await createMaterialModule(
          client,
          classroomId,
          {
            name: values.name,
            ...(values.description === ''
              ? {}
              : { description: values.description }),
          },
          { signal },
        );
        if (signal?.aborted) return null;
        setActionNotice({
          kind: 'success',
          title: copy.createdTitle,
          description: copy.createdDescription(created.name),
        });
      }
      closeDialog();
      await queryClient.invalidateQueries({
        queryKey: modulesKey,
        exact: true,
      });
      return null;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return null;
      if (error instanceof ApiError && error.kind === 'forbidden') {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
      }
      const uncertain = isUncertainModuleError(error);
      if (
        uncertain ||
        (error instanceof ApiError &&
          (error.kind === 'not-found' || error.kind === 'conflict'))
      ) {
        await reconcileMaterials();
      }
      if (signal?.aborted) return null;
      return uncertain
        ? copy.uncertainAction
        : messageFrom(error, copy.unexpected);
    }
  }

  async function handleDeleteModule(
    target: MaterialModuleDto,
  ): Promise<string | null> {
    if (userId === null || !canManage) {
      return materialMessages.upload.serverErrors.forbidden;
    }
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return null;
    try {
      await removeMaterialModule(client, classroomId, target.id, { signal });
      if (signal?.aborted) return null;
      setActionNotice({
        kind: 'success',
        title: copy.deletedTitle,
        description: copy.deletedDescription(target.name),
      });
      closeDialog();
      await reconcileMaterials();
      return null;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return null;
      if (error instanceof ApiError && error.kind === 'forbidden') {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
      }
      const uncertain = isUncertainModuleError(error);
      if (
        uncertain ||
        (error instanceof ApiError && error.kind === 'not-found')
      ) {
        await reconcileMaterials();
      }
      if (signal?.aborted) return null;
      return uncertain
        ? copy.uncertainAction
        : messageFrom(error, copy.unexpected);
    }
  }

  async function handleMoveMaterial(
    material: MaterialDto,
    destination: string | null,
  ): Promise<string | null> {
    if (userId === null || !canManage) {
      return materialMessages.upload.serverErrors.forbidden;
    }
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return null;
    try {
      await moveClassroomMaterial(
        client,
        classroomId,
        material.id,
        destination,
        { signal },
      );
      if (signal?.aborted) return null;
      const destinationName =
        modulesQuery.data?.items.find((entry) => entry.id === destination)
          ?.name ?? copy.unassignedTitle;
      setActionNotice({
        kind: 'success',
        title: copy.moveDialog.movedTitle,
        description: copy.moveDialog.movedDescription(
          material.filename,
          destinationName,
        ),
      });
      closeDialog();
      await reconcileMaterials();
      return null;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return null;
      if (error instanceof ApiError && error.kind === 'forbidden') {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
      }
      const uncertain = isUncertainMaterialError(error);
      if (
        uncertain ||
        (error instanceof ApiError && error.kind === 'not-found')
      ) {
        await reconcileMaterials();
      }
      if (signal?.aborted) return null;
      return uncertain
        ? copy.uncertainAction
        : messageFrom(error, copy.unexpected);
    }
  }

  async function handleReorder(moduleId: string, direction: 'up' | 'down') {
    const modules = modulesQuery.data?.items;
    if (userId === null || !canManage || reorderingRef.current || !modules) {
      return;
    }
    const signal = unmountAbortRef.current?.signal;
    if (signal?.aborted) return;
    const from = modules.findIndex((entry) => entry.id === moduleId);
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= modules.length) return;
    const ids = modules.map((entry) => entry.id);
    const [moved] = ids.splice(from, 1);
    if (moved === undefined) return;
    ids.splice(to, 0, moved);

    reorderingRef.current = true;
    setActionNotice(null);
    setReordering(true);
    try {
      const result = await reorderMaterialModules(client, classroomId, ids, {
        signal,
      });
      if (signal?.aborted) return;
      queryClient.setQueryData(modulesKey, result);
      const atEnd = direction === 'up' ? to === 0 : to === modules.length - 1;
      const pressed = direction;
      const sibling = direction === 'up' ? 'down' : 'up';
      focusNonceRef.current += 1;
      setFocusRequest({
        moduleId,
        focus: atEnd ? sibling : pressed,
        nonce: focusNonceRef.current,
      });
      setActionNotice({
        kind: 'success',
        title: copy.reorderedTitle,
        description: copy.movedNotice(
          modules[from]?.name ?? '',
          to + 1,
          modules.length,
        ),
      });
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) return;
      if (error instanceof ApiError && error.kind === 'forbidden') {
        await queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
        });
      }
      setActionNotice({
        kind: 'error',
        title: copy.reorderErrorTitle,
        description: isUncertainModuleError(error)
          ? copy.uncertainAction
          : messageFrom(error, copy.unexpected),
      });
      await queryClient.invalidateQueries({
        queryKey: modulesKey,
        exact: true,
      });
    } finally {
      reorderingRef.current = false;
      if (!signal?.aborted) {
        setReordering(false);
      }
    }
  }

  const failedQuery =
    modulesQuery.isError && modulesQuery.data === undefined
      ? modulesQuery
      : unassignedQuery.isError && unassignedQuery.data === undefined
        ? unassignedQuery
        : null;
  const isTerminalMaterialLoadError =
    failedQuery !== null &&
    failedQuery.error instanceof ApiError &&
    (failedQuery.error.kind === 'forbidden' ||
      failedQuery.error.kind === 'not-found');

  useEffect(() => {
    if (userId === null) return;
    if (!isTerminalMaterialLoadError) {
      terminalMaterialsReconciledRef.current = false;
      return;
    }
    if (!terminalMaterialsReconciledRef.current) {
      terminalMaterialsReconciledRef.current = true;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
      });
    }
  }, [classroomId, isTerminalMaterialLoadError, queryClient, userId]);

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

  if (
    context.status === 'pending' ||
    modulesQuery.isPending ||
    unassignedQuery.isPending
  ) {
    return <LoadingState label={materialMessages.loading} />;
  }

  if (failedQuery) {
    return (
      <ErrorState
        headingLevel="h3"
        title={materialMessages.errorTitle}
        description={
          failedQuery.error instanceof ApiError
            ? failedQuery.error.userMessage
            : materialMessages.errorDescription
        }
        onRetry={
          isTerminalMaterialLoadError
            ? undefined
            : () => {
                void modulesQuery.refetch();
                void unassignedQuery.refetch();
              }
        }
      />
    );
  }

  const modules = modulesQuery.data?.items ?? [];
  const unassignedTotal = unassignedQuery.data?.total ?? 0;
  const isEmpty = modules.length === 0 && unassignedTotal === 0;
  const atCap = modules.length >= MODULE_CAP;
  const isStale = modulesQuery.isError || unassignedQuery.isError;

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

  const fileActions: MaterialFileActions = {
    canManage,
    downloadingId,
    removingId,
    pendingConfirmId,
    onDownload: (material) => void handleDownload(material),
    onRequestMove: (material, trigger) =>
      openDialog({ kind: 'move', material }, trigger),
    onRequestRemove: (materialId) => setPendingConfirmId(materialId),
    onConfirmRemove: (material) => void handleConfirmRemove(material),
    onCancelRemove: () => setPendingConfirmId(null),
    renderItemSlot: effectiveRenderItemSlot,
  };

  const sectionShared = {
    client,
    userId: userId ?? 'signed-out',
    classroomId,
    canManage,
    reordering,
    focusRequest,
    fileActions,
    onMove: (moduleId: string, direction: 'up' | 'down') =>
      void handleReorder(moduleId, direction),
    onAddFile: (target: ModuleSectionTarget, trigger: HTMLElement | null) =>
      openDialog({ kind: 'upload', target }, trigger),
    onEdit: (entry: MaterialModuleDto, trigger: HTMLElement | null) =>
      openDialog({ kind: 'edit', module: entry }, trigger),
    onDelete: (entry: MaterialModuleDto, trigger: HTMLElement | null) =>
      openDialog({ kind: 'delete', module: entry }, trigger),
    onDeletedFallbackFocus: () => rootRef.current?.focus(),
  };

  return (
    <div ref={rootRef} tabIndex={-1} className="min-w-0 space-y-5 outline-none">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <p className="max-w-prose min-w-0 basis-full text-sm text-muted-foreground sm:basis-0 sm:flex-1">
          {materialMessages.subtitle}
        </p>
        {canManage && !isEmpty ? (
          <Button
            ref={createButtonRef}
            type="button"
            disabled={atCap}
            className="w-full shrink-0 sm:w-auto"
            onClick={() =>
              openDialog({ kind: 'create' }, createButtonRef.current)
            }
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {copy.createAction}
          </Button>
        ) : null}
      </div>

      {canManage && atCap ? (
        <p className="text-sm font-semibold text-warning-foreground">
          {copy.capReachedMessage}
        </p>
      ) : null}

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
          <AlertTitle>{materialMessages.list.bot.loadErrorTitle}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {botQuery.error instanceof ApiError && isTerminalBotConfigError
                ? botQuery.error.userMessage
                : materialMessages.list.bot.loadErrorNotice}
            </span>
            {!isTerminalBotConfigError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void botQuery.refetch()}
              >
                {materialMessages.list.bot.retryLoadAction}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isStale && (
        <StaleDataNotice
          title={materialMessages.staleTitle}
          description={materialMessages.staleDescription}
          onRetry={() => {
            void modulesQuery.refetch();
            void unassignedQuery.refetch();
          }}
        />
      )}

      {isEmpty ? (
        <EmptyState
          title={materialMessages.emptyTitle}
          description={
            canManage
              ? materialMessages.emptyTeacherDescription
              : materialMessages.emptyStudentDescription
          }
          action={
            canManage ? (
              <Button
                ref={createButtonRef}
                type="button"
                onClick={() =>
                  openDialog({ kind: 'create' }, createButtonRef.current)
                }
              >
                {copy.createFirstAction}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul aria-label={copy.regionLabel} className="min-w-0 space-y-4">
          {modules.map((entry, index) => (
            <li key={entry.id} className="min-w-0">
              <MaterialModuleSection
                {...sectionShared}
                target={{ kind: 'module', module: entry }}
                index={index}
                total={modules.length}
              />
            </li>
          ))}
          {unassignedTotal > 0 ? (
            <li className="min-w-0">
              <MaterialModuleSection
                {...sectionShared}
                target={{ kind: 'unassigned', count: unassignedTotal }}
                defaultExpanded={modules.length === 0}
                index={0}
                total={0}
              />
            </li>
          ) : null}
        </ul>
      )}

      {canManage && dialog?.kind === 'create' ? (
        <ModuleFormDialog
          mode="create"
          onSubmit={(values) => handleSubmitModule(values, null)}
          onClose={closeDialog}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
      {canManage && dialog?.kind === 'edit' ? (
        <ModuleFormDialog
          mode="edit"
          initial={dialog.module}
          onSubmit={(values) => handleSubmitModule(values, dialog.module)}
          onClose={closeDialog}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
      {canManage && dialog?.kind === 'delete' ? (
        <DeleteModuleDialog
          module={dialog.module}
          onConfirm={() => handleDeleteModule(dialog.module)}
          onClose={closeDialog}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
      {canManage && dialog?.kind === 'move' ? (
        <MoveMaterialDialog
          filename={dialog.material.filename}
          currentModuleId={dialog.material.moduleId}
          modules={modules}
          onSubmit={(destination) =>
            handleMoveMaterial(dialog.material, destination)
          }
          onClose={closeDialog}
          onCloseAutoFocus={restoreFocus}
        />
      ) : null}
      {canManage && dialog?.kind === 'upload' ? (
        <UploadDialog
          title={copy.uploadDialog.title(
            dialog.target.kind === 'module'
              ? dialog.target.module.name
              : copy.unassignedTitle,
          )}
          onClose={closeDialog}
          onCloseAutoFocus={restoreFocus}
        >
          <MaterialUploadSection
            client={client}
            classroomId={classroomId}
            canManage={canManage}
            moduleId={
              dialog.target.kind === 'module' ? dialog.target.module.id : null
            }
            onUploaded={handleUploaded}
            onReconcileRequired={() => reconcileMaterials()}
            onInteraction={() => setActionNotice(null)}
          />
        </UploadDialog>
      ) : null}
    </div>
  );
}
