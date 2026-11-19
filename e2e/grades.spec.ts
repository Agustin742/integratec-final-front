import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { classroomMessages } from '../src/features/classrooms/messages';
import { gradesMessages } from '../src/features/classrooms/grades/messages';
import { pointsMessages } from '../src/features/points/messages';

const apiOrigin = 'https://api.example.invalid';
const classroomId = '00000000-0000-4000-8000-000000000046';
const classroom: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: 'Aula sintética del servidor',
  subject: null,
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'STUDENT',
  capabilities: [
    'view_metrics',
    'participate_activities',
    'chat_classmates',
    'list_directory',
    'message_teacher',
  ],
  availablePanels: [
    'activities',
    'material',
    'grades',
    'chat',
    'notices',
    'shop',
    'bot',
    'members',
  ],
  deskCount: 0,
  pet: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const profile: components['schemas']['OwnProfileDto'] = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'learner@example.test',
  displayName: 'Synthetic Learner',
  avatar: {
    bodyId: 'male',
    hairId: 'afro',
    topId: 'hoodie',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};
const wallet: components['schemas']['StudentWalletDto'] = {
  classroomId,
  studentId: '00000000-0000-4000-8000-000000000047',
  balance: 130,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000481',
      entryKind: 'EARNING',
      amount: 50,
      sourceType: 'submission_grade',
      sourceId: '00000000-0000-4000-8000-000000000482',
      reason: 'Activity graded: Fractions Quiz',
      actorId: '00000000-0000-4000-8000-000000000483',
      createdAt: '2026-11-10T12:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
};
const reportCard: components['schemas']['ReportCardItemDto'][] = [
  {
    activityId: '00000000-0000-4000-8000-000000000491',
    activityTitle: 'Fracciones: guía de ejercicios',
    activityType: 'TP',
    maxScore: 100,
    score: 82,
    feedback: 'Muy buen trabajo. Repasá la simplificación de fracciones.',
    pointsAwarded: 41,
    isLate: false,
    submittedAt: '2026-11-10T12:00:00.000Z',
    gradedAt: '2026-11-12T15:30:00.000Z',
  },
  {
    activityId: '00000000-0000-4000-8000-000000000492',
    activityTitle: 'Examen de geometría',
    activityType: 'EXAM',
    maxScore: 100,
    score: 60,
    feedback: 'Entregado fuera de término. Repasá triángulos y perímetros.',
    pointsAwarded: 30,
    isLate: true,
    submittedAt: '2026-11-15T10:00:00.000Z',
    gradedAt: '2026-11-16T09:15:00.000Z',
  },
];
const dailyMetrics: components['schemas']['DailyMetricDto'][] = [
  {
    day: '2026-11-18',
    connectedSeconds: 4500,
    submissionCount: 1,
    messageCount: 3,
  },
];
const teacherClassroom: components['schemas']['ClassroomContextResponseDto'] = {
  ...classroom,
  myRole: 'TEACHER',
  capabilities: [
    'configure_classroom',
    'invite_members',
    'publish_content',
    'moderate_chat',
    'configure_bot',
    'view_metrics',
    'chat_classmates',
    'list_directory',
    'message_teacher',
  ],
};
const studentSummaries: components['schemas']['StudentMetricSummaryDto'][] = [
  {
    studentId: '00000000-0000-4000-8000-000000000493',
    displayName: 'Ana Sánchez',
    connectedSeconds: 36_000,
    submissionCount: 12,
    messageCount: 27,
    gradedCount: 10,
    ungradedCount: 2,
  },
  {
    studentId: '00000000-0000-4000-8000-000000000494',
    displayName: 'Bruno Díaz',
    connectedSeconds: 5400,
    submissionCount: 3,
    messageCount: 0,
    gradedCount: 1,
    ungradedCount: 2,
  },
];
const classroomURL = `${apiOrigin}/classrooms/${classroomId}`;
// The grades requests carry normalized pagination query params, so exact URL
// strings never match; route by pattern instead.
const routePattern = (pathname: string): RegExp =>
  new RegExp(
    `^https://api\\.example\\.invalid/classrooms/00000000-0000-4000-8000-000000000046/${pathname}(\\?.*)?$`,
  );
const reportCardRoute = routePattern('me/report-card');
const ownMetricsRoute = routePattern('me/activity-metrics');
const classroomMetricsRoute = routePattern('activity-metrics');
const entry = `./classrooms/${classroomId}`;
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 2, name, exact: true });
const diagnostic = 'Private synthetic diagnostic must never render';
const errorBody = (
  code: components['schemas']['ErrorCode'],
): components['schemas']['ErrorEnvelope'] => ({
  error: {
    code,
    message: diagnostic,
    correlationId: 'synthetic-grades-request',
  },
});

const monitorsByPage = new WeakMap<
  Page,
  { cspViolations: string[]; pageErrors: string[] }
>();

