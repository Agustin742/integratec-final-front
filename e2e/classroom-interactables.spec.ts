import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const classroomId = '00000000-0000-4000-8000-000000000038';
const classroomURL = `${apiOrigin}/classrooms/${classroomId}`;

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

const classroom: components['schemas']['ClassroomContextResponseDto'] = {
  id: classroomId,
  name: '3° Año B - Matemática',
  subject: 'Matemática y Geometría',
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  tutorBotSkin: 'none',
  myRole: 'STUDENT',
  capabilities: ['participate_activities', 'view_metrics'],
  availablePanels: [
    'activities',
    'material',
    'grades',
    'notices',
    'shop',
    'bot',
    'members',
  ],
  deskCount: 12,
  pet: {
    id: '00000000-0000-4000-8000-000000000701',
    name: 'Michi',
    species: 'cat',
    level: 2,
    experience: 40,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const desksPayload: components['schemas']['ClassroomDeskMapDto'] = {
  items: Array.from({ length: 12 }, (_, idx) => {
    const deskIndex = idx + 1;
    const isMine = deskIndex === 1;
    return {
      id: `00000000-0000-4000-8000-00000000d0${String(deskIndex).padStart(2, '0')}`,
      deskIndex,
      membershipId: isMine ? '00000000-0000-4000-8000-00000000m001' : null,
      userId: isMine ? profile.id : null,
      deskDecor: null,
    };
  }),
};

const wallet: components['schemas']['StudentWalletDto'] = {
  classroomId,
  studentId: profile.id,
  balance: 130,
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
};

async function openReadyClassroomStage(page: Page) {
  await page.goto(`./classrooms/${classroomId}`);
  const stageHeading = page.getByRole('heading', {
    level: 3,
    name: classroomMessages.viewMode.stage3dHeading,
  });
  await expect(stageHeading).toBeVisible();

  const region = page.getByRole('region', {
    name: classroomMessages.viewMode.canvasLabel,
  });
  await region.scrollIntoViewIfNeeded();
  await expect(region).toHaveAttribute('aria-busy', 'false');

  const canvas = region.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const gl = element.getContext('webgl2');
        return !!gl && !gl.isContextLost() && gl.drawingBufferWidth > 0;
      }),
    )
    .toBe(true);

  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await canvas.scrollIntoViewIfNeeded();

  return { stageHeading, region, canvas };
}

async function dismissLowFpsOfferIfPresent(page: Page) {
  const declineLowFps = page.getByRole('button', {
    name: classroomMessages.performanceOffer.decline,
  });
  const offerAppeared = await declineLowFps
    .waitFor({ state: 'visible', timeout: 2500 })
    .then(() => true)
    .catch(() => false);
  if (offerAppeared) {
    await declineLowFps.click();
    await expect(declineLowFps).toHaveCount(0);
  }
}

async function waitSimulatedSeconds(page: Page, targetSeconds: number) {
  await page.evaluate(
    (seconds) =>
      new Promise<void>((resolve) => {
        let accumulated = 0;
        let last = performance.now();
        function step(now: number) {
          const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
          last = now;
          accumulated += dt;
          if (accumulated >= seconds) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }),
    targetSeconds,
  );
}

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

    if (request.url() === `${apiOrigin}/users/me`) {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === '/users/me/daily-review') {
      return route.fulfill({ json: { status: 'not_due' } });
    }
    if (url.pathname === '/chats' && request.method() === 'GET') {
      return route.fulfill({ json: { items: [] } });
    }
    if (url.pathname === '/notifications' && request.method() === 'GET') {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (request.url() === classroomURL && request.method() === 'GET') {
      return route.fulfill({ json: classroom });
    }
    if (request.url() === `${classroomURL}/context-events`) {
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }
    if (
      url.pathname === `/classrooms/${classroomId}/desks` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: desksPayload });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/points` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: wallet });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/activities` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/announcements` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/shop/items` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 12, total: 0 },
      });
    }
    if (
      (url.pathname === `/classrooms/${classroomId}/me/report-card` ||
        url.pathname === `/classrooms/${classroomId}/me/activity-metrics`) &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }

    if (
      url.origin === 'https://realtime.example.invalid' ||
      url.pathname.startsWith('/matchmake/')
    ) {
      return route.abort();
    }

    await route.abort();
    throw new Error(
      `Unexpected external request: ${url.origin}${url.pathname}`,
    );
  });
});

