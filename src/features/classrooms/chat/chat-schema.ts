import { z } from 'zod';
import { chatMessages } from './chat-messages';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

/**
 * `SendMessageDto.body` limit from the contract
 * (`schema.generated.ts` `ChatController_send`): plain text, 1-2000 characters
 * after trimming; unsafe control characters are rejected.
 */
export const CHAT_MESSAGE_BODY_MAX_LENGTH = 2000;

/**
 * Mention bound from the contract: `@Name` resolves active classroom members,
 * at most 20 distinct users per message.
 */
export const CHAT_MENTIONED_USERS_MAX = 20;

/**
 * Mirrors the backend chat body validation (same policy as `ForumBody()`):
 * allows multiline `\n`, `\r`, and `\t`, while rejecting all other
 * ASCII/Unicode control characters as "unsafe control characters".
 */
export function hasDisallowedChatControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (
      (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
      (code >= 0x7f && code <= 0x9f)
    ) {
      return true;
    }
  }
  return false;
}

const isoInstantWithOffsetSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
    { message: 'Invalid ISO-8601 instant' },
  );

/**
 * The contract marks `mentionedUserIds` as "distinct resolved active classroom
 * members", so a response repeating a user is invalid, not deduplicated.
 */
const distinctMentionedUserIdsSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'mentionedUserIds must list distinct users',
  });

/**
 * `ChatMessageDto` (`ChatController_send` 201 response): the server-assigned
 * confirmation of one sent message. Author and time are server-assigned; the
 * body is trimmed plain text, never interpreted as HTML.
 */
export const chatMessageDtoSchema = z.object({
  id: z.string().min(1),
  classroomId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
  mentionedUserIds: distinctMentionedUserIdsSchema,
  createdAt: isoInstantWithOffsetSchema,
});

export type ChatMessageDto = z.infer<typeof chatMessageDtoSchema>;

/**
 * `ChatHistoryMessageDto` (`ChatController_list` items): adds the moderation
 * audit pair. Visible rows carry `null` audit values; hidden rows keep their
 * original text and the staff-only audit trail.
 */
export const chatHistoryMessageDtoSchema = chatMessageDtoSchema.extend({
  hiddenAt: isoInstantWithOffsetSchema.nullable(),
  hiddenById: z.string().min(1).nullable(),
});

export type ChatHistoryMessageDto = z.infer<typeof chatHistoryMessageDtoSchema>;

/**
 * `ChatController_list` 200 response. The contract fixes the order
 * (`createdAt DESC, id DESC`) and only accepts `page`/`pageSize`.
 */
export const paginatedChatHistorySchema = z.object({
  items: z.array(chatHistoryMessageDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type PaginatedChatHistoryDto = z.infer<
  typeof paginatedChatHistorySchema
>;

/**
 * Composer input validated against `SendMessageDto` before the request: only
 * `body` is sent; trimming and mention resolution happen on the server.
 */
export interface ChatComposerInput {
  body: string;
}

export const chatComposerSchema = z.object({
  body: z
    .string()
    .refine((value) => !hasDisallowedChatControlChar(value), {
      message: chatMessages.validation.bodyControlChars,
    })
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1, {
      message: chatMessages.validation.bodyRequired,
    })
    .refine((value) => value.length <= CHAT_MESSAGE_BODY_MAX_LENGTH, {
      message: chatMessages.validation.bodyMaxLength(
        CHAT_MESSAGE_BODY_MAX_LENGTH,
      ),
    }),
});
