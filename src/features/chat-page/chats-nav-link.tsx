import { useContext } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { Link } from 'react-router';
import { buttonStyles } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionSnapshot } from '@/session/provider';
import { ChatBubbleIcon } from '../chat-dock/chat-dock-icons';
import { useChatInbox } from '../chat-inbox/use-chat-inbox';
import { chatPageMessages as messages } from './messages';

/**
 * Navbar entry to the all-chats page, next to the notification bell. It shows
 * the total unread count (capped at `99+`, the accessible name keeps the real
 * number) and renders nothing while signed out, without a query client, or
 * when the inbox has no chats: the same visibility rule as the chat dock, so
 * parents never see it.
 */
export function ChatsNavLink() {
  const queryClient = useContext(QueryClientContext);
  const snapshot = useSessionSnapshot();
  if (!queryClient || snapshot.status !== 'authenticated') {
    return null;
  }
  return <ChatsNavLinkContent />;
}

function ChatsNavLinkContent() {
  const { inbox, totalUnread } = useChatInbox();
  if ((inbox?.items.length ?? 0) === 0) {
    return null;
  }
  return (
    <Link
      to="/chats"
      aria-label={messages.navLabel(totalUnread)}
      className={cn(
        buttonStyles({ variant: 'outline', size: 'sm' }),
        'relative min-h-11 min-w-11 gap-1.5 px-3',
      )}
    >
      <ChatBubbleIcon />
      {totalUnread > 0 ? (
        <span
          aria-hidden="true"
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs leading-none font-bold text-primary-foreground"
        >
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      ) : null}
    </Link>
  );
}
