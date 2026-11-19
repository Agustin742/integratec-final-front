import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { gradingMessages } from '../src/features/classrooms/grading/grading-messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '00000000-0000-4000-8000-000000000044';
const activityTpId = '00000000-0000-4000-8000-000000005101';
const activityExamId = '00000000-0000-4000-8000-000000005102';
const sub1Id = '00000000-0000-4000-8000-000000006101';
const sub2Id = '00000000-0000-4000-8000-000000006102';
const syntheticNow = '2026-11-18T15:00:00.000Z';

type ClassroomContext = components['schemas']['ClassroomContextResponseDto'];
type ActivitySummary = components['schemas']['ActivitySummaryDto'];
type GradingQueueItem = components['schemas']['GradingQueueItemDto'];
type GradeResponse = components['schemas']['GradeResponseDto'];

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

function buildContext(role: 'TEACHER' | 'STUDENT'): ClassroomContext {
  return {
    id: classroomId,
    name: '4.º Año A - Matemática',
    subject: 'Análisis matemático',
    schoolId: null,
    independentTeacherId: userId,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: role,
    capabilities:
      role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : ['participate_activities'],
    availablePanels: ['activities', 'grades', 'members'],
    deskCount: 16,
    pet: null,
    createdAt: syntheticNow,
    updatedAt: syntheticNow,
  };
}

const initialActivities: ActivitySummary[] = [
  {
    id: activityTpId,
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Funciones cuadráticas',
    description: 'Adjuntar la resolución en PDF con gráficos.',
    opensAt: null,
    dueAt: '2026-11-25T02:30:00.000Z',
    allowLate: true,
    maxScore: 100,
    weightMultiplier: 1.5,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
  },
  {
    id: activityExamId,
    classroomId,
    type: 'EXAM',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'Examen 1: Sistemas de ecuaciones',
    description: 'Resolución completa escaneada.',
    opensAt: null,
    dueAt: '2026-11-28T02:30:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 2,
    publishedAt: '2026-11-18T11:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:30:00.000Z',
    updatedAt: '2026-11-18T11:00:00.000Z',
  },
];

interface GradingE2eState {
  readonly context: ClassroomContext;
  readonly submissions: GradingQueueItem[];
  queueRequests: number;
}

function createInitialSubmissions(): GradingQueueItem[] {
  return [
    {
      id: sub1Id,
      activityId: activityTpId,
      activityTitle: 'TP 1: Funciones cuadráticas',
      activityType: 'TP',
      studentId: '00000000-0000-4000-8000-000000007001',
      studentDisplayName: 'Sofía Martínez',
      submittedAt: '2026-11-18T14:00:00.000Z',
      isLate: false,
      status: 'submitted',
      fileCount: 1,
      grade: null,
    },
    {
      id: sub2Id,
      activityId: activityExamId,
      activityTitle: 'Examen 1: Sistemas de ecuaciones',
      activityType: 'EXAM',
      studentId: '00000000-0000-4000-8000-000000007002',
      studentDisplayName: 'Mateo López',
      submittedAt: '2026-11-18T14:30:00.000Z',
      isLate: true,
      status: 'graded',
      fileCount: 1,
      grade: {
        id: '00000000-0000-4000-8000-000000009001',
        graderId: userId,
        score: 75,
        feedback: 'Buen procedimiento general.',
        pointsAwarded: 150,
        version: 1,
        gradedAt: '2026-11-18T15:10:00.000Z',
      },
    },
  ];
}

