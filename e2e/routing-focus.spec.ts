import { expect, test } from '@playwright/test';
import { messages } from '../src/app/messages';
import { layoutMessages } from '../src/components/layout/messages';

for (const [path, title] of [
  ['login', messages.pages.login.title],
  ['register', messages.pages.register.title],
  ['password-reset', messages.pages.passwordReset.title],
  ['invitations/accept', messages.pages.invitationAccept.title],
]) {
  test(`preserves initial focus and keyboard skip on /${path}`, async ({
    page,
  }) => {
    await page.goto(`./${path}`);
    const heading = page.getByRole('heading', { level: 2, name: title });
    await expect(heading).toBeVisible();
    await expect(page).toHaveTitle(`${title} · ${messages.title}`);
    // Public pages load lazily; check after the destination has rendered.
    await expect(page.locator('body')).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: layoutMessages.skipToContent });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
  });
}

test('focuses the destination after the public not-found link redirects to login', async ({
  page,
}) => {
  await page.goto('./missing-routing-focus-page');
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: messages.pages.notFound.title,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: messages.errors.goHome }).click();
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: messages.pages.login.title,
    }),
  ).toBeFocused();
});
