import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { examMessages } from '../src/features/classrooms/activities/exam/exam-messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000243';
const activityId = '00000000-0000-4000-8000-000000007501';
const question1Id = '10000000-0000-4000-8000-000000007511';
const question1WrongOptionId = '20000000-0000-4000-8000-000000007512';
const question1CorrectOptionId = '20000000-0000-4000-8000-000000007513';
const question2Id = '10000000-0000-4000-8000-000000007521';
const question2WrongOptionId = '20000000-0000-4000-8000-000000007522';
const question2CorrectOptionId = '20000000-0000-4000-8000-000000007523';
const attemptId = '00000000-0000-4000-8000-000000007601';

const ownAttemptUrl = `${apiOrigin}/activities/${activityId}/exam-answers/me`;
const submitUrl = `${apiOrigin}/activities/${activityId}/exam-answers`;

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'estudiante@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const classroomContext: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: '3.º Año B - Matemática',
  subject: 'Álgebra',
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'STUDENT',
  capabilities: ['participate_activities', 'view_metrics'],
  availablePanels: ['activities'],
  deskCount: 12,
  pet: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

/**
 * Published MULTIPLE_CHOICE exam the student answers. The detail response
 * carries the student question shape only: no option ever exposes `isCorrect`
 * (`RN-06`).
 */
const examActivity: components['schemas']['StudentActivityResponseDto'] = {
  id: activityId,
  classroomId,
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  state: 'PUBLISHED',
  title: 'Examen 1: Aritmética y geografía',
  description:
    'Evaluación de la unidad 1. Respondé con calma y revisá antes de confirmar.',
  opensAt: null,
  dueAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  allowLate: false,
  maxScore: 10,
  weightMultiplier: 1,
  publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  timeZone: 'America/Argentina/Buenos_Aires',
  questionCount: 2,
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 86_400_000).toISOString(),
  questions: [
    {
      id: question1Id,
      position: 1,
      prompt: '¿Cuánto es 7 × 8?',
      options: [
        { id: question1WrongOptionId, position: 1, label: '54' },
        { id: question1CorrectOptionId, position: 2, label: '56' },
      ],
    },
    {
      id: question2Id,
      position: 2,
      prompt: '¿Cuál es la capital de Francia?',
      options: [
        { id: question2WrongOptionId, position: 1, label: 'Lyon' },
        { id: question2CorrectOptionId, position: 2, label: 'París' },
      ],
    },
  ],
};

/** Server-side truth; it exists only in the mocked API, never in the DOM. */
const correctOptionIdsByQuestion: Readonly<Record<string, readonly string[]>> =
  {
    [question1Id]: [question1CorrectOptionId],
    [question2Id]: [question2CorrectOptionId],
  };

/**
 * PROVISIONAL response shape for `HU-ACT-003` part 2/2 until
 * `Agustin742/integratec-final-back#47` lands in `src/api/schema.generated.ts`;
 * see `docs/exam-answering.md`. Same payloads the MSW store
 * (`createExamAnswersStore`) serves in unit tests: answers in, server-computed
 * score out, no correct answers in any response.
 */
interface ExamAnswerInputPayload {
  readonly questionId: string;
  readonly selectedOptionIds: readonly string[];
}

interface ExamAnswerSubmissionPayload {
  readonly id: string;
  readonly activityId: string;
  readonly submittedAt: string;
  readonly isLate: boolean;
  readonly status: 'graded';
  readonly score: number;
  readonly maxScore: number;
}

interface OwnExamAttemptPayload extends ExamAnswerSubmissionPayload {
  readonly answers: readonly ExamAnswerInputPayload[];
}

/**
 * Provisional server-side scoring, mirroring the MSW store's all-or-nothing
 * rule per question: the browser sends answers only, the server computes the
 * score (`RN-06`).
 */
function scoreAnswers(answers: readonly ExamAnswerInputPayload[]): number {
  const correctQuestions = answers.filter((answer) => {
    const correctIds = correctOptionIdsByQuestion[answer.questionId] ?? [];
    return answer.selectedOptionIds.every((optionId) =>
      correctIds.includes(optionId),
    );
  }).length;
  const totalQuestions = Math.max(answers.length, 1);
  return (
    Math.round(
      (examActivity.maxScore * correctQuestions * 100) / totalQuestions,
    ) / 100
  );
}

