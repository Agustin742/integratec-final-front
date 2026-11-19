import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { ApiError } from '@/api/errors';
import {
  classroomDetailQueryKey,
  createClassroomShopPredicate,
  shopItemsQueryKey,
  shopPurchasesQueryKey,
  studentWalletQueryKey,
  type ShopItemKindFilter,
  type ShopItemsSortOrder,
} from '@/api/query-keys';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from '@/components/feedback/states';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatInstant } from '@/lib/dates';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { useClassroomContext } from '../classrooms/use-classroom-capabilities';
import {
  invalidateStudentWallet,
  useStudentWallet,
  type StudentWallet,
} from '../points/use-student-wallet';
import { shopMessages } from './messages';
import {
  PurchaseConfirmDialog,
  type ShopReconcileSnapshot,
} from './purchase-confirm-dialog';
import { formatShopPoints, type ShopCatalogItemDto } from './shop-schema';
import { listShopItems, listShopPurchases } from './shop-service';

const CATALOG_PAGE_SIZE = 12;
const PURCHASES_PAGE_SIZE = 10;

type ShopTab = 'catalog' | 'purchases';

const panelMessages = shopMessages.panel;
const filterMessages = shopMessages.filters;
const catalogMessages = shopMessages.catalog;
const purchasesMessages = shopMessages.purchases;

export interface ShopPanelProps {
  readonly classroomId?: string;
}

function formatPurchaseTimestamp(iso: string): string {
  try {
    return formatInstant(iso);
  } catch {
    return iso;
  }
}

export function ShopPanel({
  classroomId: explicitClassroomId,
}: ShopPanelProps = {}) {
  const { classroomId: routeClassroomId } = useParams();
  const classroomId = (explicitClassroomId ?? routeClassroomId ?? '').trim();
  const sessionSnapshot = useSessionSnapshot();
  const userId =
    sessionSnapshot.status === 'authenticated' ? sessionSnapshot.user.id : null;

  return (
    <ShopPanelScoped
      key={`${userId ?? 'anon'}:${classroomId || 'unknown'}`}
      classroomId={classroomId}
      userId={userId}
    />
  );
}

interface ShopPanelScopedProps {
  readonly classroomId: string;
  readonly userId: string | null;
}

