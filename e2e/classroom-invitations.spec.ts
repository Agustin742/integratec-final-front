import { expect, test, type Page } from '@playwright/test';
import type { components } from '../src/api/schema.generated';
import { classroomMessages } from '../src/features/classrooms/messages';

const apiOrigin = 'https://api.example.invalid';
const userId = '00000000-0000-4000-8000-000000000001';
const classroomId = '4e5f6a7b-0000-4000-8000-000000000032';

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

const teacherClassroomContext: components['schemas']['ClassroomContextResponseDto'] =
  {
    id: classroomId,
    name: '4.º Año A - Historia',
    subject: 'Historia contemporánea',
    schoolId: null,
    independentTeacherId: userId,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'TEACHER',
    capabilities: ['configure_classroom', 'invite_members'],
    availablePanels: ['activities', 'members'],
    deskCount: 14,
    pet: null,
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T12:00:00.000Z',
  };

const studentClassroomContext: components['schemas']['ClassroomContextResponseDto'] =
  {
    ...teacherClassroomContext,
    myRole: 'STUDENT',
    capabilities: [],
    availablePanels: ['activities', 'members'],
  };

interface InvitationRecord {
  readonly id: string;
  readonly kind: 'EMAIL' | 'JOIN_CODE';
  readonly targetEmail: string | null;
  readonly role: 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT';
  readonly maxUses: number | null;
  readonly useCount: number;
  readonly state: 'PENDING' | 'USED' | 'REVOKED' | 'EXPIRED';
  readonly expiresAt: string;
  readonly createdAt: string;
}

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

