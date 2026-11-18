import { useEffect, useRef, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/dates';
import type { MaterialDto } from './material-schema';
import { materialMessages } from './messages';

export interface MaterialListProps {
  readonly items: readonly MaterialDto[];
  readonly canManage: boolean;
  readonly downloadingId: string | null;
  readonly removingId: string | null;
  readonly pendingConfirmId: string | null;
  readonly onDownload: (material: MaterialDto) => void;
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

export function MaterialList({
  items,
  canManage,
  downloadingId,
  removingId,
  pendingConfirmId,
  onDownload,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
  renderItemSlot,
}: MaterialListProps) {
  const removeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cancelButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousConfirmId = useRef<string | null>(null);

  useEffect(() => {
    const prev = previousConfirmId.current;
    previousConfirmId.current = pendingConfirmId;
    if (pendingConfirmId && pendingConfirmId !== prev) {
      cancelButtonRefs.current[pendingConfirmId]?.focus();
    } else if (!pendingConfirmId && prev) {
      removeButtonRefs.current[prev]?.focus();
    }
  }, [pendingConfirmId]);

  return (
    <ul
      aria-label={materialMessages.list.regionLabel}
      className="min-w-0 space-y-3"
    >
      {items.map((item) => {
        const isDownloading = downloadingId === item.id;
        const isRemoving = removingId === item.id;
        const isConfirming = pendingConfirmId === item.id;

        return (
          <li
            key={item.id}
            className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                >
                  {item.contentType === 'application/pdf' ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8M8 17h5"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm4 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm12 7-5-5-4 4-2-2-5 5"
                    />
                  )}
                </svg>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground wrap-anywhere">
                    {item.filename}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {materialMessages.list.types[item.contentType]}
                    </Badge>
                    <span>{formatFileSize(item.sizeBytes)}</span>
                    <span>
                      {materialMessages.list.uploadedAtPrefix}{' '}
                      {formatInstant(item.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloading || isRemoving}
                  onClick={() => onDownload(item)}
                >
                  {isDownloading
                    ? materialMessages.list.downloadingAction
                    : materialMessages.list.downloadAction}
                </Button>

                {canManage && !isConfirming && (
                  <Button
                    ref={(node) => {
                      removeButtonRefs.current[item.id] = node;
                    }}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRemoving || isDownloading}
                    onClick={() => onRequestRemove(item.id)}
                  >
                    {isRemoving
                      ? materialMessages.list.removingAction
                      : materialMessages.list.removeAction}
                  </Button>
                )}
              </div>
            </div>

            {renderItemSlot && (
              <div
                data-material-slot={item.id}
                className="border-t border-border/60 pt-2"
              >
                {renderItemSlot(item)}
              </div>
            )}

            {canManage && isConfirming && (
              <div
                role="region"
                aria-label={materialMessages.list.confirmRemoveTitle(
                  item.filename,
                )}
                className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-0.5 text-sm">
                  <p className="font-medium text-foreground wrap-anywhere">
                    {materialMessages.list.confirmRemoveTitle(item.filename)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {materialMessages.list.confirmRemoveDescription}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isRemoving}
                    onClick={() => onConfirmRemove(item)}
                  >
                    {isRemoving
                      ? materialMessages.list.removingAction
                      : materialMessages.list.confirmRemoveSubmit}
                  </Button>
                  <Button
                    ref={(node) => {
                      cancelButtonRefs.current[item.id] = node;
                    }}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRemoving}
                    onClick={onCancelRemove}
                  >
                    {materialMessages.list.confirmRemoveCancel}
                  </Button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
