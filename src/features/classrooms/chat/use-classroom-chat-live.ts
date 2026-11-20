import { useEffect, useRef } from 'react';
import {
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  createClassroomChatHistoryPredicate,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import { useClassroomRealtimeManager } from '@/realtime/classroom-realtime-provider';
import {
  CHAT_MESSAGE_EVENT,
  CHAT_MESSAGE_HIDDEN_EVENT,
  chatMessageHiddenPayloadSchema,
  chatMessagePayloadSchema,
  type ChatMessagePayload,
} from '@/realtime/contracts.generated';
import { useSessionSnapshot } from '@/session/provider';
import type { PaginatedChatHistoryDto } from './chat-schema';

type HistoryData = InfiniteData<PaginatedChatHistoryDto, number>;

export interface UseClassroomChatLiveOptions {
  /**
   * Teaching staff keep hidden messages visible with their audit trail, which
   * only the REST history carries; students never keep a hidden message.
   */
  readonly canModerate?: boolean;
}

function prependLiveMessage(
  data: HistoryData | undefined,
  message: ChatMessagePayload,
): HistoryData | undefined {
  if (data === undefined || data.pages.length === 0) return data;
  const known = data.pages.some((page) =>
    page.items.some((item) => item.id === message.id),
  );
  if (known) return data;
  const [first, ...older] = data.pages;
  return {
    ...data,
    pages: [
      {
        ...first,
        items: [
          { ...message, hiddenAt: null, hiddenById: null },
          ...first.items,
        ],
        total: first.total + 1,
      },
      ...older,
    ],
  };
}

function dropMessage(
  data: HistoryData | undefined,
  messageId: string,
): HistoryData | undefined {
  if (data === undefined) return data;
  if (!data.pages.some((page) => page.items.some((i) => i.id === messageId))) {
    return data;
  }
  return {
    ...data,
    pages: data.pages.map((page) => {
      const items = page.items.filter((item) => item.id !== messageId);
      return items.length === page.items.length
        ? page
        : { ...page, items, total: Math.max(0, page.total - 1) };
    }),
  };
}

function resync(queryClient: QueryClient, userId: string, classroomId: string) {
  void queryClient.invalidateQueries({
    predicate: createClassroomChatPredicate(userId, classroomId),
  });
}

/**
 * Live classroom chat over the shared Colyseus connection (back #48): applies
 * `chat:message` and `chat:message.hidden` to the cached history of this user
 * and classroom, and revalidates it after a connection loss so nothing missed
 * while offline stays missing. Every payload is validated against the shared
 * contract before it touches the cache. Without a realtime provider or while
 * the connection is unavailable the chat keeps working on REST alone.
 *
 * Any number of chat views may call this for the same classroom: they share a
 * single connection, and applying an event twice is harmless (dedupe by id).
 */
export function useClassroomChatLive(
  classroomId: string,
  { canModerate = false }: UseClassroomChatLiveOptions = {},
): void {
  const manager = useClassroomRealtimeManager();
  const session = useSessionSnapshot();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const queryClient = useQueryClient();
  const canModerateRef = useRef(canModerate);
  useEffect(() => {
    canModerateRef.current = canModerate;
  }, [canModerate]);

  useEffect(() => {
    if (manager === null || userId === null || classroomId.trim() === '') {
      return undefined;
    }
    const lease = manager.acquire(classroomId);
    if (lease === null) return undefined;
    const { client } = lease;
    const historyPredicate = createClassroomChatHistoryPredicate(
      userId,
      classroomId,
    );

    const offMessage = client.onMessage(
      CHAT_MESSAGE_EVENT,
      chatMessagePayloadSchema,
      (message) => {
        if (message.classroomId !== classroomId) return;
        queryClient.setQueriesData<HistoryData>(
          { predicate: historyPredicate },
          (data) => prependLiveMessage(data, message),
        );
      },
    );
    const offHidden = client.onMessage(
      CHAT_MESSAGE_HIDDEN_EVENT,
      chatMessageHiddenPayloadSchema,
      ({ messageId }) => {
        if (canModerateRef.current) {
          resync(queryClient, userId, classroomId);
          return;
        }
        queryClient.setQueriesData<HistoryData>(
          { predicate: historyPredicate },
          (data) => dropMessage(data, messageId),
        );
      },
    );

    // A drop or a failed attempt can swallow events: when the connection comes
    // back, trust the server history instead of the live cache.
    let interrupted = false;
    const offStatus = client.subscribe(() => {
      const snapshot = client.getSnapshot();
      if (
        snapshot.status === 'reconnecting' ||
        (snapshot.status === 'disconnected' && snapshot.reason !== null)
      ) {
        interrupted = true;
      } else if (snapshot.status === 'connected' && interrupted) {
        interrupted = false;
        resync(queryClient, userId, classroomId);
      }
    });

    return () => {
      offMessage();
      offHidden();
      offStatus();
      lease.release();
    };
  }, [classroomId, manager, queryClient, userId]);
}
