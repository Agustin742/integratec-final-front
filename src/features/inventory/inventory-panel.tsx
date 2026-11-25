import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomEquipmentQueryKey,
  createClassroomEquipmentPredicate,
  shopItemsQueryKey,
  shopPurchasesQueryKey,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { useClassroomContext } from '../classrooms/use-classroom-capabilities';
import type { StudentPurchaseDto } from '../shop/shop-schema';
import { listAllShopItems, listAllShopPurchases } from '../shop/shop-service';
import { getSlotLabel, inventoryMessages } from './inventory-messages';
import {
  getEquipment,
  isUncertainEquipmentError,
  setEquipmentSlot,
} from './inventory-service';
import {
  resolveItemSlot,
  SLOT_NAMES,
  type EquipmentStateDto,
  type EquippedSlotDto,
  type EquippedSlotName,
} from './inventory-schema';

const msgs = inventoryMessages;

/** How long the "Guardado" confirmation stays visible. */
const CONFIRMATION_VISIBLE_MS = 4000;

const CATALOG_PARAMS = { page: 1, pageSize: 100, sort: 'createdAt' } as const;

export interface InventoryPanelProps {
  readonly classroomId?: string;
  /**
   * Moves focus to the heading on mount. Only meant for a standalone route;
   * leave off when embedded (shop dialog tab, profile) so focus is not stolen.
   */
  readonly focusHeadingOnMount?: boolean;
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
  focusHeadingOnMount = false,
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
      focusHeadingOnMount={focusHeadingOnMount}
    />
  );
}

interface InventoryPanelScopedProps {
  readonly classroomId: string;
  readonly userId: string | null;
  readonly focusHeadingOnMount: boolean;
}

