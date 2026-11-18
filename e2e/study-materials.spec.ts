import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000140';
const initialMaterialId = '00000000-0000-4000-8000-000000001401';

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const teacherCapabilities: components['schemas']['ClassroomContextResponseDto']['capabilities'] =
  ['publish_content', 'configure_classroom', 'view_metrics'];

const studentCapabilities: components['schemas']['ClassroomContextResponseDto']['capabilities'] =
  ['participate_activities', 'view_metrics'];

async function setupAuthSession(page: Page) {
  const cspViolations: string[] = [];
  const pageErrors: string[] = [];

  await page.exposeFunction('__recordCspViolation__', (directive: string) => {
    cspViolations.push(directive);
  });
  await page.addInitScript(() => {
    const tabOwner = '00000000-0000-4000-8000-000000000002';
    window.name = `\n[integratec-tab:${tabOwner}]`;
    sessionStorage.setItem(
      'integratec.session',
      JSON.stringify({
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner,
      }),
    );
    document.addEventListener('securitypolicyviolation', (event) => {
      const record = (
        window as unknown as {
          __recordCspViolation__?: (directive: string) => void;
        }
      ).__recordCspViolation__;
      record?.(event.violatedDirective);
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route(`${apiOrigin}/users/me`, (route) =>
    route.fulfill({ json: profile }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/context-events`,
    (route) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: '',
      }),
  );

  return { cspViolations, pageErrors };
}

test('teacher uploads, captures responsive views, downloads via signed URL, and removes material', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  let items: components['schemas']['MaterialDto'][] = [
    {
      id: initialMaterialId,
      classroomId,
      authorId: userId,
      filename: 'programa-anual.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245760,
      createdAt: '2026-11-18T03:00:00.000Z',
    },
  ];
  let signedUrlRequested = false;

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: {
        id: classroomId,
        name: '3.º Año B - Matemática',
        subject: 'Álgebra y Geometría',
        schoolId: null,
        independentTeacherId: userId,
        adultMode: false,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'TEACHER',
        capabilities: teacherCapabilities,
        availablePanels: ['material'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/materials**`,
    (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.endsWith('/materials')) {
        return route.fulfill({
          json: {
            items,
            page: 1,
            pageSize: 10,
            total: items.length,
          },
        });
      }
      if (request.method() === 'POST' && url.pathname.endsWith('/materials')) {
        const created: components['schemas']['MaterialDto'] = {
          id: '00000000-0000-4000-8000-000000001402',
          classroomId,
          authorId: userId,
          filename: 'guia-practica.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1280,
          createdAt: '2026-11-18T03:15:00.000Z',
        };
        items = [created, ...items];
        return route.fulfill({ status: 201, json: created });
      }
      if (request.method() === 'GET' && url.pathname.endsWith('/download')) {
        signedUrlRequested = true;
        return route.fulfill({
          json: {
            url: `${apiOrigin}/signed-download/${initialMaterialId}?token=ephemeral`,
            expiresInSeconds: 120,
          } satisfies components['schemas']['MaterialDownloadDto'],
        });
      }
      if (request.method() === 'DELETE') {
        const id = url.pathname.split('/').pop();
        items = items.filter((item) => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    },
  );

  const openedUrls: { url: string; target?: string; features?: string }[] = [];
  await page.exposeFunction(
    '__recordWindowOpen__',
    (url: string, target?: string, features?: string) => {
      openedUrls.push({ url, target, features });
    },
  );
  await page.addInitScript(() => {
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const record = (
        window as unknown as {
          __recordWindowOpen__?: (u: string, t?: string, f?: string) => void;
        }
      ).__recordWindowOpen__;
      record?.(String(url ?? ''), target, features);
      return null;
    }) as typeof window.open;
  });

  await page.goto(`./classrooms/${classroomId}/panels/material`);
  const dialog = page.getByRole('dialog', { name: 'Material', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('programa-anual.pdf')).toBeVisible();

  const fileInput = dialog.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: 'guia-practica.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%test'),
  });
  await dialog.getByRole('button', { name: 'Subir archivo' }).click();
  await expect(dialog.getByText('Material publicado')).toBeVisible();
  await expect(
    dialog.getByText('guia-practica.pdf', { exact: true }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/classrooms/study-materials-${width}.png`,
    fullPage: true,
  });

  await dialog.getByRole('button', { name: 'Descargar' }).nth(1).click();
  await expect.poll(() => signedUrlRequested).toBe(true);
  await expect
    .poll(() => openedUrls)
    .toEqual([
      {
        url: `${apiOrigin}/signed-download/${initialMaterialId}?token=ephemeral`,
        target: '_blank',
        features: 'noopener,noreferrer',
      },
    ]);

  await dialog.getByRole('button', { name: 'Quitar' }).first().click();
  await dialog.getByRole('button', { name: 'Sí, quitar material' }).click();
  await expect(dialog.getByText('Material quitado')).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student sees materials and download action without upload or remove controls', async ({
  page,
}) => {
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: {
        id: classroomId,
        name: '3.º Año B - Matemática',
        subject: null,
        schoolId: null,
        independentTeacherId: null,
        adultMode: false,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'STUDENT',
        capabilities: studentCapabilities,
        availablePanels: ['material'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/materials**`,
    (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: initialMaterialId,
              classroomId,
              authorId: userId,
              filename: 'programa-anual.pdf',
              contentType: 'application/pdf',
              sizeBytes: 245760,
              createdAt: '2026-11-18T03:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
        },
      }),
  );

  const openedUrls: { url: string; target?: string; features?: string }[] = [];
  await page.exposeFunction(
    '__recordWindowOpen__',
    (url: string, target?: string, features?: string) => {
      openedUrls.push({ url, target, features });
    },
  );
  await page.addInitScript(() => {
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const record = (
        window as unknown as {
          __recordWindowOpen__?: (u: string, t?: string, f?: string) => void;
        }
      ).__recordWindowOpen__;
      record?.(String(url ?? ''), target, features);
      return null;
    }) as typeof window.open;
  });

  await page.goto(`./classrooms/${classroomId}/panels/material`);
  const dialog = page.getByRole('dialog', { name: 'Material', exact: true });
  await expect(dialog.getByText('programa-anual.pdf')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Elegir archivo' }),
  ).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Quitar' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Descargar' })).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
