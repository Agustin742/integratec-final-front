import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000141';
const activityId = '00000000-0000-4000-8000-000000005501';

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

const studentCapabilities: components['schemas']['ClassroomContextResponseDto']['capabilities'] =
  ['participate_activities', 'view_metrics'];

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
    (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: '',
      }),
  );

  return { cspViolations, pageErrors };
}

test('student views activities inbox in school timeZone, captures responsive views, and opens activity detail', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  const summary: components['schemas']['ActivitySummaryDto'] = {
    id: activityId,
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Sistemas de ecuaciones',
    description: 'Resolver los cinco problemas y adjuntar el PDF.',
    opensAt: null,
    dueAt: '2026-11-25T23:59:00.000Z',
    allowLate: false,
    maxScore: 100,
    weightMultiplier: 1.5,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
  };

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: {
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
        capabilities: studentCapabilities,
        availablePanels: ['activities'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/activities`,
    (route) =>
      route.fulfill({
        json: { items: [summary], page: 1, pageSize: 10, total: 1 },
      }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/activities?**`,
    (route) =>
      route.fulfill({
        json: { items: [summary], page: 1, pageSize: 10, total: 1 },
      }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/activities/${activityId}`,
    (route) =>
      route.fulfill({
        json: {
          ...summary,
          questions: [],
        } satisfies components['schemas']['StudentActivityResponseDto'],
      }),
  );

  await page.goto(`./classrooms/${classroomId}/panels/activities`);
  const dialog = page.getByRole('dialog', { name: 'Actividades', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'TP 1: Sistemas de ecuaciones' }),
  ).toBeVisible();
  await expect(
    dialog.getByText(/\(America\/Argentina\/Buenos_Aires\)/),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await dialog.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/assets/classrooms/activities-inbox-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  await dialog.getByRole('link', { name: 'Ver actividad' }).click();
  await expect(
    page.getByRole('heading', { name: 'TP 1: Sistemas de ecuaciones' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Entrega' }).click();
  await expect(page.getByText(/HU-ACT-003/)).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
