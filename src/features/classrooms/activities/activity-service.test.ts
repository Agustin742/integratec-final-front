import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  classroomActivitiesQueryKey,
  classroomActivityDetailQueryKey,
  createClassroomActivitiesPredicate,
} from '@/api/query-keys';
import {
  createClassroomActivitiesStore,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  getClassroomActivity,
  listClassroomActivities,
} from './activity-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000101';
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';

function makeActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: '00000000-0000-4000-8000-000000005001',
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Ecuaciones',
    description: 'Resolver los ejercicios 1 a 5.',
    opensAt: null,
    dueAt: '2026-11-25T23:59:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function makeClient() {
  return createApiClient({ baseUrl: TEST_API_BASE_URL });
}

describe('activity-service', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('lists published activities for students and strips isCorrect in detail view', async () => {
    const publishedMc = makeActivity({
      id: '00000000-0000-4000-8000-000000005001',
      type: 'EXAM',
      format: 'MULTIPLE_CHOICE',
      title: 'Parcial 1',
      questionCount: 1,
      questions: [
        {
          id: '00000000-0000-4000-8000-000000006001',
          position: 1,
          prompt: '¿Cuánto es 2 + 2?',
          options: [
            {
              id: '00000000-0000-4000-8000-000000007001',
              position: 1,
              label: '4',
              isCorrect: true,
            },
          ],
        },
      ],
    });
    const draft = makeActivity({
      id: '00000000-0000-4000-8000-000000005002',
      state: 'DRAFT',
      title: 'Borrador oculto',
    });

    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [publishedMc, draft],
    });
    mswServer.use(...store.handlers);
    const client = makeClient();

    const list = await listClassroomActivities(client, CLASSROOM_ID);
    expect(list.items.map((i) => i.title)).toEqual(['Parcial 1']);

    const detail = await getClassroomActivity(
      client,
      CLASSROOM_ID,
      publishedMc.id,
    );
    expect('isCorrect' in detail.questions[0]!.options[0]!).toBe(false);

    await expect(
      getClassroomActivity(client, CLASSROOM_ID, draft.id),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.status === 404,
    );
  });

  it('rejects malformed payloads and scopes query keys by userId and classroomId', async () => {
    const client = makeClient();
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/activities`, () =>
        HttpResponse.json({ items: [{ invalid: true }], page: 1 }),
      ),
    );

    await expect(
      listClassroomActivities(client, CLASSROOM_ID),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.kind === 'unexpected',
    );

    const keyA = classroomActivitiesQueryKey(USER_A, CLASSROOM_ID, {
      page: 1,
      pageSize: 10,
      sort: 'dueAt',
    });
    const keyB = classroomActivitiesQueryKey(USER_B, CLASSROOM_ID);
    const predA = createClassroomActivitiesPredicate(USER_A, CLASSROOM_ID);
    expect(predA({ queryKey: keyA })).toBe(true);
    expect(predA({ queryKey: keyB })).toBe(false);
    expect(
      classroomActivityDetailQueryKey(USER_A, CLASSROOM_ID, 'act-1')[0].scope
        .userId,
    ).toBe(USER_A);
  });
});
