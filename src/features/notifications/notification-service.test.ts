import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createNotificationsPredicate,
  notificationsListQueryKey,
} from '@/api/query-keys';
import {
  createNotificationsStore,
  TEST_API_BASE_URL,
  type NotificationStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  dedupeAndSortNotifications,
  getNotificationTargetPath,
} from './notification-schema';
import {
  isUncertainNotificationError,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification-service';

const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';
const CLASSROOM_ID = '00000000-0000-4000-8000-000000000101';
const RESOURCE_ID = '00000000-0000-4000-8000-000000000201';

function makeNotification(
  overrides: Partial<NotificationStoreItem> = {},
): NotificationStoreItem {
  return {
    id: '00000000-0000-4000-8000-000000003001',
    kind: 'announcement',
    resourceId: RESOURCE_ID,
    classroomId: CLASSROOM_ID,
    studentId: null,
    readAt: null,
    createdAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeClient() {
  return createApiClient({ baseUrl: TEST_API_BASE_URL });
}

describe('notification-service', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('lists notifications, marks one/all read idempotently, and classifies uncertain errors', async () => {
    const n1 = makeNotification({
      id: '00000000-0000-4000-8000-000000003001',
      createdAt: '2026-11-18T09:00:00.000Z',
    });
    const n2 = makeNotification({
      id: '00000000-0000-4000-8000-000000003002',
      kind: 'grade_posted',
      createdAt: '2026-11-18T11:00:00.000Z',
    });
    const store = createNotificationsStore({ initialItems: [n1, n2] });
    mswServer.use(...store.handlers);
    const client = makeClient();

    const listed = await listNotifications(client);
    expect(listed.items.map((i) => i.id)).toEqual([n2.id, n1.id]);

    const readOne = await markNotificationRead(client, n1.id);
    expect(readOne.readAt).toBe('2026-11-18T14:00:00.000Z');

    const readAll = await markAllNotificationsRead(client);
    expect(readAll.updated).toBe(1);

    const readAllReplay = await markAllNotificationsRead(client);
    expect(readAllReplay.updated).toBe(0);

    store.failNext('read', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Not found',
        correlationId: 'req-404',
      },
    });
    await expect(
      markNotificationRead(client, '00000000-0000-4000-8000-000000009999'),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 404 &&
        !isUncertainNotificationError(err),
    );

    store.failNext('readAll', 'drop-response');
    await expect(markAllNotificationsRead(client)).rejects.toSatisfy(
      (err: unknown) => isUncertainNotificationError(err),
    );
  });

  it('deduplicates out-of-order polling items and preserves confirmed readAt', () => {
    const id = '00000000-0000-4000-8000-000000003010';
    const unread = makeNotification({ id, readAt: null });
    const read = makeNotification({
      id,
      readAt: '2026-11-18T12:00:00.000Z',
    });

    const deduped = dedupeAndSortNotifications([unread, read, unread]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.readAt).toBe('2026-11-18T12:00:00.000Z');
  });

  it('isolates query keys per user and maps safe deep-link paths', () => {
    const keyA = notificationsListQueryKey(USER_A, { page: 1, pageSize: 20 });
    const keyB = notificationsListQueryKey(USER_B, { page: 1, pageSize: 20 });
    const predA = createNotificationsPredicate(USER_A);

    expect(predA({ queryKey: keyA })).toBe(true);
    expect(predA({ queryKey: keyB })).toBe(false);

    expect(
      getNotificationTargetPath(makeNotification({ kind: 'announcement' })),
    ).toBe(`/classrooms/${CLASSROOM_ID}/panels/notices`);
    expect(
      getNotificationTargetPath(makeNotification({ kind: 'grade_posted' })),
    ).toBe(`/classrooms/${CLASSROOM_ID}/panels/grades`);
    expect(
      getNotificationTargetPath(
        makeNotification({ kind: 'activity_published' }),
      ),
    ).toBe(`/classrooms/${CLASSROOM_ID}/panels/activities`);
    expect(
      getNotificationTargetPath(
        makeNotification({ classroomId: 'not-a-uuid' }),
      ),
    ).toBeNull();
  });
});
