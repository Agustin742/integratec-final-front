import { http, HttpResponse } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  classroomActivitiesQueryKey,
  classroomActivityDetailQueryKey,
  createClassroomActivitiesPredicate,
} from '@/api/query-keys';
import {
  TEST_API_BASE_URL,
  createActivityDetailHandler,
  createClassroomActivitiesListHandler,
  createClassroomActivitiesStore,
  createCreateActivityHandler,
  createDeactivateActivityHandler,
  createPublishActivityHandler,
  createUpdateActivityHandler,
  type ActivityStoreItem,
  type ActivitySummaryPayload,
  type StudentActivityPayload,
  type TeacherActivityPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import {
  createClassroomActivity,
  deactivateClassroomActivity,
  getClassroomActivity,
  isTeacherActivityDetail,
  isUncertainActivityWriteError,
  isUncertainWriteError,
  listClassroomActivities,
  publishClassroomActivity,
  updateClassroomActivity,
} from './activity-service';
import { activityMessages } from './messages';

const CLASSROOM_ID = '4e5f6a7b-0000-4000-8000-000000000333';
const ACTIVITY_ID = 'aaaaaaa1-0000-4000-8000-000000000001';
const USER_A = '00000000-0000-4000-8000-000000000001';
const USER_B = '00000000-0000-4000-8000-000000000002';

function summaryFixture(
  overrides: Partial<ActivitySummaryPayload> = {},
): ActivitySummaryPayload {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'Trabajo práctico de síntesis',
    description: 'Adjuntá un PDF con el desarrollo completo.',
    opensAt: null,
    dueAt: '2026-12-01T23:59:59.000Z',
    allowLate: true,
    maxScore: 100,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T12:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    ...overrides,
  };
}

