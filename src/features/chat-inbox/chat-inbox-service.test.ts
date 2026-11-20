import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { createChatInboxStore, TEST_API_BASE_URL } from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { listChatInbox, markChatRead } from './chat-inbox-service';

const USER_ID = '00000000-0000-4000-8000-000000007001';
const OTHER_ID = '00000000-0000-4000-8000-000000007002';
const CLASSROOM_A = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_B = '00000000-0000-4000-8000-000000000052';
const M1 = '00000000-0000-4000-8000-600000000001';
const M2 = '00000000-0000-4000-8000-600000000002';
const M3 = '00000000-0000-4000-8000-600000000003';

function message(id: string, minute: number, authorId = OTHER_ID) {
  return {
    id,
    authorId,
    authorDisplayName: 'Sofía Martínez',
    body: `Mensaje   ${id.slice(-1)}\ncon saltos`,
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + minute * 60_000,
    ).toISOString(),
  };
}

describe('chat inbox service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  const client = () => createApiClient({ baseUrl: TEST_API_BASE_URL });

  it('lists the chats of the user, latest activity first, with unread counts', async () => {
    const store = createChatInboxStore({
      currentUserId: USER_ID,
      classrooms: [
        {
          classroomId: CLASSROOM_A,
          classroomName: 'Matemática',
          messages: [message(M1, 1)],
        },
        {
          classroomId: CLASSROOM_B,
          classroomName: 'Lengua',
          messages: [message(M2, 5), message(M3, 6, USER_ID)],
        },
      ],
    });
    mswServer.use(...store.handlers);

    const inbox = await listChatInbox(client());

    expect(inbox.items.map((i) => i.classroomName)).toEqual([
      'Lengua',
      'Matemática',
    ]);
    expect(inbox.items[0].unreadCount).toBe(1);
    expect(inbox.items[0].lastMessage?.bodyPreview).toBe(
      'Mensaje 3 con saltos',
    );
    expect(inbox.items[1].unreadCount).toBe(1);
  });

  it('returns no items for parents', async () => {
    const store = createChatInboxStore({
      currentUserId: USER_ID,
      parent: true,
      classrooms: [],
    });
    mswServer.use(...store.handlers);
    expect(await listChatInbox(client())).toEqual({ items: [] });
  });

  it('turns a malformed 2xx into an unexpected ApiError', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/chats`, () =>
        HttpResponse.json({ items: [{ classroomId: 1 }] }),
      ),
    );
    await expect(listChatInbox(client())).rejects.toMatchObject({
      kind: 'unexpected',
    });
    await expect(listChatInbox(client())).rejects.toBeInstanceOf(ApiError);
  });

  it('moves the read marker forward and is idempotent', async () => {
    const store = createChatInboxStore({
      currentUserId: USER_ID,
      classrooms: [
        {
          classroomId: CLASSROOM_A,
          classroomName: 'Matemática',
          messages: [message(M1, 1), message(M2, 2)],
        },
      ],
    });
    mswServer.use(...store.handlers);

    await markChatRead(client(), CLASSROOM_A, M2);
    await markChatRead(client(), CLASSROOM_A, M1);

    expect(store.getMarker(CLASSROOM_A)).toBe(M2);
    expect(store.getMarkRequests()).toEqual([
      { classroomId: CLASSROOM_A, messageId: M2 },
      { classroomId: CLASSROOM_A, messageId: M1 },
    ]);
  });

  it('surfaces 404 and 403 from the read marker as ApiError', async () => {
    const store = createChatInboxStore({
      currentUserId: USER_ID,
      classrooms: [
        {
          classroomId: CLASSROOM_A,
          classroomName: 'Matemática',
          messages: [message(M1, 1)],
        },
      ],
    });
    mswServer.use(...store.handlers);
    await expect(markChatRead(client(), CLASSROOM_A, M3)).rejects.toMatchObject(
      { status: 404 },
    );

    const parentStore = createChatInboxStore({
      currentUserId: USER_ID,
      parent: true,
      classrooms: [],
    });
    mswServer.use(...parentStore.handlers);
    await expect(markChatRead(client(), CLASSROOM_A, M1)).rejects.toMatchObject(
      { status: 403 },
    );
  });
});