// Synthetic credentials enter the real hydration/verification flow, not an auth bypass.
test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const appOrigin = new URL(baseURL!).origin;
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];
  monitorsByPage.set(page, { cspViolations, pageErrors });

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
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === appOrigin) return route.continue();
    // No unmocked external traffic, including unexpected auth/refresh requests.
    if (request.url() === `${apiOrigin}/users/me`) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      return route.fulfill({ json: profile });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/notifications' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (request.url() === `${classroomURL}/context-events`) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      expect(request.headers().accept).toBe('text/event-stream');
      // Hold the synthetic SSE handshake until teardown like the workspace spec.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }
    // The wallet section inside the student grades panel reads the wallet;
    // its request carries pagination query params, so match on the pathname.
    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/points`
    ) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      return route.fulfill({ json: wallet });
    }
    await route.abort();
    throw new Error(
      `Unexpected external request: ${url.origin}${url.pathname}`,
    );
  });
});

test.afterEach(async ({ page }) => {
  const monitors = monitorsByPage.get(page);
  expect(monitors?.cspViolations).toEqual([]);
  expect(monitors?.pageErrors).toEqual([]);
});

test('student grades panel shows the report card, own metrics and wallet from server data', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.route(reportCardRoute, (route) =>
    route.fulfill({
      json: { items: reportCard, page: 1, pageSize: 20, total: 2 },
    }),
  );
  await page.route(ownMetricsRoute, (route) =>
    route.fulfill({
      json: { items: dailyMetrics, page: 1, pageSize: 20, total: 1 },
    }),
  );

  await page.goto(`${entry}/panels/grades`);
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.grades,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', {
      level: 3,
      name: gradesMessages.student.heading,
      exact: true,
    }),
  ).toBeVisible();

  // Report card: server values only — no computed level or client grade.
  const first = reportCard[0];
  await expect(
    dialog.getByRole('heading', {
      level: 4,
      name: first.activityTitle,
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByText('82 / 100', { exact: true })).toBeVisible();
  await expect(dialog.getByText(first.feedback, { exact: true })).toBeVisible();
  // The signed points render inside one span with their label, so match by
  // substring instead of exact text.
  await expect(dialog.getByText('+41')).toBeVisible();
  const second = reportCard[1];
  await expect(
    dialog.getByRole('heading', {
      level: 4,
      name: second.activityTitle,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText(gradesMessages.student.lateBadge, { exact: true }),
  ).toBeVisible();

  // Own participation: UTC calendar day, raw server signals.
  await expect(
    dialog.getByRole('heading', {
      level: 4,
      name: gradesMessages.student.metrics.heading,
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.getByText('18/11/2026', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1 h 15 min', { exact: true })).toBeVisible();

  // Wallet component slot: the read-only wallet panel from #45.
  await expect(
    dialog.getByRole('heading', {
      level: 4,
      name: gradesMessages.student.wallet.heading,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByText(pointsMessages.wallet.panel.balanceValue(wallet.balance), {
      exact: true,
    }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/grades/grades-${width}.png`,
    fullPage: true,
  });

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/classrooms/${classroomId}$`));
  await expect(heading(page, classroom.name)).toBeFocused();
});

test('teacher grades panel shows raw per-student metrics without client aggregation', async ({
  page,
}) => {
  await page.route(classroomURL, (route) =>
    route.fulfill({ json: teacherClassroom }),
  );
  await page.route(classroomMetricsRoute, (route) =>
    route.fulfill({
      json: { items: studentSummaries, page: 1, pageSize: 20, total: 2 },
    }),
  );

  await page.goto(`${entry}/panels/grades`);
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.grades,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', {
      level: 3,
      name: gradesMessages.teacher.heading,
      exact: true,
    }),
  ).toBeVisible();

  for (const summary of studentSummaries) {
    await expect(
      dialog.getByRole('rowheader', { name: summary.displayName, exact: true }),
    ).toBeVisible();
  }
  await expect(dialog.getByText('10 h 0 min', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1 h 30 min', { exact: true })).toBeVisible();

  // The contract exposes no sort or filter parameters, so none is offered.
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  // No student report card content may leak into the staff view.
  await expect(dialog.getByText('82 / 100', { exact: true })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('foreign classroom answers 404 and the panel never reveals data', async ({
  page,
}) => {
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.route(reportCardRoute, (route) =>
    route.fulfill({ status: 404, json: errorBody('NOT_FOUND') }),
  );
  await page.route(ownMetricsRoute, (route) =>
    route.fulfill({
      json: { items: [], page: 1, pageSize: 20, total: 0 },
    }),
  );

  await page.goto(`${entry}/panels/grades`);
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.grades,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(gradesMessages.student.notFoundTitle, { exact: true }),
  ).toBeVisible();
  // No private data, no server diagnostic, no retry offer for a terminal 404.
  await expect(dialog.getByText('82 / 100', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText(diagnostic, { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole('button', {
      name: gradesMessages.student.retryLabel,
      exact: true,
    }),
  ).toHaveCount(0);
});
