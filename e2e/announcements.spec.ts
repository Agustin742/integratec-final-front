import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000149';
const initialAnnouncementId = '00000000-0000-4000-8000-000000002401';

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

test('teacher publishes, edits, captures responsive views, and removes announcement', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  let items: components['schemas']['AnnouncementDto'][] = [
    {
      id: initialAnnouncementId,
      classroomId,
      authorId: userId,
      title: 'Bienvenida al segundo cuatrimestre',
      content: 'Revisen el cronograma en el aula antes del viernes.',
      mentionedUserIds: [],
      createdAt: '2026-11-18T09:00:00.000Z',
      updatedAt: '2026-11-18T09:00:00.000Z',
    },
  ];

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
        availablePanels: ['notices'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/announcements**`,
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (
        request.method() === 'GET' &&
        url.pathname.endsWith('/announcements')
      ) {
        return route.fulfill({
          json: {
            items,
            page: 1,
            pageSize: 10,
            total: items.length,
          },
        });
      }
      if (
        request.method() === 'POST' &&
        url.pathname.endsWith('/announcements')
      ) {
        const body = request.postDataJSON() as {
          title: string;
          content: string;
        };
        const created: components['schemas']['AnnouncementDto'] = {
          id: '00000000-0000-4000-8000-000000002402',
          classroomId,
          authorId: userId,
          title: body.title,
          content: body.content,
          mentionedUserIds: ['00000000-0000-4000-8000-000000000055'],
          createdAt: '2026-11-18T11:30:00.000Z',
          updatedAt: '2026-11-18T11:30:00.000Z',
        };
        items = [created, ...items];
        return route.fulfill({ status: 201, json: created });
      }
      if (request.method() === 'PATCH') {
        const id = url.pathname.split('/').pop();
        const body = request.postDataJSON() as {
          title?: string;
          content?: string;
        };
        items = items.map((item) =>
          item.id === id
            ? {
                ...item,
                title: body.title ?? item.title,
                content: body.content ?? item.content,
                updatedAt: '2026-11-18T11:45:00.000Z',
              }
            : item,
        );
        const updated = items.find((item) => item.id === id);
        return route.fulfill({ status: 200, json: updated });
      }
      if (request.method() === 'DELETE') {
        const id = url.pathname.split('/').pop();
        items = items.filter((item) => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    },
  );

  await page.goto(`./classrooms/${classroomId}/panels/notices`);
  const dialog = page.getByRole('dialog', { name: 'Avisos', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('Bienvenida al segundo cuatrimestre'),
  ).toBeVisible();

  await dialog.getByLabel('Título').fill('Clase de consulta');
  await dialog
    .getByLabel('Contenido')
    .fill('Traer dudas resueltas @Sofía antes del parcial.');
  await dialog.getByRole('button', { name: 'Publicar anuncio' }).click();

  await expect(dialog.getByText('Anuncio publicado')).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Clase de consulta' }),
  ).toBeVisible();
  await expect(dialog.getByText('1 mención')).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await dialog.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/assets/classrooms/announcements-${width}.png`,
    fullPage: true,
  });

  // Edit announcement
  await dialog.getByRole('button', { name: 'Editar' }).first().click();
  await dialog.getByLabel('Título').fill('Clase de consulta (actualizada)');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(dialog.getByText('Anuncio actualizado')).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Clase de consulta (actualizada)' }),
  ).toBeVisible();

  // Remove announcement
  await dialog.getByRole('button', { name: 'Eliminar' }).first().click();
  await dialog.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(dialog.getByText('Anuncio eliminado')).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student reads announcements as plain text without edit or delete controls', async ({
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
        availablePanels: ['notices'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );

  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/announcements**`,
    (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: initialAnnouncementId,
              classroomId,
              authorId: '00000000-0000-4000-8000-000000000099',
              title: '<script>alert(1)</script>Aviso seguro',
              content: '<img src=x onerror=alert(1)> Hola @Sofía',
              mentionedUserIds: [],
              createdAt: '2026-11-18T09:00:00.000Z',
              updatedAt: '2026-11-18T09:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
        },
      }),
  );

  await page.goto(`./classrooms/${classroomId}/panels/notices`);
  const dialog = page.getByRole('dialog', { name: 'Avisos', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText('<script>alert(1)</script>Aviso seguro'),
  ).toBeVisible();
  await expect(
    dialog.getByText('<img src=x onerror=alert(1)> Hola @Sofía'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Publicar anuncio' }),
  ).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Editar' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Eliminar' })).toHaveCount(0);

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('announcement card keeps a readable title and wraps actions on narrow screens', async ({
  page,
}, testInfo) => {
  const isMobile = testInfo.project.name === 'mobile';
  await page.setViewportSize({ width: isMobile ? 360 : 1280, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);
  const longTitle =
    'Recordatorio importante sobre la evaluación de fracciones del viernes';

  await page.route(`${apiOrigin}/classrooms/${classroomId}`, (route) =>
    route.fulfill({
      json: {
        id: classroomId,
        name: '3.º Año B - Matemática',
        subject: null,
        schoolId: null,
        independentTeacherId: userId,
        adultMode: false,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'TEACHER',
        capabilities: teacherCapabilities,
        availablePanels: ['notices'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      } satisfies components['schemas']['ClassroomContextResponseDto'],
    }),
  );
  await page.route(
    `${apiOrigin}/classrooms/${classroomId}/announcements**`,
    (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: initialAnnouncementId,
              classroomId,
              authorId: userId,
              title: longTitle,
              content: 'Traer la carpeta completa.',
              mentionedUserIds: [],
              createdAt: '2026-11-18T09:00:00.000Z',
              updatedAt: '2026-11-18T10:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 10,
          total: 1,
        },
      }),
  );

  await page.goto(`./classrooms/${classroomId}/panels/notices`);
  const dialog = page.getByRole('dialog', { name: 'Avisos', exact: true });
  const title = dialog.getByRole('heading', { name: longTitle });
  await expect(title).toBeVisible();

  const card = dialog.getByRole('listitem').filter({ hasText: longTitle });
  const cardBox = await card.boundingBox();
  const titleBox = await title.boundingBox();
  const editBox = await dialog
    .getByRole('button', { name: 'Editar' })
    .first()
    .boundingBox();
  if (!cardBox || !titleBox || !editBox) {
    throw new Error('Expected card, title and edit button to be laid out');
  }

  if (isMobile) {
    expect(titleBox.width).toBeGreaterThanOrEqual(cardBox.width * 0.6);
    expect(editBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height);
  } else {
    expect(editBox.y).toBeLessThan(titleBox.y + titleBox.height);
  }

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
