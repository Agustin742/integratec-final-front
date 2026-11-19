import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/errors';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useSessionService } from '@/session/provider';
import { shopMessages } from './messages';
import {
  formatShopPoints,
  type PurchaseResponseDto,
  type ShopCatalogItemDto,
} from './shop-schema';
import {
  createPurchaseIdempotencyKey,
  isAbortError,
  isUncertainShopWriteError,
  purchaseShopItem,
} from './shop-service';

const messages = shopMessages.confirm;

export interface ShopReconcileSnapshot {
  readonly item: ShopCatalogItemDto | null;
  readonly walletBalance: number | null;
}

export interface PurchaseConfirmDialogProps {
  readonly open: boolean;
  readonly classroomId: string;
  readonly item: ShopCatalogItemDto | null;
  readonly walletBalance: number | null;
  readonly pendingIdempotencyKey: string | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onStoreIdempotencyKey: (shopItemId: string, key: string) => void;
  readonly onClearIdempotencyKey: (shopItemId: string) => void;
  readonly onPurchaseConfirmed: (
    response: PurchaseResponseDto,
    item: ShopCatalogItemDto,
  ) => void;
  readonly onReconcileRequired: (
    shopItemId: string,
    invalidateClassroomContext?: boolean,
  ) => Promise<ShopReconcileSnapshot>;
  readonly getTriggerElement?: () => HTMLElement | null;
  readonly fallbackFocus?: () => HTMLElement | null;
}

function focusIfUsable(element: HTMLElement | null | undefined): boolean {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [inert], [aria-hidden="true"]') ||
    element.matches(':disabled, [aria-disabled="true"]')
  ) {
    return false;
  }
  element.focus();
  return document.activeElement === element;
}

function resolveConflictMessage(
  originalItem: ShopCatalogItemDto,
  snapshot: ShopReconcileSnapshot,
): string {
  const refreshed = snapshot.item;
  if (refreshed) {
    if (refreshed.ownedByStudent) {
      return shopMessages.errors.conflictAlreadyOwnedStudent;
    }
    if (refreshed.kind === 'CLASSROOM_ITEM' && refreshed.ownedByClassroom) {
      return shopMessages.errors.conflictAlreadyOwnedClassroom;
    }
    if (!refreshed.isImplemented) {
      return shopMessages.errors.conflictUnimplemented;
    }
  }
  const effectivePrice = refreshed?.price ?? originalItem.price;
  if (
    snapshot.walletBalance !== null &&
    snapshot.walletBalance < effectivePrice
  ) {
    return shopMessages.errors.conflictInsufficientBalance;
  }
  return shopMessages.errors.conflictGeneric;
}