function makeStoreActivity(
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

function teacherActivityFixture(
  overrides: Partial<TeacherActivityPayload> = {},
): TeacherActivityPayload {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'EXAM',
    format: 'MULTIPLE_CHOICE',
    state: 'DRAFT',
    title: 'Examen parcial',
    description: 'Evaluación de la unidad 3.',
    opensAt: '2026-11-25T12:00:00.000Z',
    dueAt: '2026-12-01T23:59:59.000Z',
    allowLate: false,
    maxScore: 50,
    weightMultiplier: 1.5,
    publishedAt: null,
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 1,
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-17T10:00:00.000Z',
    createdById: 'bbbbbbbb-0000-4000-8000-000000000002',
    questions: [
      {
        id: 'cccccccc-0000-4000-8000-000000000003',
        position: 1,
        prompt: '¿Cuál es la capital de Francia?',
        options: [
          {
            id: 'dddddddd-0000-4000-8000-000000000004',
            position: 1,
            label: 'París',
            isCorrect: true,
          },
          {
            id: 'eeeeeeee-0000-4000-8000-000000000005',
            position: 2,
            label: 'Londres',
            isCorrect: false,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function studentActivityFixture(
  overrides: Partial<StudentActivityPayload> = {},
): StudentActivityPayload {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'EXAM',
    format: 'MULTIPLE_CHOICE',
    state: 'PUBLISHED',
    title: 'Examen parcial',
    description: 'Evaluación de la unidad 3.',
    opensAt: '2026-11-25T12:00:00.000Z',
    dueAt: '2026-12-01T23:59:59.000Z',
    allowLate: false,
    maxScore: 50,
    weightMultiplier: 1.5,
    publishedAt: '2026-11-18T12:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 1,
    createdAt: '2026-11-17T10:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
    questions: [
      {
        id: 'cccccccc-0000-4000-8000-000000000003',
        position: 1,
        prompt: '¿Cuál es la capital de Francia?',
        options: [
          {
            id: 'dddddddd-0000-4000-8000-000000000004',
            position: 1,
            label: 'París',
          },
          {
            id: 'eeeeeeee-0000-4000-8000-000000000005',
            position: 2,
            label: 'Londres',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function makeClient() {
  return createApiClient({ baseUrl: TEST_API_BASE_URL });
}

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

describe('listClassroomActivities and role-scoped store', () => {
  test('returns parsed paginated activity summaries', async () => {
    mswServer.use(
      createClassroomActivitiesListHandler({
        items: [summaryFixture()],
        total: 1,
      }),
    );

    const result = await listClassroomActivities(makeClient(), CLASSROOM_ID);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Trabajo práctico de síntesis');
    expect(result.total).toBe(1);
  });

  test('maps a 403 to a forbidden ApiError', async () => {
    mswServer.use(
      createClassroomActivitiesListHandler({
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Insufficient role',
            correlationId: 'corr-activities-403',
          },
        },
      }),
    );

    await expect(
      listClassroomActivities(makeClient(), CLASSROOM_ID),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      userMessage: activityMessages.forbiddenDescription,
    });
  });

  test('maps a malformed 200 payload to an unexpected ApiError', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/:id/activities`, () =>
        HttpResponse.json({ items: [{ id: 42 }], page: 1 }),
      ),
    );

    await expect(
      listClassroomActivities(makeClient(), CLASSROOM_ID),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: activityMessages.errorDescription,
    });
  });

  test('lists published activities for students and strips createdById/isCorrect in detail view', async () => {
    const publishedMc = makeStoreActivity({
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
    const draft = makeStoreActivity({
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
    expect(isTeacherActivityDetail(detail)).toBe(false);
    expect('createdById' in detail).toBe(false);
    expect('isCorrect' in detail.questions[0]!.options[0]!).toBe(false);

    await expect(
      getClassroomActivity(client, CLASSROOM_ID, draft.id),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.status === 404,
    );
  });

  test('preserves createdById and isCorrect for teacher/owner and denies parents with 403', async () => {
    const creatorId = '00000000-0000-4000-8000-000000000077';
    const mcDraft = makeStoreActivity({
      id: '00000000-0000-4000-8000-000000005010',
      type: 'EXAM',
      format: 'MULTIPLE_CHOICE',
      state: 'DRAFT',
      title: 'Parcial borrador',
      createdById: creatorId,
      questionCount: 1,
      questions: [
        {
          id: '00000000-0000-4000-8000-000000006010',
          position: 1,
          prompt: '¿Cuál es el resultado de 3 × 3?',
          options: [
            {
              id: '00000000-0000-4000-8000-000000007010',
              position: 1,
              label: '9',
              isCorrect: true,
            },
          ],
        },
      ],
    });
    const filePublished = makeStoreActivity({
      id: '00000000-0000-4000-8000-000000005011',
      title: 'TP 2: Matrices',
    });

    const client = makeClient();

    const teacherStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [mcDraft, filePublished],
    });
    mswServer.use(...teacherStore.handlers);

    const teacherDetail = await getClassroomActivity(
      client,
      CLASSROOM_ID,
      mcDraft.id,
    );
    expect(isTeacherActivityDetail(teacherDetail)).toBe(true);
    if (isTeacherActivityDetail(teacherDetail)) {
      expect(teacherDetail.createdById).toBe(creatorId);
      expect(teacherDetail.questions[0]?.options[0]?.isCorrect).toBe(true);
    }

    const ownerStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'SCHOOL_OWNER',
      initialItems: [filePublished],
    });
    mswServer.use(...ownerStore.handlers);

    const ownerDetail = await getClassroomActivity(
      client,
      CLASSROOM_ID,
      filePublished.id,
    );
    expect(isTeacherActivityDetail(ownerDetail)).toBe(true);

    const parentStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialItems: [filePublished],
    });
    mswServer.use(...parentStore.handlers);

    await expect(
      listClassroomActivities(client, CLASSROOM_ID),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.status === 403,
    );
    await expect(
      getClassroomActivity(client, CLASSROOM_ID, filePublished.id),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof ApiError && err.status === 403,
    );
  });

  test('scopes query keys by userId and classroomId and matches both list and detail in predicate', () => {
    const listKeyA = classroomActivitiesQueryKey(USER_A, CLASSROOM_ID, {
      page: 1,
      pageSize: 10,
      sort: 'dueAt',
    });
    const detailKeyA = classroomActivityDetailQueryKey(
      USER_A,
      CLASSROOM_ID,
      ACTIVITY_ID,
    );
    const listKeyB = classroomActivitiesQueryKey(USER_B, CLASSROOM_ID);
    const detailKeyOtherClass = classroomActivityDetailQueryKey(
      USER_A,
      '00000000-0000-4000-8000-000000000999',
      ACTIVITY_ID,
    );

    const predA = createClassroomActivitiesPredicate(USER_A, CLASSROOM_ID);
    expect(predA({ queryKey: listKeyA })).toBe(true);
    expect(predA({ queryKey: detailKeyA })).toBe(true);
    expect(predA({ queryKey: listKeyB })).toBe(false);
    expect(predA({ queryKey: detailKeyOtherClass })).toBe(false);
  });
});

describe('getClassroomActivity', () => {
  test('returns teacher view with correct answers for staff', async () => {
    mswServer.use(
      createActivityDetailHandler({
        activity: teacherActivityFixture(),
      }),
    );

    const result = await getClassroomActivity(
      makeClient(),
      CLASSROOM_ID,
      ACTIVITY_ID,
    );

    expect(isTeacherActivityDetail(result)).toBe(true);
    if (isTeacherActivityDetail(result)) {
      expect(result.questions[0]?.options[0]?.isCorrect).toBe(true);
    }
  });

  test('returns student view without correct answers', async () => {
    mswServer.use(
      createActivityDetailHandler({
        student: studentActivityFixture(),
      }),
    );

    const result = await getClassroomActivity(
      makeClient(),
      CLASSROOM_ID,
      ACTIVITY_ID,
    );

    expect(isTeacherActivityDetail(result)).toBe(false);
    expect(
      result.questions.every((question) =>
        question.options.every((option) => !('isCorrect' in option)),
      ),
    ).toBe(true);
  });

  test('maps a 404 to a not-found ApiError', async () => {
    mswServer.use(
      createActivityDetailHandler({
        activity: teacherActivityFixture(),
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Activity not found',
            correlationId: 'corr-activities-404',
          },
        },
      }),
    );

    await expect(
      getClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toMatchObject({
      kind: 'not-found',
      userMessage: activityMessages.detail.notFoundDescription,
    });
  });
});

describe('createClassroomActivity', () => {
  test('returns the created draft activity', async () => {
    mswServer.use(
      createCreateActivityHandler({
        activity: teacherActivityFixture(),
      }),
    );

    const result = await createClassroomActivity(makeClient(), CLASSROOM_ID, {
      type: 'EXAM',
      format: 'MULTIPLE_CHOICE',
      title: 'Examen parcial',
      description: 'Evaluación de la unidad 3.',
      opensAt: '2026-11-25T12:00:00.000Z',
      dueAt: '2026-12-01T23:59:59.000Z',
      allowLate: false,
      maxScore: 50,
      weightMultiplier: 1.5,
      questions: [
        {
          prompt: '¿Cuál es la capital de Francia?',
          options: [
            { label: 'París', isCorrect: true },
            { label: 'Londres', isCorrect: false },
          ],
        },
      ],
    });

    expect(result.state).toBe('DRAFT');
  });

  test('marks a transport failure as an uncertain write', async () => {
    mswServer.use(
      createCreateActivityHandler({
        activity: teacherActivityFixture(),
        error: 'network',
      }),
    );

    const error = await captureRejection(() =>
      createClassroomActivity(makeClient(), CLASSROOM_ID, {
        type: 'TP',
        format: 'FILE',
        title: 'TP',
        description: '',
        dueAt: '2026-12-01T23:59:59.000Z',
        allowLate: false,
        maxScore: 100,
        weightMultiplier: 1,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(isUncertainWriteError(error)).toBe(true);
    expect(isUncertainActivityWriteError(error)).toBe(true);
    expect((error as ApiError).userMessage).toBe(
      activityMessages.write.uncertain,
    );
  });

  test('marks a malformed 201 payload as an uncertain write recognized by isUncertainWriteError', async () => {
    mswServer.use(
      createCreateActivityHandler({
        resolveResponse: () =>
          HttpResponse.json(
            { id: 'not-a-uuid', broken: true },
            { status: 201 },
          ),
      }),
    );

    const error = await captureRejection(() =>
      createClassroomActivity(makeClient(), CLASSROOM_ID, {
        type: 'TP',
        format: 'FILE',
        title: 'TP',
        description: '',
        dueAt: '2026-12-01T23:59:59.000Z',
        allowLate: false,
        maxScore: 100,
        weightMultiplier: 1,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(201);
    expect(isUncertainWriteError(error)).toBe(true);
    expect(isUncertainActivityWriteError(error)).toBe(true);
    expect((error as ApiError).userMessage).toBe(
      activityMessages.write.uncertain,
    );
  });

  test('rethrows an abort error untouched', async () => {
    mswServer.use(
      createCreateActivityHandler({
        activity: teacherActivityFixture(),
      }),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      createClassroomActivity(
        makeClient(),
        CLASSROOM_ID,
        {
          type: 'TP',
          format: 'FILE',
          title: 'TP',
          description: '',
          dueAt: '2026-12-01T23:59:59.000Z',
          allowLate: false,
          maxScore: 100,
          weightMultiplier: 1,
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('updateClassroomActivity', () => {
  test('returns the updated activity', async () => {
    mswServer.use(
      createUpdateActivityHandler({
        activity: teacherActivityFixture({ title: 'Examen parcial editado' }),
      }),
    );

    const result = await updateClassroomActivity(
      makeClient(),
      CLASSROOM_ID,
      ACTIVITY_ID,
      {
        title: 'Examen parcial editado',
        description: '',
        allowLate: false,
        weightMultiplier: 1.5,
      },
    );

    expect(result.title).toBe('Examen parcial editado');
  });

  test('maps a 409 to the questions-locked message', async () => {
    mswServer.use(
      createUpdateActivityHandler({
        activity: teacherActivityFixture(),
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Questions can no longer change',
            correlationId: 'corr-activities-409q',
          },
        },
      }),
    );

    await expect(
      updateClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID, {
        description: '',
        allowLate: false,
        weightMultiplier: 1,
        questions: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      userMessage: activityMessages.write.updateQuestionsLocked,
    });
  });

  test('marks a malformed 200 update response as an uncertain write', async () => {
    mswServer.use(
      createUpdateActivityHandler({
        resolveResponse: () => HttpResponse.json({ invalid: true }),
      }),
    );

    const error = await captureRejection(() =>
      updateClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID, {
        title: 'Editado',
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(isUncertainWriteError(error)).toBe(true);
  });
});

describe('publishClassroomActivity', () => {
  test('returns the published activity', async () => {
    mswServer.use(
      createPublishActivityHandler({
        activity: teacherActivityFixture({ state: 'PUBLISHED' }),
      }),
    );

    const result = await publishClassroomActivity(
      makeClient(),
      CLASSROOM_ID,
      ACTIVITY_ID,
    );

    expect(result.state).toBe('PUBLISHED');
  });

  test('maps a 400 BAD_REQUEST to the not-publishable message', async () => {
    mswServer.use(
      createPublishActivityHandler({
        activity: teacherActivityFixture(),
        error: {
          status: 400,
          body: {
            code: 'BAD_REQUEST',
            message: 'The activity is not publishable',
            correlationId: 'corr-activities-400',
          },
        },
      }),
    );

    await expect(
      publishClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toMatchObject({
      status: 400,
      userMessage: activityMessages.write.publishNotPublishable,
    });
  });

  test('maps a backend 400 VALIDATION_FAILED with details to publishNotPublishable', async () => {
    mswServer.use(
      createPublishActivityHandler({
        activity: teacherActivityFixture(),
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Activity cannot be published',
            correlationId: 'corr-activities-400-val',
            details: [
              { field: 'dueAt', messages: ['dueAt must be in the future'] },
            ],
          },
        },
      }),
    );

    await expect(
      publishClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toMatchObject({
      kind: 'bad-request',
      status: 400,
      userMessage: activityMessages.write.publishNotPublishable,
    });
  });

  test('maps a 409 to the already-published message', async () => {
    mswServer.use(
      createPublishActivityHandler({
        activity: teacherActivityFixture(),
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Activity is already published',
            correlationId: 'corr-activities-409p',
          },
        },
      }),
    );

    await expect(
      publishClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toMatchObject({
      status: 409,
      userMessage: activityMessages.write.publishAlreadyPublished,
    });
  });
});

describe('deactivateClassroomActivity', () => {
  test('resolves on 204 without content', async () => {
    mswServer.use(createDeactivateActivityHandler());

    await expect(
      deactivateClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).resolves.toBeUndefined();
  });

  test('maps a 409 to the has-submissions refusal explanation', async () => {
    mswServer.use(
      createDeactivateActivityHandler({
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'The activity has submissions and cannot be deleted',
            correlationId: 'corr-activities-409d',
          },
        },
      }),
    );

    await expect(
      deactivateClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    ).rejects.toMatchObject({
      status: 409,
      userMessage: activityMessages.write.deactivateHasSubmissions,
    });
  });

  test('marks a 5xx deactivate failure as an uncertain write', async () => {
    mswServer.use(
      createDeactivateActivityHandler({
        error: {
          status: 503,
          body: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Unavailable',
            correlationId: 'corr-activities-503',
          },
        },
      }),
    );

    const error = await captureRejection(() =>
      deactivateClassroomActivity(makeClient(), CLASSROOM_ID, ACTIVITY_ID),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(isUncertainWriteError(error)).toBe(true);
  });
});

async function captureRejection(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    throw new Error('Expected the call to reject');
  } catch (error) {
    return error;
  }
}
