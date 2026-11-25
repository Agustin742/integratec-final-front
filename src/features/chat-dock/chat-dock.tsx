import { useCallback, useContext, useEffect, useId, useRef } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { useSessionSnapshot } from '@/session/provider';
import { useChatInbox } from '../chat-inbox/use-chat-inbox';
import { useStaffFamilyThreads } from '../family/use-staff-family-threads';
import { ChatDockFamilyWindow } from './chat-dock-family-window';
import { ChatBubbleIcon, ChevronUpIcon } from './chat-dock-icons';
import { ChatDockList, UnreadBadge } from './chat-dock-list';
import { useChatDockState } from './chat-dock-state';
import { useDockPresence } from './use-dock-presence';
import { ChatDockWindow } from './chat-dock-window';
import { chatDockMessages as messages } from './messages';

type FocusTarget = 'launcher' | 'list-item' | 'family-item' | 'toggle';
interface FocusRequest {
  readonly target: FocusTarget;
  readonly itemId: string | null;
}

/**
 * Floating chat dock (LinkedIn / Facebook style) mounted once in the
 * authenticated app shell: a launcher fixed at the bottom-right with the total
 * unread count, the list of the user's classroom chats, and ONE conversation
 * window at a time. Renders nothing while signed out, without a query client,
 * or when the inbox has no chats (parents never have any).
 */
export function ChatDock() {
  const queryClient = useContext(QueryClientContext);
  const snapshot = useSessionSnapshot();
  const { pathname } = useLocation();
  // The all-chats page IS the conversation surface: no second window there.
  const onChatsPage = pathname === '/chats' || pathname.startsWith('/chats/');
  if (!queryClient || snapshot.status !== 'authenticated' || onChatsPage) {
    return null;
  }
  return <ChatDockContent key={snapshot.user.id} userId={snapshot.user.id} />;
}

