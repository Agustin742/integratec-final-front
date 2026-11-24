import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Button, buttonStyles } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatInstant } from '@/lib/dates';
import { MaterialFileIcon } from './material-file-icon';
import type { MaterialDto } from './material-schema';
import { materialMessages } from './messages';

/** Everything a file row needs from the panel; shared by every section. */
export interface MaterialFileActions {
  readonly canManage: boolean;
  readonly downloadingId: string | null;
  readonly removingId: string | null;
  readonly pendingConfirmId: string | null;
  readonly onDownload: (material: MaterialDto) => void;
  readonly onRequestMove: (
    material: MaterialDto,
    trigger: HTMLElement | null,
  ) => void;
  readonly onRequestRemove: (materialId: string) => void;
  readonly onConfirmRemove: (material: MaterialDto) => void;
  readonly onCancelRemove: () => void;
  /** Extension slot for HU-BOT-001 (bot-enabled switch & indexing status). */
  readonly renderItemSlot?: (material: MaterialDto) => ReactNode;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface MaterialRowListProps {
  readonly items: readonly MaterialDto[];
  readonly actions: MaterialFileActions;
  readonly label: string;
  readonly onDeletedFallbackFocus?: () => void;
}

export function MaterialRowList({
  items,
  actions,
  label,
  onDeletedFallbackFocus,
}: MaterialRowListProps): ReactElement {
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousConfirmId = useRef<string | null>(null);
  const { pendingConfirmId } = actions;

  useEffect(() => {
    const prev = previousConfirmId.current;
    previousConfirmId.current = pendingConfirmId;
    if (pendingConfirmId && pendingConfirmId !== prev) {
      cancelRefs.current[pendingConfirmId]?.focus();
    } else if (!pendingConfirmId && prev) {
      const trigger = triggerRefs.current[prev];
      if (trigger?.isConnected) {
        trigger.focus();
      } else {
        onDeletedFallbackFocus?.();
      }
    }
  }, [onDeletedFallbackFocus, pendingConfirmId]);

  return (
    <ul aria-label={label} className="min-w-0 divide-y divide-edge">
      {items.map((item) => (
        <MaterialRow
          key={item.id}
          item={item}
          actions={actions}
          registerTrigger={(node) => {
            triggerRefs.current[item.id] = node;
          }}
          registerCancel={(node) => {
            cancelRefs.current[item.id] = node;
          }}
        />
      ))}
    </ul>
  );
}

function MaterialRow({
  item,
  actions,
  registerTrigger,
  registerCancel,
}: {
  readonly item: MaterialDto;
  readonly actions: MaterialFileActions;
  readonly registerTrigger: (node: HTMLButtonElement | null) => void;
  readonly registerCancel: (node: HTMLButtonElement | null) => void;
}): ReactElement {
  const copy = materialMessages.list;
  // A menu action opens a dialog or confirmation that owns focus next. It runs
  // once the menu has unmounted (its focus trap would otherwise steal focus
  // back), and the menu then must not return focus to its trigger.
  const pendingActionRef = useRef<(() => void) | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isDownloading = actions.downloadingId === item.id;
  const isRemoving = actions.removingId === item.id;
  const isConfirming = actions.pendingConfirmId === item.id;

  return (
    <li className="min-w-0">
      <div className="flex min-w-0 flex-col gap-3 px-4 py-3.5 transition-colors focus-within:bg-row-hover hover:bg-row-hover sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <MaterialFileIcon contentType={item.contentType} />
          <div className="min-w-0 space-y-0.5">
            <p className="font-display text-base leading-snug font-semibold text-foreground wrap-anywhere">
              {item.filename}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {copy.types[item.contentType]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatFileSize(item.sizeBytes)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatInstant(item.createdAt)}</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDownloading || isRemoving}
            onClick={() => actions.onDownload(item)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            {isDownloading ? copy.downloadingAction : copy.downloadAction}
          </Button>

          {actions.canManage && !isConfirming ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  ref={(node) => {
                    triggerRef.current = node;
                    registerTrigger(node);
                  }}
                  type="button"
                  disabled={isRemoving || isDownloading}
                  aria-label={copy.moreActionsAriaLabel(item.filename)}
                  className={buttonStyles({
                    variant: 'outline',
                    size: 'icon',
                    disabled: isRemoving || isDownloading,
                  })}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="currentColor"
                  >
                    <circle cx="5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="19" cy="12" r="1.8" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                onCloseAutoFocus={(event) => {
                  const pending = pendingActionRef.current;
                  if (pending) {
                    pendingActionRef.current = null;
                    event.preventDefault();
                    pending();
                  }
                }}
              >
                <DropdownMenuItem
                  onSelect={() => {
                    const trigger = triggerRef.current;
                    pendingActionRef.current = () =>
                      actions.onRequestMove(item, trigger);
                  }}
                >
                  {copy.moveAction}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  tone="destructive"
                  onSelect={() => {
                    pendingActionRef.current = () =>
                      actions.onRequestRemove(item.id);
                  }}
                >
                  {copy.removeAction}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {actions.renderItemSlot ? (
        <div
          data-material-slot={item.id}
          className="mx-4 border-t border-edge py-2.5 sm:mx-5"
        >
          {actions.renderItemSlot(item)}
        </div>
      ) : null}

      {actions.canManage && isConfirming ? (
        <div
          role="region"
          aria-label={copy.confirmRemoveTitle(item.filename)}
          className="mx-4 mb-4 flex flex-col gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3.5 sm:mx-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-0.5 text-sm">
            <p className="font-display font-semibold text-foreground wrap-anywhere">
              {copy.confirmRemoveTitle(item.filename)}
            </p>
            <p className="text-muted-foreground">
              {copy.confirmRemoveDescription}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isRemoving}
              onClick={() => actions.onConfirmRemove(item)}
            >
              {isRemoving ? copy.removingAction : copy.confirmRemoveSubmit}
            </Button>
            <Button
              ref={registerCancel}
              type="button"
              variant="outline"
              size="sm"
              disabled={isRemoving}
              onClick={actions.onCancelRemove}
            >
              {copy.confirmRemoveCancel}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