test('teacher manages join code, issues and revokes invitations, and clears one-time secrets on leave', async ({
  page,
  context,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  let codeCounter = 0;
  let inviteCounter = 0;
  let invitations: InvitationRecord[] = [
    {
      id: '99999999-9999-4999-8999-999999999901',
      kind: 'EMAIL',
      targetEmail: 'previo@example.test',
      role: 'STUDENT',
      maxUses: 1,
      useCount: 0,
      state: 'PENDING',
      expiresAt: '2026-11-25T15:00:00.000Z',
      createdAt: '2026-11-18T12:00:00.000Z',
    },
    {
      id: '99999999-9999-4999-8999-999999999902',
      kind: 'EMAIL',
      targetEmail: 'matriculada@example.test',
      role: 'STUDENT',
      maxUses: 1,
      useCount: 1,
      state: 'USED',
      expiresAt: '2026-11-25T15:00:00.000Z',
      createdAt: '2026-11-17T10:00:00.000Z',
    },
  ];
  let activeJoinCodeExists = false;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }

    if (url.origin !== apiOrigin) {
      return route.abort();
    }

    if (url.pathname === '/users/me') {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: teacherClassroomContext });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/roster` &&
      request.method() === 'GET'
    ) {
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/invitations` &&
      request.method() === 'GET'
    ) {
      const status = url.searchParams.get('status') ?? 'PENDING';
      const filtered =
        status === 'ALL'
          ? invitations
          : invitations.filter((item) => item.state === status);
      return route.fulfill({
        json: {
          items: filtered,
          page: 1,
          pageSize: 20,
          total: filtered.length,
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/invitations` &&
      request.method() === 'POST'
    ) {
      const body = request.postDataJSON() as { email?: string };
      inviteCounter += 1;
      const created: InvitationRecord = {
        id: `99999999-9999-4999-8999-99999999910${inviteCounter}`,
        kind: 'EMAIL',
        targetEmail: (body.email ?? '').trim().toLowerCase(),
        role: 'STUDENT',
        maxUses: 1,
        useCount: 0,
        state: 'PENDING',
        expiresAt: '2026-11-25T15:00:00.000Z',
        createdAt: '2026-11-18T14:00:00.000Z',
      };
      invitations = [created, ...invitations];
      return route.fulfill({
        status: 201,
        json: {
          ...created,
          token: `e2e-one-time-token-${inviteCounter}`,
        },
      });
    }
    if (
      url.pathname.startsWith(`/classrooms/${classroomId}/invitations/`) &&
      request.method() === 'DELETE'
    ) {
      const targetId = url.pathname.split('/').pop();
      invitations = invitations.map((item) =>
        item.id === targetId ? { ...item, state: 'REVOKED' } : item,
      );
      return route.fulfill({
        json: { id: targetId, state: 'REVOKED' },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/join-code` &&
      request.method() === 'POST'
    ) {
      const body = (request.postDataJSON() as { maxUses?: number }) ?? {};
      codeCounter += 1;
      activeJoinCodeExists = true;
      const code = codeCounter === 1 ? 'K7P9X2M' : 'M3R8V5Q';
      return route.fulfill({
        status: 201,
        json: {
          id: `88888888-8888-4888-8888-88888888800${codeCounter}`,
          code,
          role: 'STUDENT',
          maxUses: body.maxUses ?? null,
          useCount: 0,
          state: 'PENDING',
          expiresAt: '2026-11-25T15:00:00.000Z',
          createdAt: '2026-11-18T14:00:00.000Z',
        },
      });
    }
    if (
      url.pathname === `/classrooms/${classroomId}/join-code` &&
      request.method() === 'DELETE'
    ) {
      if (!activeJoinCodeExists) {
        return route.fulfill({
          status: 404,
          json: {
            error: {
              code: 'NOT_FOUND',
              message: 'No active join code found',
              correlationId: 'corr-e2e-404',
            },
          },
        });
      }
      activeJoinCodeExists = false;
      return route.fulfill({
        json: { success: true, message: 'Join code revoked successfully' },
      });
    }

    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(`./classrooms/${classroomId}/panels/members`);

  const copy = classroomMessages.invitations;
  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.members,
    exact: true,
  });
  await expect(dialog).toBeVisible();

  await dialog
    .getByRole('tab', { name: classroomMessages.members.invitationsTab })
    .click();

  await expect(dialog.getByText('previo@example.test')).toBeVisible();

  await dialog.getByLabel(copy.joinCode.maxUsesLabel).fill('15');
  await dialog
    .getByRole('button', { name: copy.joinCode.generateSubmit, exact: true })
    .click();

  await expect(dialog.getByText('K7P9X2M', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(copy.joinCode.usesLabel(0, 15), { exact: true }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await dialog.getByText('K7P9X2M', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `docs/assets/classrooms/invitations-${width}.png`,
    fullPage: true,
  });

  await dialog
    .getByRole('button', { name: copy.joinCode.copyAction, exact: true })
    .click();
  const copiedCode = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedCode).toBe('K7P9X2M');

  await dialog
    .getByRole('button', { name: copy.joinCode.regenerateSubmit, exact: true })
    .click();
  await expect(
    dialog.getByRole('heading', { name: copy.joinCode.confirmRegenerateTitle }),
  ).toBeVisible();

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const confirmRegenerateBtn = dialog.getByRole('button', {
    name: copy.joinCode.confirmRegenerateSubmit,
    exact: true,
  });
  await confirmRegenerateBtn.scrollIntoViewIfNeeded();
  await expect(confirmRegenerateBtn).toBeInViewport();
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1';
  });

  await confirmRegenerateBtn.click();
  await expect(dialog.getByText('M3R8V5Q', { exact: true })).toBeVisible();
  await expect(dialog.getByText('K7P9X2M')).toHaveCount(0);

  // Leaving and reopening clears one-time code from UI state.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.goto(`./classrooms/${classroomId}/panels/members`);
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('tab', { name: classroomMessages.members.invitationsTab })
    .click();
  await expect(dialog.getByText('M3R8V5Q')).toHaveCount(0);

  // Email invitation issuance + revocation flow.
  await dialog
    .getByLabel(copy.email.emailLabel)
    .fill('nuevo.alumno@example.test');
  await dialog
    .getByRole('button', { name: copy.email.submitAction, exact: true })
    .click();

  await expect(
    dialog.getByText('e2e-one-time-token-1', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('nuevo.alumno@example.test', { exact: true }),
  ).toBeVisible();

  await dialog
    .getByRole('button', {
      name: copy.list.revokeAriaLabel('previo@example.test'),
    })
    .click();
  await dialog
    .getByRole('button', { name: copy.list.confirmRevokeSubmit, exact: true })
    .click();

  await expect(
    dialog.getByText('previo@example.test', { exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole('button', { name: copy.list.filters.REVOKED, exact: true })
    .click();
  await expect(
    dialog.getByText('previo@example.test', { exact: true }),
  ).toBeVisible();

  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('student does not see invitation controls or trigger invitation endpoints on /panels/members', async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === 'mobile' ? 360 : 1280;
  await page.setViewportSize({ width, height: 800 });
  const { cspViolations, pageErrors } = await attachRuntimeMonitors(page);

  let invitationRequests = 0;

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const baseURL = testInfo.project.use.baseURL;
    if (baseURL && url.origin === new URL(baseURL).origin) {
      return route.continue();
    }
    if (url.origin !== apiOrigin) {
      return route.abort();
    }

    if (url.pathname === '/users/me') {
      return route.fulfill({ json: profile });
    }
    if (url.pathname === `/classrooms/${classroomId}`) {
      return route.fulfill({ json: studentClassroomContext });
    }
    if (url.pathname === `/classrooms/${classroomId}/context-events`) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: ': heartbeat\n\n',
      });
    }
    if (url.pathname === `/classrooms/${classroomId}/roster`) {
      return route.fulfill({
        status: 403,
        json: {
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient role',
            correlationId: 'corr-student-403',
          },
        },
      });
    }
    if (
      url.pathname.includes('/invitations') ||
      url.pathname.includes('/join-code')
    ) {
      invitationRequests += 1;
      return route.fulfill({ status: 403, json: {} });
    }

    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto(`./classrooms/${classroomId}/panels/members`);

  const dialog = page.getByRole('dialog', {
    name: classroomMessages.panels.members,
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('tab', { name: classroomMessages.members.invitationsTab }),
  ).toHaveCount(0);
  await expect(
    dialog.getByText(classroomMessages.roster.forbiddenTitle, { exact: true }),
  ).toBeVisible();

  expect(invitationRequests).toBe(0);
  expect(cspViolations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
