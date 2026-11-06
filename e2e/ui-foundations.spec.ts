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
      .getByRole('heading')
      .evaluate((element) => {
        element.textContent = 'LongUnbrokenContent'.repeat(30);
      });
    expect(await fits()).toBe(true);
    await expect(
      page.getByRole('region', { name: messages.showcase.tableRegion }),
    ).toBeVisible();
  });
}

test('keeps content and modal controls usable at 200% CSS zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('./');
  // CSS zoom exercises rendered magnification, not browser UI zoom.
  await page.locator('html').evaluate((element) => {
    element.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const copy = messages.showcase;
  const input = page.getByRole('textbox', { name: copy.fieldLabel });
  await input.fill('Zoom input');
  await expect(input).toHaveValue('Zoom input');
  await expect(page.getByText(copy.validation, { exact: true })).toBeVisible();
  const trigger = page.getByRole('button', { name: copy.openDialog });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: copy.dialogTitle });
  await expect(dialog).toBeInViewport({ ratio: 1 });
  await dialog
    .getByRole('button', { name: uiMessages.close, exact: true })
    .click();
  await expect(trigger).toBeFocused();
});

test('blocks physical pointer activation of background actions behind modals', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  const copy = messages.showcase;
  await page.getByRole('tab', { name: copy.overlays }).click();
  const notice = page.getByRole('button', { name: copy.showToast });
  for (const [triggerName, title] of [
    [copy.openDialog, copy.dialogTitle],
    [copy.openSheet, copy.sheetTitle],
  ]) {
    const trigger = page.getByRole('button', { name: triggerName });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    // Include aria-hidden background in this DOM lookup, not an accessible query.
    const background = page.getByRole('button', {
      name: copy.showToast,
      includeHidden: true,
    });
    const target = await background.boundingBox();
    const modal = await dialog.boundingBox();
    expect(target).not.toBeNull();
    expect(modal).not.toBeNull();
    if (!target || !modal) throw new Error('Missing rendered control bounds');
    const point = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2,
    };
    expect(point.y).toBeGreaterThan(0);
    expect(point.y).toBeLessThan(800);
    expect(
      point.x < modal.x ||
        point.x > modal.x + modal.width ||
        point.y < modal.y ||
        point.y > modal.y + modal.height,
    ).toBe(true);
    // A physical coordinate click must hit the backdrop, never the toast action.
    await page.mouse.click(point.x, point.y);
    await expect(page.getByText(copy.toast, { exact: true })).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  // Positive control: the same background action works once no modal blocks it.
  await notice.click();
  await expect(page.getByText(copy.toast, { exact: true })).toBeVisible();
});

test.describe('touch-equivalent interaction at 360px', () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });

  test('opens and closes both modals and dismisses a local notice by tap', async ({
    page,
  }) => {
    await page.goto('./');
    const copy = messages.showcase;
    await page.getByRole('tab', { name: copy.overlays }).tap();
    for (const [triggerName, title] of [
      [copy.openDialog, copy.dialogTitle],
      [copy.openSheet, copy.sheetTitle],
    ]) {
      const trigger = page.getByRole('button', { name: triggerName });
      await trigger.tap();
      const dialog = page.getByRole('dialog', { name: title });
      await expect(dialog).toBeInViewport({ ratio: 1 });
      await dialog
        .getByRole('button', { name: uiMessages.close, exact: true })
        .tap();
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    await page.getByRole('button', { name: copy.showToast }).tap();
    await expect(page.getByText(copy.toast, { exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: uiMessages.closeNotification })
      .tap();
    await expect(page.getByText(copy.toast, { exact: true })).toHaveCount(0);
  });
});

test('honours the reduced-motion preference for animation and scrolling', async ({
  page,
}) => {
  const busyIndicator = () =>
    page
      .getByRole('button', { name: messages.showcase.loading })
      .locator('span[aria-hidden="true"]');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  await expect(busyIndicator()).toBeVisible();
  expect(
    await busyIndicator().evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        animationName: styles.animationName,
        animationDuration: styles.animationDuration,
      };
    }),
  ).toMatchObject({ animationName: 'spin' });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await busyIndicator().evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      animationName: styles.animationName,
      animationDuration: styles.animationDuration,
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  expect(reduced.animationName).toBe('none');
  expect(Number.parseFloat(reduced.animationDuration)).toBeLessThanOrEqual(
    0.01,
  );
  expect(reduced.scrollBehavior).toBe('auto');
});

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
