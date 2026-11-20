import { z } from 'zod';
import { isoInstantWithOffsetSchema } from '../classrooms/chat/chat-schema';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

/**
 * Last VISIBLE message of a chat (`ChatInboxLastMessageDto`). The preview is
 * plain text with collapsed whitespace, cut by the server; it is rendered as a
 * text node, never interpreted as HTML.
 */
export const chatInboxLastMessageSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().min(1),
  authorDisplayName: z.string(),
  bodyPreview: z.string(),
  createdAt: isoInstantWithOffsetSchema,
});

export type ChatInboxLastMessageDto = z.infer<
  typeof chatInboxLastMessageSchema
>;

/** One classroom chat of the inbox (`ChatInboxItemDto`). */
export const chatInboxItemSchema = z.object({
  classroomId: z.string().min(1),
  classroomName: z.string(),
  lastMessage: chatInboxLastMessageSchema.nullable(),
  unreadCount: z.number().int().min(0),
});

export type ChatInboxItemDto = z.infer<typeof chatInboxItemSchema>;

/**
 * `GET /chats` 200 response (`ChatInboxDto`): latest activity first. Parents
 * get no items, never an error.
 */
export const chatInboxSchema = z.object({
  items: z.array(chatInboxItemSchema),
});

export type ChatInboxDto = z.infer<typeof chatInboxSchema>;

/** Unread messages across every chat, for the launcher and navbar badges. */
export function selectTotalUnread(inbox: ChatInboxDto | undefined): number {
  return (inbox?.items ?? []).reduce((sum, item) => sum + item.unreadCount, 0);
}
