import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { chatInboxQueryKey } from '@/api/query-keys';
import { useSessionService } from '@/session/provider';
import type { ChatInboxDto } from './chat-inbox-schema';
import { markChatRead } from './chat-inbox-service';
import { clearInboxUnread } from './use-chat-inbox';

/** Pause before a read marker is sent, so scrolling or bursts send once. */
export const READ_MARKER_DEBOUNCE_MS = 1000;

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(
    () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  useEffect(() => {
    const update = () => {
      setVisible(document.visibilityState !== 'hidden');
    };
    document.addEventListener('visibilitychange', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return visible;
}

export interface UseChatReadMarkerOptions {
  readonly userId: string;
  readonly classroomId: string;
  /** Newest VISIBLE message of the loaded history, `null` while empty. */
  readonly newestMessageId: string | null;
  /** Whether the newest message is in the reader's viewport. */
  readonly inView: boolean;
}

/**
 * Reports the newest message the reader has seen
 * (`PUT /classrooms/{id}/messages/read-marker`).
 *
 * The marker is sent after a short debounce, only while the page is visible
 * and the newest message is in view, and only when the newest message
 * advanced since the last report (the server is forward-only and idempotent,
 * so a skipped or repeated call is never wrong). When the server accepts it,
 * the cached inbox entry is set to zero unread and the inbox revalidated. A
 * `404` (the message was hidden meanwhile) or `403` is ignored: they only
 * mean there is nothing to mark.
 */
export function useChatReadMarker({
  userId,
  classroomId,
  newestMessageId,
  inView,
}: UseChatReadMarkerOptions): void {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const documentVisible = useDocumentVisible();
  const lastReportedRef = useRef<string | null>(null);

  const active = inView && documentVisible;

  useEffect(() => {
    if (
      !active ||
      newestMessageId === null ||
      lastReportedRef.current === newestMessageId
    ) {
      return undefined;
    }

    const inbox = queryClient.getQueryData<ChatInboxDto>(
      chatInboxQueryKey(userId),
    );
    const entry = inbox?.items.find((item) => item.classroomId === classroomId);
    if (
      entry !== undefined &&
      entry.unreadCount === 0 &&
      entry.lastMessage?.id === newestMessageId
    ) {
      // The server already considers this message read.
      lastReportedRef.current = newestMessageId;
      return undefined;
    }

    const timer = setTimeout(() => {
      lastReportedRef.current = newestMessageId;
      markChatRead(client, classroomId, newestMessageId).then(
        () => {
          clearInboxUnread(queryClient, userId, classroomId);
          void queryClient.invalidateQueries({
            queryKey: chatInboxQueryKey(userId),
            exact: true,
          });
        },
        (error: unknown) => {
          const status = error instanceof ApiError ? error.status : null;
          if (status === 403 || status === 404) {
            return;
          }
          // Transient failure: allow the next newest message (or a return to
          // the bottom) to report again.
          lastReportedRef.current = null;
        },
      );
    }, READ_MARKER_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [active, classroomId, client, newestMessageId, queryClient, userId]);
}
