import { useEffect, useReducer } from 'react';

/**
 * Where the floating chat dock is: whether the chat list is expanded and
 * which classroom conversation (at most ONE) is open or minimized.
 */
export interface ChatDockState {
  readonly listOpen: boolean;
  readonly conversationId: string | null;
  readonly minimized: boolean;
}

export type ChatDockAction =
  | { readonly type: 'toggleList' }
  | { readonly type: 'closeList' }
  | { readonly type: 'openConversation'; readonly classroomId: string }
  | { readonly type: 'minimize' }
  | { readonly type: 'restore' }
  | { readonly type: 'closeConversation' }
  | { readonly type: 'backToList' };

export const INITIAL_CHAT_DOCK_STATE: ChatDockState = {
  listOpen: false,
  conversationId: null,
  minimized: false,
};

export function chatDockReducer(
  state: ChatDockState,
  action: ChatDockAction,
): ChatDockState {
  switch (action.type) {
    case 'toggleList':
      return { ...state, listOpen: !state.listOpen };
    case 'closeList':
      return state.listOpen ? { ...state, listOpen: false } : state;
    case 'openConversation':
      return {
        ...state,
        conversationId: action.classroomId,
        minimized: false,
      };
    case 'minimize':
      return state.conversationId === null || state.minimized
        ? state
        : { ...state, minimized: true };
    case 'restore':
      return state.minimized ? { ...state, minimized: false } : state;
    case 'closeConversation':
      return { ...state, conversationId: null, minimized: false };
    case 'backToList':
      return { listOpen: true, conversationId: null, minimized: false };
  }
}

const STORAGE_PREFIX = 'chat-dock:v1:';

function readStoredState(userId: string): ChatDockState {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_PREFIX + userId);
    if (raw === null || raw === undefined) return INITIAL_CHAT_DOCK_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return INITIAL_CHAT_DOCK_STATE;
    }
    const value = parsed as Record<string, unknown>;
    const conversationId =
      typeof value.conversationId === 'string' && value.conversationId !== ''
        ? value.conversationId
        : null;
    return {
      listOpen: value.listOpen === true,
      conversationId,
      minimized: conversationId !== null && value.minimized === true,
    };
  } catch {
    return INITIAL_CHAT_DOCK_STATE;
  }
}

function writeStoredState(userId: string, state: ChatDockState): void {
  try {
    globalThis.sessionStorage?.setItem(
      STORAGE_PREFIX + userId,
      JSON.stringify(state),
    );
  } catch {
    // Storage can be unavailable (private mode, blocked data): the dock just
    // forgets its position on reload.
  }
}

/**
 * Dock state remembered for the browser session of ONE user (`sessionStorage`
 * keyed by user id, every access guarded): a reload keeps the list and the
 * conversation as they were; nothing is shared across users or tabs.
 */
export function useChatDockState(userId: string) {
  const [state, dispatch] = useReducer(
    chatDockReducer,
    userId,
    readStoredState,
  );
  useEffect(() => {
    writeStoredState(userId, state);
  }, [state, userId]);
  return [state, dispatch] as const;
}
