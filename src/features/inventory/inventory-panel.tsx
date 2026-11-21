import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomEquipmentQueryKey,
  createClassroomEquipmentPredicate,
  shopPurchasesQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { useClassroomContext } from '../classrooms/use-classroom-capabilities';
import type { StudentPurchaseDto } from '../shop/shop-schema';
import { listShopPurchases } from '../shop/shop-service';
import { inventoryMessages } from './inventory-messages';
import {
  getEquipment,
  isUncertainEquipmentError,
  setEquipmentSlot,
} from './inventory-service';
import {
  isEquipableInSlot,
  isEquipableKind,
  SLOT_NAMES,
  type EquipmentStateDto,
  type EquippedSlotDto,
  type EquippedSlotName,
} from './inventory-schema';

const msgs = inventoryMessages;

export interface InventoryPanelProps {
  readonly classroomId?: string;
}

type SlotMutationStatus = 'idle' | 'pending' | 'confirmed' | 'rejected';

interface SlotMutationState {
  readonly status: SlotMutationStatus;
  readonly errorMessage: string | null;
}

function deduplicatePurchases(
  purchases: readonly StudentPurchaseDto[],
): StudentPurchaseDto[] {
  const seen = new Set<string>();
  const unique: StudentPurchaseDto[] = [];
  for (const purchase of purchases) {
    if (!seen.has(purchase.shopItemId)) {
      seen.add(purchase.shopItemId);
      unique.push(purchase);
    }
  }
  return unique;
}

export function InventoryPanel({
  classroomId: explicitClassroomId,
}: InventoryPanelProps = {}) {
  const { classroomId: routeClassroomId } = useParams();
  const classroomId = (explicitClassroomId ?? routeClassroomId ?? '').trim();
  const sessionSnapshot = useSessionSnapshot();
  const userId =
    sessionSnapshot.status === 'authenticated' ? sessionSnapshot.user.id : null;

  return (
    <InventoryPanelScoped
      key={`${userId ?? 'anon'}:${classroomId || 'unknown'}`}
      classroomId={classroomId}
      userId={userId}
    />
  );
}

interface InventoryPanelScopedProps {
  readonly classroomId: string;
  readonly userId: string | null;
}

