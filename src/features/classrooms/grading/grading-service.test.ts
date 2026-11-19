import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  createClassroomGradingStore,
  TEST_API_BASE_URL,
  type GradingStoreSubmission,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { gradingMessages } from './grading-messages';
import {
  getGradingConflictKind,
  getSubmissionDetail,
  getSubmissionGrade,
  gradeSubmission,
  isAbortError,
  isUncertainGradingWriteError,
  listClassroomSubmissions,
  regradeSubmission,
} from './grading-service';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000005101';
const SUBMISSION_ID = '00000000-0000-4000-8000-000000006101';

function makeSubmission(
  overrides: Partial<GradingStoreSubmission> = {},
): GradingStoreSubmission {
  return {
    id: SUBMISSION_ID,
    classroomId: CLASSROOM_ID,
    activityId: ACTIVITY_ID,
    activityTitle: 'TP 1: Funciones',
    activityType: 'TP',
    activityFormat: 'FILE',
    maxScore: 100,
    weightMultiplier: 1.5,
    studentId: '00000000-0000-4000-8000-000000007001',
    studentDisplayName: 'Sofía Martínez',
    submittedAt: '2026-11-18T14:00:00.000Z',
    isLate: false,
    files: [
      {
        id: '00000000-0000-4000-8000-000000008001',
        originalName: 'tp1-sofia.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4096,
        position: 0,
      },
    ],
    grade: null,
    ...overrides,
  };
}

describe('grading-service', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('lists queue items, fetches signed download URLs, grades, and regrades with version', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...store.handlers);

    const queue = await listClassroomSubmissions(client, CLASSROOM_ID, {
      page: 1,
      pageSize: 10,
      state: 'submitted',
    });
    expect(queue.total).toBe(1);
    expect(queue.items[0].studentDisplayName).toBe('Sofía Martínez');

    const detail = await getSubmissionDetail(client, SUBMISSION_ID);
    expect(detail.files).toHaveLength(1);
    expect(detail.files[0].downloadUrl).toMatch(/^https:\/\//);

    const created = await gradeSubmission(client, SUBMISSION_ID, {
      score: 80,
      feedback: 'Buen trabajo general.',
    });
    expect(created.version).toBe(1);
    expect(created.pointsAwarded).toBe(120);

    const fetched = await getSubmissionGrade(client, SUBMISSION_ID);
    expect(fetched.score).toBe(80);
    expect(fetched.version).toBe(1);

    const updated = await regradeSubmission(client, SUBMISSION_ID, {
      score: 90,
      feedback: 'Se revisó el punto 3 y está correcto.',
      version: 1,
    });
    expect(updated.version).toBe(2);
    expect(updated.pointsAwarded).toBe(135);
  });

  it('classifies 409 version, submission, and activity conflicts distinctly', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [
        makeSubmission({
          grade: {
            id: 'grade-1',
            graderId: 'teacher-1',
            score: 80,
            feedback: 'Inicial.',
            pointsAwarded: 120,
            pointTransactionId: 'tx-1',
            version: 2,
            gradedAt: '2026-11-18T15:00:00.000Z',
            createdAt: '2026-11-18T15:00:00.000Z',
            updatedAt: '2026-11-18T15:00:00.000Z',
          },
        }),
        makeSubmission({
          id: '00000000-0000-4000-8000-000000006102',
          activityFormat: 'MULTIPLE_CHOICE',
          grade: null,
        }),
      ],
    });
    mswServer.use(...store.handlers);

    await expect(
      regradeSubmission(client, SUBMISSION_ID, {
        score: 85,
        feedback: 'Versión vieja.',
        version: 1,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect(getGradingConflictKind(error)).toBe('version');
      expect((error as ApiError).userMessage).toBe(
        gradingMessages.errors.conflictVersion,
      );
      return true;
    });

    await expect(
      gradeSubmission(client, SUBMISSION_ID, {
        score: 85,
        feedback: 'Ya estaba calificada.',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(getGradingConflictKind(error)).toBe('submission');
      expect((error as ApiError).userMessage).toBe(
        gradingMessages.errors.conflictAlreadyGradedOrInactive,
      );
      return true;
    });

    await expect(
      gradeSubmission(client, '00000000-0000-4000-8000-000000006102', {
        score: 85,
        feedback: 'Actividad opción múltiple.',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(getGradingConflictKind(error)).toBe('activity');
      expect((error as ApiError).userMessage).toBe(
        gradingMessages.errors.conflictNotGradable,
      );
      return true;
    });
  });

  it('marks 5xx, network failure, and malformed 2xx write responses as uncertain', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission()],
    });
    mswServer.use(...store.handlers);

    store.failNext('grade', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Temporary failure',
        correlationId: 'req-503',
      },
    });
    await expect(
      gradeSubmission(client, SUBMISSION_ID, {
        score: 80,
        feedback: 'Prueba 503.',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isUncertainGradingWriteError(error)).toBe(true);
      return true;
    });

    store.failNext('grade', 'malformed-2xx');
    await expect(
      gradeSubmission(client, SUBMISSION_ID, {
        score: 80,
        feedback: 'Prueba 201 malformado.',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isUncertainGradingWriteError(error)).toBe(true);
      return true;
    });
  });

  it('maps 400 validation field errors, 403, 404, and propagates AbortError cleanly', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const store = createClassroomGradingStore({
      classroomId: CLASSROOM_ID,
      initialSubmissions: [makeSubmission({ maxScore: 50 })],
    });
    mswServer.use(...store.handlers);

    await expect(
      gradeSubmission(client, SUBMISSION_ID, {
        score: 60,
        feedback: 'Supera el máximo del servidor.',
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).kind).toBe('validation');
      expect((error as ApiError).fieldErrors.score).toBeDefined();
      return true;
    });

    await expect(
      getSubmissionDetail(client, '00000000-0000-4000-8000-000000009999'),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      return true;
    });

    const controller = new AbortController();
    controller.abort();
    await expect(
      gradeSubmission(
        client,
        SUBMISSION_ID,
        { score: 40, feedback: 'Cancelado.' },
        { signal: controller.signal },
      ),
    ).rejects.toSatisfy((error: unknown) => isAbortError(error));
  });
});
