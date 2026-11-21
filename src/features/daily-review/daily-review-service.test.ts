import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { ownDailyReviewQueryKey } from '@/api/query-keys';
import {
  TEST_API_BASE_URL,
  createDailyQuestionAnswerHandler,
  createDailyReviewHandler,
  type DailyReviewPayload,
} from '@/test/msw/handlers';
import {
  DailyReviewServiceError,
  answerDailyReviewQuestion,
  fetchDailyReview,
} from './daily-review-service';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const DUE_STUDENT_REVIEW: DailyReviewPayload = {
  status: 'due',
  audience: 'STUDENT',
  contentKind: 'generated',
  summary:
    'Buen día, Camila. Tenés dos actividades pendientes y una calificación nueva.',
  sections: [
    {
      kind: 'pending',
      items: [
        {
          kind: 'pending_activity',
          title: 'Trabajo práctico de fotosíntesis',
          classroomName: 'Biología 3°B',
          dueAt: '2026-11-20T23:59:00.000Z',
          detail: null,
        },
      ],
    },
    {
      kind: 'news',
      items: [
        {
          kind: 'recent_grade',
          title: 'Examen de sistemas circulatorio',
          classroomName: 'Biología 3°B',
          dueAt: null,
          detail: '9/10',
        },
      ],
    },
  ],
  dailyQuestion: {
    id: 'question-1',
    prompt: '¿Qué organelo realiza la fotosíntesis?',
    options: ['Mitocondria', 'Cloroplasto', 'Ribosoma'],
    materialTitle: 'guia-fotosintesis.pdf',
  },
};

describe('daily-review-service', () => {
  it('reads a server-decided due student review with the daily question', async () => {
    server.use(createDailyReviewHandler({ payload: DUE_STUDENT_REVIEW }));

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const review = await fetchDailyReview(client);

    expect(review.status).toBe('due');
    if (review.status !== 'due') {
      throw new Error('unreachable');
    }
    expect(review.audience).toBe('STUDENT');
    expect(review.contentKind).toBe('generated');
    expect(review.summary).toContain('Camila');
    expect(review.sections).toHaveLength(2);
    expect(review.sections[0]?.kind).toBe('pending');
    expect(review.sections[0]?.items[0]?.title).toBe(
      'Trabajo práctico de fotosíntesis',
    );
    expect(review.dailyQuestion?.options).toHaveLength(3);
  });

  it('reads a not-due response after the server already delivered today', async () => {
    server.use(createDailyReviewHandler({ payload: { status: 'not_due' } }));

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const review = await fetchDailyReview(client);

    expect(review.status).toBe('not_due');
  });

  it('rejects malformed review payloads', async () => {
    server.use(
      http.get(`${TEST_API_BASE_URL}/users/me/daily-review`, () =>
        HttpResponse.json({ status: 'due', audience: 'STUDENT' }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(fetchDailyReview(client)).rejects.toBeInstanceOf(ApiError);
  });

  it('models the server once-per-day record with deliverOnce handlers', async () => {
    server.use(
      createDailyReviewHandler({
        payload: DUE_STUDENT_REVIEW,
        deliverOnce: true,
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const first = await fetchDailyReview(client);
    const second = await fetchDailyReview(client);

    expect(first.status).toBe('due');
    expect(second.status).toBe('not_due');
  });

  it('sends the chosen answer and returns the server-confirmed streak update', async () => {
    const answers: Array<{ questionId: string; answer: string }> = [];
    server.use(
      createDailyQuestionAnswerHandler({
        onAnswer: (body) => {
          answers.push(body);
        },
        result: {
          correct: true,
          feedback: '¡Correcto! El cloroplasto realiza la fotosíntesis.',
          streak: {
            currentStreak: 5,
            bestStreak: 9,
            lastQualifiedDate: '2026-11-19',
          },
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const result = await answerDailyReviewQuestion(client, {
      questionId: 'question-1',
      answer: 'Cloroplasto',
    });

    expect(answers).toEqual([
      { questionId: 'question-1', answer: 'Cloroplasto' },
    ]);
    expect(result.correct).toBe(true);
    expect(result.streak?.currentStreak).toBe(5);
    expect(result.streak?.lastQualifiedDate).toBe('2026-11-19');
  });

  it('maps a repeated-answer rejection to an already-answered error', async () => {
    server.use(
      createDailyQuestionAnswerHandler({
        error: {
          status: 409,
          body: {
            code: 'CONFLICT',
            message: 'Ya respondiste la pregunta de hoy.',
            correlationId: '3f2b8c1e-0d1a-4f4e-9a55-6f0c2f9c1a11',
          },
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const error = await answerDailyReviewQuestion(client, {
      questionId: 'question-1',
      answer: 'Cloroplasto',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DailyReviewServiceError);
    expect(error instanceof DailyReviewServiceError && error.category).toBe(
      'already_answered',
    );
  });

  it('rejects malformed answer results', async () => {
    server.use(
      http.post(
        `${TEST_API_BASE_URL}/users/me/daily-review/daily-question`,
        () => HttpResponse.json({ correct: 'yes' }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    const error = await answerDailyReviewQuestion(client, {
      questionId: 'question-1',
      answer: 'Cloroplasto',
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DailyReviewServiceError);
    expect(error instanceof DailyReviewServiceError && error.category).toBe(
      'unexpected',
    );
  });

  it('scopes the daily-review query key by userId', () => {
    const keyA = ownDailyReviewQueryKey('user-a');
    const keyB = ownDailyReviewQueryKey('user-b');
    expect(keyA).not.toEqual(keyB);
  });
});