function InventoryPanelScoped({
  classroomId,
  userId,
}: InventoryPanelScopedProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const isStudent =
    context.status === 'ready' && context.classroom.myRole === 'STUDENT';

  // Focus heading on mount for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Evict private equipment cache when student role is absent/revoked
  useEffect(() => {
    if (!userId || !classroomId) return;
    if (context.status === 'ready' && !isStudent) {
      queryClient.removeQueries({
        predicate: createClassroomEquipmentPredicate(userId, classroomId),
      });
    }
  }, [classroomId, context.status, isStudent, queryClient, userId]);

  const equipmentKey = classroomEquipmentQueryKey(
    userId ?? 'anonymous',
    classroomId || 'unknown',
  );

  const equipmentQuery = useQuery({
    queryKey: equipmentKey,
    queryFn: ({ signal }) => getEquipment(client, classroomId, { signal }),
    enabled: Boolean(userId && classroomId) && isStudent,
    retry: false,
  });

  const purchasesQuery = useQuery({
    queryKey: shopPurchasesQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      { pageSize: 100, sort: '-createdAt' },
    ),
    queryFn: ({ signal }) =>
      listShopPurchases(
        client,
        classroomId,
        { pageSize: 100, sort: '-createdAt' },
        { signal },
      ),
    enabled: Boolean(userId && classroomId) && isStudent,
    retry: false,
  });

  const uniquePurchases = useMemo(
    () => deduplicatePurchases(purchasesQuery.data?.items ?? []),
    [purchasesQuery.data?.items],
  );

  const equipablePurchases = useMemo(
    () => uniquePurchases.filter((p) => isEquipableKind(p.shopItemKind)),
    [uniquePurchases],
  );

  if (context.status === 'pending') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <LoadingState label={msgs.panel.loading} />
      </div>
    );
  }

  if (context.status === 'error') {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <ErrorState
          title={msgs.errors.loadError}
          description={msgs.errors.loadError}
          onRetry={() => context.retry()}
        />
      </div>
    );
  }

  if (!isStudent) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <EmptyState
          title={msgs.panel.studentOnlyTitle}
          description={msgs.panel.studentOnlyDescription}
        />
      </div>
    );
  }

  if (
    (equipmentQuery.isLoading && equipmentQuery.data === undefined) ||
    (purchasesQuery.isLoading && purchasesQuery.data === undefined)
  ) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <LoadingState label={msgs.panel.loading} />
      </div>
    );
  }

  if (
    (equipmentQuery.isError && equipmentQuery.data === undefined) ||
    (purchasesQuery.isError && purchasesQuery.data === undefined)
  ) {
    const err = equipmentQuery.error ?? purchasesQuery.error;
    const userMessage =
      err instanceof ApiError ? err.userMessage : msgs.errors.loadError;
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <ErrorState
          title={msgs.errors.loadError}
          description={userMessage}
          onRetry={() => {
            void equipmentQuery.refetch();
            void purchasesQuery.refetch();
          }}
        />
      </div>
    );
  }

  const equipment = equipmentQuery.data;

  if (uniquePurchases.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <EmptyState
          title={msgs.empty.title}
          description={msgs.empty.description}
        />
      </div>
    );
  }

  if (equipablePurchases.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <EmptyState
          title={msgs.empty.noEquipableTitle}
          description={msgs.empty.noEquipableDescription}
        />
      </div>
    );
  }

  const hasStaleError =
    (equipmentQuery.isError && equipmentQuery.data !== undefined) ||
    (purchasesQuery.isError && purchasesQuery.data !== undefined);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} className="text-xl font-semibold" tabIndex={-1}>
          {msgs.panel.heading}
        </h2>
        <p className="text-sm text-muted-foreground">
          {msgs.panel.description}
        </p>
      </div>

      {hasStaleError ? (
        <StaleDataNotice
          title={msgs.panel.staleTitle}
          description={msgs.panel.staleDescription}
          onRetry={() => {
            void equipmentQuery.refetch();
            void purchasesQuery.refetch();
          }}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {SLOT_NAMES.map((slot) => {
          const slotPurchases = equipablePurchases.filter((p) =>
            isEquipableInSlot(p.shopItemKind, slot),
          );
          return (
            <SlotRow
              key={slot}
              slot={slot}
              equippedItem={equipment?.slots[slot] ?? null}
              purchases={slotPurchases}
              classroomId={classroomId}
              onEquipmentConfirmed={(updated) => {
                queryClient.setQueryData<EquipmentStateDto>(
                  equipmentKey,
                  updated,
                );
                void queryClient.invalidateQueries({ queryKey: equipmentKey });
              }}
              onReconcile={() => {
                void queryClient.invalidateQueries({ queryKey: equipmentKey });
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SlotRowProps {
  readonly slot: EquippedSlotName;
  readonly equippedItem: EquippedSlotDto | null;
  readonly purchases: readonly StudentPurchaseDto[];
  readonly classroomId: string;
  readonly onEquipmentConfirmed: (updated: EquipmentStateDto) => void;
  readonly onReconcile: () => void;
}

function SlotRow({
  slot,
  equippedItem,
  purchases,
  classroomId,
  onEquipmentConfirmed,
  onReconcile,
}: SlotRowProps) {
  const { client } = useSessionService();
  const selectId = useId();
  const labelId = useId();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mutationState, setMutationState] = useState<SlotMutationState>({
    status: 'idle',
    errorMessage: null,
  });

  const serverEquippedId = equippedItem?.shopItemId ?? '';
  const [prevServerEquippedId, setPrevServerEquippedId] =
    useState<string>(serverEquippedId);
  const [selectedItemId, setSelectedItemId] =
    useState<string>(serverEquippedId);

  if (serverEquippedId !== prevServerEquippedId) {
    setPrevServerEquippedId(serverEquippedId);
    setSelectedItemId(serverEquippedId);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (shopItemId: string | null) =>
      setEquipmentSlot(client, classroomId, { slot, shopItemId }),
    onMutate: () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setMutationState({ status: 'pending', errorMessage: null });
    },
    onSuccess: (updatedEquipment) => {
      setMutationState({ status: 'confirmed', errorMessage: null });
      onEquipmentConfirmed(updatedEquipment);
      timerRef.current = setTimeout(() => {
        setMutationState((prev) =>
          prev.status === 'confirmed'
            ? { status: 'idle', errorMessage: null }
            : prev,
        );
      }, 1500);
    },
    onError: (error) => {
      const userMessage =
        error instanceof ApiError ? error.userMessage : msgs.errors.uncertain;
      setMutationState({ status: 'rejected', errorMessage: userMessage });
      // Restore selection to the confirmed server state — equipped state never changes on error
      setSelectedItemId(equippedItem?.shopItemId ?? '');
      if (isUncertainEquipmentError(error)) {
        onReconcile();
      }
    },
  });

  const handleEquip = () => {
    if (mutationState.status === 'pending' || !selectedItemId) return;
    mutation.mutate(selectedItemId);
  };

  const handleUnequip = () => {
    if (mutationState.status === 'pending') return;
    mutation.mutate(null);
  };

  const slotLabel = msgs.slots[slot] ?? slot;
  const isPending = mutationState.status === 'pending';
  const isRejected = mutationState.status === 'rejected';
  const isUnchangedSelection =
    !selectedItemId || selectedItemId === equippedItem?.shopItemId;

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
      role="group"
      aria-labelledby={labelId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium">
          {slotLabel}
        </span>
        {equippedItem ? (
          <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {msgs.actions.equipped}: {equippedItem.shopItemName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {msgs.actions.noItem}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">
            {msgs.actions.selectItem}
          </label>
          <select
            id={selectId}
            className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={isPending || purchases.length === 0}
            aria-label={`${slotLabel}: ${msgs.actions.selectItem}`}
          >
            <option value="">{msgs.actions.selectPlaceholder}</option>
            {purchases.map((p) => (
              <option key={p.shopItemId} value={p.shopItemId}>
                {p.shopItemName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleEquip}
            disabled={isPending || isUnchangedSelection}
            className="min-h-11"
          >
            {isPending ? msgs.states.pending : msgs.actions.equip}
          </Button>
          {equippedItem && (
            <Button
              type="button"
              variant="outline"
              onClick={handleUnequip}
              disabled={isPending}
              className="min-h-11"
            >
              {msgs.actions.unequip}
            </Button>
          )}
        </div>
      </div>

      {mutationState.status === 'confirmed' && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-green-600 dark:text-green-400"
        >
          {msgs.states.confirmed}
        </p>
      )}
      {isRejected && mutationState.errorMessage && (
        <p
          role="alert"
          aria-live="assertive"
          className="text-xs text-destructive"
        >
          {mutationState.errorMessage}
        </p>
      )}
    </div>
  );
}
