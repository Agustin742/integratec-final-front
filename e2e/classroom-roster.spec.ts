import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000033';

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const classroomContext: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: '3.º Año B - Física',
  subject: 'Mecánica clásica',
  schoolId: null,
  independentTeacherId: userId,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  tutorBotSkin: 'none',
  myRole: 'TEACHER',
  capabilities: ['configure_classroom', 'invite_members'],
  availablePanels: ['activities', 'members'],
  deskCount: 12,
  pet: null,
  createdAt: '2026-11-17T21:00:00.000Z',
  updatedAt: '2026-11-17T21:00:00.000Z',
};

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

test('teacher inspects roster, filters, removes a student logically, and passes responsive/zoom checks', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  let students: components['schemas']['RosterStudentDto'][] = [
    {
      membershipId: '11111111-1111-4111-8111-111111111101',
      userId: '22222222-2222-4222-8222-222222222201',
      displayName: 'Ana Álvarez',
      state: 'ACTIVE',
      deletedAt: null,
      guardians: [
        {
          id: '33333333-3333-4333-8333-333333333301',
          displayName: 'Laura Álvarez',
          state: 'ACTIVE',
        },
      ],
    },
    {
      membershipId: '11111111-1111-4111-8111-111111111102',
      userId: '22222222-2222-4222-8222-222222222202',
      displayName: 'Bruno Benítez',
      state: 'ACTIVE',
      deletedAt: null,
      guardians: [],
    },
  ];

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
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: classroomContext });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/roster` &&
      request.method() === 'GET'
    ) {
      const state = url.searchParams.get('state');
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const filtered = students
        .filter((s) =>
          state === 'ACTIVE' || state === 'INACTIVE' ? s.state === state : true,
        )
        .filter((s) =>
          q === '' ? true : s.displayName.toLowerCase().startsWith(q),
        );
      return route.fulfill({
        json: {
          items: filtered,
          page: 1,
          pageSize: 20,
          total: filtered.length,
        },
      });
    }
    if (
      url.pathname ===
        `/classrooms/${classroomId}/students/22222222-2222-4222-8222-222222222201` &&
      request.method() === 'DELETE'
    ) {
      students = students.map((student) =>
        student.userId === '22222222-2222-4222-8222-222222222201'
          ? {
              ...student,
              state: 'INACTIVE',
              deletedAt: '2026-11-18T15:00:00.000Z',
              guardians: student.guardians.map((g) => ({
                ...g,
                state: 'INACTIVE',
              })),
            }
          : student,
      );
      return route.fulfill({ status: 204 });
    }

    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(`./classrooms/${classroomId}/panels/members`);

  const copy = classroomMessages.roster;
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.members,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Ana Álvarez', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('Laura Álvarez', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('Bruno Benítez', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(copy.guardiansEmpty, { exact: true }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/classrooms/roster-${width}.png`,
    fullPage: true,
  });

  await dialog.getByLabel(copy.searchLabel).fill('Ana');
  await expect(dialog.getByText('Ana Álvarez', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Bruno Benítez')).toHaveCount(0);
  await dialog.getByRole('button', { name: copy.searchClearAction }).click();
  await expect(
    dialog.getByText('Bruno Benítez', { exact: true }),
  ).toBeVisible();

  await dialog
    .getByRole('button', { name: copy.actionsAriaLabel('Ana Álvarez') })
    .click();
  await page.getByRole('menuitem', { name: copy.removeAction }).click();

  const confirmRegion = dialog.getByRole('region', {
    name: copy.confirmTitle('Ana Álvarez'),
  });
  await expect(confirmRegion).toBeVisible();
  await expect(confirmRegion).toContainText('historial académico');

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const confirmButton = confirmRegion.getByRole('button', {
    name: copy.confirmSubmit,
    exact: true,
  });
  await confirmButton.scrollIntoViewIfNeeded();
  await expect(confirmButton).toBeInViewport();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1';
  });

  await confirmButton.click();

  await expect(
    dialog.getByText(copy.states.INACTIVE, { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText(copy.guardianStates.INACTIVE, { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: copy.actionsAriaLabel('Ana Álvarez') }),
  ).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/classrooms/${classroomId}$`));

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('non-staff sees forbidden error on /panels/members without member data', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

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
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({
        json: {
          ...classroomContext,
          myRole: 'STUDENT',
          capabilities: ['view_metrics'],
        },
      });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (url.pathname === `/classrooms/${classroomId}/roster`) {
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: 'FORBIDDEN',
            message: 'Student role secret diagnostic',
            correlationId: 'corr-e2e-403',
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(`./classrooms/${classroomId}/panels/members`);

  const copy = classroomMessages.roster;
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.members,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(copy.forbiddenTitle)).toBeVisible();
  await expect(dialog.getByText('Student role secret')).toHaveCount(0);
  await expect(dialog.getByText('Ana Álvarez')).toHaveCount(0);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
