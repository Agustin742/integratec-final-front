import { expect, test } from '@playwright/test';

test('serves the semantic placeholder without horizontal overflow', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page).toHaveTitle('IntegrarTec');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  const main = page.getByRole('main');
  await expect(main).toBeVisible();
  await expect(
    main.getByRole('heading', { level: 1, name: 'IntegrarTec', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
