import { http } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  chatMentionDirectoryQueryKey,
  classroomAnnouncementsQueryKey,
  classroomChatHistoryQueryKey,
  createClassroomChatPredicate,
} from '@/api/query-keys';
import {
  createClassroomChatStore,
  createErrorEnvelopeResponse,
  TEST_API_BASE_URL,
  type ChatStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  chatRetryAfterSeconds,
  hideClassroomChatMessage,
  isAbortError,
  isUncertainChatWriteError,
  listClassroomChatHistory,
  sendClassroomChatMessage,
} from './chat-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000052';
const OTHER_CLASSROOM_ID = '00000000-0000-4000-8000-000000000999';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';
const MENTIONED_ID = '00000000-0000-4000-8000-000000007002';
const BASE_TIME = Date.parse('2026-11-19T03:00:00.000Z');

function historyMessage(
  id: string,
  seq: number,
  overrides: Partial<ChatStoreMessage> = {},
): ChatStoreMessage {
  return {
    id,
    authorId: STUDENT_ID,
    body: `Mensaje ${seq}`,
    mentionedUserIds: [],
    createdAt: new Date(BASE_TIME + seq * 1000).toISOString(),
    hiddenAt: null,
    hiddenById: null,
    ...overrides,
  };
}

const MESSAGE_ID_1 = '00000000-0000-4000-8000-600000000001';
const MESSAGE_ID_2 = '00000000-0000-4000-8000-600000000002';
const MESSAGE_ID_2B = '00000000-0000-4000-8000-60000000000b';
const MESSAGE_ID_3 = '00000000-0000-4000-8000-600000000003';

