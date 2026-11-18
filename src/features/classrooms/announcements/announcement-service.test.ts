import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  classroomAnnouncementsQueryKey,
  createClassroomAnnouncementsPredicate,
} from '@/api/query-keys';
import {
  createClassroomAnnouncementsStore,
  TEST_API_BASE_URL,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { announcementFormSchema } from './announcement-schema';
import {
  createClassroomAnnouncement,
  isUncertainAnnouncementError,
  listClassroomAnnouncements,
  removeClassroomAnnouncement,
  updateClassroomAnnouncement,
} from './announcement-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000101';
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';

function makeClient() {
  return createApiClient({ baseUrl: TEST_API_BASE_URL });
}

describe('announcement-service', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('lists chronological announcements and resolves server mentions on create/update/remove', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: USER_A,
      mentionDirectory: { Sofía: USER_B },
    });
    mswServer.use(...store.handlers);
    const client = makeClient();

    const empty = await listClassroomAnnouncements(client, CLASSROOM_ID);
    expect(empty.items).toEqual([]);
    expect(empty.total).toBe(0);

    const created = await createClassroomAnnouncement(client, CLASSROOM_ID, {
      title: 'Aviso inicial',
      content: 'Hola @Sofía, revisá la guía.',
    });
    expect(created.title).toBe('Aviso inicial');
    expect(created.mentionedUserIds).toEqual([USER_B]);

    const updated = await updateClassroomAnnouncement(
      client,
      CLASSROOM_ID,
      created.id,
      { title: 'Aviso actualizado' },
    );
    expect(updated.title).toBe('Aviso actualizado');

    const listed = await listClassroomAnnouncements(client, CLASSROOM_ID);
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.title).toBe('Aviso actualizado');

    await removeClassroomAnnouncement(client, CLASSROOM_ID, created.id);
    const afterRemove = await listClassroomAnnouncements(client, CLASSROOM_ID);
    expect(afterRemove.items).toHaveLength(0);
  });

  it('classifies 5xx and dropped network responses as uncertain while keeping 403/404 certain', async () => {
    const store = createClassroomAnnouncementsStore({
      classroomId: CLASSROOM_ID,
      authorId: USER_A,
    });
    mswServer.use(...store.handlers);
    const client = makeClient();

    store.failNext('create', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-403',
      },
    });
    await expect(
      createClassroomAnnouncement(client, CLASSROOM_ID, {
        title: 'Test',
        content: 'Body',
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 403 &&
        !isUncertainAnnouncementError(err),
    );

    store.failNext('create', 'drop-response');
    await expect(
      createClassroomAnnouncement(client, CLASSROOM_ID, {
        title: 'Persisted despite drop',
        content: 'Body',
      }),
    ).rejects.toSatisfy((err: unknown) => isUncertainAnnouncementError(err));
    expect(store.getItems()).toHaveLength(1);

    const id = store.getItems()[0]!.id;
    store.failNext('update', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unavailable',
        correlationId: 'req-503',
      },
    });
    await expect(
      updateClassroomAnnouncement(client, CLASSROOM_ID, id, {
        title: 'Retry',
      }),
    ).rejects.toSatisfy((err: unknown) => isUncertainAnnouncementError(err));

    store.failNext('remove', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Not found',
        correlationId: 'req-404',
      },
    });
    await expect(
      removeClassroomAnnouncement(client, CLASSROOM_ID, id),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 404 &&
        !isUncertainAnnouncementError(err),
    );
  });

  it('scopes announcement query keys by userId and classroomId', () => {
    const keyA1 = classroomAnnouncementsQueryKey(USER_A, CLASSROOM_ID, {
      page: 1,
      pageSize: 10,
    });
    const keyB1 = classroomAnnouncementsQueryKey(USER_B, CLASSROOM_ID, {
      page: 1,
      pageSize: 10,
    });
    const predicateA = createClassroomAnnouncementsPredicate(
      USER_A,
      CLASSROOM_ID,
    );

    expect(predicateA({ queryKey: keyA1 })).toBe(true);
    expect(predicateA({ queryKey: keyB1 })).toBe(false);
    expect(
      predicateA({
        queryKey: classroomAnnouncementsQueryKey(USER_A, 'other-classroom'),
      }),
    ).toBe(false);
  });

  it('validates announcementFormSchema boundaries', () => {
    expect(
      announcementFormSchema.safeParse({ title: '   ', content: 'Body' })
        .success,
    ).toBe(false);
    expect(
      announcementFormSchema.safeParse({
        title: 'Line 1\nLine 2',
        content: 'Body',
      }).success,
    ).toBe(false);
    expect(
      announcementFormSchema.safeParse({
        title: 'a'.repeat(201),
        content: 'Body',
      }).success,
    ).toBe(false);
    expect(
      announcementFormSchema.safeParse({ title: 'Ok', content: '   ' }).success,
    ).toBe(false);
    expect(
      announcementFormSchema.safeParse({
        title: 'Ok',
        content: 'b'.repeat(5001),
      }).success,
    ).toBe(false);
    expect(
      announcementFormSchema.safeParse({
        title: '  Aviso válido  ',
        content: '  Contenido válido  ',
      }),
    ).toEqual({
      success: true,
      data: { title: 'Aviso válido', content: 'Contenido válido' },
    });
  });
});
