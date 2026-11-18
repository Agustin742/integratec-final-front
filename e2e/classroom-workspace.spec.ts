import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { messages } from '../src/app/messages';
import { feedbackMessages } from '../src/components/feedback/messages';
import { layoutMessages } from '../src/components/layout/messages';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const classroomId = '00000000-0000-4000-8000-000000000026';
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
  capabilities: [],
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
const classroomURL = `${apiOrigin}/classrooms/${classroomId}`;
const entry = `./classrooms/${classroomId}`;
const heading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 2, name, exact: true });
const roleText = `${classroomMessages.role}: ${classroomMessages.roles.STUDENT}`;
const diagnostic = 'Private synthetic diagnostic must never render';
const errorBody = (
  code: components['schemas']['ErrorCode'],
): components['schemas']['ErrorEnvelope'] => ({
  error: {
    code,
    message: diagnostic,
    correlationId: 'synthetic-classroom-request',
  },
});

// Synthetic credentials enter the real hydration/verification flow, not an auth bypass.
test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL).toBeTruthy();
  const appOrigin = new URL(baseURL!).origin;
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
      // Hold the synthetic SSE handshake until teardown. These REST-shell tests
      // do not emit hints/EOF that would reset their deliberately gated reads.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }
    await route.abort();
    throw new Error(
      `Unexpected external request: ${url.origin}${url.pathname}`,
    );
  });
});

test('loads server context only after confirmation', async ({ page }) => {
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(classroomURL, async (route) => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers().authorization).toBe(
      'Bearer synthetic-access',
    );
    await responseGate;
    await route.fulfill({ json: classroom });
  });
  try {
    await page.goto(entry);
    await expect(page.getByRole('status')).toHaveText(
      classroomMessages.loading,
    );
    await expect(heading(page, classroom.name)).toHaveCount(0);
    await expect(
      page.getByText(classroomMessages.role, { exact: false }),
    ).toHaveCount(0);
    release();
    await expect(heading(page, classroom.name)).toBeVisible();
    await expect(page.getByText(roleText, { exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page).toHaveTitle(`${classroom.name} · ${messages.title}`);
  } finally {
    release();
  }
});

test('wraps long names and preserves keyboard skip/focus', async ({ page }) => {
  const name = `Aula ${'NombreLargoSinSeparadores'.repeat(12)}`;
  await page.route(classroomURL, (route) =>
    route.fulfill({ json: { ...classroom, name } }),
  );
  await page.goto(entry);
  await expect(heading(page, name)).toBeVisible();
  await expect(page.locator('body')).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', {
    name: layoutMessages.skipToContent,
    exact: true,
  });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

