import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { messages } from '../src/app/messages';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const schoolId = '3f6c2d9e-0000-4000-8000-000000000011';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000101';

const profile: components['schemas']['OwnProfileDto'] = {
  id: userId,
  email: 'docente@example.test',
  displayName: 'Prof. Ana García',
  avatar: {
    bodyId: 'female',
    hairId: 'classic-short',
    topId: 'basic-tshirt',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
};

const teacherCapabilities: components['schemas']['ClassroomListItemDto']['capabilities'] =
  [
    'configure_classroom',
    'invite_members',
    'publish_content',
    'moderate_chat',
    'configure_bot',
    'view_metrics',
    'chat_classmates',
    'list_directory',
    'message_teacher',
  ];

const studentCapabilities: components['schemas']['ClassroomListItemDto']['capabilities'] =
  [
    'view_metrics',
    'participate_activities',
    'chat_classmates',
    'list_directory',
    'message_teacher',
  ];

async function attachRuntimeMonitors(page: Page) {
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
    window.addEventListener('securitypolicyviolation', (event) => {
      const report = window as unknown as {
        __recordCspViolation__?: (directive: string) => void;
      };
      report.__recordCspViolation__?.(
        `${event.violatedDirective}:${event.blockedURI}`,
      );
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  return { cspViolations, pageErrors };
}

test('teacher creates and configures a classroom, navigates to F16 workspace, and passes responsive/zoom checks', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  const serverItems: components['schemas']['ClassroomListItemDto'][] = [];

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }

    if (request.url() === `${apiOrigin}/users/me`) {
      expect(request.headers().authorization).toBe('Bearer synthetic-access');
      return route.fulfill({ json: profile });
    }

    if (url.origin === apiOrigin && url.pathname === '/users/me/daily-review') {
      return route.fulfill({ json: { status: 'not_due' } });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === '/me/classrooms' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          items: serverItems,
          page: 1,
          pageSize: 20,
          total: serverItems.length,
        },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === '/classrooms' &&
      request.method() === 'POST'
    ) {
      const body = request.postDataJSON() as {
        name: string;
        subject?: string;
        adultMode: boolean;
      };
      const created: components['schemas']['ClassroomListItemDto'] = {
        id: classroomId,
        name: body.name,
        subject: body.subject ?? null,
        schoolId,
        independentTeacherId: null,
        adultMode: body.adultMode,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'TEACHER',
        capabilities: teacherCapabilities,
        createdAt: '2026-11-17T21:00:00.000Z',
        updatedAt: '2026-11-17T21:00:00.000Z',
      };
      serverItems.splice(0, serverItems.length, created);
      return route.fulfill({
        status: 201,
        json: {
          ...created,
          deskCount: 12,
          pet: {
            id: '9a1b2c3d-0000-4000-8000-000000000001',
            name: 'Michi',
            species: 'cat',
            level: 1,
            experience: 0,
          },
        },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}` &&
      request.method() === 'PATCH'
    ) {
      const body = request.postDataJSON() as {
        name?: string;
        subject?: string | null;
        adultMode?: boolean;
      };
      const current = serverItems[0];
      const updated: components['schemas']['ClassroomListItemDto'] = {
        ...current,
        name: body.name ?? current.name,
        subject: body.subject === undefined ? current.subject : body.subject,
        adultMode: body.adultMode ?? current.adultMode,
        updatedAt: '2026-11-17T21:10:00.000Z',
      };
      serverItems.splice(0, serverItems.length, updated);
      return route.fulfill({
        status: 200,
        json: {
          ...updated,
          deskCount: 12,
          pet: null,
        },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}` &&
      request.method() === 'GET'
    ) {
      const current = serverItems[0];
      return route.fulfill({
        json: {
          ...current,
          deskCount: 12,
          pet: null,
          availablePanels: ['activities', 'material', 'grades', 'settings'],
        },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/desks` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/chats' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/me/family-threads' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/notifications' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/context-events`
    ) {
      await new Promise<void>((resolve) => page.once('close', () => resolve()));
      return;
    }

    if (
      url.origin === 'https://realtime.example.invalid' ||
      url.pathname.startsWith('/matchmake/')
    ) {
      return route.abort();
    }

    await route.abort();
    throw new Error(`Unexpected external request: ${request.method()} ${url}`);
  });

  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 2, name: messages.pages.home.title }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: classroomMessages.list.createFirstAction })
    .click();

  const createDialog = page.getByRole('dialog', {
    name: classroomMessages.form.createTitle,
  });
  await expect(createDialog).toBeVisible();

  await createDialog
    .getByLabel(classroomMessages.form.fields.name.label)
    .fill('3.º Año B - Matemática');
  await createDialog
    .getByLabel(classroomMessages.form.fields.subject.label)
    .fill('Matemática y Geometría');
  await createDialog
    .locator('label', {
      hasText: classroomMessages.form.fields.adultMode.options.adult.title,
    })
    .click();

  await createDialog
    .getByRole('button', { name: classroomMessages.form.actions.createSubmit })
    .click();

  await expect(createDialog).toHaveCount(0);
  await expect(
    page.getByText(classroomMessages.list.confirmedCreatedTitle, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 3, name: '3.º Año B - Matemática' }),
  ).toBeVisible();
  await expect(page.getByText('Matemática y Geometría')).toBeVisible();
  await expect(
    page.getByText(classroomMessages.list.paths.school),
  ).toBeVisible();
  await expect(
    page.getByText(classroomMessages.list.modes.adult),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.waitForFunction(() => {
    const toast = document.querySelector('[data-sonner-toast]');
    return toast ? getComputedStyle(toast).opacity === '1' : false;
  });

  await page.screenshot({
    path: `docs/assets/classrooms/list-${width}.png`,
    fullPage: true,
  });

  // Check 200% zoom fits horizontally without overflow.
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = '';
  });

  // Configure button opens dialog, Escape restores focus to configure button.
  const configureButton = page.getByRole('button', {
    name: classroomMessages.list.configureAction,
  });
  await configureButton.click();
  const editDialog = page.getByRole('dialog', {
    name: classroomMessages.form.editTitle,
  });
  await expect(editDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(editDialog).toHaveCount(0);
  await expect(configureButton).toBeFocused();

  await configureButton.click();
  await editDialog
    .getByLabel(classroomMessages.form.fields.name.label)
    .fill('3.º Año B - Álgebra');
  await editDialog
    .locator('label', {
      hasText: classroomMessages.form.fields.adultMode.options.school.title,
    })
    .click();
  await editDialog
    .getByRole('button', { name: classroomMessages.form.actions.editSubmit })
    .click();

  await expect(editDialog).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 3, name: '3.º Año B - Álgebra' }),
  ).toBeVisible();
  await expect(
    page.getByText(classroomMessages.list.modes.school),
  ).toBeVisible();

  // Navigate to F16 classroom workspace.
  await page
    .getByRole('link', { name: classroomMessages.list.enterAction })
    .click();
  await expect(page).toHaveURL(new RegExp(`/classrooms/${classroomId}$`));
  await expect(
    page.getByRole('heading', { level: 2, name: '3.º Año B - Álgebra' }),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student sees enrolled classroom link without create or configure controls', async ({
  page,
}, testInfo) => {
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  const studentItem: components['schemas']['ClassroomListItemDto'] = {
    id: classroomId,
    name: 'Biología I',
    subject: 'Ecología',
    schoolId,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: studentCapabilities,
    createdAt: '2026-11-17T18:00:00.000Z',
    updatedAt: '2026-11-17T18:00:00.000Z',
  };

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }

    if (request.url() === `${apiOrigin}/users/me`) {
      return route.fulfill({ json: profile });
    }

    if (url.origin === apiOrigin && url.pathname === '/users/me/daily-review') {
      return route.fulfill({ json: { status: 'not_due' } });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === '/me/classrooms' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: {
          items: [studentItem],
          page: 1,
          pageSize: 20,
          total: 1,
        },
      });
    }

    if (
      url.origin === apiOrigin &&
      url.pathname === `/classrooms/${classroomId}/desks` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/chats' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/me/family-threads' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({ json: { items: [] } });
    }
    if (
      url.origin === apiOrigin &&
      url.pathname === '/notifications' &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }

    await route.abort();
    throw new Error(`Unexpected external request: ${request.method()} ${url}`);
  });

  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 3, name: 'Biología I' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: classroomMessages.list.enterAction }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: classroomMessages.list.createAction }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', {
      name: classroomMessages.list.createFirstAction,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: classroomMessages.list.configureAction }),
  ).toHaveCount(0);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
