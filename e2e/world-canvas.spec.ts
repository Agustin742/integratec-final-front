import { expect, test, type Locator, type Page } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { frameCamera } from '../src/features/world/camera';

// The selectable reference capsule sits at world (1.5, 1, 0) with radius 0.3
// (world-reference.tsx) and the host camera framing is deterministic, so the
// expected screen position of the capsule can be computed from the real
// framing code instead of hand-picked pixel coordinates.
const CAPSULE_CENTER = new Vector3(1.5, 1, 0);

async function capsulePosition(canvas: Locator) {
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas is not visible');
  const camera = new OrthographicCamera();
  frameCamera(camera, box.width, box.height);
  const point = CAPSULE_CENTER.clone().project(camera);
  return {
    x: ((point.x + 1) / 2) * box.width,
    y: (1 - (point.y + 1) / 2) * box.height,
  };
}

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
  const idle = page.getByText(
    'Seleccioná la referencia alta o usá el botón. No hay navegación ni acciones del aula.',
  );
  const selected = page.getByText(
    'Referencia de 2 m seleccionada. Es una intención local, sin cambios guardados.',
  );
  const button = page.getByRole('button', {
    name: 'Seleccionar referencia de 2 m',
  });

  // Keyboard activation from a verifiably idle state.
  const { region } = await openReference(page);
  await expect(idle).toBeVisible();
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(selected).toBeVisible();

  // Pointer/touch activation on the DOM control, from a fresh idle page.
  await page.reload();
  await expect(idle).toBeVisible();
  if (isMobile) await button.tap();
  else await button.click();
  await expect(selected).toBeVisible();

  // Direct 3D picking on the canvas reference object, from a fresh idle page.
  const reopened = await openReference(page);
  await expect(idle).toBeVisible();
  const canvas = reopened.canvas;
  const position = await capsulePosition(canvas);
  if (isMobile) await canvas.tap({ position });
  else await canvas.click({ position });
  await expect(selected).toBeVisible();

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
