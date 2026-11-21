import { describe, expect, it } from 'vitest';
import {
  FORUM_POST_BODY_MAX_LENGTH,
  forumComposerSchema,
  forumThreadDetailDtoSchema,
  paginatedForumPostsSchema,
  paginatedForumThreadsSchema,
} from './forum-schema';

describe('forum-schema', () => {
  it('allows multiline text and tabs while rejecting blank text, disallowed control chars, and >2000 chars', () => {
    expect(
      forumComposerSchema.safeParse({
        body: '  Hola profe,\n¿el punto 2\tva con gráfico?  ',
      }),
    ).toEqual({
      success: true,
      data: { body: 'Hola profe,\n¿el punto 2\tva con gráfico?' },
    });

    expect(forumComposerSchema.safeParse({ body: '   \n\t  ' }).success).toBe(
      false,
    );
    expect(
      forumComposerSchema.safeParse({ body: 'Texto\x00invalido' }).success,
    ).toBe(false);
    expect(
      forumComposerSchema.safeParse({
        body: 'x'.repeat(FORUM_POST_BODY_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('validates paginated threads, thread detail, and paginated posts DTOs', () => {
    const post = {
      id: '00000000-0000-4000-8000-500000000001',
      threadId: '00000000-0000-4000-8000-400000000001',
      authorId: '00000000-0000-4000-8000-700000000001',
      body: '¿Se entrega en PDF?',
      createdAt: '2026-11-19T02:00:00.000Z',
    };

    expect(
      paginatedForumThreadsSchema.safeParse({
        items: [
          {
            id: post.threadId,
            activityId: '00000000-0000-4000-8000-510000000001',
            authorId: post.authorId,
            firstPostBody: post.body,
            replyCount: 0,
            createdAt: post.createdAt,
          },
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      }).success,
    ).toBe(true);

    expect(
      forumThreadDetailDtoSchema.safeParse({
        id: post.threadId,
        activityId: '00000000-0000-4000-8000-510000000001',
        authorId: post.authorId,
        posts: [post],
        createdAt: post.createdAt,
      }).success,
    ).toBe(true);

    expect(
      paginatedForumPostsSchema.safeParse({
        items: [post],
        page: 1,
        pageSize: 20,
        total: 1,
      }).success,
    ).toBe(true);
  });
});
