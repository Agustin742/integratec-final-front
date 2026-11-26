import { expect, test, type Page } from '@playwright/test';
import { callMessages as copy } from '../src/features/calls/call-messages';

const assetPaths = [
  '/models/avatars/female/body.glb',
  '/models/avatars/female/top-school-smock.glb',
  '/models/avatars/shared/hair-bun.glb',
  '/models/avatars/male/body.glb',
  '/models/avatars/male/top-basic-tshirt.glb',
  '/models/avatars/shared/hair-afro.glb',
];

type DrawTrace = Window & { callDrawCounts?: number[] };

async function openVisualFixture(page: Page) {
  // Observe actual GPU submissions, without changing the scene, loader or SDK.
  await page.addInitScript(() => {
    const counts: number[] = [];
    (window as DrawTrace).callDrawCounts = counts;
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      draw.apply(this, args);
      if (!counts.includes(args[1])) counts.push(args[1]);
    };
  });
  const assets = assetPaths.map(async (path) => {
    const response = await page.waitForResponse(
      (item) => new URL(item.url()).pathname === path,
    );
    expect(response.ok(), path).toBe(true);
    const bytes = await response.body();
    expect(bytes.readUInt32LE(0), path).toBe(0x46546c67);
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString()) as {
      accessors: { count: number }[];
      meshes: { primitives: { indices: number }[] }[];
    };
    // A submitted index count from each real body/hair/top is stronger than
    // network-idle or canvas creation: a loading capsule cannot satisfy this.
    return gltf.meshes.flatMap((mesh) =>
      mesh.primitives.map(
        (primitive) => gltf.accessors[primitive.indices]!.count,
      ),
    );
  });
  await page.goto('./dev/ui/calls');
  const region = page.getByRole('img', { name: 'Avatares de la llamada' });
  await expect(region).toHaveAttribute('aria-busy', 'false');
  const canvas = region.locator('canvas');
  await expect(canvas).toBeVisible();
  const geometryCounts = await Promise.all(assets);
  expect(geometryCounts.every((counts) => counts.length > 0)).toBe(true);
  await expect
    .poll(
      async () => {
        const submitted = await page.evaluate(
          () => (window as DrawTrace).callDrawCounts ?? [],
        );
        return geometryCounts.every((counts) =>
          counts.some((count) => submitted.includes(count)),
        );
      },
      {
        message: 'Every real avatar GLB contributes rendered geometry',
        timeout: 30_000,
      },
    )
    .toBe(true);
  expect(
    await canvas.evaluate((element: HTMLCanvasElement) => {
      const gl = element.getContext('webgl2');
      return !!gl && !gl.isContextLost() && gl.drawingBufferWidth > 0;
    }),
  ).toBe(true);
}

async function expectFits(page: Page) {
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight,
    })),
  ).toEqual({ horizontal: true, vertical: true });
  await expect(
    page.getByRole('group', { name: copy.controlsLabel }),
  ).toBeInViewport({ ratio: 1 });
}

test('visual fixture: production call stage, teacher panel and keyboard controls (not a live call)', async ({
  page,
  isMobile,
}) => {
  test.setTimeout(60_000);
  const width = isMobile ? 360 : 1280;
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openVisualFixture(page);
  await expect(
    page.getByRole('heading', { name: 'Muestra local · Ciencias' }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Profe de muestra (vos)', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('group', {
      name: 'Estudiante de muestra, hablando',
      exact: true,
    }),
  ).toBeVisible();
  await expectFits(page);

  // Mobile starts collapsed: capture the unobscured real avatars as well.
  if (isMobile) {
    await page.screenshot({
      path: `docs/assets/voice-calls/fixture-stage-${width}.png`,
    });
    const open = page.getByRole('button', { name: copy.openTeacherPanel });
    await open.focus();
    await page.keyboard.press('Enter');
  }
  await expect(
    page.getByRole('heading', { name: copy.panel.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: copy.panel.muteAll }),
  ).toBeInViewport({ ratio: 1 });
  await expectFits(page);
  await page.screenshot({
    path: `docs/assets/voice-calls/fixture-panel-${width}.png`,
  });

  const focus = page.getByRole('switch', { name: copy.panel.focusMode });
  await expect(focus).not.toBeChecked();
  await focus.focus();
  await expect(focus).toBeFocused();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('status').filter({
      hasText: copy.panel.moderationRequestedAnnouncement,
    }),
  ).toBeAttached();
  await expect(page.getByLabel('Última solicitud simulada')).toHaveText(
    '{"action":"focus-mode","value":true}',
  );
  // Request-only fixture: no authoritative snapshot is invented on moderation.
  await expect(focus).not.toBeChecked();
  await expect(
    page.getByRole('switch', { name: copy.panel.allowSelfUnmute }),
  ).toBeChecked();

  const mute = page.getByRole('button', { name: copy.mute, exact: true });
  await mute.focus();
  await expect(mute).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: copy.unmute, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('group', {
      name: 'Profe de muestra (vos), micrófono silenciado',
      exact: true,
    }),
  ).toBeVisible();
  const emotesButton = page.getByRole('button', {
    name: copy.emotes,
    exact: true,
  });
  await expect(emotesButton).toHaveAccessibleName(copy.emotes);
  await expect(
    page.getByRole('button', { name: copy.leave, exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole('button', { name: copy.endClass, exact: true }),
  ).toBeInViewport({ ratio: 1 });

  // Open the reaction menu after baseline captures to verify all 13 options,
  // SVG-only icons, bounded menu scrolling, and local avatar animation wiring.
  await emotesButton.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  // Wait for Radix Popper's post-measure placement (tolerating subpixel ratio rounding).
  await expect(menu).toBeInViewport({ ratio: 0.99 });
  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.y).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width);
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(800);
  const items = page.getByRole('menuitem');
  await expect(items).toHaveCount(13);
  const itemAudit = await items.evaluateAll((elements) =>
    elements.map((el) => ({
      text: el.textContent ?? '',
      hasSvg: el.querySelector('svg') !== null,
    })),
  );
  for (const item of itemAudit) {
    expect(item.hasSvg).toBe(true);
    expect(item.text).not.toMatch(/\p{Extended_Pictographic}/u);
  }
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth <= window.innerWidth,
      vertical: document.documentElement.scrollHeight <= window.innerHeight,
    })),
  ).toEqual({ horizontal: true, vertical: true });
  await page.getByRole('menuitem', { name: copy.emoteLabels.dance }).click();
  await expectFits(page);
  await expect(page.getByLabel('Última reacción simulada')).toHaveText(
    'dance:1',
  );
  expect(failures).toEqual([]);
});
