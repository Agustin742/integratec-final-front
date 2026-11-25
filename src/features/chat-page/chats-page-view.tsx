import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/router/document-title';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/feedback/states';
import { buttonStyles } from '@/components/ui/button';
import { ClassCallButton } from '@/features/calls';
import { cn } from '@/lib/utils';
import { BackIcon } from '../chat-dock/chat-dock-icons';
import { formatListTime, UnreadBadge } from '../chat-dock/chat-dock-list';
import { chatDockMessages as dockMessages } from '../chat-dock/messages';
import type { ChatInboxItemDto } from '../chat-inbox/chat-inbox-schema';
import { useChatInbox } from '../chat-inbox/use-chat-inbox';
import { ChatConversationWithComposer } from '../classrooms/chat/chat-conversation';
import { chatPageMessages as messages } from './messages';

const PANE =
  'min-h-0 overflow-hidden rounded-2xl border border-edge bg-card text-card-foreground shadow-panel';

function BackToListLink({ className }: { readonly className?: string }) {
  return (
    <Link
      to="/chats"
      className={cn(buttonStyles({ variant: 'ghost', size: 'sm' }), className)}
    >
      <BackIcon />
      {messages.backToList}
    </Link>
  );
}

function ChatList({
  items,
  userId,
  activeId,
}: {
  readonly items: readonly ChatInboxItemDto[];
  readonly userId: string;
  readonly activeId: string | undefined;
}) {
  return (
    <nav aria-label={messages.listLabel} className="h-full overflow-y-auto">
      <ul>
        {items.map((item) => {
          const last = item.lastMessage;
          const author =
            last === null
              ? null
              : last.authorId === userId
                ? dockMessages.you
                : last.authorDisplayName;
          const active = item.classroomId === activeId;
          return (
            <li
              key={item.classroomId}
              className="border-b border-edge last:border-b-0"
            >
              <Link
                to={`/chats/${item.classroomId}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 w-full items-start gap-2 px-3 py-3 text-left hover:bg-tray focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                  active && 'bg-muted/60',
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
                      ? dockMessages.lastMessage(author, last.bodyPreview)
                      : dockMessages.noMessagesYet}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0">
                  <UnreadBadge count={item.unreadCount} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The all-chats page body (`/chats`, `/chats/:classroomId`): the chats of
 * every classroom on the left and the shared conversation on the right
 * (LinkedIn "Messaging" style). Below `md` only one pane shows: the list at
 * `/chats`, the conversation (with a back link) at `/chats/:classroomId`. Both
 * panes stay in the DOM and CSS picks the visible one, so a single
 * conversation is mounted either way. The conversation, and with it the
 * classroom's realtime connection and read marker, exists only while a chat is
 * selected.
 */
export function ChatsPageView({
  userId,
  classroomId,
}: {
  readonly userId: string;
  readonly classroomId: string | undefined;
}) {
  const { inbox, isPending, isError, refetch } = useChatInbox();
  const items = inbox?.items ?? [];
  const selected =
    classroomId === undefined
      ? null
      : (items.find((item) => item.classroomId === classroomId) ?? null);
  useDocumentTitle(
    selected === null
      ? messages.title
      : messages.documentTitle(selected.classroomName),
  );

  const hasSelection = classroomId !== undefined;
  let body: ReactNode;
  if (inbox === undefined && isPending) {
    body = <LoadingState label={messages.loading} />;
  } else if (inbox === undefined && isError) {
    body = (
      <ErrorState
        title={messages.errorTitle}
        description={messages.errorDescription}
        onRetry={refetch}
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        title={messages.emptyTitle}
        description={messages.emptyDescription}
      />
    );
  } else {
    let conversation: ReactNode;
    if (selected !== null) {
      conversation = (
        <>
          <header className="flex shrink-0 items-center gap-1 border-b border-edge px-3 py-1">
            <BackToListLink className="-ml-2 md:hidden" />
            <h3 className="min-w-0 flex-1 truncate font-display text-base font-semibold">
              {selected.classroomName}
            </h3>
            <ClassCallButton
              classroomId={selected.classroomId}
              classroomName={selected.classroomName}
              compact
            />
          </header>
          <div className="min-h-0 flex-1 p-2">
            <ChatConversationWithComposer
              key={selected.classroomId}
              classroomId={selected.classroomId}
              variant="dock"
            />
          </div>
        </>
      );
    } else if (hasSelection) {
      conversation = (
        <div className="p-4">
          <EmptyState
            title={messages.notFoundTitle}
            description={messages.notFoundDescription}
            action={<BackToListLink />}
          />
        </div>
      );
    } else {
      conversation = (
        <div className="p-4">
          <EmptyState
            title={messages.pickTitle}
            description={messages.pickDescription}
          />
        </div>
      );
    }
    body = (
      <div className="grid h-[calc(100dvh-14rem)] min-h-[28rem] gap-4 md:grid-cols-[20rem_minmax(0,1fr)]">
        <div
          data-testid="chats-list-pane"
          className={cn(PANE, hasSelection && 'max-md:hidden')}
        >
          <ChatList items={items} userId={userId} activeId={classroomId} />
        </div>
        <div
          data-testid="chats-conversation-pane"
          className={cn(
            PANE,
            'flex flex-col',
            !hasSelection && 'max-md:hidden',
          )}
        >
          {conversation}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2
        className={cn(
          'text-2xl',
          // On small screens the open conversation carries its own title.
          selected !== null && 'max-md:sr-only',
        )}
      >
        {messages.title}
      </h2>
      {body}
    </section>
  );
}
