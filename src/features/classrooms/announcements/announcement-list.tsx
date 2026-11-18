import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/dates';
import type { AnnouncementDto } from './announcement-schema';
import { announcementMessages } from './messages';

export interface AnnouncementListProps {
  readonly items: readonly AnnouncementDto[];
  readonly canModifyItem: (item: AnnouncementDto) => boolean;
  readonly editingId: string | null;
  readonly removingId: string | null;
  readonly actionsLocked?: boolean;
  readonly pendingConfirmId: string | null;
  readonly onStartEdit: (item: AnnouncementDto) => void;
  readonly onRequestRemove: (announcementId: string) => void;
  readonly onConfirmRemove: (item: AnnouncementDto) => void;
  readonly onCancelRemove: () => void;
}

export function AnnouncementList({
  items,
  canModifyItem,
  editingId,
  removingId,
  actionsLocked = false,
  pendingConfirmId,
  onStartEdit,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
}: AnnouncementListProps) {
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
      aria-label={announcementMessages.list.regionLabel}
      className="min-w-0 space-y-3"
    >
      {items.map((item) => {
        const canModify = canModifyItem(item);
        const isEditing = editingId === item.id;
        const isRemoving = removingId === item.id;
        const isConfirming = pendingConfirmId === item.id;
        const wasEdited = item.updatedAt !== item.createdAt;

        return (
          <li
            key={item.id}
            className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs"
          >
            <article className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="break-words text-base font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {announcementMessages.list.publishedAtLabel}{' '}
                      <time dateTime={item.createdAt}>
                        {formatInstant(item.createdAt)}
                      </time>
                    </span>
                    {wasEdited ? (
                      <span>
                        {announcementMessages.list.updatedAtLabel}{' '}
                        <time dateTime={item.updatedAt}>
                          {formatInstant(item.updatedAt)}
                        </time>
                      </span>
                    ) : null}
                    {item.mentionedUserIds.length > 0 ? (
                      <Badge variant="secondary">
                        {announcementMessages.list.mentionsLabel(
                          item.mentionedUserIds.length,
                        )}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {canModify && !isConfirming ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsLocked || isRemoving || isEditing}
                      onClick={() => onStartEdit(item)}
                    >
                      {announcementMessages.list.editLabel}
                    </Button>
                    <Button
                      ref={(el) => {
                        removeButtonRefs.current[item.id] = el;
                      }}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsLocked || removingId !== null}
                      onClick={() => onRequestRemove(item.id)}
                    >
                      {isRemoving
                        ? announcementMessages.list.removingLabel
                        : announcementMessages.list.removeLabel}
                    </Button>
                  </div>
                ) : null}
              </div>

              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {item.content}
              </p>

              {canModify && isConfirming ? (
                <div
                  role="region"
                  aria-label={announcementMessages.list.confirmRemovePrompt(
                    item.title,
                  )}
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
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
            </article>
          </li>
        );
      })}
    </ul>
  );
}
