import { z } from 'zod';
import { forumMessages } from './forum-messages';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

export const FORUM_POST_BODY_MAX_LENGTH = 2000;

/**
 * Mirrors backend `ForumBody()` (`activity-forum.dto.ts`): allows multiline
 * `\n`, `\r`, and `\t`, while rejecting all other ASCII/Unicode control chars.
 */
export function hasDisallowedForumControlChar(value: string): boolean {
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

export const forumPostDtoSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
  createdAt: isoInstantWithOffsetSchema,
});

export type ForumPostDto = z.infer<typeof forumPostDtoSchema>;

export const forumThreadSummaryDtoSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  authorId: z.string().min(1),
  firstPostBody: z.string().min(1),
  replyCount: z.number().int().min(0),
  createdAt: isoInstantWithOffsetSchema,
});

export type ForumThreadSummaryDto = z.infer<typeof forumThreadSummaryDtoSchema>;

export const forumThreadDetailDtoSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  authorId: z.string().min(1),
  posts: z.array(forumPostDtoSchema),
  createdAt: isoInstantWithOffsetSchema,
});

export type ForumThreadDetailDto = z.infer<typeof forumThreadDetailDtoSchema>;

export const paginatedForumThreadsSchema = z.object({
  items: z.array(forumThreadSummaryDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type PaginatedForumThreadsDto = z.infer<
  typeof paginatedForumThreadsSchema
>;

export const paginatedForumPostsSchema = z.object({
  items: z.array(forumPostDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type PaginatedForumPostsDto = z.infer<typeof paginatedForumPostsSchema>;

export const classroomDirectoryMemberSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  role: z.enum(['TEACHER', 'STUDENT']),
});

export const paginatedClassroomDirectorySchema = z.object({
  items: z.array(classroomDirectoryMemberSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type ClassroomDirectoryMemberDto = z.infer<
  typeof classroomDirectoryMemberSchema
>;

export type PaginatedClassroomDirectoryDto = z.infer<
  typeof paginatedClassroomDirectorySchema
>;

export interface ForumComposerInput {
  body: string;
}

export const forumComposerSchema = z.object({
  body: z
    .string()
    .refine((value) => !hasDisallowedForumControlChar(value), {
      message: forumMessages.validation.bodyControlChars,
    })
    .transform((value) => value.trim())
    .refine((value) => value.length >= 1, {
      message: forumMessages.validation.bodyRequired,
    })
    .refine((value) => value.length <= FORUM_POST_BODY_MAX_LENGTH, {
      message: forumMessages.validation.bodyMaxLength(
        FORUM_POST_BODY_MAX_LENGTH,
      ),
    }),
});
