import { expect, test } from '@playwright/test';
import { messages } from '../src/app/messages';
import { layoutMessages } from '../src/components/layout/messages';
import { uiMessages } from '../src/components/ui/ui-messages';

for (const width of [360, 1280]) {
  test(`fits the layout and long content at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('./');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: messages.showcase.navigation }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: messages.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(messages.bootstrapReady)).toBeVisible();
    const fits = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
    expect(await fits()).toBe(true);
    // Stress consumer text without changing production copy or shared components.
    await page
      .getByRole('banner')
      .locator('p')
      .evaluate((element) => {
        element.textContent = 'LongUnbrokenContent'.repeat(30);
      });
    expect(await fits()).toBe(true);
    await expect(
      page.getByRole('region', { name: messages.showcase.tableRegion }),
    ).toBeVisible();
  });
}

test('supports keyboard skip, modal focus containment and trigger restoration', async ({
  page,
}) => {
  await page.goto('./');
  const copy = messages.showcase;
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: layoutMessages.skipToContent });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();

  const trigger = page.getByRole('button', { name: copy.openDialog });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: copy.dialogTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription(copy.dialogDescription);
  const close = dialog.getByRole('button', {
    name: uiMessages.close,
    exact: true,
  });
  await expect(close).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(close).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(
    await page
      .locator('body')
      .evaluate((body) => getComputedStyle(body).pointerEvents),
  ).toBe('none');
  expect(
    await dialog.evaluate((element) => getComputedStyle(element).pointerEvents),
  ).toBe('auto');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  const tab = page.getByRole('tab', { name: copy.controls });
  await tab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: copy.overlays })).toBeFocused();
  const sheetTrigger = page.getByRole('button', { name: copy.openSheet });
  await sheetTrigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: copy.sheetTitle });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole('button', { name: uiMessages.close, exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheetTrigger).toBeFocused();

  await page.getByRole('button', { name: copy.showToast }).click();
  await expect(page.getByText(copy.toast)).toBeVisible();
});
