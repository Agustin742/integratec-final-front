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
  TEST_API_BASE_URL,
  createActivityDetailHandler,
  createClassroomActivitiesListHandler,
  createCreateActivityHandler,
  createDeactivateActivityHandler,
  createPublishActivityHandler,
  createUpdateActivityHandler,
  type ActivitySummaryPayload,
  type StudentActivityPayload,
  type TeacherActivityPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { classroomMessages } from '../messages';
import {
  createClassroomActivity,
  deactivateClassroomActivity,
  getClassroomActivity,
  isUncertainWriteError,
  listClassroomActivities,
  publishClassroomActivity,
  updateClassroomActivity,
} from './activity-service';

const classroomId = '4e5f6a7b-0000-4000-8000-000000000333';
const activityId = 'aaaaaaa1-0000-4000-8000-000000000001';

function summaryFixture(
  overrides: Partial<ActivitySummaryPayload> = {},
): ActivitySummaryPayload {
  return {
    id: activityId,
    classroomId,
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

function teacherActivityFixture(
  overrides: Partial<TeacherActivityPayload> = {},
): TeacherActivityPayload {
  return {
    id: activityId,
    classroomId,
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
    id: activityId,
    classroomId,
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

describe('listClassroomActivities', () => {
  test('returns the parsed paginated activity summaries', async () => {
    mswServer.use(
      createClassroomActivitiesListHandler({
        items: [summaryFixture()],
        total: 1,
      }),
    );

    const result = await listClassroomActivities(
      createApiClient(),
      classroomId,
    );

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
      listClassroomActivities(createApiClient(), classroomId),
    ).rejects.toMatchObject({
      kind: 'forbidden',
      userMessage: classroomMessages.activities.list.forbidden,
    });
  });

  test('maps a malformed 200 payload to an unexpected ApiError', async () => {
    mswServer.use(
      createClassroomActivitiesListHandler({
        resolveResponse: () =>
          Response.json({ items: [{ id: 42 }], page: 1 }),
      }),
    );

    await expect(
      listClassroomActivities(createApiClient(), classroomId),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: classroomMessages.activities.list.errorDescription,
    });
  });
});

describe('getClassroomActivity', () => {
  test('returns the teacher view with correct answers for staff', async () => {
    mswServer.use(
      createActivityDetailHandler({
        activity: teacherActivityFixture(),
      }),
    );

    const result = await getClassroomActivity(
      createApiClient(),
      classroomId,
      activityId,
    );

    expect(result.kind).toBe('teacher');
    if (result.kind === 'teacher') {
      expect(result.activity.questions[0]?.options[0]?.isCorrect).toBe(true);
    }
  });

  test('returns the student view without correct answers', async () => {
    mswServer.use(
      createActivityDetailHandler({
        student: studentActivityFixture(),
      }),
    );

    const result = await getClassroomActivity(
      createApiClient(),
      classroomId,
      activityId,
    );

    expect(result.kind).toBe('student');
    if (result.kind === 'student') {
      expect(
        result.activity.questions.every((question) =>
          question.options.every(
            (option) => !('isCorrect' in option && option.isCorrect),
          ),
        ),
      ).toBe(true);
    }
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
      getClassroomActivity(createApiClient(), classroomId, activityId),
    ).rejects.toMatchObject({
      kind: 'not-found',
      userMessage: classroomMessages.activities.detail.notFound,
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

    const result = await createClassroomActivity(createApiClient(), classroomId, {
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

    const error = await listAndCapture(() =>
      createClassroomActivity(createApiClient(), classroomId, {
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
    expect((error as ApiError).userMessage).toBe(
      classroomMessages.activities.write.uncertain,
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
        createApiClient(),
        classroomId,
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
      createApiClient(),
      classroomId,
      activityId,
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
      updateClassroomActivity(createApiClient(), classroomId, activityId, {
        description: '',
        allowLate: false,
        weightMultiplier: 1,
        questions: [],
      }),
    ).rejects.toMatchObject({
      status: 409,
      userMessage: classroomMessages.activities.write.updateQuestionsLocked,
    });
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
      createApiClient(),
      classroomId,
      activityId,
    );

    expect(result.state).toBe('PUBLISHED');
  });

  test('maps a 400 to the not-publishable message', async () => {
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
      publishClassroomActivity(createApiClient(), classroomId, activityId),
    ).rejects.toMatchObject({
      status: 400,
      userMessage: classroomMessages.activities.write.publishNotPublishable,
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
      publishClassroomActivity(createApiClient(), classroomId, activityId),
    ).rejects.toMatchObject({
      status: 409,
      userMessage: classroomMessages.activities.write.publishAlreadyPublished,
    });
  });
});

describe('deactivateClassroomActivity', () => {
  test('resolves on 204 without content', async () => {
    mswServer.use(createDeactivateActivityHandler());

    await expect(
      deactivateClassroomActivity(createApiClient(), classroomId, activityId),
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
      deactivateClassroomActivity(createApiClient(), classroomId, activityId),
    ).rejects.toMatchObject({
      status: 409,
      userMessage:
        classroomMessages.activities.write.deactivateHasSubmissions,
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

    const error = await listAndCapture(() =>
      deactivateClassroomActivity(createApiClient(), classroomId, activityId),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(isUncertainWriteError(error)).toBe(true);
  });
});

async function listAndCapture(
  run: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await run();
    throw new Error('Expected the call to reject');
  } catch (error) {
    return error;
  }
}
