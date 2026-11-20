import { useCallback, useMemo } from 'react';
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { chatInboxQueryKey } from '@/api/query-keys';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import { selectTotalUnread, type ChatInboxDto } from './chat-inbox-schema';
import { listChatInbox } from './chat-inbox-service';

export const CHAT_INBOX_POLL_INTERVAL_MS = 30_000;

/**
 * Sets the unread count of one classroom to zero in the cached inbox (a no-op
 * when the inbox was never loaded), so badges clear immediately after a read
 * marker is accepted; a revalidation then confirms the server truth.
 */
export function clearInboxUnread(
  queryClient: QueryClient,
  userId: string,
  classroomId: string,
): void {
  queryClient.setQueryData<ChatInboxDto>(chatInboxQueryKey(userId), (data) =>
    data === undefined
      ? data
      : {
          ...data,
          items: data.items.map((item) =>
            item.classroomId === classroomId && item.unreadCount !== 0
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        },
  );
}

export interface UseChatInboxResult {
  readonly isAuthenticated: boolean;
  readonly inbox: ChatInboxDto | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly totalUnread: number;
  readonly refetch: () => void;
}

/**
 * The user's chat inbox (`GET /chats`): one entry per classroom with the last
 * message and unread count. Polled every 30 s and on window focus, like the
 * notification center, so unread badges stay current without holding a live
 * connection per classroom. Disabled while signed out.
 */
export function useChatInbox(): UseChatInboxResult {
  const { client } = useSessionService();
  const session = useSessionSnapshot();
  const userId = session.status === 'authenticated' ? session.user.id : null;

  const query = useQuery({
    queryKey: chatInboxQueryKey(userId ?? 'signed-out'),
    queryFn: ({ signal }) => listChatInbox(client, { signal }),
    enabled: userId !== null,
    refetchInterval: CHAT_INBOX_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const { refetch } = query;
  const totalUnread = useMemo(
    () => selectTotalUnread(query.data),
    [query.data],
  );
  const refetchInbox = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    isAuthenticated: userId !== null,
    inbox: query.data,
    isPending: query.isPending && userId !== null,
    isError: query.isError,
    totalUnread,
    refetch: refetchInbox,
  };
}

/** Marks the user's inbox stale so the next read refetches `GET /chats`. */
export function useInvalidateChatInbox(): () => void {
  const queryClient = useQueryClient();
  const session = useSessionSnapshot();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  return useCallback(() => {
    if (userId === null) return;
    void queryClient.invalidateQueries({
      queryKey: chatInboxQueryKey(userId),
      exact: true,
    });
  }, [queryClient, userId]);
}
