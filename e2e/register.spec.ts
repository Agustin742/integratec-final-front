import { expect, test, type Page } from '@playwright/test';
import { messages } from '../src/app/messages';
import { authMessages } from '../src/features/auth/messages';

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

test('completes SCHOOL registration with server confirmation and transitions to /login without CSP or overflow errors', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let capturedBody: Record<string, unknown> | null = null;

  await page.route('**/auth/register', async (route) => {
    const request = route.request();
    capturedBody = request.postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e-1',
        email: 'directora@escuela4.edu.ar',
        displayName: 'Sofía Martínez',
        path: 'SCHOOL',
        school: {
          id: 'school-e2e-1',
          name: 'Escuela Técnica N.º 4',
          slug: 'escuela-tecnica-n-4',
          timeZone: 'America/Argentina/Buenos_Aires',
        },
        createdAt: '2026-11-14T12:00:00.000Z',
      }),
    });
  });

  await page.goto('./register');

  const main = page.getByRole('main');
  await expect(
    main.getByRole('heading', {
      level: 2,
      name: messages.pages.register.title,
    }),
  ).toBeVisible();

  await main
    .locator('label', { hasText: authMessages.paths.options.SCHOOL.title })
    .click();

  await main
    .getByLabel(authMessages.fields.displayName.label)
    .fill('Sofía Martínez');
  await main
    .getByLabel(authMessages.fields.email.label)
    .fill('Directora@Escuela4.edu.ar');
  await main
    .getByLabel(authMessages.fields.password.label, { exact: true })
    .fill('ClaveSegura2026');
  await main
    .getByLabel(authMessages.fields.schoolName.label)
    .fill('Escuela Técnica N.º 4');

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await main.getByRole('button', { name: authMessages.actions.submit }).click();

  const statusRegion = main.getByRole('status');
  await expect(statusRegion).toBeVisible();
  await expect(
    statusRegion.getByText(
      `${authMessages.confirmed.schoolTitlePrefix} Escuela Técnica N.º 4`,
    ),
  ).toBeVisible();

  expect(capturedBody).toEqual({
    path: 'SCHOOL',
    displayName: 'Sofía Martínez',
    email: 'directora@escuela4.edu.ar',
    password: 'ClaveSegura2026',
    schoolName: 'Escuela Técnica N.º 4',
  });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await main
    .getByRole('link', { name: authMessages.confirmed.loginCta })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page
      .getByRole('main')
      .getByRole('heading', { level: 2, name: messages.pages.login.title }),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('preselects INVITEE when ?next=/invitations/accept and completes registration into the invitation route', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let capturedBody: Record<string, unknown> | null = null;

  await page.route('**/auth/register', async (route) => {
    capturedBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e-invitee',
        email: 'invitado@ejemplo.edu.ar',
        displayName: 'Lucas Gómez',
        path: 'INVITEE',
        createdAt: '2026-11-26T12:00:00.000Z',
        session: {
          accessToken: 'synthetic-invitee-access',
          refreshToken: 'synthetic-invitee-refresh',
          tokenType: 'Bearer',
          expiresIn: 900,
        },
      }),
    });
  });

  await page.route('**/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-e2e-invitee',
        email: 'invitado@ejemplo.edu.ar',
        displayName: 'Lucas Gómez',
        avatar: {
          bodyId: 'male',
          hairId: 'classic-short',
          topId: 'hoodie',
          hairColor: '#6C4D48',
          clothingColor: '#5B4F96',
        },
      }),
    });
  });

  await page.goto(
    './register?next=%2Finvitations%2Faccept%3Ftoken%3Dinv-e2e-parent-token',
  );
  const main = page.getByRole('main');

  await expect(
    main.getByText(authMessages.invitationNotice.heading),
  ).toBeVisible();
  await expect(
    main.getByLabel(authMessages.fields.schoolName.label),
  ).toHaveCount(0);

  await main
    .getByLabel(authMessages.fields.displayName.label)
    .fill('Lucas Gómez');
  await main
    .getByLabel(authMessages.fields.email.label)
    .fill('invitado@ejemplo.edu.ar');
  await main
    .getByLabel(authMessages.fields.password.label, { exact: true })
    .fill('ClaveSegura2026');

  await main.getByRole('button', { name: authMessages.actions.submit }).click();

  await expect(page).toHaveURL(/\/invitations\/accept$/);
  await expect(
    page.getByRole('main').getByRole('heading', {
      level: 2,
      name: messages.pages.invitationAccept.title,
    }),
  ).toBeVisible();
  expect(capturedBody).toEqual({
    path: 'INVITEE',
    displayName: 'Lucas Gómez',
    email: 'invitado@ejemplo.edu.ar',
    password: 'ClaveSegura2026',
  });
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

for (const width of [360, 1280]) {
  test(`fits registration path cards and school form without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./register');

    const main = page.getByRole('main');
    await main
      .locator('label', { hasText: authMessages.paths.options.SCHOOL.title })
      .click();

    await expect(
      main.getByLabel(authMessages.fields.schoolName.label),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
