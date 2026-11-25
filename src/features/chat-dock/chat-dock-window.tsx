import type { KeyboardEvent, Ref } from 'react';
import { Button } from '@/components/ui/button';
import { ClassCallButton } from '@/features/calls';
import { cn } from '@/lib/utils';
import { ChatConversationWithComposer } from '../classrooms/chat/chat-conversation';
import {
  BackIcon,
  CloseIcon,
  MinimizeIcon,
  RestoreIcon,
} from './chat-dock-icons';
import { UnreadBadge } from './chat-dock-list';
import { chatDockMessages as messages } from './messages';

export interface ChatDockWindowProps {
  readonly classroomId: string;
  readonly classroomName: string;
  readonly unreadCount: number;
  readonly minimized: boolean;
  readonly toggleRef: Ref<HTMLButtonElement>;
  readonly onMinimize: () => void;
  readonly onRestore: () => void;
  readonly onClose: () => void;
  readonly onBack: () => void;
}

/**
 * One conversation window of the dock: a slim header (back on small screens,
 * classroom name, minimize/restore, close) over the shared
 * `ChatConversationWithComposer`, which takes all the remaining height.
 *
 * Expanded it is a NON-MODAL `dialog`: focus moves into the draft when it
 * opens, Escape minimizes it and the rest of the page stays usable, which is
 * exactly the dialog contract without the focus trap. Minimized it is a plain
 * labelled `region` holding only the header. The conversation (and with it
 * the classroom's realtime connection) exists only while expanded.
 */
export function ChatDockWindow({
  classroomId,
  classroomName,
  unreadCount,
  minimized,
  toggleRef,
  onMinimize,
  onRestore,
  onClose,
  onBack,
}: ChatDockWindowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (minimized || event.key !== 'Escape' || event.defaultPrevented) return;
    // Portaled layers (the moderation dialog) bubble through React: only the
    // keys pressed inside this window's own DOM handle Escape. The mention list
    // consumes its own Escape (`defaultPrevented`).
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
      aria-label={messages.windowLabel(classroomName)}
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
          'flex shrink-0 items-center gap-1 bg-card pl-3 pr-1',
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
        <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold">
          {classroomName}
        </h2>
        {minimized ? <UnreadBadge count={unreadCount} /> : null}
        {minimized ? null : (
          <ClassCallButton
            classroomId={classroomId}
            classroomName={classroomName}
          />
        )}
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
        <div className="min-h-0 flex-1 p-2">
          <ChatConversationWithComposer
            classroomId={classroomId}
            variant="dock"
            focusComposerOnMount
          />
        </div>
      )}
    </section>
  );
}
