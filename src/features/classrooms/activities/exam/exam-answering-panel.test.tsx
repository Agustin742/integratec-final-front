import { fireEvent, screen, waitFor } from '@testing-library/react';
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
import { createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { expectAccessible } from '@/test/accessibility';
import {
  createExamSubmissionsStore,
  TEST_API_BASE_URL,
  type ExamSubmissionsStore,
  type ExamSubmissionsStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { profile } from '@/session/test-fixtures';
import type { SessionService } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import type { StudentActivityResponseDto } from '../activity-schema';
import { ExamAnsweringPanel } from './exam-answering-panel';
import { examMessages } from './exam-messages';

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
});

afterAll(() => {
  mswServer.close();
});

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000201';
const ACTIVITY_ID = '00000000-0000-4000-8000-0000000005b1';
const COPY = examMessages.panel;

const QUESTION_1_ID = '11111111-1111-4111-8111-111111111111';
const QUESTION_1_CORRECT = '21111111-1111-4111-8111-211111111111';
const QUESTION_1_WRONG = '21111111-1111-4111-8111-222222222222';
const QUESTION_2_ID = '11111111-1111-4111-8111-333333333333';
const QUESTION_2_WRONG = '21111111-1111-4111-8111-444444444444';
const QUESTION_2_CORRECT = '21111111-1111-4111-8111-555555555555';

function makeExamActivityDto(
  overrides: Partial<StudentActivityResponseDto> = {},
): StudentActivityResponseDto {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'EXAM',
    format: 'MULTIPLE_CHOICE',
    state: 'PUBLISHED',
    title: 'Examen 1: Aritmética',
    description: 'Evaluación de la unidad 1.',
    opensAt: null,
    // Far in the future of any plausible test clock: the window is open.
    dueAt: '2999-12-31T23:59:00.000Z',
    allowLate: false,
    maxScore: 10,
    weightMultiplier: 1,
    publishedAt: '2026-11-19T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 2,
    createdAt: '2026-11-19T09:00:00.000Z',
    updatedAt: '2026-11-19T10:00:00.000Z',
    questions: [
      {
        id: QUESTION_1_ID,
        position: 0,
        prompt: '¿Cuánto es 2 + 2?',
        options: [
          { id: QUESTION_1_CORRECT, position: 0, label: '4' },
          { id: QUESTION_1_WRONG, position: 1, label: '5' },
        ],
      },
      {
        id: QUESTION_2_ID,
        position: 1,
        prompt: '¿Cuál es la capital de Francia?',
        options: [
          { id: QUESTION_2_WRONG, position: 0, label: 'Lyon' },
          { id: QUESTION_2_CORRECT, position: 1, label: 'París' },
        ],
      },
    ],
    ...overrides,
  };
}

function makeStore(
  overrides: Partial<Parameters<typeof createExamSubmissionsStore>[0]> = {},
): ExamSubmissionsStore {
  return createExamSubmissionsStore({
    baseUrl: TEST_API_BASE_URL,
    role: 'STUDENT',
    activity: {
      id: ACTIVITY_ID,
      state: 'PUBLISHED',
      format: 'MULTIPLE_CHOICE',
      opensAt: null,
      dueAt: '2999-12-31T23:59:00.000Z',
      allowLate: false,
      maxScore: 10,
      questions: [
        {
          id: QUESTION_1_ID,
          options: [
            { id: QUESTION_1_CORRECT, isCorrect: true },
            { id: QUESTION_1_WRONG, isCorrect: false },
          ],
        },
        {
          id: QUESTION_2_ID,
          options: [
            { id: QUESTION_2_WRONG, isCorrect: false },
            { id: QUESTION_2_CORRECT, isCorrect: true },
          ],
        },
      ],
    },
    ...overrides,
  });
}

function makeStoredAttempt(
  overrides: Partial<ExamSubmissionsStoreItem> = {},
): ExamSubmissionsStoreItem {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    activityId: ACTIVITY_ID,
    submittedAt: '2026-11-19T12:00:00.000Z',
    isLate: false,
    idempotencyKey: '11111111-2222-4333-8444-555555555555',
    answers: [
      { questionId: QUESTION_1_ID, optionId: QUESTION_1_CORRECT, position: 0 },
      { questionId: QUESTION_2_ID, optionId: QUESTION_2_CORRECT, position: 1 },
    ],
    autoScore: 10,
    ...overrides,
  };
}

function makePanelSession() {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const { service } = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  return { service: service as SessionService, client };
}

function renderPanel(activity: StudentActivityResponseDto) {
  const { service } = makePanelSession();
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const view = render(
    <SessionProvider service={service}>
      <ExamAnsweringPanel activity={activity} />
    </SessionProvider>,
    { queryClient },
  );
  return { ...view, queryClient };
}

function selectCorrectAnswers() {
  fireEvent.click(screen.getByRole('radio', { name: '4' }));
  fireEvent.click(screen.getByRole('radio', { name: 'París' }));
}

async function confirmSubmission() {
  fireEvent.click(screen.getByRole('button', { name: COPY.submitLabel }));
  fireEvent.click(screen.getByRole('button', { name: COPY.confirm.action }));
}

