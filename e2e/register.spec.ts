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
    .getByLabel(authMessages.fields.password.label)
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

test('routes INVITATION choice to /invitations/accept without sending a registration request', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);
  let registerRequests = 0;

  await page.route('**/auth/register', async (route) => {
    registerRequests += 1;
    await route.abort();
  });

  await page.goto('./register');
  const main = page.getByRole('main');

  await main
    .locator('label', { hasText: authMessages.paths.options.INVITATION.title })
    .click();

  await expect(
    main.getByText(authMessages.invitationNotice.heading),
  ).toBeVisible();
  await expect(main.getByLabel(authMessages.fields.email.label)).toHaveCount(0);

  await main
    .getByRole('link', { name: authMessages.invitationNotice.cta })
    .click();

  await expect(page).toHaveURL(/\/invitations\/accept$/);
  await expect(
    page.getByRole('main').getByRole('heading', {
      level: 2,
      name: messages.pages.invitationAccept.title,
    }),
  ).toBeVisible();
  expect(registerRequests).toBe(0);
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
