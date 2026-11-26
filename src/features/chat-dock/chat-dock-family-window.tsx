import type { KeyboardEvent, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StaffFamilyThreadDto } from '../family/family-schema';
import { ParentLinkMessagesThread } from '../family/parent-link-messages-thread';
import {
  BackIcon,
  CloseIcon,
  MinimizeIcon,
  RestoreIcon,
} from './chat-dock-icons';
import { chatDockMessages as messages } from './messages';

export interface ChatDockFamilyWindowProps {
  readonly userId: string;
  readonly thread: StaffFamilyThreadDto;
  readonly minimized: boolean;
  readonly toggleRef: Ref<HTMLButtonElement>;
  readonly onMinimize: () => void;
  readonly onRestore: () => void;
  readonly onClose: () => void;
  readonly onBack: () => void;
}

/**
 * Floating parent-teacher conversation window in the chat dock: matches
 * `ChatDockWindow`'s chrome, responsive full-screen mobile / docked desktop
 * layout, minimize/restore/close controls, and Escape behavior, hosting
 * `ParentLinkMessagesThread` inside.
 */
export function ChatDockFamilyWindow({
  userId,
  thread,
  minimized,
  toggleRef,
  onMinimize,
  onRestore,
  onClose,
  onBack,
}: ChatDockFamilyWindowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (minimized || event.key !== 'Escape' || event.defaultPrevented) return;
    if (!event.currentTarget.contains(event.target as Node)) return;
    event.preventDefault();
    const isCompactViewport =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 639px)').matches;
    if (isCompactViewport) {
      onClose();
      return;
    }
    onMinimize();
  };

  return (
    // The Escape shortcut complements the visible minimize button.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      role={minimized ? 'region' : 'dialog'}
      aria-modal={minimized ? undefined : false}
      aria-label={messages.familyWindowLabel(thread.parentDisplayName)}
      onKeyDown={handleKeyDown}
      className={cn(
        'pointer-events-auto flex origin-bottom motion-safe:animate-dock-in w-[22rem] max-w-full flex-col overflow-hidden rounded-t-2xl border border-b-0 border-edge bg-card text-card-foreground shadow-float',
        minimized
          ? 'max-sm:w-auto max-sm:max-w-[calc(100vw-10rem)]'
          : 'h-[min(36rem,calc(100dvh-6rem))] max-sm:fixed max-sm:inset-x-0 max-sm:top-0 max-sm:z-40 max-sm:h-dvh max-sm:w-auto max-sm:rounded-none max-sm:border-0 max-sm:pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <header
        className={cn(
          'flex shrink-0 items-center gap-1 bg-card pl-3 pr-1 py-1',
          !minimized && 'border-b border-edge',
        )}
      >
        {minimized ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 sm:hidden"
            aria-label={messages.back}
            onClick={onBack}
          >
            <BackIcon />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-semibold">
            {thread.parentDisplayName}
          </h2>
          {minimized ? null : (
            <p className="truncate text-xs text-muted-foreground">
              {messages.familySubtitle(
                thread.childDisplayName,
                thread.classroomName,
              )}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={toggleRef}
          aria-label={minimized ? messages.restore : messages.minimize}
          onClick={minimized ? onRestore : onMinimize}
          className={cn(!minimized && 'max-sm:hidden')}
        >
          {minimized ? <RestoreIcon /> : <MinimizeIcon />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={messages.close}
          onClick={onClose}
        >
          <CloseIcon />
        </Button>
      </header>
      {minimized ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <ParentLinkMessagesThread
            key={thread.id}
            userId={userId}
            linkId={thread.id}
            viewerRole="STAFF"
            headingLevel="h3"
            hideHeader
          />
        </div>
      )}
    </section>
  );
}
