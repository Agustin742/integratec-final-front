import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { authMessages } from '../src/features/auth/messages';
import { joinMessages } from '../src/features/classrooms/join-messages';

const API_ORIGIN = 'https://api.example.invalid';
const CLASSROOM_ID = 'classroom-demo-1';
const TEST_ACCESS_TOKEN = 'e2e-student-access-token';
const TEST_REFRESH_TOKEN = 'e2e-student-refresh-token';

const classroomContext: components['schemas']['ClassroomContextResponseDto'] = {
  id: CLASSROOM_ID,
  name: '3° Año B - Matemática',
  subject: 'Matemática y Geometría',
  schoolId: null,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'STUDENT',
  capabilities: ['participate_activities', 'chat_classmates', 'list_directory'],
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
  deskCount: 12,
  pet: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const studentProfile: components['schemas']['OwnProfileDto'] = {
  id: '00000000-0000-4000-8000-000000000031',
  email: 'estudiante@ejemplo.com',
  displayName: 'Lucía Estudiante',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

async function attachRuntimeMonitors(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
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

async function mockClassroomRoutes(page: Page) {
  await page.route(`${API_ORIGIN}/users/me`, async (route) => {
    const auth = await route.request().headerValue('authorization');
    if (auth !== `Bearer ${TEST_ACCESS_TOKEN}`) {
      await route.fulfill({ status: 401, body: '' });
      return;
    }
    await route.fulfill({ json: studentProfile });
  });

  await page.route(
    `${API_ORIGIN}/classrooms/${CLASSROOM_ID}`,
    async (route) => {
      await route.fulfill({ json: classroomContext });
    },
  );

  await page.route(
    `${API_ORIGIN}/classrooms/${CLASSROOM_ID}/context-events`,
    async () => {
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
    },
  );
}

test('unauthenticated invitation visitor signs in, returns with token scrubbed, and joins classroom', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let capturedAcceptBody: Record<string, unknown> | null = null;

  await page.route(`${API_ORIGIN}/auth/login`, async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        accessToken: TEST_ACCESS_TOKEN,
        refreshToken: TEST_REFRESH_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 900,
      },
    });
  });

  await page.route(`${API_ORIGIN}/invitations/accept`, async (route) => {
    capturedAcceptBody = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      json: {
        classroomId: CLASSROOM_ID,
        membershipId: 'membership-e2e-1',
        role: 'STUDENT',
        desk: { id: 'desk-4', deskIndex: 4 },
        alreadyMember: false,
      },
    });
  });

  await mockClassroomRoutes(page);

  await page.goto('./invitations/accept?token=inv-valid-student-token');
  await expect(
    page.getByRole('heading', { level: 3, name: joinMessages.gate.title }),
  ).toBeVisible();

  await page.getByRole('link', { name: joinMessages.gate.loginCta }).click();
  await expect(page).toHaveURL(
    /\/login\?next=%2Finvitations%2Faccept%3Ftoken%3Dinv-valid-student-token$/,
  );

  await page
    .getByLabel(authMessages.login.fields.email.label)
    .fill('estudiante@ejemplo.com');
  await page
    .getByLabel(authMessages.login.fields.password.label)
    .fill('ClaveSegura123');
  await page
    .getByRole('button', { name: authMessages.login.actions.submit })
    .click();

  await expect(
    page.getByRole('heading', {
      level: 3,
      name: joinMessages.invitation.readyTitle,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/invitations\/accept$/);
  expect(
    await page.evaluate(() => JSON.stringify(history.state)),
  ).not.toContain('inv-valid-student-token');

  await page
    .getByRole('button', { name: joinMessages.invitation.acceptAction })
    .click();

  await expect(
    page.getByRole('heading', { level: 2, name: classroomContext.name }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/classrooms/${CLASSROOM_ID}$`));
  await expect(page.getByTestId('classroom-join-outcome')).toContainText(
    joinMessages.outcome.joinedBody,
  );
  await expect(page.getByTestId('classroom-join-outcome')).toContainText(
    'Pupitre asignado: #4.',
  );
  expect(capturedAcceptBody).toEqual({ token: 'inv-valid-student-token' });
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('authenticated student joins with classroom code and re-joins idempotently across viewports', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });

  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  const capturedCodes: string[] = [];
  let joinedCount = 0;

  await page.addInitScript(
    ({ accessToken, refreshToken }) => {
      const tabOwner = '00000000-0000-4000-8000-000000000088';
      window.name = `\n[integratec-tab:${tabOwner}]`;
      sessionStorage.setItem(
        'integratec.session',
        JSON.stringify({
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          expiresIn: 900,
          expiresAt: Date.now() + 900_000,
          tabOwner,
        }),
      );
    },
    { accessToken: TEST_ACCESS_TOKEN, refreshToken: TEST_REFRESH_TOKEN },
  );

  await mockClassroomRoutes(page);

  await page.route(`${API_ORIGIN}/classrooms/join`, async (route) => {
    const body = route.request().postDataJSON() as { code: string };
    capturedCodes.push(body.code);

    if (body.code === 'FULLCODE') {
      await route.fulfill({
        status: 409,
        json: {
          error: {
            code: 'CONFLICT',
            message: 'Join code limit reached',
            correlationId: 'e2e-join-409',
          },
        },
      });
      return;
    }

    joinedCount += 1;
    await route.fulfill({
      status: 201,
      json: {
        classroomId: CLASSROOM_ID,
        membershipId: 'membership-e2e-code-1',
        role: 'STUDENT',
        desk: { id: 'desk-4', deskIndex: 4 },
        alreadyMember: joinedCount > 1,
      },
    });
  });

  await page.goto('./invitations/accept');
  const codeInput = page.getByLabel(joinMessages.code.fieldLabel);
  await expect(codeInput).toBeVisible();
  await expect(page.getByLabel(/rol/i)).toHaveCount(0);

  const submitButton = page.getByRole('button', {
    name: joinMessages.code.submitAction,
  });
  const submitBox = await submitButton.boundingBox();
  expect(submitBox?.height).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/classrooms/join-classroom-${width}.png`,
    fullPage: true,
  });

  await codeInput.fill('FULLCODE');
  await submitButton.click();
  await expect(page.getByRole('alert')).toContainText(
    joinMessages.errors.codeExhaustedOrConflict,
  );
  await expect(codeInput).toHaveValue('FULLCODE');

  await codeInput.fill('  k7p9x2m  ');
  await submitButton.click();

  await expect(
    page.getByRole('heading', { level: 2, name: classroomContext.name }),
  ).toBeVisible();
  await expect(page.getByTestId('classroom-join-outcome')).toContainText(
    joinMessages.outcome.joinedBody,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => sessionStorage.getItem('integratec.session')),
  ).not.toContain('K7P9X2M');
  expect(await page.evaluate(() => localStorage.length)).toBe(0);

  await page.goto('./invitations/accept');
  await page.getByLabel(joinMessages.code.fieldLabel).fill('k7p9x2m');
  await page
    .getByRole('button', { name: joinMessages.code.submitAction })
    .click();

  await expect(page.getByTestId('classroom-join-outcome')).toContainText(
    joinMessages.outcome.alreadyMemberBody,
  );
  expect(capturedCodes).toEqual(['FULLCODE', 'K7P9X2M', 'K7P9X2M']);
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
