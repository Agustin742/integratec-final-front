import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  TEST_API_BASE_URL,
  createExamAnswersStore,
  type ExamAnswersStore,
} from '@/test/msw/handlers';
import { examMessages } from './exam-messages';
import {
  isUncertainExamAnswerError,
  readOwnExamAttempt,
  submitExamAnswers,
} from './exam-service';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const activityId = '99999999-9999-4999-8999-999999999999';

const examActivity = {
  id: activityId,
  state: 'PUBLISHED' as const,
  format: 'MULTIPLE_CHOICE' as const,
  opensAt: null,
  dueAt: '2026-11-20T23:59:00.000Z',
  allowLate: true,
  maxScore: 10,
  questions: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      options: [
        {
          id: '21111111-1111-4111-8111-211111111111',
          isCorrect: true,
        },
        {
          id: '21111111-1111-4111-8111-222222222222',
          isCorrect: false,
        },
      ],
    },
    {
      id: '11111111-1111-4111-8111-333333333333',
      options: [
        {
          id: '21111111-1111-4111-8111-444444444444',
          isCorrect: false,
        },
        {
          id: '21111111-1111-4111-8111-555555555555',
          isCorrect: true,
        },
      ],
    },
  ],
};

const correctAnswers = [
  {
    questionId: '11111111-1111-4111-8111-111111111111',
    selectedOptionIds: ['21111111-1111-4111-8111-211111111111'],
  },
  {
    questionId: '11111111-1111-4111-8111-333333333333',
    selectedOptionIds: ['21111111-1111-4111-8111-555555555555'],
  },
];

const partiallyCorrectAnswers = [
  {
    questionId: '11111111-1111-4111-8111-111111111111',
    selectedOptionIds: ['21111111-1111-4111-8111-211111111111'],
  },
  {
    questionId: '11111111-1111-4111-8111-333333333333',
    selectedOptionIds: ['21111111-1111-4111-8111-444444444444'],
  },
];

function useStore(
  overrides: Partial<Parameters<typeof createExamAnswersStore>[0]> = {},
): ExamAnswersStore {
  const store = createExamAnswersStore({
    activity: examActivity,
    ...overrides,
  });
  server.use(...store.handlers);
  return store;
}

describe('exam-answer-service', () => {
  it('submits answers with an idempotency key and returns the server-computed result', async () => {
    const store = useStore();
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const result = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    });

    expect(result.status).toBe('graded');
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
    expect(result.activityId).toBe(activityId);
    expect(store.getItems()).toHaveLength(1);
    expect(store.getLastCreateRequest()?.idempotencyKey).toBe('key-1');
    expect(store.getLastCreateRequest()?.answers).toEqual({
      answers: correctAnswers,
    });
  });

  it('computes partial scores server-side; the browser never sends a score', async () => {
    const store = useStore();
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const result = await submitExamAnswers(
      client,
      activityId,
      partiallyCorrectAnswers,
      { idempotencyKey: 'key-1' },
    );

    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(10);
    const sent = store.getLastCreateRequest()?.answers as {
      answers: { selectedOptionIds: string[] }[];
    };
    expect(JSON.stringify(sent).includes('"score"')).toBe(false);
  });

  it('replays idempotently when the same key is reused', async () => {
    const store = useStore();
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const first = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    });
    const second = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    });

    expect(second.id).toBe(first.id);
    expect(store.getItems()).toHaveLength(1);
  });

  it('marks a network failure as outcome-uncertain and stores nothing', async () => {
    const store = useStore();
    store.failNext('create', 'network');
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const error = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(isUncertainExamAnswerError(error)).toBe(true);
    expect((error as ApiError).userMessage).toBe(
      examMessages.serverErrors.uncertain,
    );
    expect(store.getItems()).toHaveLength(0);
  });

  it('reconciles a dropped response by reading the retained attempt back', async () => {
    const store = useStore();
    store.failNext('create', 'drop-response');
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const error = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    }).catch((caught: unknown) => caught);

    expect(isUncertainExamAnswerError(error)).toBe(true);
    // The server stored the attempt even though the response was lost.
    expect(store.getItems()).toHaveLength(1);

    const attempt = await readOwnExamAttempt(client, activityId);
    expect(attempt).not.toBeNull();
    expect(attempt?.answers).toEqual(correctAnswers);
    expect(attempt?.score).toBe(10);
    expect(attempt?.status).toBe('graded');
  });

  it('translates a closed answering window into feature copy', async () => {
    useStore({
      activity: {
        ...examActivity,
        dueAt: '2026-11-18T00:00:00.000Z',
        allowLate: false,
      },
      now: '2026-11-19T12:00:00.000Z',
    });
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const error = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).userMessage).toBe(
      examMessages.serverErrors.windowClosed,
    );
  });

  it('rejects non-student roles with forbidden copy', async () => {
    useStore({ role: 'TEACHER' });
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const error = await submitExamAnswers(client, activityId, correctAnswers, {
      idempotencyKey: 'key-1',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).userMessage).toBe(
      examMessages.serverErrors.forbidden,
    );
  });

  it('validates the payload client-side before any request leaves', async () => {
    const store = useStore();
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    await expect(
      submitExamAnswers(client, activityId, [], {
        idempotencyKey: 'key-1',
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      submitExamAnswers(
        client,
        activityId,
        [
          correctAnswers[0]!,
          {
            questionId: correctAnswers[0]!.questionId,
            selectedOptionIds: ['21111111-1111-4111-8111-211111111111'],
          },
        ],
        { idempotencyKey: 'key-1' },
      ),
    ).rejects.toBeInstanceOf(ApiError);

    expect(store.getLastCreateRequest()).toBeNull();
    expect(store.getItems()).toHaveLength(0);
  });

  it('reads null when no attempt exists yet', async () => {
    useStore();
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    const attempt = await readOwnExamAttempt(client, activityId);
    expect(attempt).toBeNull();
  });
});
