import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { AnnouncementDto } from './announcement-schema';
import { AnnouncementNote, type NoticeAuthor } from './announcement-note';
import { announcementMessages } from './messages';

export interface AnnouncementListProps {
  readonly items: readonly AnnouncementDto[];
  readonly resolveAuthor: (item: AnnouncementDto) => NoticeAuthor;
  /** Epoch ms used only to phrase relative ages. */
  readonly now: number;
  readonly canModifyItem: (item: AnnouncementDto) => boolean;
  readonly editingId: string | null;
  readonly removingId: string | null;
  readonly actionsLocked?: boolean;
  readonly pendingConfirmId: string | null;
  readonly renderEditor: (item: AnnouncementDto) => ReactNode;
  readonly onStartEdit: (item: AnnouncementDto) => void;
  readonly onRequestRemove: (announcementId: string) => void;
  readonly onConfirmRemove: (item: AnnouncementDto) => void;
  readonly onCancelRemove: () => void;
}

export function AnnouncementList({
  items,
  resolveAuthor,
  now,
  canModifyItem,
  editingId,
  removingId,
  actionsLocked = false,
  pendingConfirmId,
  renderEditor,
  onStartEdit,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
}: AnnouncementListProps) {
  const menuTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const cancelButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousConfirmId = useRef<string | null>(null);

  useEffect(() => {
    const prev = previousConfirmId.current;
    previousConfirmId.current = pendingConfirmId;
    if (pendingConfirmId && pendingConfirmId !== prev) {
      cancelButtonRefs.current[pendingConfirmId]?.focus();
    } else if (!pendingConfirmId && prev) {
      menuTriggerRefs.current.get(prev)?.focus();
    }
  }, [pendingConfirmId]);

  return (
    <ul
      aria-label={announcementMessages.list.regionLabel}
      className="min-w-0 space-y-7"
    >
      {items.map((item) => {
        const canModify = canModifyItem(item);
        const isEditing = editingId === item.id;
        const isRemoving = removingId === item.id;
        const isConfirming = pendingConfirmId === item.id;

        return (
          <AnnouncementNote
            key={item.id}
            item={item}
            author={resolveAuthor(item)}
            now={now}
            canModify={canModify}
            menuDisabled={
              actionsLocked || isEditing || isConfirming || removingId !== null
            }
            registerMenuTrigger={(node) => {
              if (node) {
                menuTriggerRefs.current.set(item.id, node);
              } else {
                menuTriggerRefs.current.delete(item.id);
              }
            }}
            onEdit={onStartEdit}
            onRemove={(target) => onRequestRemove(target.id)}
            editor={isEditing && canModify ? renderEditor(item) : undefined}
          >
            {canModify && isConfirming ? (
              <div
                role="region"
                aria-label={announcementMessages.list.confirmRemovePrompt(
                  item.title,
                )}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
              >
                <p className="text-sm text-foreground">
                  {announcementMessages.list.confirmRemovePrompt(item.title)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    ref={(el) => {
                      cancelButtonRefs.current[item.id] = el;
                    }}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRemoving}
                    onClick={onCancelRemove}
                  >
                    {announcementMessages.list.cancelRemoveLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isRemoving}
                    onClick={() => onConfirmRemove(item)}
                  >
                    {isRemoving
                      ? announcementMessages.list.removingLabel
                      : announcementMessages.list.confirmRemoveLabel}
                  </Button>
                </div>
              </div>
            ) : null}
          </AnnouncementNote>
        );
      })}
    </ul>
  );
}
