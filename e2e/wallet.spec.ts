import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { classroomMessages } from '../src/features/classrooms/messages';
import { pointsMessages } from '../src/features/points/messages';

const apiOrigin = 'https://api.example.invalid';
const classroomId = '00000000-0000-4000-8000-000000000045';
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
const wallet: components['schemas']['StudentWalletDto'] = {
  classroomId,
  studentId: '00000000-0000-4000-8000-000000000046',
  balance: 130,
  items: [
    {
      id: '00000000-0000-4000-8000-000000000451',
      entryKind: 'EARNING',
      amount: 50,
      sourceType: 'submission_grade',
      sourceId: '00000000-0000-4000-8000-000000000452',
      reason: 'Activity graded: Fractions Quiz',
      actorId: '00000000-0000-4000-8000-000000000453',
      createdAt: '2026-11-10T12:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000454',
      entryKind: 'DEBIT',
      amount: -20,
      sourceType: 'shop_purchase',
      sourceId: '00000000-0000-4000-8000-000000000455',
      reason: 'Shop purchase: Blue Classroom Cap',
      actorId: null,
      createdAt: '2026-11-12T15:30:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000000456',
      entryKind: 'COMPENSATION',
      amount: 5,
      sourceType: 'grade_revision',
      sourceId: '00000000-0000-4000-8000-000000000457',
      reason: 'Regrade adjustment: Fractions Quiz',
      actorId: '00000000-0000-4000-8000-000000000453',
      createdAt: '2026-11-14T09:00:00.000Z',
    },
  ],
  page: 1,
  pageSize: 20,
  total: 3,
};
const classroomURL = `${apiOrigin}/classrooms/${classroomId}`;
// The wallet request carries normalized pagination query params, so an exact
// URL string never matches; route by pattern instead.
const walletRoute =
  /^https:\/\/api\.example\.invalid\/classrooms\/00000000-0000-4000-8000-000000000045\/points(\?.*)?$/;
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
    correlationId: 'synthetic-wallet-request',
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
    if (request.url() === `${classroomURL}/context-events`) {
      expect(request.method()).toBe('GET');
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      expect(request.headers().accept).toBe('text/event-stream');
      // Hold the synthetic SSE handshake until teardown like the workspace spec.
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
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

test('student wallet opens from the workspace header and closes to its trigger', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.route(walletRoute, (route) => route.fulfill({ json: wallet }));

  await page.goto(entry);
  await expect(heading(page, classroom.name)).toBeVisible();
  await expect(page.getByText(roleText, { exact: true })).toBeVisible();

  const indicator = pointsMessages.wallet.indicator;
  const trigger = page.getByRole('button', {
    name: indicator.accessibleName(indicator.ready(wallet.balance)),
    exact: true,
  });
  await expect(trigger).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: pointsMessages.wallet.panel.title,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(pointsMessages.wallet.panel.balanceValue(wallet.balance)),
  ).toBeVisible();
  for (const movement of wallet.items) {
    await expect(
      dialog.getByText(movement.reason, { exact: true }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/wallet/wallet-${width}.png`,
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
  await expect(trigger).toBeFocused();
});

test('wallet failure shows unavailable, never a zero balance', async ({
  page,
}) => {
  await page.route(classroomURL, (route) => route.fulfill({ json: classroom }));
  await page.route(walletRoute, (route) =>
    route.fulfill({ status: 403, json: errorBody('FORBIDDEN') }),
  );

  await page.goto(entry);
  const indicator = pointsMessages.wallet.indicator;
  await expect(
    page.getByRole('button', {
      name: indicator.accessibleName(indicator.unavailable),
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('0 puntos', { exact: true })).toHaveCount(0);
  await expect(page.getByText(diagnostic)).toHaveCount(0);
});
