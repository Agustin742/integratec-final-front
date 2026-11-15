import { expect, test, type Page } from '@playwright/test';

async function openReference(page: Page) {
  await page.goto('/dev/ui');
  const region = page.getByRole('region', {
    name: 'Vista isométrica de referencia',
  });
  await region.scrollIntoViewIfNeeded();
  const canvas = region.locator('canvas');
  await expect(canvas).toBeVisible();
  // Wait for R3F onCreated before querying WebGL; getContext alone can create it.
  await expect(region).toHaveAttribute('aria-busy', 'false');
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const gl = element.getContext('webgl2');
        return !!gl && !gl.isContextLost() && gl.drawingBufferWidth > 0;
      }),
    )
    .toBe(true);
  return { region, canvas };
}

test('renders actual WebGL with DOM keyboard/touch access and no horizontal overflow', async ({
  page,
  isMobile,
}, info) => {
  await page.setViewportSize({ width: isMobile ? 360 : 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { region } = await openReference(page);
  const button = page.getByRole('button', {
    name: 'Seleccionar referencia de 2 m',
  });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByText(
      'Referencia de 2 m seleccionada. Es una intención local, sin cambios guardados.',
    ),
  ).toBeVisible();
  if (isMobile) await button.tap();
  else await button.click();
  expect(await region.getByRole('button').count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('heading', { name: 'Referencia técnica 3D' })
    .locator('..')
    .screenshot({ path: `odd/previews/world-canvas/${info.project.name}.png` });
});

test('handles unavailable WebGL creation without an uncaught page failure', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, kind: string, options?: unknown) {
        if (
          kind === 'webgl2' ||
          kind === 'webgl' ||
          kind === 'experimental-webgl'
        )
          return null;
        return Reflect.apply(getContext, this, [kind, options]);
      },
    });
  });
  await page.goto('/dev/ui');
  const region = page.getByRole('region', {
    name: 'Vista isométrica de referencia',
  });
  await region.scrollIntoViewIfNeeded();
  await expect(region.getByRole('status')).toContainText(
    'La vista 3D no está disponible',
  );
  await expect(region.locator('canvas')).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('replaces a lost WebGL context with a truthful accessible fallback', async ({
  page,
}) => {
  const { region, canvas } = await openReference(page);
  const supported = await canvas.evaluate((element: HTMLCanvasElement) => {
    const extension = element
      .getContext('webgl2')
      ?.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  test.skip(!supported, 'WEBGL_lose_context is unavailable on this browser');
  await expect(region.getByRole('status')).toContainText(
    'La vista 3D no está disponible',
  );
  await expect(region.getByRole('status')).toContainText(
    'El modo clásico 2D todavía no está disponible',
  );
  await expect(region.locator('canvas')).toHaveCount(0);
  await expect(region.getByRole('link')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Seleccionar referencia de 2 m' })
    .click();
  await expect(
    page.getByText(
      'Referencia de 2 m seleccionada. Es una intención local, sin cambios guardados.',
    ),
  ).toBeVisible();
});
