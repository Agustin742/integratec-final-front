import type { KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { formatDayLabel, formatTimeOfDay, getSchoolDayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { ChatInboxItemDto } from '../chat-inbox/chat-inbox-schema';
import { CloseIcon } from './chat-dock-icons';
import { chatDockMessages as messages } from './messages';

/** Time of day for today's messages, `Ayer` or the date for older ones. */
export function formatListTime(isoInstant: string): string {
  try {
    const now = new Date();
    return getSchoolDayKey(isoInstant) === getSchoolDayKey(now.toISOString())
      ? formatTimeOfDay(isoInstant)
      : formatDayLabel(isoInstant, now);
  } catch {
    return '';
  }
}

export function UnreadBadge({ count }: { readonly count: number }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs leading-none font-bold text-primary-foreground"
      >
        {count > 99 ? '99+' : count}
      </span>
      <span className="sr-only">{messages.unreadText(count)}</span>
    </>
  );
}

export interface ChatDockListProps {
  readonly id: string;
  readonly userId: string;
  readonly items: readonly ChatInboxItemDto[];
  readonly activeId: string | null;
  /** `true` hides the sheet on small screens while a conversation covers it. */
  readonly covered: boolean;
  /** Plays the enter animation, or the exit one while it closes. */
  readonly animated?: boolean;
  readonly closing?: boolean;
  readonly onAnimationEnd?: () => void;
  readonly onSelect: (classroomId: string) => void;
  readonly onClose: () => void;
  readonly registerItem: (
    classroomId: string,
    element: HTMLButtonElement | null,
  ) => void;
}

/**
 * Chat list of the dock: one button per classroom chat, latest activity first
 * (the server order). Above `sm` it is a panel stacked over the launcher; on
 * small screens it is a full-screen sheet with its own close button.
 */
export function ChatDockList({
  id,
  userId,
  items,
  activeId,
  covered,
  animated = false,
  closing = false,
  onAnimationEnd,
  onSelect,
  onClose,
  registerItem,
}: ChatDockListProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (closing) return;
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    // The Escape handler is a convenience for keyboard users; every control
    // inside stays reachable and operable without it.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      id={id}
      aria-label={messages.listLabel}
      inert={closing || undefined}
      aria-hidden={closing || undefined}
      onKeyDown={handleKeyDown}
      data-state={closing ? 'closed' : 'open'}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onAnimationEnd?.();
      }}
      // The list is the body of the dock surface (the launcher is its header):
      // above `sm` it has no border or radius of its own.
      className={cn(
        'pointer-events-auto flex max-h-[min(24rem,60vh)] origin-top flex-col overflow-hidden bg-card text-card-foreground',
        'max-sm:fixed max-sm:inset-x-0 max-sm:top-0 max-sm:z-40 max-sm:h-dvh max-sm:max-h-none max-sm:pb-[env(safe-area-inset-bottom)]',
        covered && 'max-sm:hidden',
        closing && 'pointer-events-none',
        animated && (closing ? 'animate-dock-out' : 'animate-dock-in'),
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-1 sm:hidden">
        <h2 className="font-display text-base font-semibold">
          {messages.listTitle}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={messages.closeList}
          onClick={onClose}
        >
          <CloseIcon />
        </Button>
      </div>
      <ul aria-label={messages.listLabel} className="min-h-0 overflow-y-auto">
        {items.map((item) => {
          const last = item.lastMessage;
          const author =
            last === null
              ? null
              : last.authorId === userId
                ? messages.you
                : last.authorDisplayName;
          return (
            <li
              key={item.classroomId}
              className="border-b border-edge last:border-b-0"
            >
              <button
                type="button"
                ref={(element) => {
                  registerItem(item.classroomId, element);
                }}
                aria-current={
                  item.classroomId === activeId ? 'true' : undefined
                }
                onClick={() => {
                  onSelect(item.classroomId);
                }}
                className={cn(
                  'flex min-h-14 w-full cursor-pointer items-start gap-2 px-3 py-2 text-left hover:bg-tray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  item.classroomId === activeId && 'bg-muted/60',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {item.classroomName}
                    </span>
                    {last !== null ? (
                      <time
                        dateTime={last.createdAt}
                        className="shrink-0 text-xs text-muted-foreground"
                      >
                        {formatListTime(last.createdAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {last !== null && author !== null
                      ? messages.lastMessage(author, last.bodyPreview)
                      : messages.noMessagesYet}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0">
                  <UnreadBadge count={item.unreadCount} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
