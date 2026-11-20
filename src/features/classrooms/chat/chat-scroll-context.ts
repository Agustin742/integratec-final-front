import { createContext, useContext } from 'react';

/**
 * Bridge between the history list (owner of the scroll container) and the
 * composer slot rendered next to it: after the user's own confirmed send the
 * composer asks the list to follow the conversation to its newest message.
 */
export interface ChatScrollApi {
  /** Pins the view to the newest message, now and when the send lands. */
  readonly scrollToLatest: () => void;
}

const noopScrollApi: ChatScrollApi = { scrollToLatest: () => undefined };

export const ChatScrollContext = createContext<ChatScrollApi>(noopScrollApi);

export function useChatScroll(): ChatScrollApi {
  return useContext(ChatScrollContext);
}