async function interceptGradingApi(
  page: Page,
  testInfo: TestInfo,
  state: GradingE2eState,
): Promise<void> {
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }
    if (url.origin !== apiOrigin) {
      return route.abort();
    }

    if (url.pathname === '/users/me') {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === '/notifications' && request.method() === 'GET') {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/points` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          classroomId,
          studentId: userId,
          balance: 0,
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
        },
      });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: state.context });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/activities` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          items: initialActivities,
          page: 1,
          pageSize: 100,
          total: initialActivities.length,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/submissions` &&
      request.method() === 'GET'
    ) {
      state.queueRequests += 1;
      const filterState = url.searchParams.get('state');
      const filterActivity = url.searchParams.get('activityId');
      const filtered = state.submissions.filter((item) => {
        if (filterActivity && item.activityId !== filterActivity) {
          return false;
        }
        if (filterState === 'submitted' || filterState === 'graded') {
          return item.status === filterState;
        }
        return true;
      });
      return route.fulfill({
        json: {
          items: filtered,
          page: 1,
          pageSize: 10,
          total: filtered.length,
        },
      });
    }

    const detailMatch = url.pathname.match(/^\/submissions\/([^/]+)$/);
    if (detailMatch && request.method() === 'GET') {
      const item = state.submissions.find(
        (entry) => entry.id === detailMatch[1],
      );
      if (!item) {
        return route.fulfill({ status: 404, json: {} });
      }
      return route.fulfill({
        headers: { 'Cache-Control': 'no-store' },
        json: {
          id: item.id,
          activityId: item.activityId,
          submittedAt: item.submittedAt,
          isLate: item.isLate,
          status: item.status,
          files: [
            {
              id: '00000000-0000-4000-8000-000000008001',
              originalName: 'tp1-funciones-sofia.pdf',
              contentType: 'application/pdf',
              sizeBytes: 245760,
              position: 0,
              downloadUrl: `https://storage.example.invalid/signed/${item.id}/tp1-funciones-sofia.pdf?sig=e2e`,
              downloadUrlExpiresAt: '2026-11-18T18:00:00.000Z',
            },
          ],
        },
      });
    }

    const gradeMatch = url.pathname.match(/^\/submissions\/([^/]+)\/grade$/);
    if (gradeMatch && request.method() === 'POST') {
      const index = state.submissions.findIndex(
        (entry) => entry.id === gradeMatch[1],
      );
      if (index === -1) {
        return route.fulfill({ status: 404, json: {} });
      }
      const body = request.postDataJSON() as {
        score: number;
        feedback: string;
      };
      const target = state.submissions[index];
      const now = '2026-11-18T16:30:00.000Z';
      const pointsAwarded = Math.round(body.score * 1.5);
      const response: GradeResponse = {
        id: '00000000-0000-4000-8000-000000009100',
        submissionId: target.id,
        activityId: target.activityId,
        studentId: target.studentId,
        graderId: userId,
        score: body.score,
        feedback: body.feedback,
        pointsAwarded,
        pointTransactionId: '00000000-0000-4000-8000-000000009900',
        version: 1,
        gradedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      state.submissions[index] = {
        ...target,
        status: 'graded',
        grade: {
          id: response.id,
          graderId: response.graderId,
          score: response.score,
          feedback: response.feedback,
          pointsAwarded: response.pointsAwarded,
          version: response.version,
          gradedAt: response.gradedAt,
        },
      };
      return route.fulfill({ status: 201, json: response });
    }

    if (gradeMatch && request.method() === 'PATCH') {
      const index = state.submissions.findIndex(
        (entry) => entry.id === gradeMatch[1],
      );
      if (index === -1 || !state.submissions[index]?.grade) {
        return route.fulfill({ status: 404, json: {} });
      }
      const body = request.postDataJSON() as {
        score: number;
        feedback: string;
        version: number;
      };
      const target = state.submissions[index];
      const existing = target.grade!;
      const now = '2026-11-18T17:00:00.000Z';
      const pointsAwarded = Math.round(body.score * 1.5);
      const response: GradeResponse = {
        id: existing.id,
        submissionId: target.id,
        activityId: target.activityId,
        studentId: target.studentId,
        graderId: userId,
        score: body.score,
        feedback: body.feedback,
        pointsAwarded,
        pointTransactionId: '00000000-0000-4000-8000-000000009901',
        version: existing.version + 1,
        gradedAt: now,
        createdAt: existing.gradedAt,
        updatedAt: now,
      };
      state.submissions[index] = {
        ...target,
        status: 'graded',
        grade: {
          id: response.id,
          graderId: response.graderId,
          score: response.score,
          feedback: response.feedback,
          pointsAwarded: response.pointsAwarded,
          version: response.version,
          gradedAt: response.gradedAt,
        },
      };
      return route.fulfill({ status: 200, json: response });
    }

    return route.fulfill({ status: 404, json: {} });
  });
}