function ShopPanelScoped({ classroomId, userId }: ShopPanelScopedProps) {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const context = useClassroomContext(classroomId);

  const isStudentBuyer =
    context.status === 'ready' &&
    context.classroom.myRole === 'STUDENT' &&
    context.classroom.capabilities.includes('participate_activities');

  const [activeTab, setActiveTab] = useState<ShopTab>('catalog');
  const [kindFilter, setKindFilter] = useState<ShopItemKindFilter | ''>('');
  const [sortOrder, setSortOrder] = useState<ShopItemsSortOrder>('createdAt');
  const [catalogPage, setCatalogPage] = useState(1);
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [confirmItem, setConfirmItem] = useState<ShopCatalogItemDto | null>(
    null,
  );
  const [pendingKeysByItemId, setPendingKeysByItemId] = useState<
    Readonly<Record<string, string>>
  >({});
  const [announcement, setAnnouncement] = useState('');

  const kindSelectId = useId();
  const sortSelectId = useId();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const reconciledErrorRef = useRef<unknown>(null);
  const terminalCleanupRef = useRef<{
    readonly userId: string;
    readonly classroomId: string;
  } | null>(null);

  const wallet = useStudentWallet(isStudentBuyer ? classroomId : '');

  const catalogParams = useMemo(
    () => ({
      page: catalogPage,
      pageSize: CATALOG_PAGE_SIZE,
      sort: sortOrder,
      ...(kindFilter ? { kind: kindFilter } : {}),
    }),
    [catalogPage, kindFilter, sortOrder],
  );

  const catalogQuery = useQuery({
    queryKey: shopItemsQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      catalogParams,
    ),
    queryFn: ({ signal }) =>
      listShopItems(client, classroomId, catalogParams, { signal }),
    enabled: Boolean(userId && classroomId) && isStudentBuyer,
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const purchasesParams = useMemo(
    () => ({
      page: purchasesPage,
      pageSize: PURCHASES_PAGE_SIZE,
      sort: '-createdAt' as const,
    }),
    [purchasesPage],
  );

  const purchasesQuery = useQuery({
    queryKey: shopPurchasesQueryKey(
      userId ?? 'anonymous',
      classroomId || 'unknown',
      purchasesParams,
    ),
    queryFn: ({ signal }) =>
      listShopPurchases(client, classroomId, purchasesParams, { signal }),
    enabled:
      Boolean(userId && classroomId) &&
      isStudentBuyer &&
      activeTab === 'purchases',
    placeholderData: (previousData) => previousData,
    retry: false,
  });

  const catalogErrorStatus =
    catalogQuery.error instanceof ApiError ? catalogQuery.error.status : null;
  const isTerminalCatalogError =
    catalogErrorStatus === 403 || catalogErrorStatus === 404;

  // Bounded non-looping 403/404 cleanup: evict inactive cached pages and
  // invalidate classroomDetailQueryKey at most once per error instance.
  useEffect(() => {
    if (!catalogQuery.isError) {
      reconciledErrorRef.current = null;
      terminalCleanupRef.current = null;
      return;
    }
    if (!isTerminalCatalogError || !userId || !classroomId) {
      return;
    }
    terminalCleanupRef.current = { userId, classroomId };
    queryClient.removeQueries({
      predicate: createClassroomShopPredicate(userId, classroomId),
      type: 'inactive',
    });
    if (reconciledErrorRef.current !== catalogQuery.error) {
      reconciledErrorRef.current = catalogQuery.error;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }
  }, [
    catalogQuery.error,
    catalogQuery.isError,
    classroomId,
    isTerminalCatalogError,
    queryClient,
    userId,
  ]);

  // Evict private shop cache immediately on live SSE role demotion or unmount after 403/404.
  useEffect(() => {
    if (!userId || !classroomId) {
      return;
    }
    if (context.status === 'ready' && !isStudentBuyer) {
      queryClient.removeQueries({
        predicate: createClassroomShopPredicate(userId, classroomId),
      });
    }
  }, [classroomId, context.status, isStudentBuyer, queryClient, userId]);

  useEffect(() => {
    return () => {
      const cleanup = terminalCleanupRef.current;
      if (cleanup !== null) {
        queryClient.removeQueries({
          predicate: createClassroomShopPredicate(
            cleanup.userId,
            cleanup.classroomId,
          ),
        });
      }
    };
  }, [queryClient]);

  const handleStoreIdempotencyKey = useCallback(
    (shopItemId: string, key: string) => {
      setPendingKeysByItemId((prev) => ({ ...prev, [shopItemId]: key }));
    },
    [],
  );

  const handleClearIdempotencyKey = useCallback((shopItemId: string) => {
    setPendingKeysByItemId((prev) => {
      if (!(shopItemId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[shopItemId];
      return next;
    });
  }, []);

  const handleReconcileRequired = useCallback(
    async (
      shopItemId: string,
      invalidateClassroomContext = false,
    ): Promise<ShopReconcileSnapshot> => {
      if (!userId || !classroomId) {
        return { item: null, walletBalance: null };
      }

      const [catalogRefetch] = await Promise.all([
        catalogQuery.refetch(),
        queryClient.invalidateQueries({
          predicate: createClassroomShopPredicate(userId, classroomId),
        }),
        invalidateStudentWallet(queryClient, { userId, classroomId }),
        invalidateClassroomContext
          ? queryClient.invalidateQueries({
              queryKey: classroomDetailQueryKey(userId, classroomId),
              exact: true,
            })
          : Promise.resolve(),
      ]);

      // Reject failed refetches (`result.isError || result.data === undefined`)
      // rather than trusting stale cached data (`frontend-dod-audit` Gate B).
      const freshItems =
        !catalogRefetch.isError && catalogRefetch.data !== undefined
          ? catalogRefetch.data.items
          : [];
      const freshItem =
        freshItems.find((entry) => entry.id === shopItemId) ?? null;

      // Read server-reconciled balance only when the active wallet query succeeded.
      const walletState = queryClient.getQueryState<StudentWallet>(
        studentWalletQueryKey(userId, classroomId),
      );
      const freshWalletBalance =
        walletState?.status === 'success' &&
        walletState.error == null &&
        walletState.data !== undefined
          ? walletState.data.balance
          : null;

      return {
        item: freshItem,
        walletBalance: freshWalletBalance,
      };
    },
    [catalogQuery, classroomId, queryClient, userId],
  );

  const handlePurchaseConfirmed = useCallback(() => {
    if (!userId || !classroomId) {
      return;
    }
    setAnnouncement(panelMessages.liveShopUpdated);
    void queryClient.invalidateQueries({
      predicate: createClassroomShopPredicate(userId, classroomId),
    });
    void invalidateStudentWallet(queryClient, { userId, classroomId });
  }, [classroomId, queryClient, userId]);

  if (context.status === 'pending') {
    return <LoadingState label={catalogMessages.loading} />;
  }

  if (!isStudentBuyer) {
    return (
      <EmptyState
        headingLevel="h3"
        title={panelMessages.studentOnlyTitle}
        description={panelMessages.studentOnlyDescription}
      />
    );
  }

  const effectiveConfirmItem = isTerminalCatalogError ? null : confirmItem;
  const walletBalance =
    wallet.status === 'ready' ? wallet.wallet.balance : null;

  const catalogData = catalogQuery.data;
  const catalogItems = catalogData?.items ?? [];
  const catalogTotal = catalogData?.total ?? 0;
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(catalogTotal / CATALOG_PAGE_SIZE),
  );
  const isCatalogOutOfRange =
    catalogPage > 1 && catalogItems.length === 0 && catalogTotal > 0;
  const hasCatalogFilter = kindFilter !== '';

  const purchasesData = purchasesQuery.data;
  const purchaseItems = purchasesData?.items ?? [];
  const purchasesTotal = purchasesData?.total ?? 0;
  const purchasesTotalPages = Math.max(
    1,
    Math.ceil(purchasesTotal / PURCHASES_PAGE_SIZE),
  );
  const isPurchasesOutOfRange =
    purchasesPage > 1 && purchaseItems.length === 0 && purchasesTotal > 0;

  return (
    <section aria-label={panelMessages.heading} className="space-y-4">
      <LiveRegion message={announcement} visuallyHidden />

      <div className="space-y-1">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-foreground outline-none"
        >
          {panelMessages.heading}
        </h3>
        <p className="text-sm text-muted-foreground">
          {panelMessages.description}
        </p>
      </div>

      {/* Server-authoritative individual student balance strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-subtle/60 px-4 py-3">
        <span className="text-xs font-medium text-muted-foreground">
          {panelMessages.balanceLabel}
        </span>
        {wallet.status === 'ready' ? (
          <Badge variant="success">
            {formatShopPoints(wallet.wallet.balance)}
          </Badge>
        ) : wallet.status === 'error' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-destructive">
              {panelMessages.balanceUnavailable}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => wallet.retry()}
            >
              {panelMessages.balanceRetry}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {panelMessages.balanceLoading}
          </span>
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(next) => {
          if (next === 'catalog' || next === 'purchases') {
            setActiveTab(next);
          }
        }}
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="catalog" className="min-h-11">
            {panelMessages.tabCatalog}
          </TabsTrigger>
          <TabsTrigger value="purchases" className="min-h-11">
            {panelMessages.tabPurchases}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor={kindSelectId}
                className="block text-xs font-medium text-muted-foreground"
              >
                {filterMessages.kindLabel}
              </label>
              <select
                id={kindSelectId}
                value={kindFilter}
                onChange={(event) => {
                  const next = event.target.value;
                  setKindFilter(
                    next === 'CLASSROOM_ITEM' ||
                      next === 'AVATAR_ACCESSORY' ||
                      next === 'DESK_UPGRADE' ||
                      next === 'PET_ACCESSORY'
                      ? next
                      : '',
                  );
                  setCatalogPage(1);
                }}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{filterMessages.kindAll}</option>
                <option value="AVATAR_ACCESSORY">
                  {shopMessages.kinds.AVATAR_ACCESSORY}
                </option>
                <option value="DESK_UPGRADE">
                  {shopMessages.kinds.DESK_UPGRADE}
                </option>
                <option value="CLASSROOM_ITEM">
                  {shopMessages.kinds.CLASSROOM_ITEM}
                </option>
                <option value="PET_ACCESSORY">
                  {shopMessages.kinds.PET_ACCESSORY}
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor={sortSelectId}
                className="block text-xs font-medium text-muted-foreground"
              >
                {filterMessages.sortLabel}
              </label>
              <select
                id={sortSelectId}
                value={sortOrder}
                onChange={(event) => {
                  const next = event.target.value;
                  if (
                    next === 'createdAt' ||
                    next === 'defaultPrice' ||
                    next === '-defaultPrice' ||
                    next === 'name' ||
                    next === '-name'
                  ) {
                    setSortOrder(next);
                    setCatalogPage(1);
                  }
                }}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="createdAt">
                  {filterMessages.sortCreatedAsc}
                </option>
                <option value="defaultPrice">
                  {filterMessages.sortPriceAsc}
                </option>
                <option value="-defaultPrice">
                  {filterMessages.sortPriceDesc}
                </option>
                <option value="name">{filterMessages.sortNameAsc}</option>
                <option value="-name">{filterMessages.sortNameDesc}</option>
              </select>
            </div>
          </div>

          {catalogQuery.isError &&
          catalogData !== undefined &&
          !isTerminalCatalogError ? (
            <StaleDataNotice
              title={catalogMessages.staleTitle}
              description={catalogMessages.staleDescription}
              onRetry={() => {
                void catalogQuery.refetch();
              }}
            />
          ) : null}

          {catalogQuery.isPending && catalogData === undefined ? (
            <LoadingState label={catalogMessages.loading} />
          ) : isTerminalCatalogError ? (
            <ErrorState
              headingLevel="h4"
              title={
                catalogErrorStatus === 403
                  ? catalogMessages.forbiddenTitle
                  : catalogMessages.notFoundTitle
              }
              description={
                catalogErrorStatus === 403
                  ? catalogMessages.forbiddenDescription
                  : catalogMessages.notFoundDescription
              }
            />
          ) : catalogQuery.isError && catalogData === undefined ? (
            <ErrorState
              headingLevel="h4"
              title={catalogMessages.loadErrorTitle}
              description={catalogMessages.loadErrorDescription}
              onRetry={() => {
                void catalogQuery.refetch();
              }}
            />
          ) : isCatalogOutOfRange ? (
            <EmptyState
              headingLevel="h4"
              title={catalogMessages.outOfRangeTitle}
              description={catalogMessages.outOfRangeDescription}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setCatalogPage(1)}
                >
                  {catalogMessages.backToFirstPage}
                </Button>
              }
            />
          ) : catalogItems.length === 0 ? (
            <EmptyState
              headingLevel="h4"
              title={
                hasCatalogFilter
                  ? catalogMessages.filteredEmptyTitle
                  : catalogMessages.emptyTitle
              }
              description={
                hasCatalogFilter
                  ? catalogMessages.filteredEmptyDescription
                  : catalogMessages.emptyDescription
              }
              action={
                hasCatalogFilter ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setKindFilter('');
                      setCatalogPage(1);
                    }}
                  >
                    {catalogMessages.clearFilters}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {catalogMessages.resultsSummary(
                  catalogItems.length,
                  catalogTotal,
                )}
              </p>

              <ul className="space-y-3">
                {catalogItems.map((item) => {
                  const hasPendingKey = item.id in pendingKeysByItemId;
                  const seemsInsufficient =
                    walletBalance !== null &&
                    walletBalance < item.price &&
                    item.isPurchasable;

                  return (
                    <li
                      key={item.id}
                      className="space-y-3 rounded-xl border border-border bg-surface p-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline">
                            {shopMessages.kinds[item.kind]}
                          </Badge>
                          {item.ownedByStudent ? (
                            <Badge variant="success">
                              {catalogMessages.statusOwnedStudent}
                            </Badge>
                          ) : item.kind === 'CLASSROOM_ITEM' &&
                            item.ownedByClassroom ? (
                            <Badge variant="success">
                              {catalogMessages.statusOwnedClassroom}
                            </Badge>
                          ) : !item.isImplemented ? (
                            <Badge variant="secondary">
                              {catalogMessages.statusUpcoming}
                            </Badge>
                          ) : !item.isPurchasable ? (
                            <Badge variant="secondary">
                              {catalogMessages.statusUnavailable}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="break-words text-sm font-semibold text-foreground">
                          {item.name}
                        </p>
                        {item.description ? (
                          <p className="break-words text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">
                            {formatShopPoints(item.price)}
                          </p>
                          {item.kind === 'CLASSROOM_ITEM' &&
                          item.isPurchasable ? (
                            <p className="text-xs text-muted-foreground">
                              {catalogMessages.classroomScopeHint}
                            </p>
                          ) : null}
                          {seemsInsufficient ? (
                            <p className="text-xs text-muted-foreground">
                              {catalogMessages.insufficientBalanceHint}
                            </p>
                          ) : null}
                        </div>

                        {item.isPurchasable ? (
                          <Button
                            type="button"
                            variant={hasPendingKey ? 'outline' : 'default'}
                            size="sm"
                            className="min-h-11"
                            onClick={(event) => {
                              triggerElementRef.current = event.currentTarget;
                              setConfirmItem(item);
                            }}
                          >
                            {hasPendingKey
                              ? catalogMessages.retrySameAttemptAction
                              : catalogMessages.buyAction}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {catalogTotalPages > 1 ? (
                <PaginationControls
                  page={catalogPage}
                  pageSize={CATALOG_PAGE_SIZE}
                  total={catalogTotal}
                  onPageChange={setCatalogPage}
                />
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="purchases" className="mt-4 space-y-4">
          {purchasesQuery.isError && purchasesData !== undefined ? (
            <StaleDataNotice
              title={purchasesMessages.staleTitle}
              description={purchasesMessages.staleDescription}
              onRetry={() => {
                void purchasesQuery.refetch();
              }}
            />
          ) : null}

          {purchasesQuery.isPending && purchasesData === undefined ? (
            <LoadingState label={purchasesMessages.loading} />
          ) : purchasesQuery.isError && purchasesData === undefined ? (
            <ErrorState
              headingLevel="h4"
              title={purchasesMessages.loadErrorTitle}
              description={purchasesMessages.loadErrorDescription}
              onRetry={() => {
                void purchasesQuery.refetch();
              }}
            />
          ) : isPurchasesOutOfRange ? (
            <EmptyState
              headingLevel="h4"
              title={purchasesMessages.outOfRangeTitle}
              description={purchasesMessages.outOfRangeDescription}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setPurchasesPage(1)}
                >
                  {purchasesMessages.backToFirstPage}
                </Button>
              }
            />
          ) : purchaseItems.length === 0 ? (
            <EmptyState
              headingLevel="h4"
              title={purchasesMessages.emptyTitle}
              description={purchasesMessages.emptyDescription}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {purchasesMessages.summary(
                  purchaseItems.length,
                  purchasesTotal,
                )}
              </p>

              <ul className="space-y-3">
                {purchaseItems.map((purchase) => (
                  <li
                    key={purchase.id}
                    className="space-y-1.5 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">
                        {shopMessages.kinds[purchase.shopItemKind]}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">
                        {purchasesMessages.paidLabel(
                          formatShopPoints(purchase.pricePaid),
                        )}
                      </span>
                    </div>
                    <p className="break-words text-sm font-semibold text-foreground">
                      {purchase.shopItemName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {purchasesMessages.purchasedAtPrefix}{' '}
                      {formatPurchaseTimestamp(purchase.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>

              {purchasesTotalPages > 1 ? (
                <PaginationControls
                  page={purchasesPage}
                  pageSize={PURCHASES_PAGE_SIZE}
                  total={purchasesTotal}
                  onPageChange={setPurchasesPage}
                />
              ) : null}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PurchaseConfirmDialog
        key={effectiveConfirmItem?.id ?? 'closed'}
        open={effectiveConfirmItem !== null}
        classroomId={classroomId}
        item={effectiveConfirmItem}
        walletBalance={walletBalance}
        pendingIdempotencyKey={
          effectiveConfirmItem
            ? (pendingKeysByItemId[effectiveConfirmItem.id] ?? null)
            : null
        }
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setConfirmItem(null);
          }
        }}
        onStoreIdempotencyKey={handleStoreIdempotencyKey}
        onClearIdempotencyKey={handleClearIdempotencyKey}
        onPurchaseConfirmed={handlePurchaseConfirmed}
        onReconcileRequired={handleReconcileRequired}
        getTriggerElement={() => triggerElementRef.current}
        fallbackFocus={() => headingRef.current}
      />
    </section>
  );
}