describe('chat-service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('lists history latest-first (createdAt DESC, id DESC) with moderation info for teachers and omission for students', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [
        historyMessage(MESSAGE_ID_1, 1),
        historyMessage(MESSAGE_ID_2, 2, {
          body: 'Mensaje oculto',
          hiddenAt: '2026-11-19T04:00:00.000Z',
          hiddenById: TEACHER_ID,
        }),
        // Same createdAt as MESSAGE_ID_2: the id DESC tiebreaker decides.
        historyMessage(MESSAGE_ID_2B, 2),
        historyMessage(MESSAGE_ID_3, 3),
      ],
    });
    mswServer.use(...store.handlers);

    const teacherFirstPage = await listClassroomChatHistory(
      client,
      CLASSROOM_ID,
      { page: 1, pageSize: 2 },
    );
    expect(teacherFirstPage.total).toBe(4);
    expect(teacherFirstPage.items.map((item) => item.id)).toEqual([
      MESSAGE_ID_3,
      MESSAGE_ID_2B,
    ]);

    const teacherSecondPage = await listClassroomChatHistory(
      client,
      CLASSROOM_ID,
      { page: 2, pageSize: 2 },
    );
    expect(teacherSecondPage.items.map((item) => item.id)).toEqual([
      MESSAGE_ID_2,
      MESSAGE_ID_1,
    ]);
    const hiddenRow = teacherSecondPage.items[0];
    expect(hiddenRow.hiddenAt).toBe('2026-11-19T04:00:00.000Z');
    expect(hiddenRow.hiddenById).toBe(TEACHER_ID);

    store.setRole('STUDENT');
    store.setCurrentUserId(STUDENT_ID);
    const studentHistory = await listClassroomChatHistory(
      client,
      CLASSROOM_ID,
      { page: 1, pageSize: 20 },
    );
    expect(studentHistory.total).toBe(3);
    expect(
      studentHistory.items.map((item) => item.id).includes(MESSAGE_ID_2),
    ).toBe(false);
    expect(
      studentHistory.items.every(
        (item) => item.hiddenAt === null && item.hiddenById === null,
      ),
    ).toBe(true);
  });

  it('sends messages with resolved mentions and lists them latest-first', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [historyMessage(MESSAGE_ID_1, 1)],
      mentionDirectory: { 'María Gómez': MENTIONED_ID },
    });
    mswServer.use(...store.handlers);

    const sent = await sendClassroomChatMessage(
      client,
      CLASSROOM_ID,
      '  Hola @María Gómez, ¿entendiste la consigna?  ',
    );
    expect(sent.classroomId).toBe(CLASSROOM_ID);
    expect(sent.authorId).toBe(STUDENT_ID);
    expect(sent.body).toBe('Hola @María Gómez, ¿entendiste la consigna?');
    expect(sent.mentionedUserIds).toEqual([MENTIONED_ID]);

    const history = await listClassroomChatHistory(client, CLASSROOM_ID);
    expect(history.total).toBe(2);
    expect(history.items[0].id).toBe(sent.id);
    expect(store.getMessages().some((m) => m.id === sent.id)).toBe(true);
  });

  it('enforces the contract rate limit: 5 admitted sends per rolling 10 seconds, then 429 that is not uncertain', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
    });
    mswServer.use(...store.handlers);

    for (let i = 0; i < 5; i += 1) {
      await sendClassroomChatMessage(client, CLASSROOM_ID, `Mensaje ${i + 1}`);
    }

    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Sexto mensaje'),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(429);
      expect(apiError.kind).toBe('rate-limited');
      expect(isUncertainChatWriteError(apiError)).toBe(false);
      return true;
    });

    store.resetRateLimit();
    const late = await sendClassroomChatMessage(
      client,
      CLASSROOM_ID,
      'Después de esperar',
    );
    expect(late.body).toBe('Después de esperar');
  });

  it('denies parents on list, send, and hide with 403 that is not uncertain', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialMessages: [historyMessage(MESSAGE_ID_1, 1)],
    });
    mswServer.use(...store.handlers);

    await expect(
      listClassroomChatHistory(client, CLASSROOM_ID),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.kind === 'forbidden',
    );

    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Hola'),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        !isUncertainChatWriteError(error),
    );

    await expect(
      hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_1),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        !isUncertainChatWriteError(error),
    );
  });

  it('rejects muted students but lets teachers send', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      chatMuted: true,
      initialMessages: [historyMessage(MESSAGE_ID_1, 1)],
    });
    mswServer.use(...store.handlers);

    const readable = await listClassroomChatHistory(client, CLASSROOM_ID);
    expect(readable.total).toBe(1);

    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Hola profe'),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.kind === 'forbidden' &&
        !isUncertainChatWriteError(error),
    );

    store.setRole('TEACHER');
    store.setCurrentUserId(TEACHER_ID);
    const sent = await sendClassroomChatMessage(
      client,
      CLASSROOM_ID,
      'Recuerden revisar la consigna',
    );
    expect(sent.authorId).toBe(TEACHER_ID);
  });

  it('hides messages idempotently while students and parents are denied and missing messages 404', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [
        historyMessage(MESSAGE_ID_1, 1),
        historyMessage(MESSAGE_ID_2, 2),
      ],
    });
    mswServer.use(...store.handlers);

    await hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_2);
    const hidden = store.getMessages().find((m) => m.id === MESSAGE_ID_2);
    expect(hidden?.hiddenAt).not.toBeNull();
    expect(hidden?.hiddenById).toBe(TEACHER_ID);
    const firstHiddenAt = hidden?.hiddenAt;

    // Repeated moderation returns 204 without overwriting the audit pair.
    await expect(
      hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_2),
    ).resolves.toBeUndefined();
    expect(
      store.getMessages().find((m) => m.id === MESSAGE_ID_2)?.hiddenAt,
    ).toBe(firstHiddenAt);

    await expect(
      hideClassroomChatMessage(
        client,
        CLASSROOM_ID,
        '00000000-0000-4000-8000-60000000dead',
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 404 &&
        error.kind === 'not-found' &&
        !isUncertainChatWriteError(error),
    );

    store.setRole('STUDENT');
    store.setCurrentUserId(STUDENT_ID);
    await expect(
      hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_1),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        !isUncertainChatWriteError(error),
    );
  });

  it('returns 404 for unknown classrooms and 400 for invalid pagination', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
    });
    mswServer.use(...store.handlers);

    await expect(
      listClassroomChatHistory(client, OTHER_CLASSROOM_ID),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.status === 404,
    );

    await expect(
      listClassroomChatHistory(client, CLASSROOM_ID, { page: 0 }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  });

  it('marks 5xx, network, and malformed 2xx writes as uncertain and keeps aborts transparent', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [historyMessage(MESSAGE_ID_1, 1)],
    });
    mswServer.use(...store.handlers);

    store.failNext('send', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Down',
        correlationId: 'req-chat-503',
      },
    });
    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Consulta'),
    ).rejects.toSatisfy((error: unknown) => isUncertainChatWriteError(error));

    store.failNext('send', 'malformed-2xx');
    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Consulta'),
    ).rejects.toSatisfy((error: unknown) => isUncertainChatWriteError(error));

    store.failNext('hide', 'drop-response');
    await expect(
      hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_1),
    ).rejects.toSatisfy((error: unknown) => isUncertainChatWriteError(error));

    // The hide contract promises `204 No Content`; any other 2xx cannot
    // confirm the moderation outcome and stays uncertain.
    store.failNext('hide', 'malformed-2xx');
    await expect(
      hideClassroomChatMessage(client, CLASSROOM_ID, MESSAGE_ID_1),
    ).rejects.toSatisfy((error: unknown) => isUncertainChatWriteError(error));

    const controller = new AbortController();
    controller.abort();
    await expect(
      sendClassroomChatMessage(client, CLASSROOM_ID, 'Cancelado', {
        signal: controller.signal,
      }),
    ).rejects.toSatisfy((error: unknown) => isAbortError(error));
  });

  it('reports malformed history responses as unexpected without discarding kind', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [historyMessage(MESSAGE_ID_1, 1)],
    });
    mswServer.use(...store.handlers);

    store.failNext('list', 'malformed-2xx');
    await expect(
      listClassroomChatHistory(client, CLASSROOM_ID),
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ApiError && error.kind === 'unexpected',
    );
  });

  it('keeps the mention directory key out of the chat domain but scoped by user and classroom', () => {
    const key = chatMentionDirectoryQueryKey(STUDENT_ID, CLASSROOM_ID, {
      q: ' sof ',
      page: 1,
      pageSize: 20,
    });
    // Chat invalidations (send, hide, reconnect) must not touch it.
    expect(
      createClassroomChatPredicate(STUDENT_ID, CLASSROOM_ID)({ queryKey: key }),
    ).toBe(false);
    expect(key[0].scope).toMatchObject({
      userId: STUDENT_ID,
      classroomId: CLASSROOM_ID,
    });
    expect(key[0].params).toEqual({ q: 'sof', page: 1, pageSize: 20 });
    expect(
      chatMentionDirectoryQueryKey(TEACHER_ID, CLASSROOM_ID, {
        q: 'sof',
        page: 1,
        pageSize: 20,
      }),
    ).not.toEqual(key);
  });

  it('exposes the Retry-After seconds of a rate-limited send, and nothing otherwise', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
    });
    mswServer.use(
      http.post(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`,
        () => {
          const response = createErrorEnvelopeResponse(429, {
            code: 'TOO_MANY_REQUESTS',
            message: 'Slow down.',
            correlationId: 'req-retry-after',
          });
          response.headers.set('Retry-After', '3');
          return response;
        },
      ),
      ...store.handlers,
    );
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const error = await sendClassroomChatMessage(
      client,
      CLASSROOM_ID,
      'hola',
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(chatRetryAfterSeconds(error)).toBe(3);
    expect(chatRetryAfterSeconds(new Error('x'))).toBeNull();
  });

  it('scopes chat query keys by userId and classroomId', () => {
    const keyA = classroomChatHistoryQueryKey(STUDENT_ID, CLASSROOM_ID, {
      pageSize: 20,
    });
    const keyB = classroomChatHistoryQueryKey(TEACHER_ID, CLASSROOM_ID);
    const predicate = createClassroomChatPredicate(STUDENT_ID, CLASSROOM_ID);

    expect(predicate({ queryKey: keyA })).toBe(true);
    expect(predicate({ queryKey: keyB })).toBe(false);
    expect(
      predicate({
        queryKey: classroomChatHistoryQueryKey(STUDENT_ID, OTHER_CLASSROOM_ID),
      }),
    ).toBe(false);
    expect(
      predicate({
        queryKey: classroomAnnouncementsQueryKey(STUDENT_ID, CLASSROOM_ID),
      }),
    ).toBe(false);

    // The page is the infinite-query page param, never part of the key.
    const clamped = classroomChatHistoryQueryKey(STUDENT_ID, CLASSROOM_ID, {
      pageSize: 1000,
    });
    expect(clamped[0].params).toEqual({ pageSize: 100 });
    expect(
      classroomChatHistoryQueryKey(STUDENT_ID, CLASSROOM_ID)[0].params,
    ).toEqual({ pageSize: 20 });
  });
});
