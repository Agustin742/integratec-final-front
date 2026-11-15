import { expect, test, type Page } from '@playwright/test';
import { messages } from '../src/app/messages';
import { authMessages } from '../src/features/auth/messages';

const TEST_ACCESS_TOKEN = 'e2e-access-token';
const TEST_REFRESH_TOKEN = 'e2e-refresh-token';

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

test('signs in, reloads authenticated home screen, and clears protected state on logout', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let capturedLoginBody: Record<string, unknown> | null = null;
  let capturedLogoutAuth: string | null = null;
  let capturedLogoutCalled = false;
  let profileCalls = 0;

  await page.route('**/auth/login', async (route) => {
    capturedLoginBody = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: TEST_ACCESS_TOKEN,
        refreshToken: TEST_REFRESH_TOKEN,
        tokenType: 'Bearer',
        expiresIn: 900,
      }),
    });
  });

  await page.route('**/users/me', async (route) => {
    profileCalls += 1;
    const authorization = await route.request().headerValue('authorization');
    if (authorization !== `Bearer ${TEST_ACCESS_TOKEN}`) {
      await route.fulfill({ status: 401, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: '00000000-0000-4000-8000-000000000001',
        email: 'ana@example.com',
        displayName: 'Ana Pérez',
        avatar: {
          bodyId: 'female',
          hairId: 'original',
          topId: 'hoodie',
          hairColor: '#6C4D48',
          clothingColor: '#5B4F96',
        },
      }),
    });
  });

  await page.route('**/auth/logout', async (route) => {
    capturedLogoutCalled = true;
    capturedLogoutAuth = await route.request().headerValue('authorization');
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('./login');
  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.login.title }),
  ).toBeVisible();

  await page
    .getByLabel(authMessages.login.fields.email.label)
    .fill('Ana@Example.com');
  await page
    .getByLabel(authMessages.login.fields.password.label)
    .fill('ClaveSegura123');

  const submitButton = page.getByRole('button', {
    name: authMessages.login.actions.submit,
  });
  const submitBox = await submitButton.boundingBox();
  expect(submitBox?.height).toBeGreaterThanOrEqual(44);

  await submitButton.click();

  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.home.title }),
  ).toBeVisible();
  await expect(page.getByText('Ana Pérez')).toBeVisible();

  const logoutButton = page.getByRole('button', {
    name: messages.shell.logoutAction,
  });
  const logoutBox = await logoutButton.boundingBox();
  expect(logoutBox?.height).toBeGreaterThanOrEqual(44);

  expect(capturedLoginBody).toEqual({
    email: 'ana@example.com',
    password: 'ClaveSegura123',
  });
  expect(profileCalls).toBe(1);

  await page.reload();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.home.title }),
  ).toBeVisible();
  await expect(page.getByText('Ana Pérez')).toBeVisible();
  expect(profileCalls).toBe(2);

  await logoutButton.click();

  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.login.title }),
  ).toBeVisible();
  await expect(
    page.getByText(messages.shell.logoutConfirmedTitle),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.home.title }),
  ).toHaveCount(0);
  await expect(page.getByText('Ana Pérez')).toHaveCount(0);

  expect(capturedLogoutCalled).toBe(true);
  expect(capturedLogoutAuth).toBe(`Bearer ${TEST_ACCESS_TOKEN}`);

  const callsBeforeRevisit = profileCalls;
  await page.goto('./');
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.home.title }),
  ).toHaveCount(0);
  expect(profileCalls).toBe(callsBeforeRevisit);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('shows a generic error on 401 login, keeps email, and clears password', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        correlationId: 'e2e-login-401',
      }),
    });
  });

  await page.goto('./login');
  const emailInput = page.getByLabel(authMessages.login.fields.email.label);
  const passwordInput = page.getByLabel(
    authMessages.login.fields.password.label,
  );

  await emailInput.fill('ana@example.com');
  await passwordInput.fill('wrong-secret');
  await page
    .getByRole('button', { name: authMessages.login.actions.submit })
    .click();

  await expect(page.getByRole('alert')).toContainText(
    authMessages.login.errors.invalidCredentials,
  );
  await expect(emailInput).toHaveValue('ana@example.com');
  await expect(passwordInput).toHaveValue('');

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('completes password reset request and token confirmation flows', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let capturedConfirmBody: Record<string, unknown> | null = null;

  await page.route('**/auth/password-reset/request', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'If the email is registered, reset instructions were sent.',
      }),
    });
  });

  await page.route('**/auth/password-reset/confirm', async (route) => {
    capturedConfirmBody = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('./password-reset');
  await page
    .getByLabel(authMessages.passwordReset.request.fields.email.label)
    .fill('ana@example.com');
  await page
    .getByRole('button', {
      name: authMessages.passwordReset.request.actions.submit,
    })
    .click();

  await expect(
    page.getByRole('heading', {
      level: 3,
      name: authMessages.passwordReset.request.confirmation.title,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(authMessages.passwordReset.request.confirmation.body),
  ).toBeVisible();

  await page.goto('./password-reset?token=valid-reset-token-123456');
  const passwordInput = page.getByLabel(
    authMessages.passwordReset.confirm.fields.newPassword.label,
  );
  await expect(passwordInput).toBeVisible();
  await expect(page).toHaveURL(/\/password-reset$/);
  await passwordInput.fill('NuevaClave123!');
  await page
    .getByRole('button', {
      name: authMessages.passwordReset.confirm.actions.submit,
    })
    .click();

  await expect(
    page.getByRole('heading', {
      level: 3,
      name: authMessages.passwordReset.confirm.confirmed.title,
    }),
  ).toBeFocused();
  await expect(
    page.getByText(authMessages.passwordReset.confirm.confirmed.body),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: authMessages.passwordReset.confirm.actions.goToLogin,
    }),
  ).toHaveAttribute('href', '/login');

  expect(capturedConfirmBody).toEqual({
    token: 'valid-reset-token-123456',
    newPassword: 'NuevaClave123!',
  });

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

for (const width of [360, 1280]) {
  test(`renders login and password reset cleanly at ${width}px without overflow`, async ({
    page,
  }) => {
    const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
    await page.setViewportSize({ width, height: 800 });

    for (const path of [
      './login',
      './password-reset',
      './password-reset?token=preview-token-123',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      const submitBox = await page
        .locator('button[type="submit"]')
        .boundingBox();
      expect(submitBox?.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    expect(cspViolations).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
