import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createActivityForumStore,
  TEST_API_BASE_URL,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  createActivityForumPost,
  createActivityForumThread,
  isAbortError,
  isUncertainForumWriteError,
  listActivityForumPosts,
  listActivityForumThreads,
} from './forum-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000052';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000005101';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';

describe('forum-service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('creates threads, posts replies, and lists both with pagination/sorting', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
    });
    mswServer.use(...store.handlers);

    const created = await createActivityForumThread(
      client,
      CLASSROOM_ID,
      ACTIVITY_ID,
      '¿Hasta qué hora se puede entregar?\nGracias.',
    );
    expect(created.posts).toHaveLength(1);

    store.setRole('TEACHER');
    store.setCurrentUserId(TEACHER_ID);
    const reply = await createActivityForumPost(
      client,
      CLASSROOM_ID,
      ACTIVITY_ID,
      created.id,
      'Hasta las 23:30 hs.',
    );
    expect(reply.authorId).toBe(TEACHER_ID);

    const threads = await listActivityForumThreads(
      client,
      CLASSROOM_ID,
      ACTIVITY_ID,
    );
    expect(threads.total).toBe(1);
    expect(threads.items[0].replyCount).toBe(1);

    const posts = await listActivityForumPosts(
      client,
      CLASSROOM_ID,
      ACTIVITY_ID,
      created.id,
    );
    expect(posts.total).toBe(2);
    expect(posts.items[1].body).toBe('Hasta las 23:30 hs.');
  });

  it('denies parents with 403 and marks 5xx/network/malformed 2xx writes as uncertain', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createActivityForumStore({
      classroomId: CLASSROOM_ID,
      activityId: ACTIVITY_ID,
      role: 'PARENT',
    });
    mswServer.use(...store.handlers);

    await expect(
      listActivityForumThreads(client, CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
      return true;
    });

    store.setRole('STUDENT');
    store.failNext('createThread', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Down',
        correlationId: 'req-503',
      },
    });
    await expect(
      createActivityForumThread(client, CLASSROOM_ID, ACTIVITY_ID, 'Consulta'),
    ).rejects.toSatisfy((error: unknown) => isUncertainForumWriteError(error));

    store.failNext('createThread', 'malformed-2xx');
    await expect(
      createActivityForumThread(client, CLASSROOM_ID, ACTIVITY_ID, 'Consulta'),
    ).rejects.toSatisfy((error: unknown) => isUncertainForumWriteError(error));

    const controller = new AbortController();
    controller.abort();
    await expect(
      createActivityForumThread(
        client,
        CLASSROOM_ID,
        ACTIVITY_ID,
        'Cancelado',
        { signal: controller.signal },
      ),
    ).rejects.toSatisfy((error: unknown) => isAbortError(error));
  });
});