function InventoryPanelScoped({
  classroomId,
  userId,
  focusHeadingOnMount,
}: InventoryPanelScopedProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const isStudent =
    context.status === 'ready' && context.classroom.myRole === 'STUDENT';

  useEffect(() => {
    if (focusHeadingOnMount) {
      headingRef.current?.focus();
    }
  }, [focusHeadingOnMount]);

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
      listAllShopPurchases(
        client,
        classroomId,
        { sort: '-createdAt' },
        { signal },
      ),
    enabled: Boolean(userId && classroomId) && isStudent,
    retry: false,
  });

  // The purchases DTO carries no item metadata: the slot each item fits is
  // resolved from the shop catalog (`metadata.slot`), like the back does.
  const catalogQuery = useQuery({
    queryKey: shopItemsQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      CATALOG_PARAMS,
    ),
    queryFn: ({ signal }) =>
      listAllShopItems(
        client,
        classroomId,
        { sort: CATALOG_PARAMS.sort },
        { signal },
      ),
    enabled: Boolean(userId && classroomId) && isStudent,
    retry: false,
  });

  const uniquePurchases = useMemo(
    () => deduplicatePurchases(purchasesQuery.data?.items ?? []),
    [purchasesQuery.data?.items],
  );

  const purchasesBySlot = useMemo(() => {
    const metadataById = new Map(
      (catalogQuery.data?.items ?? []).map((item) => [item.id, item.metadata]),
    );
    const bySlot: Record<EquippedSlotName, StudentPurchaseDto[]> = {
      head: [],
      face: [],
      back: [],
      hand: [],
      neck: [],
      ears: [],
      desk_decor: [],
    };
    for (const purchase of uniquePurchases) {
      const slot = resolveItemSlot(
        purchase.shopItemKind,
        metadataById.get(purchase.shopItemId),
      );
      if (slot !== null) {
        bySlot[slot].push(purchase);
      }
    }
    return bySlot;
  }, [catalogQuery.data?.items, uniquePurchases]);

  const hasEquipablePurchases = SLOT_NAMES.some(
    (slot) => purchasesBySlot[slot].length > 0,
  );

  if (context.status === 'pending') {
    return (
      <PanelShell headingRef={headingRef}>
        <LoadingState label={msgs.panel.loading} />
      </PanelShell>
    );
  }

  if (context.status === 'error') {
    return (
      <PanelShell headingRef={headingRef}>
        <ErrorState
          title={msgs.errors.loadTitle}
          description={msgs.errors.loadError}
          onRetry={() => context.retry()}
        />
      </PanelShell>
    );
  }

  if (!isStudent) {
    return (
      <PanelShell headingRef={headingRef}>
        <EmptyState
          title={msgs.panel.studentOnlyTitle}
          description={msgs.panel.studentOnlyDescription}
        />
      </PanelShell>
    );
  }

  if (
    (equipmentQuery.isLoading && equipmentQuery.data === undefined) ||
    (purchasesQuery.isLoading && purchasesQuery.data === undefined) ||
    (catalogQuery.isLoading && catalogQuery.data === undefined)
  ) {
    return (
      <PanelShell headingRef={headingRef}>
        <LoadingState label={msgs.panel.loading} />
      </PanelShell>
    );
  }

  if (
    (equipmentQuery.isError && equipmentQuery.data === undefined) ||
    (purchasesQuery.isError && purchasesQuery.data === undefined) ||
    (catalogQuery.isError && catalogQuery.data === undefined)
  ) {
    const err =
      equipmentQuery.error ?? purchasesQuery.error ?? catalogQuery.error;
    const userMessage =
      err instanceof ApiError ? err.userMessage : msgs.errors.loadError;
    return (
      <PanelShell headingRef={headingRef}>
        <ErrorState
          title={msgs.errors.loadTitle}
          description={userMessage}
          onRetry={() => {
            void equipmentQuery.refetch();
            void purchasesQuery.refetch();
            void catalogQuery.refetch();
          }}
        />
      </PanelShell>
    );
  }

  const equipment = equipmentQuery.data;

  if (uniquePurchases.length === 0) {
    return (
      <PanelShell headingRef={headingRef}>
        <EmptyState
          title={msgs.empty.title}
          description={msgs.empty.description}
        />
      </PanelShell>
    );
  }

  if (!hasEquipablePurchases) {
    return (
      <PanelShell headingRef={headingRef}>
        <EmptyState
          title={msgs.empty.noEquipableTitle}
          description={msgs.empty.noEquipableDescription}
        />
      </PanelShell>
    );
  }

  const hasStaleError =
    (equipmentQuery.isError && equipmentQuery.data !== undefined) ||
    (purchasesQuery.isError && purchasesQuery.data !== undefined) ||
    (catalogQuery.isError && catalogQuery.data !== undefined);

  return (
    <PanelShell headingRef={headingRef} description={msgs.panel.description}>
      {hasStaleError ? (
        <StaleDataNotice
          title={msgs.panel.staleTitle}
          description={msgs.panel.staleDescription}
          onRetry={() => {
            void equipmentQuery.refetch();
            void purchasesQuery.refetch();
            void catalogQuery.refetch();
          }}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        {SLOT_NAMES.map((slot) => {
          return (
            <SlotRow
              key={slot}
              slot={slot}
              equippedItem={equipment?.slots[slot] ?? null}
              purchases={purchasesBySlot[slot]}
              classroomId={classroomId}
              onEquipmentConfirmed={(updated) => {
                void (async () => {
                  // Drop any in-flight read, then merge ONLY the confirmed
                  // slot: a response for another slot may land out of order
                  // and its snapshot must not erase this slot's change.
                  await queryClient.cancelQueries({ queryKey: equipmentKey });
                  queryClient.setQueryData<EquipmentStateDto>(
                    equipmentKey,
                    (current) =>
                      current
                        ? {
                            ...current,
                            slots: {
                              ...current.slots,
                              [slot]: updated.slots[slot],
                            },
                          }
                        : updated,
                  );
                  await queryClient.invalidateQueries({
                    queryKey: equipmentKey,
                  });
                })();
              }}
              onReconcile={() => {
                void queryClient.invalidateQueries({ queryKey: equipmentKey });
              }}
            />
          );
        })}
      </div>
    </PanelShell>
  );
}

interface PanelShellProps {
  readonly headingRef: RefObject<HTMLHeadingElement | null>;
  readonly description?: string;
  readonly children: ReactNode;
}

/**
 * Single shell for every panel state, so the heading element survives
 * loading -> ready transitions (focus and reading position are kept).
 */
function PanelShell({ headingRef, description, children }: PanelShellProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          className="font-display text-xl font-semibold text-foreground"
          tabIndex={-1}
        >
          {msgs.panel.heading}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
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

function CheckIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'size-4 shrink-0 fill-none stroke-current stroke-[3]',
        className,
      )}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="size-4 shrink-0 fill-none stroke-current stroke-[2.5]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
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
  const headingId = useId();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());

  const [mutationState, setMutationState] = useState<SlotMutationState>({
    status: 'idle',
    errorMessage: null,
  });
  // Roving tabindex: the tile that currently owns the single tab stop.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

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
      setMutationState({
        status: 'pending',
        errorMessage: null,
      });
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
      }, CONFIRMATION_VISIBLE_MS);
    },
    onError: (error) => {
      // The equipped state never changes on error; the message stays until the
      // next interaction with this slot.
      const userMessage =
        error instanceof ApiError ? error.userMessage : msgs.errors.uncertain;
      setMutationState({
        status: 'rejected',
        errorMessage: userMessage,
      });
      if (isUncertainEquipmentError(error)) {
        onReconcile();
      }
    },
  });

  const slotLabel = getSlotLabel(slot);
  const equippedId = equippedItem?.shopItemId ?? null;
  const isPending = mutationState.status === 'pending';

  const tabStopId =
    purchases.find((p) => p.shopItemId === activeItemId)?.shopItemId ??
    purchases.find((p) => p.shopItemId === equippedId)?.shopItemId ??
    purchases[0]?.shopItemId ??
    null;

  const handleSelect = (shopItemId: string) => {
    setActiveItemId(shopItemId);
    if (isPending || shopItemId === equippedId) return;
    mutation.mutate(shopItemId);
  };

  const handleUnequip = () => {
    if (isPending) return;
    mutation.mutate(null);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const last = purchases.length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = purchases[next];
    if (!target) return;
    // Arrow keys only move focus: selecting sends a request, so it stays an
    // explicit action (Space, Enter or click).
    setActiveItemId(target.shopItemId);
    tileRefs.current.get(target.shopItemId)?.focus();
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={headingId}
          className="font-display text-base font-semibold text-foreground"
        >
          {slotLabel}
        </h3>
        {equippedItem ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUnequip}
            disabled={isPending}
          >
            {msgs.actions.unequip}
          </Button>
        ) : purchases.length > 0 ? (
          <span className="text-sm text-muted-foreground">
            {msgs.actions.noItem}
          </span>
        ) : null}
      </div>

      {purchases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{msgs.empty.slotHint}</p>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={headingId}
          className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2"
        >
          {purchases.map((purchase, index) => {
            const isChecked = purchase.shopItemId === equippedId;
            return (
              <button
                key={purchase.shopItemId}
                ref={(node) => {
                  if (node) {
                    tileRefs.current.set(purchase.shopItemId, node);
                  } else {
                    tileRefs.current.delete(purchase.shopItemId);
                  }
                }}
                type="button"
                role="radio"
                aria-checked={isChecked}
                aria-disabled={isPending ? true : undefined}
                data-item-name={purchase.shopItemName}
                tabIndex={purchase.shopItemId === tabStopId ? 0 : -1}
                onClick={() => handleSelect(purchase.shopItemId)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'flex min-h-24 min-w-0 flex-col justify-between gap-2 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring aria-disabled:cursor-wait aria-disabled:opacity-70',
                  isChecked
                    ? 'border-success-foreground bg-success text-success-foreground'
                    : 'border-edge bg-card text-card-foreground hover:bg-tray-hover',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-semibold">
                    {purchase.shopItemName}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      isChecked
                        ? 'border-success-foreground bg-success-foreground text-success'
                        : 'border-field-border bg-background',
                    )}
                  >
                    {isChecked ? <CheckIcon className="size-3" /> : null}
                  </span>
                </span>
                <span className="flex min-h-5 items-center gap-1 text-sm font-semibold">
                  {isChecked ? (
                    <>
                      <CheckIcon />
                      {msgs.actions.equipped}
                    </>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Always mounted so assistive tech registers it before its text changes. */}
      <p
        role="status"
        className={cn(
          'flex min-h-5 items-center gap-1.5 text-sm',
          mutationState.status === 'rejected'
            ? 'text-destructive'
            : 'font-semibold text-success-foreground',
        )}
      >
        {mutationState.status === 'pending' ? (
          <span className="font-normal text-muted-foreground">
            {msgs.states.pending}
          </span>
        ) : mutationState.status === 'confirmed' ? (
          <>
            <CheckIcon />
            {msgs.states.confirmed}
          </>
        ) : mutationState.status === 'rejected' ? (
          <>
            <AlertIcon />
            {mutationState.errorMessage}
          </>
        ) : null}
      </p>
    </section>
  );
}
