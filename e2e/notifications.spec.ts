import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000150';

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'estudiante@example.test',
  displayName: 'Sofía Martínez',
  avatar: {
    bodyId: 'female',
    hairId: 'original',
    topId: 'tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

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
  await page.route(`${apiOrigin}/me/classrooms**`, (route) =>
    route.fulfill({
      json: {
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      },
    }),
  );

  return { cspViolations, pageErrors };
}

test('notification center shows unread count, persists mark-read/mark-all across reload, and captures responsive views', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await setupAuthSession(page);

  let items: components['schemas']['NotificationDto'][] = [
    {
      id: '00000000-0000-4000-8000-000000003501',
      kind: 'announcement',
      resourceId: '00000000-0000-4000-8000-000000004501',
      classroomId,
      studentId: null,
      readAt: null,
      createdAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: '00000000-0000-4000-8000-000000003502',
      kind: 'grade_posted',
      resourceId: '00000000-0000-4000-8000-000000004502',
      classroomId,
      studentId: null,
      readAt: null,
      createdAt: '2026-11-18T10:00:00.000Z',
    },
  ];

  await page.route(`${apiOrigin}/notifications`, (route) =>
    route.fulfill({
      json: { items, page: 1, pageSize: 20, total: items.length },
    }),
  );
  await page.route(`${apiOrigin}/notifications?**`, (route) =>
    route.fulfill({
      json: { items, page: 1, pageSize: 20, total: items.length },
    }),
  );
  await page.route(`${apiOrigin}/notifications/read-all`, (route) => {
    let updated = 0;
    items = items.map((item) => {
      if (item.readAt !== null) return item;
      updated += 1;
      return { ...item, readAt: '2026-11-18T12:00:00.000Z' };
    });
    return route.fulfill({ json: { updated } });
  });
  await page.route(`${apiOrigin}/notifications/*/read`, (route) => {
    const id = route.request().url().split('/').slice(-2, -1)[0];
    items = items.map((item) =>
      item.id === id && item.readAt === null
        ? { ...item, readAt: '2026-11-18T12:00:00.000Z' }
        : item,
    );
    const updated = items.find((item) => item.id === id);
    return route.fulfill({ json: updated });
  });

  await page.goto('./');
  const bell = page.getByRole('button', { name: 'Notificaciones, 2 sin leer' });
  await expect(bell).toBeVisible();
  await bell.click();

  const dialog = page.getByRole('dialog', { name: 'Notificaciones' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Nuevo anuncio en el tablón')).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.screenshot({
    path: `docs/assets/notifications/notifications-${width}.png`,
    fullPage: true,
    animations: 'disabled',
  });

  // Mark one read and verify persistence after reload
  await dialog
    .getByRole('button', { name: 'Marcar como leída' })
    .first()
    .click();
  await expect(dialog.getByText('Leída', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(
    page.getByRole('button', { name: 'Notificaciones, 1 sin leer' }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Notificaciones, 1 sin leer' }),
  ).toBeVisible();

  // Mark all read and verify persistence after reload
  await page
    .getByRole('button', { name: 'Notificaciones, 1 sin leer' })
    .click();
  const reopenDialog = page.getByRole('dialog', { name: 'Notificaciones' });
  await reopenDialog
    .getByRole('button', { name: 'Marcar todas como leídas' })
    .click();
  await reopenDialog.getByRole('button', { name: 'Cerrar' }).click();
  await expect(
    page.getByRole('button', { name: 'Notificaciones', exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Notificaciones', exact: true }),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
