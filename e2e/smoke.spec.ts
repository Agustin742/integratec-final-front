import { expect, test } from '@playwright/test';

test('serves the semantic placeholder without horizontal overflow', async ({
  page,
}) => {
  const cspViolations: string[] = [];
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

  const response = await page.goto('./');
  expect(response).not.toBeNull();
  const headers = response?.headers() ?? {};

  expect(headers['content-security-policy']).toContain("default-src 'none'");
  expect(headers['content-security-policy']).toContain(
    "script-src 'self' 'wasm-unsafe-eval'",
  );
  expect(headers['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['strict-transport-security']).toContain('max-age=63072000');

  await expect(page).toHaveTitle('IntegrarTec');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  const main = page.getByRole('main');
  await expect(main).toBeVisible();
  await expect(
    page
      .getByRole('banner')
      .getByRole('heading', { level: 1, name: 'IntegrarTec', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(cspViolations).toEqual([]);
});