test('opens panels from the floating HUD buttons, triggers proximity prompt with KeyE, and captures responsive evidence', async ({
  page,
}, testInfo) => {
  test.setTimeout(30_000);
  const isMobile = testInfo.project.name === 'mobile';
  const width = isMobile ? 360 : 1280;
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
  const { stageHeading, canvas } = await openReadyClassroomStage(page);

  await expect(
    page.getByRole('button', { name: 'Calificaciones' }),
  ).toBeVisible();

  await dismissLowFpsOfferIfPresent(page);
  await canvas.scrollIntoViewIfNeeded();

  // The follow camera keeps only a third of the room in view, so panels open
  // from the standalone HUD buttons; the world objects are no longer clickable
  // from the spawn point.
  const activitiesButton = page.getByRole('button', {
    name: classroomMessages.panels.activities,
    exact: true,
  });
  await activitiesButton.click();
  const activitiesDialog = page.getByRole('dialog', {
    name: classroomMessages.panels.activities,
    exact: true,
  });
  await expect(activitiesDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(activitiesDialog).toHaveCount(0);
  await expect(activitiesButton).toBeFocused();

  // Keyboard navigation on the floating panel groups opens a panel and restores focus to that button.
  const shopChip = page.getByRole('button', { name: 'Tienda' });
  await shopChip.focus();
  await expect(shopChip).toBeFocused();
  await expect(page.getByTestId('classroom-active-target')).toHaveCount(0);
  await page.keyboard.press('Enter');

  const shopDialog = page.getByRole('dialog', {
    name: classroomMessages.panels.shop,
    exact: true,
  });
  await expect(shopDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shopDialog).toHaveCount(0);
  await expect(shopChip).toBeFocused();

  // Walk slightly left from spawn (-6, 5) toward the bulletin board (-7.84, 4.2)
  // to reveal the #128 proximity prompt, open it with KeyE, and restore focus on Escape.
  await page.keyboard.down('KeyA');
  await page.keyboard.down('KeyW');
  const proximityPrompt = page.getByTestId('classroom-proximity-prompt');
  try {
    await expect(proximityPrompt).toBeVisible();
  } finally {
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyW');
  }
  await expect(proximityPrompt).toContainText('Abrir avisos');
  await expect(page.getByTestId('classroom-proximity-status')).toHaveText(
    classroomMessages.proximity.announce('Abrir avisos'),
  );
  const promptBox = await proximityPrompt.boundingBox();
  expect(promptBox).not.toBeNull();
  expect(promptBox!.x).toBeGreaterThanOrEqual(0);
  expect(promptBox!.x + promptBox!.width).toBeLessThanOrEqual(width);

  await page.keyboard.press('KeyE');
  const noticesDialog = page.getByRole('dialog', {
    name: classroomMessages.panels.notices,
    exact: true,
  });
  await expect(noticesDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(noticesDialog).toHaveCount(0);
  await expect(stageHeading).toBeFocused();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const devStats = page.getByTestId('dev-performance-stats');
  if ((await devStats.count()) > 0) {
    await devStats.evaluate((el) => {
      el.style.visibility = 'hidden';
    });
  }

  const declineLowFps = page.getByRole('button', {
    name: classroomMessages.performanceOffer.decline,
  });
  if (await declineLowFps.isVisible().catch(() => false)) {
    await declineLowFps.click();
    await expect(declineLowFps).toHaveCount(0);
  }

  await page.screenshot({
    path: `docs/assets/classroom-workspace/interactables-${width}.png`,
    fullPage: true,
  });

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('greets the decorative pet Michi via proximity KeyE without opening a dialog and auto-dismisses the greeting', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
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
  const { canvas } = await openReadyClassroomStage(page);
  await dismissLowFpsOfferIfPresent(page);
  await canvas.scrollIntoViewIfNeeded();

  // Walk along the clear back aisle (+x) to the right wall, then straight up (-z) to Michi at (7, -5.86).
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyS');
  try {
    await waitSimulatedSeconds(page, 4.7);
  } finally {
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyS');
  }

  const petPrompt = page.getByRole('button', { name: /Saludar a Michi/ });
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  try {
    await expect(petPrompt).toBeVisible({ timeout: 15_000 });
  } finally {
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
  }

  await expect(petPrompt).toBeVisible();
  await expect(page.getByTestId('classroom-proximity-status')).toHaveText(
    classroomMessages.proximity.announce('Saludar a Michi'),
  );
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const status = page.getByTestId('classroom-interactable-status');
  await expect(status).toHaveText('Michi te saluda desde su rincón.');
  await expect(status).toBeEmpty({ timeout: 6_000 });

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
