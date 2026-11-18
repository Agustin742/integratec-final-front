import { expect, test, type Page } from '@playwright/test';
import { messages } from '../src/app/messages';
import { authMessages } from '../src/features/auth/messages';
import { profileMessages } from '../src/features/profile/messages';

const TEST_ACCESS_TOKEN = 'e2e-profile-access-token';
const TEST_REFRESH_TOKEN = 'e2e-profile-refresh-token';

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

test('edits display name and base avatar on /profile and persists across reload without CSP or overflow errors', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  let serverProfile = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ana@example.com',
    displayName: 'Ana Pérez',
    avatar: {
      bodyId: 'male',
      hairId: 'afro',
      topId: 'hoodie',
      hairColor: '#6C4D48',
      clothingColor: '#5B4F96',
    },
  };

  await page.route('**/auth/login', async (route) => {
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
    const authorization = await route.request().headerValue('authorization');
    if (authorization !== `Bearer ${TEST_ACCESS_TOKEN}`) {
      await route.fulfill({ status: 401, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(serverProfile),
    });
  });

  await page.route('**/users/me/profile', async (route) => {
    const body = route.request().postDataJSON() as { displayName: string };
    serverProfile = {
      ...serverProfile,
      displayName: body.displayName.trim(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(serverProfile),
    });
  });

  await page.route('**/users/me/avatar', async (route) => {
    const body = route.request().postDataJSON() as typeof serverProfile.avatar;
    serverProfile = {
      ...serverProfile,
      avatar: body,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(serverProfile.avatar),
    });
  });

  await page.goto('./login');
  await page
    .getByLabel(authMessages.login.fields.email.label)
    .fill('ana@example.com');
  await page
    .getByLabel(authMessages.login.fields.password.label)
    .fill('ClaveSegura123');
  await page
    .getByRole('button', { name: authMessages.login.actions.submit })
    .click();

  await page.getByRole('link', { name: messages.shell.profileLink }).click();
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: profileMessages.page.title,
    }),
  ).toBeVisible();

  const nameInput = page.getByRole('textbox', {
    name: profileMessages.displayName.label,
  });
  await expect(nameInput).toHaveValue('Ana Pérez');

  // Edit display name and save
  await nameInput.fill('Ana María');
  await page
    .getByRole('button', { name: profileMessages.displayName.submit })
    .click();
  await expect(
    page.getByText(profileMessages.displayName.confirmed),
  ).toBeVisible();

  // Edit base avatar and save
  const hairGroup = page.getByRole('group', {
    name: profileMessages.avatar.groups.hairId,
  });
  await hairGroup.locator('label', { hasText: 'Rastas' }).click();

  const hairColorGroup = page.getByRole('group', {
    name: profileMessages.avatar.groups.hairColor,
  });
  await hairColorGroup.locator('label', { hasText: 'Rubio' }).click();

  await expect(
    page.getByText(profileMessages.avatar.previewDraft),
  ).toBeVisible();

  await page
    .getByRole('button', { name: profileMessages.avatar.submit })
    .click();
  await expect(page.getByText(profileMessages.avatar.confirmed)).toBeVisible();
  await expect(
    page.getByText(profileMessages.avatar.previewSaved),
  ).toBeVisible();

  // Verify zero horizontal overflow at current viewport (desktop 1280 / mobile 360+)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  // Reload and verify persistence
  await page.reload();
  await expect(
    page.getByRole('textbox', { name: profileMessages.displayName.label }),
  ).toHaveValue('Ana María');
  await expect(
    page
      .getByRole('group', { name: profileMessages.avatar.groups.hairId })
      .getByRole('radio', { name: 'Rastas' }),
  ).toBeChecked();
  await expect(
    page
      .getByRole('group', { name: profileMessages.avatar.groups.hairColor })
      .getByRole('radio', { name: 'Rubio' }),
  ).toBeChecked();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
