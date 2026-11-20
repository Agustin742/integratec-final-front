import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../classrooms/classroom-service';
import { chatMessages } from '../classrooms/chat/chat-messages';
import { chatInboxSchema, type ChatInboxDto } from './chat-inbox-schema';

export { isAbortError };

export type ChatInboxServiceOptions = ClassroomServiceOptions;

/**
 * `GET /chats` (`ChatInboxController_list`): the chats of every classroom the
 * user belongs to, latest activity first, with the last visible message and
 * the unread count. Parents receive an empty list.
 */
export async function listChatInbox(
  client: TypedApiClient,
  options: ChatInboxServiceOptions = {},
): Promise<ChatInboxDto> {
  const data = await requestApi(() =>
    client.GET('/chats', { signal: options.signal }),
  );

  const parsed = chatInboxSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: chatMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }
  return parsed.data;
}

/**
 * `PUT /classrooms/{id}/messages/read-marker` (`ChatInboxController_markRead`):
 * records the newest visible message the caller has seen. The server only
 * moves the marker forward, so repeating or sending an older message is a
 * harmless `204`. A hidden or foreign message is a `404`, a parent a `403`.
 */
export async function markChatRead(
  client: TypedApiClient,
  classroomId: string,
  messageId: string,
  options: ChatInboxServiceOptions = {},
): Promise<void> {
  await requestApiVoid(() =>
    client.PUT('/classrooms/{id}/messages/read-marker', {
      params: { path: { id: classroomId } },
      body: { messageId },
      signal: options.signal,
    }),
  );
}
