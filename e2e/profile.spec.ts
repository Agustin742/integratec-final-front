import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { messages } from '../src/app/messages';
import { authMessages } from '../src/features/auth/messages';
import {
  FREE_HAIR_IDS,
  FREE_TOP_IDS,
  hairOptionsFor,
  topOptionsFor,
} from '../src/features/profile/avatar-options';
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
}, testInfo) => {
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

  // Published AvatarStylesDto: all hair, then all tops, alphabetical per type.
  // This account bought Rastas and already owns its saved hoodie; other paid
  // styles remain locked rather than bypassing the product ownership guard.
  const avatarStyles: components['schemas']['AvatarStylesDto'] = {
    items: [
      ...hairOptionsFor('male')
        .map(({ value }) => value)
        .sort()
        .map((styleId) => ({
          styleType: 'hair' as const,
          styleId,
          free: FREE_HAIR_IDS.has(styleId),
          owned: FREE_HAIR_IDS.has(styleId) || styleId === 'dreads',
          shopItemCode: FREE_HAIR_IDS.has(styleId)
            ? null
            : `hair_${styleId.replaceAll('-', '_')}`,
        })),
      ...topOptionsFor('male')
        .map(({ value }) => value)
        .sort()
        .map((styleId) => ({
          styleType: 'top' as const,
          styleId,
          free: FREE_TOP_IDS.has(styleId),
          owned: FREE_TOP_IDS.has(styleId) || styleId === 'hoodie',
          shopItemCode: FREE_TOP_IDS.has(styleId)
            ? null
            : `top_${styleId.replaceAll('-', '_')}`,
        })),
    ],
  };
  await page.route('**/users/me/avatar/styles', async (route) => {
    const authorization = await route.request().headerValue('authorization');
    if (authorization !== `Bearer ${TEST_ACCESS_TOKEN}`) {
      await route.fulfill({ status: 401, body: '' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(avatarStyles),
    });
  });

  await page.route('**/users/me/streak-and-badges', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentStreak: 4,
        bestStreak: 9,
        lastQualifiedDate: '2026-11-18',
        badges: [
          {
            id: 'badge-1',
            code: 'FIRST_SUBMISSION',
            name: 'Primera entrega',
            description: 'Completaste tu primera entrega a tiempo.',
            unlocked: true,
            unlockedAt: '2026-11-15T14:00:00.000Z',
          },
          {
            id: 'badge-2',
            code: 'STREAK_7',
            name: 'Semana constante',
            description: 'Mantené una racha de 7 días calificados.',
            unlocked: false,
            unlockedAt: null,
          },
        ],
      }),
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
  await expect(
    hairGroup.getByRole('radio', { name: 'Rastas', exact: true }),
  ).toBeEnabled();
  await expect(
    hairGroup.getByRole('radio', {
      name: `Mohicano suave , ${profileMessages.avatar.styleLockedLabel}`,
      exact: true,
    }),
  ).toBeDisabled();
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

  const streakHeading = page.getByRole('heading', {
    name: 'Racha de estudio y medallas',
  });
  await streakHeading.scrollIntoViewIfNeeded();
  await expect(streakHeading).toBeVisible();
  await expect(page.getByText('4 días')).toBeVisible();
  await expect(page.getByText('9 días')).toBeVisible();
  await expect(
    page.getByText('Primera entrega', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Semana constante', { exact: true }),
  ).toBeVisible();

  if (testInfo.project.name === 'desktop') {
    await page.screenshot({
      path: 'odd/artifacts/pr136-profile/streak-badges-1280.png',
      fullPage: false,
    });
  } else if (testInfo.project.name === 'mobile') {
    await page.screenshot({
      path: 'odd/artifacts/pr136-profile/streak-badges-360.png',
      fullPage: false,
    });
  }

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