export function PurchaseConfirmDialog({
  open,
  classroomId,
  item,
  walletBalance,
  pendingIdempotencyKey,
  onOpenChange,
  onStoreIdempotencyKey,
  onClearIdempotencyKey,
  onPurchaseConfirmed,
  onReconcileRequired,
  getTriggerElement,
  fallbackFocus,
}: PurchaseConfirmDialogProps) {
  const { client } = useSessionService();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUncertainState, setIsUncertainState] = useState(
    pendingIdempotencyKey !== null,
  );

  const isMountedRef = useRef(true);
  const submittingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      submittingRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  if (!item) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (submittingRef.current) {
      return;
    }
    onOpenChange(false);
  };

  const handleConfirm = async (): Promise<void> => {
    if (submittingRef.current || !item.isPurchasable) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Preserve the exact same key on an uncertain retry so the backend can
    // replay safely (`200 OK`, `replayed: true`) without double charging.
    const attemptKey = pendingIdempotencyKey ?? createPurchaseIdempotencyKey();

    try {
      const response = await purchaseShopItem(
        client,
        classroomId,
        { shopItemId: item.id, idempotencyKey: attemptKey },
        { signal: controller.signal },
      );

      if (!isMountedRef.current) {
        return;
      }

      onClearIdempotencyKey(item.id);
      setIsUncertainState(false);

      const formattedBalance = formatShopPoints(response.balance);
      const confirmationText = response.replayed
        ? messages.replayedToast(item.name, formattedBalance)
        : messages.confirmedToast(item.name, formattedBalance);
      toast.success(confirmationText);

      onPurchaseConfirmed(response, item);
      onOpenChange(false);
    } catch (error) {
      if (isAbortError(error) || !isMountedRef.current) {
        return;
      }

      if (isUncertainShopWriteError(error)) {
        onStoreIdempotencyKey(item.id, attemptKey);
        setIsUncertainState(true);

        const reconciled = await onReconcileRequired(item.id, false);
        if (!isMountedRef.current) {
          return;
        }

        const nowOwned =
          reconciled.item !== null &&
          (reconciled.item.ownedByStudent ||
            (reconciled.item.kind === 'CLASSROOM_ITEM' &&
              reconciled.item.ownedByClassroom));

        if (nowOwned) {
          onClearIdempotencyKey(item.id);
          setIsUncertainState(false);
          const balanceText =
            reconciled.walletBalance !== null
              ? formatShopPoints(reconciled.walletBalance)
              : shopMessages.panel.balanceUnavailable;
          toast.success(
            messages.uncertainReconciledSuccess(item.name, balanceText),
          );
          onOpenChange(false);
          return;
        }

        setErrorMessage(messages.uncertainBody);
        return;
      }

      if (error instanceof ApiError) {
        onClearIdempotencyKey(item.id);
        setIsUncertainState(false);

        if (error.status === 409) {
          const reconciled = await onReconcileRequired(item.id, false);
          if (!isMountedRef.current) {
            return;
          }
          setErrorMessage(resolveConflictMessage(item, reconciled));
          return;
        }

        if (error.status === 403 || error.status === 404) {
          await onReconcileRequired(item.id, true);
          if (!isMountedRef.current) {
            return;
          }
          setErrorMessage(error.userMessage);
          return;
        }

        setErrorMessage(error.userMessage);
        return;
      }

      onClearIdempotencyKey(item.id);
      setIsUncertainState(false);
      setErrorMessage(shopMessages.errors.validation);
    } finally {
      submittingRef.current = false;
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  };

  const seemsInsufficient =
    walletBalance !== null && walletBalance < item.price;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg"
        onEscapeKeyDown={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (submittingRef.current) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!focusIfUsable(getTriggerElement?.())) {
            focusIfUsable(fallbackFocus?.());
          }
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1 pr-8">
            <DialogTitle>{messages.title}</DialogTitle>
            <DialogDescription>{messages.description}</DialogDescription>
          </div>

          <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface-subtle/60 p-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.itemLabel}
              </dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {item.name}
              </dd>
              {item.description ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.categoryLabel}
              </dt>
              <dd className="mt-1">
                <Badge variant="outline">{shopMessages.kinds[item.kind]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.priceLabel}
              </dt>
              <dd className="mt-0.5 font-semibold text-foreground">
                {formatShopPoints(item.price)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">
                {messages.currentBalanceLabel}
              </dt>
              <dd className="mt-0.5 font-medium text-foreground">
                {walletBalance !== null
                  ? formatShopPoints(walletBalance)
                  : shopMessages.panel.balanceUnavailable}
              </dd>
            </div>
          </dl>

          {seemsInsufficient && !errorMessage && !submitting ? (
            <Alert>
              <AlertTitle as="h4">
                {messages.insufficientWarningTitle}
              </AlertTitle>
              <AlertDescription>
                {messages.insufficientWarningBody}
              </AlertDescription>
            </Alert>
          ) : null}

          {submitting ? (
            <Alert role="status">
              <AlertDescription>{messages.pendingNotice}</AlertDescription>
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert variant="destructive" role="alert">
              {isUncertainState ? (
                <AlertTitle as="h4">{messages.uncertainTitle}</AlertTitle>
              ) : null}
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={submitting}
              onClick={() => handleOpenChange(false)}
            >
              {messages.cancelAction}
            </Button>
            <Button
              type="button"
              variant="default"
              className="min-h-11"
              disabled={submitting || !item.isPurchasable}
              onClick={() => {
                void handleConfirm();
              }}
            >
              {submitting
                ? messages.confirmingAction
                : isUncertainState
                  ? messages.retryUncertainAction
                  : messages.confirmAction}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