function ChatDockContent({ userId }: { readonly userId: string }) {
  const { inbox, totalUnread } = useChatInbox();
  const { threads: familyThreads } = useStaffFamilyThreads();
  const [state, dispatch] = useChatDockState(userId);
  const listId = useId();
  const listPresence = useDockPresence(state.listOpen);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const familyItemRefs = useRef(new Map<string, HTMLButtonElement>());
  // Focus to apply once the next render has made its target exist.
  const focusRequestRef = useRef<FocusRequest | null>(null);

  const items = inbox?.items ?? [];
  const conversation =
    state.conversationId === null
      ? null
      : (items.find((item) => item.classroomId === state.conversationId) ??
        null);
  const familyThread =
    conversation === null && state.familyLinkId !== null
      ? (familyThreads.find((thread) => thread.id === state.familyLinkId) ??
        null)
      : null;
  const conversationExpanded =
    (conversation !== null || familyThread !== null) && !state.minimized;

  useEffect(() => {
    const request = focusRequestRef.current;
    if (request === null) return;
    focusRequestRef.current = null;
    const element =
      request.target === 'launcher'
        ? launcherRef.current
        : request.target === 'toggle'
          ? toggleRef.current
          : request.target === 'family-item'
            ? (familyItemRefs.current.get(request.itemId ?? '') ??
              launcherRef.current)
            : (itemRefs.current.get(request.itemId ?? '') ??
              launcherRef.current);
    element?.focus();
  }, [state]);

  const registerItem = useCallback(
    (classroomId: string, element: HTMLButtonElement | null) => {
      if (element === null) {
        itemRefs.current.delete(classroomId);
      } else {
        itemRefs.current.set(classroomId, element);
      }
    },
    [],
  );

  const registerFamilyItem = useCallback(
    (familyLinkId: string, element: HTMLButtonElement | null) => {
      if (element === null) {
        familyItemRefs.current.delete(familyLinkId);
      } else {
        familyItemRefs.current.set(familyLinkId, element);
      }
    },
    [],
  );

  if (items.length === 0 && familyThreads.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={messages.region}
      className="pointer-events-none fixed right-4 bottom-0 z-40 flex items-end gap-2 max-sm:right-3 max-sm:bottom-3"
    >
      {conversation !== null ? (
        <ChatDockWindow
          key={conversation.classroomId}
          classroomId={conversation.classroomId}
          classroomName={conversation.classroomName}
          unreadCount={conversation.unreadCount}
          minimized={state.minimized}
          toggleRef={toggleRef}
          onMinimize={() => {
            dispatch({ type: 'minimize' });
            focusRequestRef.current = { target: 'toggle', itemId: null };
          }}
          onRestore={() => {
            dispatch({ type: 'restore' });
          }}
          onClose={() => {
            dispatch({ type: 'closeConversation' });
            focusRequestRef.current = {
              target: state.listOpen ? 'list-item' : 'launcher',
              itemId: conversation.classroomId,
            };
          }}
          onBack={() => {
            dispatch({ type: 'backToList' });
            focusRequestRef.current = {
              target: 'list-item',
              itemId: conversation.classroomId,
            };
          }}
        />
      ) : familyThread !== null ? (
        <ChatDockFamilyWindow
          key={familyThread.id}
          userId={userId}
          thread={familyThread}
          minimized={state.minimized}
          toggleRef={toggleRef}
          onMinimize={() => {
            dispatch({ type: 'minimize' });
            focusRequestRef.current = { target: 'toggle', itemId: null };
          }}
          onRestore={() => {
            dispatch({ type: 'restore' });
          }}
          onClose={() => {
            dispatch({ type: 'closeConversation' });
            focusRequestRef.current = {
              target: state.listOpen ? 'family-item' : 'launcher',
              itemId: familyThread.id,
            };
          }}
          onBack={() => {
            dispatch({ type: 'backToList' });
            focusRequestRef.current = {
              target: 'family-item',
              itemId: familyThread.id,
            };
          }}
        />
      ) : null}

      {/* One continuous surface: the launcher is the header of the open list
          (same background, radius and border, no gap), so the dock reads as a
          single panel that expands from its toggle. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        data-chat-dock-surface=""
        onKeyDown={(event) => {
          if (
            state.listOpen &&
            event.key === 'Escape' &&
            !event.defaultPrevented
          ) {
            event.preventDefault();
            dispatch({ type: 'closeList' });
            focusRequestRef.current = {
              target: 'launcher',
              itemId: null,
            };
          }
        }}
        className="pointer-events-none flex w-64 flex-col max-sm:w-auto max-sm:items-end sm:pointer-events-auto sm:overflow-hidden sm:rounded-t-2xl sm:border sm:border-b-0 sm:border-edge sm:bg-card sm:shadow-float"
      >
        <button
          type="button"
          ref={launcherRef}
          aria-expanded={state.listOpen}
          aria-controls={state.listOpen ? listId : undefined}
          aria-label={messages.launcherLabel(totalUnread)}
          onClick={() => {
            dispatch({ type: 'toggleList' });
          }}
          className={cn(
            'pointer-events-auto flex min-h-12 w-full cursor-pointer items-center gap-2 bg-card px-3 text-card-foreground',
            'hover:bg-tray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            'max-sm:w-auto max-sm:rounded-full max-sm:border max-sm:border-edge max-sm:shadow-float',
            state.listOpen && 'sm:border-b sm:border-edge',
          )}
        >
          <ChatBubbleIcon />
          <span className="min-w-0 flex-1 truncate text-left font-display text-base font-semibold max-sm:flex-none">
            {messages.launcherText}
          </span>
          <UnreadBadge count={totalUnread} />
          <span
            className={cn(
              'transition-transform motion-reduce:transition-none max-sm:hidden',
              state.listOpen && 'rotate-180',
            )}
          >
            <ChevronUpIcon />
          </span>
        </button>
        {listPresence.mounted ? (
          <ChatDockList
            id={listId}
            userId={userId}
            items={items}
            activeId={conversation?.classroomId ?? null}
            familyThreads={familyThreads}
            activeFamilyLinkId={familyThread?.id ?? null}
            covered={conversationExpanded}
            animated={listPresence.animated}
            closing={!state.listOpen}
            onAnimationEnd={listPresence.onAnimationEnd}
            registerItem={registerItem}
            registerFamilyItem={registerFamilyItem}
            onSelect={(classroomId) => {
              dispatch({ type: 'openConversation', classroomId });
            }}
            onSelectFamilyThread={(familyLinkId) => {
              dispatch({ type: 'openFamilyThread', familyLinkId });
            }}
            onClose={() => {
              dispatch({ type: 'closeList' });
              focusRequestRef.current = {
                target: 'launcher',
                itemId: null,
              };
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