/**
 * The panel renders the answering form only after the own-attempt query
 * (`GET .../submissions/me`, `404` while nothing was submitted) settles, so
 * every form interaction first waits for the question radios to appear.
 */
async function waitForAnswerForm() {
  await screen.findByRole('radio', { name: '4' });
}

/** Counts create requests via MSW events (double-submit protection). */
function trackCreateRequests() {
  const requests: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    if (request.method === 'POST' && request.url.endsWith('/submissions')) {
      requests.push(request.headers.get('Idempotency-Key') ?? '');
    }
  };
  mswServer.events.on('request:start', listener);
  return {
    requests,
    stop: () => mswServer.events.removeListener('request:start', listener),
  };
}

describe('ExamAnsweringPanel', () => {
  test('renders keyboard-operable radio groups, asks for confirmation and shows the server-computed result', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    const { container } = renderPanel(makeExamActivityDto());

    // One radio group per question; options are keyboard-operable radios.
    // `findByRole` also awaits the own-attempt query that gates the form.
    await screen.findByRole('radio', { name: '4' });
    expect(screen.getByRole('radio', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lyon' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'París' })).toBeInTheDocument();
    await expectAccessible(container);

    selectCorrectAnswers();

    // Submit confirmation before anything leaves the browser.
    fireEvent.click(screen.getByRole('button', { name: COPY.submitLabel }));
    expect(
      screen.getByRole('dialog', { name: COPY.confirm.title }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: COPY.confirm.action }));

    // Server-computed result, never a client-side score.
    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(screen.getByText(COPY.statusLabels.submitted)).toBeVisible();
    expect(store.getItems()).toHaveLength(1);
    await expectAccessible(container);
  });

  test('never sends a computed score and shows no per-question correctness after grading', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });

    // The browser sends answers only: no score field in the request body.
    const sent = store.getLastCreateRequest()?.answers ?? '';
    expect(store.getLastCreateRequest()?.fieldNames).toEqual(['answers']);
    expect(sent).not.toContain('score');
    expect(sent).toContain(QUESTION_1_CORRECT);

    // The result view shows the aggregate score only, not which options were
    // correct (`RN-06`): the question list is gone.
    expect(
      screen.queryByText(COPY.questionLegend(1, 2)),
    ).not.toBeInTheDocument();
  });

  test('keeps the selected answers after a definite server rejection and lets the student retry', async () => {
    const store = makeStore();
    store.failNext('create', {
      status: 409,
      body: {
        code: 'CONFLICT',
        message: 'Request conflicts with the current state',
        details: [
          {
            field: 'activity',
            messages: [
              'The deadline has passed and this activity does not accept late submissions',
            ],
          },
        ],
        correlationId: 'req-exam-submissions-create-409-closed',
      },
    });
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    // Definite rejection is explained and the selections are preserved.
    await waitFor(() => {
      expect(
        screen.getByText(examMessages.serverErrors.conflict),
      ).toBeVisible();
    });
    expect(
      (screen.getByRole('radio', { name: '4' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('radio', { name: 'París' }) as HTMLInputElement)
        .checked,
    ).toBe(true);

    // A retry with the same selections succeeds.
    await confirmSubmission();
    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(store.getItems()).toHaveLength(1);
  });

  test('shows the stored result when a 409 means the exam was already submitted with another key', async () => {
    const store = makeStore({ initialItems: [makeStoredAttempt()] });
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    // The stored submission exists, but the first read-own answers `404` as
    // if it were stale (another tab submitted since the page loaded).
    store.failNext('readOwn', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        correlationId: 'req-exam-submissions-me-404-stale',
      },
    });
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    // The server confirms the earlier submission: it replaces the form and
    // the conflict copy is not shown as an error.
    await waitFor(() => {
      expect(screen.getByText(COPY.reconciledNotice)).toBeVisible();
    });
    expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    expect(
      screen.queryByText(examMessages.serverErrors.conflict),
    ).not.toBeInTheDocument();
  });

  test('sends only one request when the confirm action is activated twice', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    const tracker = trackCreateRequests();
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    try {
      selectCorrectAnswers();
      fireEvent.click(screen.getByRole('button', { name: COPY.submitLabel }));
      const confirmButton = screen.getByRole('button', {
        name: COPY.confirm.action,
      });
      fireEvent.click(confirmButton);
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('10 de 10 puntos')).toBeVisible();
      });
      expect(tracker.requests).toHaveLength(1);
    } finally {
      tracker.stop();
    }
  });

  test('reconciles an uncertain network failure that stored nothing, keeping the answers', async () => {
    const store = makeStore({
      // MSW resolves in microtasks: without artificial read-own latency the
      // whole reconciliation finishes before React commits the transient
      // "verifying" phase this test asserts on.
      readOwnDelayMs: 300,
    });
    store.failNext('create', 'network');
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    // The server is consulted before any resubmission is offered.
    await waitFor(() => {
      expect(screen.getByText(COPY.uncertainChecking)).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText(COPY.uncertainNothingStored)).toBeVisible();
    });
    expect(
      (screen.getByRole('radio', { name: '4' }) as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: COPY.retryAction }));
    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(store.getItems()).toHaveLength(1);
  });

  test('reports an unverifiable outcome when the verification read also fails, never "nothing stored"', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    // The uncertain POST failure is followed by a failed verification GET.
    store.failNext('create', 'network');
    store.failNext('readOwn', 'network');
    selectCorrectAnswers();
    await confirmSubmission();

    await waitFor(() => {
      expect(screen.getByText(COPY.uncertainUnverified)).toBeVisible();
    });
    expect(
      screen.queryByText(COPY.uncertainNothingStored),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: COPY.retryAction }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: COPY.verifyAgainAction }),
    ).toBeVisible();
  });

  test('keeps the confirmed result visible when the follow-up own-attempt refresh fails', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    // The POST succeeds; the background read-own refresh then fails.
    store.failNext('readOwn', 'network');
    selectCorrectAnswers();
    await confirmSubmission();

    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(screen.queryByText(COPY.errorTitle)).not.toBeInTheDocument();
    expect(store.getItems()).toHaveLength(1);
  });

  test('reconciles a dropped response by showing the stored attempt with its retained answers', async () => {
    const store = makeStore();
    store.failNext('create', 'drop-response');
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    await waitFor(() => {
      expect(screen.getByText(COPY.reconciledNotice)).toBeVisible();
    });
    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(store.getItems()).toHaveLength(1);
  });

  test('blocks the submission while the answering window is closed', async () => {
    const store = makeStore({
      activity: {
        id: ACTIVITY_ID,
        state: 'PUBLISHED',
        format: 'MULTIPLE_CHOICE',
        opensAt: null,
        // Long past: the window is closed and late answers are not allowed.
        dueAt: '2000-01-01T00:00:00.000Z',
        allowLate: false,
        maxScore: 10,
        questions: [
          {
            id: QUESTION_1_ID,
            options: [
              { id: QUESTION_1_CORRECT, isCorrect: true },
              { id: QUESTION_1_WRONG, isCorrect: false },
            ],
          },
        ],
      },
    });
    mswServer.use(...store.handlers);
    renderPanel(
      makeExamActivityDto({
        dueAt: '2000-01-01T00:00:00.000Z',
        questionCount: 1,
        questions: [makeExamActivityDto().questions[0]!],
      }),
    );
    await waitForAnswerForm();

    expect(
      screen.getByRole('button', { name: COPY.submitLabel }),
    ).toBeDisabled();
    expect(screen.getByText(COPY.window.closedReason)).toBeVisible();
  });

  test('requires every question answered before opening the confirmation dialog', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    const tracker = trackCreateRequests();
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    try {
      // Only the first question is answered.
      fireEvent.click(screen.getByRole('radio', { name: '4' }));
      fireEvent.click(screen.getByRole('button', { name: COPY.submitLabel }));

      expect(screen.getByText(examMessages.validation.answers)).toBeVisible();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(tracker.requests).toHaveLength(0);
    } finally {
      tracker.stop();
    }
  });

  test('shows an existing attempt immediately with its server-confirmed result', async () => {
    const store = makeStore({ initialItems: [makeStoredAttempt()] });
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());

    await waitFor(() => {
      expect(screen.getByText('10 de 10 puntos')).toBeVisible();
    });
    expect(screen.getByText(COPY.statusLabels.submitted)).toBeVisible();
    // No answering form is offered once the attempt exists.
    expect(screen.queryByRole('radio', { name: '4' })).not.toBeInTheDocument();
  });

  test('describes each radio group with its question prompt', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    expect(
      screen.getByRole('group', { name: COPY.questionLegend(1, 2) }),
    ).toHaveAccessibleDescription('¿Cuánto es 2 + 2?');
    expect(
      screen.getByRole('group', { name: COPY.questionLegend(2, 2) }),
    ).toHaveAccessibleDescription('¿Cuál es la capital de Francia?');
  });

  test('renders the options without React key warnings', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    const keyWarnings = errorSpy.mock.calls.filter((call) =>
      String(call[0]).includes('unique "key" prop'),
    );
    errorSpy.mockRestore();
    expect(keyWarnings).toHaveLength(0);
  });

  test('moves focus to the result heading after a successful submission', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    selectCorrectAnswers();
    await confirmSubmission();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: COPY.heading })).toHaveFocus();
    });
  });

  test('moves focus to the validation alert when questions are unanswered', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto());
    await waitForAnswerForm();

    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: COPY.submitLabel }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(examMessages.validation.answers);
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
    expect(
      screen.getByRole('button', { name: COPY.submitLabel }),
    ).toHaveAccessibleDescription(examMessages.validation.answers);
  });

  test('disables the radio inputs while the answering window is closed', async () => {
    const store = makeStore();
    mswServer.use(...store.handlers);
    renderPanel(makeExamActivityDto({ dueAt: '2000-01-01T00:00:00.000Z' }));
    await waitForAnswerForm();

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });
});
