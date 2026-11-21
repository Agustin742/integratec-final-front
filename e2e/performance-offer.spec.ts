import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { messages } from '../src/app/messages';
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
const walletPathname = `/classrooms/${classroomId}/points`;
const wallet: components['schemas']['StudentWalletDto'] = {
  classroomId,
  studentId: '00000000-0000-4000-8000-000000000046',
  balance: 130,
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
};
const entry = `./classrooms/${classroomId}`;
const diagnostic = 'Private synthetic diagnostic must never render';

// Synthetic credentials enter the real hydration/verification flow, not an
// auth bypass. Same harness shape as `classroom-workspace.spec.ts`.
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
    if (url.origin === apiOrigin && url.pathname === '/users/me/daily-review') {
      return route.fulfill({ json: { status: 'not_due' } });
    }
    // The shell's chat dock and nav link read the chat inbox (#51).
    if (
      url.origin === apiOrigin &&
      url.pathname === '/chats' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
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
      // Hold the synthetic SSE handshake until teardown. These REST-shell
      // tests do not emit hints/EOF that would reset their gated reads.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }
    // The student workspace header reads the points wallet (#45); its
    // request carries pagination query params, so match on the pathname.
    if (url.origin === apiOrigin && url.pathname === walletPathname) {
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

const stage3d = (page: Page) =>
  page.getByRole('heading', {
    level: 3,
    name: classroomMessages.viewMode.stage3dHeading,
  });
const offerBanner = (page: Page) => page.getByTestId('performance-offer');
const devStats = (page: Page) => page.getByTestId('dev-performance-stats');

/** Full dev overlay text; `null` until the lazy 3D chunk has mounted it. */
async function devStatsText(page: Page): Promise<string | null> {
  if ((await devStats(page).count()) === 0) return null;
  return (await devStats(page).textContent()) ?? null;
}

/** Mean fps published by the dev overlay, or 0 while no frames flow. */
async function measuredFps(page: Page): Promise<number> {
  const text = await devStatsText(page);
  const match = text?.match(/fps (\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Real frame source for the classroom 3D stage (#56). The stage scene holds
 * no continuously animating content and R3F runs with `frameloop="demand"`,
 * so nothing renders by itself between interactions. The app's own re-frame-on-resize path
 * (`CameraFraming` in `world-canvas.tsx` -> `invalidate()`) renders one real
 * frame per viewport resize, and the probe samples every rendered frame, so
 * alternating the viewport size drives a sustained, controlled-low cadence
 * that the sampler measures like any other rendered stream.
 */
async function driveRenderedFramesUntil(
  page: Page,
  base: { width: number; height: number },
  offered: () => Promise<boolean>,
  maxMs: number,
): Promise<void> {
  const deadline = Date.now() + maxMs;
  let toggle = false;
  while (Date.now() < deadline && !(await offered())) {
    toggle = !toggle;
    await page.setViewportSize({
      width: base.width + (toggle ? 4 : 0),
      height: base.height + (toggle ? 4 : 0),
    });
  }
}

async function openThrottled3DClassroom(
  page: Page,
  width: number,
): Promise<{ detach: () => Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  // Throttle before navigation so the whole window (bundle evaluation, mount
  // and every resize-driven frame) runs on the slow device profile.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  const detach = async () => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  };
  await page.setViewportSize({ width, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  // The throttled bundle evaluation and mount need more than the default
  // navigation/expect budgets.
  await page.goto(entry, { timeout: 60_000 });
  await expect(stage3d(page)).toBeVisible({ timeout: 45_000 });
  await expect(
    page.getByRole('region', {
      name: classroomMessages.viewMode.canvasLabel,
    }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveTitle(`${classroom.name} · ${messages.title}`);
  return { detach };
}

test('offers 2D Classic Mode under sustained low fps and keeps the 3D stage when declined', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
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

  const throttled = await openThrottled3DClassroom(page, width);
  try {
    // A static demand scene records no frames at all, so warm the sampler
    // with resize-driven frames first and confirm the overlay is measuring a
    // real rendered cadence before the offer window is judged.
    await driveRenderedFramesUntil(
      page,
      { width, height: 800 },
      async () => (await measuredFps(page)) > 0,
      30_000,
    );
    await expect
      .poll(() => measuredFps(page), { timeout: 10_000 })
      .toBeGreaterThan(0);

    await driveRenderedFramesUntil(
      page,
      { width, height: 800 },
      () => offerBanner(page).isVisible(),
      45_000,
    );
    const banner = offerBanner(page);
    await expect(banner).toBeVisible({ timeout: 45_000 });
    await expect(banner).toHaveAttribute('role', 'status');

    // The app never switches modes by itself: the 3D stage is still on screen.
    await expect(stage3d(page)).toBeVisible();
    // The runtime publishes stats per rendered frame, so flush the sustained
    // flag into the overlay with a couple of extra resize frames before the
    // throttled reference-scene reading is recorded with the run output.
    await page.setViewportSize({ width: width + 4, height: 804 });
    await page.setViewportSize({ width, height: 800 });
    await expect
      .poll(
        async () =>
          (await devStatsText(page))?.includes('sustained low') ?? false,
        { timeout: 10_000 },
      )
      .toBe(true);
    const throttledReading = await devStatsText(page);
    expect(throttledReading?.includes('sustained low')).toBe(true);
    const throttledFps = await measuredFps(page);
    expect(throttledFps).toBeGreaterThan(0);
    expect(throttledFps).toBeLessThan(24);
    testInfo.attach('throttled-reference-scene-overlay', {
      body: `${throttledReading}\n`,
      contentType: 'text/plain',
    });
    console.log(
      `[performance-offer] throttled (20x) desktop-class reading: ${throttledReading}`,
    );

    // Evidence: the banner visible on the unthrottled-size viewport, before
    // any choice is made.
    await page.setViewportSize({ width, height: 800 });
    // The dev-only overlay is pointer-events-none but would cover the offer
    // actions in the evidence capture; its reading is attached above.
    await devStats(page).evaluate((el) => {
      el.style.visibility = 'hidden';
    });
    await page.screenshot({
      path: `docs/assets/classroom-workspace/performance-offer-${width}.png`,
      fullPage: true,
    });

    await banner
      .getByRole('button', {
        name: classroomMessages.performanceOffer.decline,
        exact: true,
      })
      .click();
    await expect(banner).toHaveCount(0);
    await expect(stage3d(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(cspViolations).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await throttled.detach();
  }
});

test('accepting the sustained-low-fps offer switches to 2D Classic Mode', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
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

  const throttled = await openThrottled3DClassroom(page, width);
  try {
    // A static demand scene records no frames at all: warm the sampler with
    // resize-driven frames first, then drive until the offer appears.
    await driveRenderedFramesUntil(
      page,
      { width, height: 800 },
      async () => (await measuredFps(page)) > 0,
      30_000,
    );
    await expect
      .poll(() => measuredFps(page), { timeout: 10_000 })
      .toBeGreaterThan(0);
    await driveRenderedFramesUntil(
      page,
      { width, height: 800 },
      () => offerBanner(page).isVisible(),
      45_000,
    );
    const banner = offerBanner(page);
    await expect(banner).toBeVisible({ timeout: 45_000 });
    await expect(stage3d(page)).toBeVisible();

    // Accepting calls the HU-ESP-003 mode action chosen by the host
    // workspace, so the canvas is replaced by the 2D Classic Mode layout.
    await banner
      .getByRole('button', {
        name: classroomMessages.performanceOffer.accept,
        exact: true,
      })
      .click();
    const mode2dHeading = page.getByRole('heading', {
      level: 3,
      name: classroomMessages.viewMode.mode2dHeading,
    });
    await expect(mode2dHeading).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(cspViolations).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    await throttled.detach();
  }
});

test('records the reference-scene dev overlay reading without throttling', async ({
  page,
}, testInfo) => {
  // Issue #56 asks for measured numbers, not just assertions; the desktop
  // project records them for the docs guide.
  test.skip(
    testInfo.project.name !== 'desktop',
    'reference-scene measurements are recorded on the desktop project only',
  );
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.goto(entry);
  await expect(stage3d(page)).toBeVisible();
  await expect(
    page.getByRole('region', {
      name: classroomMessages.viewMode.canvasLabel,
    }),
  ).toBeVisible();

  // Drive the same resize frame source for ~10 s without CPU throttling and
  // read the full published overlay text.
  await driveRenderedFramesUntil(
    page,
    { width: 1280, height: 800 },
    async () => false,
    10_000,
  );
  const unthrottledReading = await devStatsText(page);
  expect(unthrottledReading).not.toBeNull();
  const unthrottledFps = await measuredFps(page);
  expect(unthrottledFps).toBeGreaterThan(0);
  testInfo.attach('unthrottled-reference-scene-overlay', {
    body: `${unthrottledReading}\n`,
    contentType: 'text/plain',
  });
  console.log(
    `[performance-offer] unthrottled reference-scene reading: ${unthrottledReading}`,
  );
  // The diagnostic must never leak into any test's rendered output.
  expect(await page.getByText(diagnostic, { exact: true }).count()).toBe(0);
});
