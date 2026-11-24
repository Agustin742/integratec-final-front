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

test('opens panels from the floating HUD buttons, and captures responsive evidence', async ({
  page,
}, testInfo) => {
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
  const { canvas } = await openReadyClassroomStage(page);

  await expect(
    page.getByRole('button', { name: 'Calificaciones' }),
  ).toBeVisible();

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