for (const status of [403, 404]) {
  test(`hides classroom existence on ${status}`, async ({ page }) => {
    await page.route(classroomURL, (route) =>
      route.fulfill({
        status,
        json: errorBody(status === 403 ? 'FORBIDDEN' : 'NOT_FOUND'),
      }),
    );
    await page.goto(entry);
    await expect(heading(page, messages.pages.notFound.title)).toBeVisible();
    await expect(
      page.getByText(messages.pages.notFound.description, { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveTitle(
      `${messages.pages.notFound.title} · ${messages.title}`,
    );
    await expect(
      page.getByText(classroomMessages.role, { exact: false }),
    ).toHaveCount(0);
    await expect(page.getByText(classroom.name, { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(diagnostic, { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: feedbackMessages.retry, exact: true }),
    ).toHaveCount(0);
  });
}

test('default panel entry traps focus, closes to its classroom and fits the viewport', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.goto(`${entry}/panels/grades`);
  const dialog = page.getByRole('dialog', {
    name: 'Calificaciones',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Funcionalidad pendiente', { exact: true }),
  ).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Cerrar', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/assets/classroom-panels/entry-${width}.png`,
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
  // Zoom can require scrolling within the existing bounded dialog.
  await close.scrollIntoViewIfNeeded();
  await expect(close).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/classrooms/${classroomId}$`));
  await expect(heading(page, classroom.name)).toBeFocused();
});

for (const key of ['settings', 'pet', 'unknown']) {
  test(`default catalog denies unavailable or reserved ${key}`, async ({
    page,
  }) => {
    await page.route(classroomURL, (route) =>
      route.fulfill({
        json: {
          ...classroom,
          availablePanels: [...classroom.availablePanels, 'pet'],
        },
      }),
    );
    await page.goto(`${entry}/panels/${key}`);
    await expect(heading(page, messages.pages.notFound.title)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByText('Funcionalidad pendiente', { exact: true }),
    ).toHaveCount(0);
  });
}

test('recovers through the actual retry control', async ({ page }) => {
  let requests = 0;
  await page.route(classroomURL, (route) => {
    requests += 1;
    // HTTP 500 is not automatically retried by the app query policy.
    return requests === 1
      ? route.fulfill({
          status: 500,
          json: errorBody('INTERNAL_ERROR'),
        })
      : route.fulfill({ json: classroom });
  });
  await page.goto(entry);
  await expect(heading(page, classroomMessages.errorTitle)).toBeVisible();
  await expect(
    page.getByText(classroomMessages.errorDescription, { exact: true }),
  ).toBeVisible();
  await expect(heading(page, classroom.name)).toHaveCount(0);
  expect(requests).toBe(1);
  await page
    .getByRole('button', { name: feedbackMessages.retry, exact: true })
    .click();
  await expect(heading(page, classroom.name)).toBeVisible();
  await expect(heading(page, classroomMessages.errorTitle)).toHaveCount(0);
  expect(requests).toBe(2);
});

test('switches 3D to accessible 2D Classic Mode via button and Alt+M, opens panel without canvas, and passes responsive/zoom checks', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (
      msg.type() === 'error' &&
      /Content Security Policy|CSP/i.test(msg.text())
    ) {
      cspViolations.push(msg.text());
    }
  });

  await page.setViewportSize({ width, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));

  await page.goto(entry);
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.stage3dHeading,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: classroomMessages.viewMode.canvasLabel }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: classroomMessages.viewMode.switchTo2d })
    .click();

  const mode2dHeading = page.getByRole('heading', {
    level: 3,
    name: classroomMessages.viewMode.mode2dHeading,
  });
  await expect(mode2dHeading).toBeVisible();
  await expect(mode2dHeading).toBeFocused();
  await expect(page.locator('canvas')).toHaveCount(0);

  const nav = page.getByRole('navigation', {
    name: classroomMessages.viewMode.mode2dNavLabel,
  });
  await expect(nav).toBeVisible();
  const gradesBtn = nav.getByRole('button', { name: /Calificaciones/ });
  await expect(gradesBtn).toBeVisible();
  await expect(nav.getByRole('button', { name: /Actividades/ })).toBeVisible();
  await expect(nav.getByRole('button', { name: /Configuración/ })).toHaveCount(
    0,
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/classroom-workspace/mode-2d-${width}.png`,
    fullPage: true,
  });

  await gradesBtn.click();
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.grades,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(classroomMessages.pendingPanelTitle, { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(gradesBtn).toBeFocused();

  await page.keyboard.press('Alt+m');
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.stage3dHeading,
    }),
  ).toBeFocused();

  await page.keyboard.press('Alt+m');
  await expect(mode2dHeading).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await gradesBtn.scrollIntoViewIfNeeded();
  await expect(gradesBtn).toBeInViewport();
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('never offers 3D stage or 2D Classic Mode switch to PARENT accounts', async ({
  page,
}) => {
  await page.route(classroomURL, (route) =>
    route.fulfill({
      json: {
        ...classroom,
        myRole: 'PARENT',
        capabilities: ['message_teacher'],
        availablePanels: ['grades', 'notices'],
      },
    }),
  );

  await page.goto(entry);
  await expect(heading(page, classroom.name)).toBeVisible();
  await expect(
    page.getByText(
      `${classroomMessages.role}: ${classroomMessages.roles.PARENT}`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: classroomMessages.viewMode.switchTo2d }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', {
      name: classroomMessages.viewMode.mode2dNavLabel,
    }),
  ).toHaveCount(0);

  await page.keyboard.press('Alt+m');
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    }),
  ).toHaveCount(0);
});