async function setupAuthSession(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
    const tabOwner = '00000000-0000-4000-8000-000000000002';
    window.name = `\n[integratec-tab:${tabOwner}]`;
    sessionStorage.setItem(
      'integratec.session',
      JSON.stringify({
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner,
      }),
    );
    document.addEventListener('securitypolicyviolation', (event) => {
      const record = (
        window as unknown as {
          __recordCspViolation__?: (directive: string) => void;
        }
      ).__recordCspViolation__;
      record?.(event.violatedDirective);
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route(`${apiOrigin}/users/me`, (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route(`${apiOrigin}/notifications**`, (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/context-events`,
    async (route) => {
      // Hold the synthetic SSE handshake until teardown like the workspace
      // and grades specs: an immediate EOF would reconcile the classroom
      // context and remount the exam panel, losing the in-progress
      // selections mid-flow.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: '',
      });
    },
  );

  return { cspViolations, pageErrors };
}

function errorEnvelope(
  code: components['schemas']['ErrorCode'],
  message: string,
): components['schemas']['ErrorEnvelope'] {
  return {
    error: { code, message, correlationId: 'synthetic-exam-request' },
  };
}

async function openExamAnsweringTab(page: Page) {
  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({ json: classroomContext }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/activities/${activityId}`,
    (route) =>
      route.fulfill({
        json: examActivity satisfies components['schemas']['StudentActivityResponseDto'],
      }),
  );
  await page.goto(`./classrooms/${classroomId}/activities/${activityId}`);
  await expect(
    page.getByRole('heading', { name: examActivity.title }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Entrega' }).click();
  // The read-own query gates the form; wait for the question radios.
  await expect(page.getByRole('radio', { name: '56' })).toBeVisible();
}

function expectHealthyPage(
  cspViolations: readonly string[],
  pageErrors: readonly string[],
): void {
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
}

/**
 * The radios are visually hidden inside their `<label>` touch targets, so a
 * user picks an option by activating the label text; the e2e flow does the
 * same instead of forcing a click on the `sr-only` input.
 */
async function chooseOption(page: Page, optionLabel: string) {
  await page.getByText(optionLabel, { exact: true }).click();
}

test('student answers a multiple-choice exam and the server-confirmed result shows', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  // The read-own endpoint answers 404 until the POST has been observed, then
  // returns the stored attempt with the retained answers and the
  // server-computed score, like the MSW store serves in unit tests.
  let stored: OwnExamAttemptPayload | null = null;
  await page.route(ownAttemptUrl, (route) =>
    stored !== null
      ? route.fulfill({ json: stored })
      : route.fulfill({
          status: 404,
          json: errorEnvelope('NOT_FOUND', 'Exam attempt not found.'),
        }),
  );

  const createRequests: { key: string; body: unknown }[] = [];
  await page.route(submitUrl, (route) => {
    const answers = (
      route.request().postDataJSON() as {
        answers: readonly ExamAnswerInputPayload[];
      }
    ).answers;
    const submission: ExamAnswerSubmissionPayload = {
      id: attemptId,
      activityId,
      submittedAt: new Date().toISOString(),
      isLate: false,
      status: 'graded',
      score: scoreAnswers(answers),
      maxScore: examActivity.maxScore,
    };
    stored = { ...submission, answers };
    createRequests.push({
      key: route.request().headers()['idempotency-key'] ?? '',
      body: route.request().postDataJSON(),
    });
    return route.fulfill({ status: 201, json: submission });
  });

  await openExamAnsweringTab(page);

  // One keyboard-operable radio group per published question.
  await expect(
    page.getByText(examMessages.panel.questionLegend(1, 2)),
  ).toBeVisible();
  await expect(
    page.getByText(examMessages.panel.questionLegend(2, 2)),
  ).toBeVisible();
  await chooseOption(page, '56');
  await chooseOption(page, 'París');

  // Submit confirmation before anything leaves the browser.
  await page
    .getByRole('button', { name: examMessages.panel.submitLabel })
    .click();
  const confirmDialog = page.getByRole('dialog', {
    name: examMessages.panel.confirm.title,
  });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog
    .getByRole('button', { name: examMessages.panel.confirm.action })
    .click();

  // The server-confirmed result shows; the browser never computed a score.
  await expect(
    page.getByRole('heading', { name: examMessages.panel.heading }),
  ).toBeVisible();
  await expect(
    page.getByText(examMessages.panel.statusLabels.graded, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      examMessages.panel.scoreValue(
        examActivity.maxScore,
        examActivity.maxScore,
      ),
      { exact: true },
    ),
  ).toBeVisible();

  // The send carried a client-generated idempotency key and answers only.
  expect(createRequests).toHaveLength(1);
  expect(createRequests[0]!.key).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(JSON.stringify(createRequests[0]!.body)).toContain(question1Id);
  expect(JSON.stringify(createRequests[0]!.body)).not.toContain('"score"');

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/assets/activities/exam-answering-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expectHealthyPage(cspViolations, pageErrors);
});

test('unanswered questions block the submission, explain and keep the selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  await page.route(ownAttemptUrl, (route) =>
    route.fulfill({
      status: 404,
      json: errorEnvelope('NOT_FOUND', 'Exam attempt not found.'),
    }),
  );
  const createRequests: string[] = [];
  await page.route(submitUrl, (route) => {
    createRequests.push(route.request().headers()['idempotency-key'] ?? '');
    return route.fulfill({ status: 201, json: {} });
  });

  await openExamAnsweringTab(page);

  // Only the first question is answered.
  await chooseOption(page, '56');
  await page
    .getByRole('button', { name: examMessages.panel.submitLabel })
    .click();

  // Client-side validation explains before any request leaves the browser.
  await expect(page.getByText(examMessages.validation.answers)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(createRequests).toHaveLength(0);

  // The answered selection is preserved for the student to continue.
  await expect(page.getByRole('radio', { name: '56' })).toBeChecked();
  await expect(
    page.getByRole('button', { name: examMessages.panel.submitLabel }),
  ).toBeEnabled();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expectHealthyPage(cspViolations, pageErrors);
});