async function attachRuntimeMonitors(page: Page) {
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
    window.addEventListener('securitypolicyviolation', (event) => {
      const report = window as unknown as {
        __recordCspViolation__?: (directive: string) => void;
      };
      report.__recordCspViolation__?.(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return { cspViolations, pageErrors };
}

test('teacher reviews a submission, grades 0-100 with feedback, and regrades with compensating notice', async ({
  page,
}, testInfo) => {
  const monitors = await attachRuntimeMonitors(page);
  const state: GradingE2eState = {
    context: buildContext('TEACHER'),
    submissions: createInitialSubmissions(),
    queueRequests: 0,
  };
  await interceptGradingApi(page, testInfo, state);

  await page.goto(`/classrooms/${classroomId}/panels/grades`);

  const panelDialog = page.getByRole('dialog', { name: 'Calificaciones' });
  await expect(
    panelDialog.getByRole('heading', { name: gradingMessages.panel.heading }),
  ).toBeVisible();
  await expect(panelDialog.getByText('Sofía Martínez')).toBeVisible();
  await expect(panelDialog.getByText('Mateo López')).toBeVisible();

  const width = page.viewportSize()?.width ?? 1280;
  const suffix = width <= 480 ? '360' : '1280';

  const hasOverflowQueue = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasOverflowQueue).toBe(false);

  await page.screenshot({
    path: `docs/assets/grading/queue-${suffix}.png`,
    fullPage: false,
  });

  // Filter pending submissions
  await panelDialog
    .getByLabel(gradingMessages.filters.stateLabel)
    .selectOption('submitted');
  await expect(panelDialog.getByText('Mateo López')).not.toBeVisible();
  await expect(panelDialog.getByText('Sofía Martínez')).toBeVisible();

  // Open submission review dialog
  await panelDialog
    .getByRole('button', { name: gradingMessages.panel.openReviewAction })
    .click();

  const reviewDialog = page.getByRole('dialog', {
    name: gradingMessages.dialog.titleGrade,
  });
  await expect(reviewDialog).toBeVisible();
  const fileLink = reviewDialog.getByRole('link', {
    name: gradingMessages.viewer.openFileAction,
  });
  await expect(fileLink).toBeVisible();
  await expect(fileLink).toHaveAttribute('target', '_blank');
  await expect(fileLink).toHaveAttribute('rel', 'noopener noreferrer');

  await page.screenshot({
    path: `docs/assets/grading/review-${suffix}.png`,
    fullPage: false,
  });

  // Submit grade 85 with feedback
  await reviewDialog.getByLabel(gradingMessages.form.scoreLabel).fill('85');
  await reviewDialog
    .getByLabel(gradingMessages.form.feedbackLabel)
    .fill('Excelente planteo de parábolas y vértices.');
  await reviewDialog
    .getByRole('button', { name: gradingMessages.form.submitGrade })
    .click();

  const regradeDialog = page.getByRole('dialog', {
    name: gradingMessages.dialog.titleRegrade,
  });
  await expect(regradeDialog).toBeVisible();
  await expect(
    regradeDialog.getByText('128 puntos acreditados', { exact: true }),
  ).toBeVisible();
  await expect(
    regradeDialog.getByText(
      gradingMessages.form.regradeCompensatingNoticeTitle,
    ),
  ).toBeVisible();

  // Regrade to 92
  await regradeDialog.getByLabel(gradingMessages.form.scoreLabel).fill('92');
  await regradeDialog
    .getByLabel(gradingMessages.form.feedbackLabel)
    .fill('Revisión final: gráfico completo y justificación clara.');
  await regradeDialog
    .getByRole('button', { name: gradingMessages.form.submitRegrade })
    .click();

  await expect(
    regradeDialog.getByText('138 puntos acreditados', { exact: true }),
  ).toBeVisible();
  await expect(
    regradeDialog.getByText('Versión 2', { exact: true }),
  ).toBeVisible();

  expect(monitors.cspViolations).toEqual([]);
  expect(monitors.pageErrors).toEqual([]);
});

test('student cannot see teacher grading controls or trigger staff queue requests', async ({
  page,
}, testInfo) => {
  const monitors = await attachRuntimeMonitors(page);
  const state: GradingE2eState = {
    context: buildContext('STUDENT'),
    submissions: createInitialSubmissions(),
    queueRequests: 0,
  };
  await interceptGradingApi(page, testInfo, state);

  await page.goto(`/classrooms/${classroomId}/panels/grades`);

  const panelDialog = page.getByRole('dialog', { name: 'Calificaciones' });
  await expect(panelDialog.getByText('Funcionalidad pendiente')).toBeVisible();
  await expect(
    panelDialog.getByRole('heading', { name: gradingMessages.panel.heading }),
  ).not.toBeVisible();
  expect(state.queueRequests).toBe(0);
  expect(monitors.cspViolations).toEqual([]);
  expect(monitors.pageErrors).toEqual([]);
});
