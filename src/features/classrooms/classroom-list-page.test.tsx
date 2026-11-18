import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { messages as appMessages } from '@/app/messages';
import { createAppRoutes } from '@/app/router/routes';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { storageKey, tokens } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomListHandler,
  createCreateClassroomHandler,
  createOwnProfileHandler,
  createUpdateClassroomHandler,
  type ClassroomListItemPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { classroomMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const teacherCapabilities: ClassroomListItemPayload['capabilities'] = [
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

const studentCapabilities: ClassroomListItemPayload['capabilities'] = [
  'view_metrics',
  'participate_activities',
  'chat_classmates',
  'list_directory',
  'message_teacher',
];

const parentCapabilities: ClassroomListItemPayload['capabilities'] = [
  'view_metrics',
  'message_teacher',
];

const teacherId = '00000000-0000-4000-8000-000000000001';
const schoolAId = '3f6c2d9e-0000-4000-8000-000000000011';
const schoolBId = '3f6c2d9e-0000-4000-8000-000000000022';

const independentTeacherClassroom: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000101',
  name: 'Taller de Física',
  subject: 'Mecánica clásica',
  schoolId: null,
  independentTeacherId: teacherId,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'TEACHER',
  capabilities: teacherCapabilities,
  createdAt: '2026-11-17T18:00:00.000Z',
  updatedAt: '2026-11-17T18:00:00.000Z',
};

const schoolTeacherClassroom: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000102',
  name: '3.º Año B - Matemática',
  subject: 'Álgebra y Geometría',
  schoolId: schoolAId,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'TEACHER',
  capabilities: teacherCapabilities,
  createdAt: '2026-11-17T19:00:00.000Z',
  updatedAt: '2026-11-17T19:00:00.000Z',
};

const schoolBAdminClassroom: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000103',
  name: 'CENS N° 4 - Historia',
  subject: 'Historia contemporánea',
  schoolId: schoolBId,
  independentTeacherId: null,
  adultMode: true,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'ADMIN',
  capabilities: teacherCapabilities,
  createdAt: '2026-11-17T19:30:00.000Z',
  updatedAt: '2026-11-17T19:30:00.000Z',
};

const studentClassroom: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000201',
  name: 'Biología I',
  subject: 'Ecología',
  schoolId: schoolAId,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'STUDENT',
  capabilities: studentCapabilities,
  createdAt: '2026-11-17T17:00:00.000Z',
  updatedAt: '2026-11-17T17:00:00.000Z',
};

const parentClassroom: ClassroomListItemPayload = {
  id: '4e5f6a7b-0000-4000-8000-000000000301',
  name: 'Lengua 2°A',
  subject: null,
  schoolId: schoolAId,
  independentTeacherId: null,
  adultMode: false,
  chatMuted: false,
  collaborationLocked: false,
  gamesDisabled: false,
  myRole: 'PARENT',
  capabilities: parentCapabilities,
  createdAt: '2026-11-17T16:00:00.000Z',
  updatedAt: '2026-11-17T16:00:00.000Z',
};

function seedAuthenticatedSession(tabOwner = 'tab-classrooms-test') {
  window.name = `\n[integratec-tab:${tabOwner}]`;
  window.sessionStorage.setItem(
    storageKey,
    JSON.stringify({
      ...tokens,
      expiresAt: Date.now() + 900_000,
      tabOwner,
    }),
  );
  return tabOwner;
}

function renderHomeRoute(options?: {
  readonly userId?: string;
  readonly displayName?: string;
  readonly queryClient?: QueryClient;
}) {
  const tabOwner = seedAuthenticatedSession();
  mswServer.use(
    createOwnProfileHandler({
      response: {
        id: options?.userId ?? teacherId,
        displayName: options?.displayName ?? 'Prof. Ana García',
      },
    }),
  );

  const session = createSession({
    baseUrl: TEST_API_BASE_URL,
    tabOwner: () => tabOwner,
  });
  const queryClient =
    options?.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: ['/'],
  });

  const view = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );

  return { router, session, queryClient, ...view };
}

describe('ClassroomListPage (/)', () => {
  test('shows loading, error with retry, and stale refresh notice while keeping visible items', async () => {
    let listCalls = 0;
    let releaseInitial!: () => void;
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });

    mswServer.use(
      createClassroomListHandler({
        resolveResponse: async () => {
          listCalls += 1;
          if (listCalls === 1) {
            await initialGate;
            return new HttpResponse(
              JSON.stringify({
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Database timeout',
                  correlationId: 'corr-list-1',
                },
              }),
              {
                status: 500,
                headers: { 'content-type': 'application/json' },
              },
            );
          }
          if (listCalls === 2) {
            return {
              items: [independentTeacherClassroom],
              page: 1,
              pageSize: 20,
              total: 1,
            };
          }
          return new HttpResponse(
            JSON.stringify({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Temporary error',
                correlationId: 'corr-list-3',
              },
            }),
            {
              status: 500,
              headers: { 'content-type': 'application/json' },
            },
          );
        },
      }),
    );

    const { container, queryClient } = renderHomeRoute();

    expect(
      await screen.findByText(classroomMessages.list.loading),
    ).toBeVisible();

    releaseInitial();

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(classroomMessages.list.errorTitle);
    expect(errorAlert).not.toHaveTextContent('Database timeout');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: independentTeacherClassroom.name,
      }),
    ).toBeVisible();
    await expectAccessible(container);

    // Trigger a failing background refresh while content is visible.
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(
      await screen.findByText(classroomMessages.list.staleTitle),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: independentTeacherClassroom.name,
      }),
    ).toBeVisible();
  });

  test('S1/S3: teacher creates classroom from empty state and sees server-confirmed path in list with link to F16', async () => {
    const serverItems: ClassroomListItemPayload[] = [];
    let capturedCreateBody: unknown = null;

    mswServer.use(
      createClassroomListHandler({
        resolveResponse: () => ({
          items: [...serverItems],
          page: 1,
          pageSize: 20,
          total: serverItems.length,
        }),
      }),
      createCreateClassroomHandler({
        resolveResponse: (body) => {
          capturedCreateBody = body;
          const created: ClassroomListItemPayload = {
            id: '4e5f6a7b-0000-4000-8000-000000000999',
            name: body.name,
            subject: body.subject ?? null,
            schoolId: schoolAId,
            independentTeacherId: null,
            adultMode: body.adultMode,
            chatMuted: false,
            collaborationLocked: false,
            gamesDisabled: false,
            myRole: 'TEACHER',
            capabilities: teacherCapabilities,
            createdAt: '2026-11-17T21:30:00.000Z',
            updatedAt: '2026-11-17T21:30:00.000Z',
          };
          serverItems.push(created);
          return {
            ...created,
            deskCount: 12,
            pet: {
              id: '9a1b2c3d-0000-4000-8000-000000000001',
              name: 'Michi',
              species: 'cat',
              level: 1,
              experience: 0,
            },
          };
        },
      }),
    );

    const { container } = renderHomeRoute();

    const emptyCreateButton = await screen.findByRole('button', {
      name: classroomMessages.list.createFirstAction,
    });
    expect(screen.getByText(classroomMessages.list.emptyTitle)).toBeVisible();
    await expectAccessible(container);

    fireEvent.click(emptyCreateButton);

    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.form.createTitle,
    });
    expect(
      within(dialog).getByText(
        classroomMessages.form.fields.adultMode.options.adult.description,
      ),
    ).toBeVisible();

    fireEvent.change(
      within(dialog).getByLabelText(classroomMessages.form.fields.name.label),
      {
        target: { value: '  4.º Año A - Química  ' },
      },
    );
    fireEvent.change(
      within(dialog).getByLabelText(
        classroomMessages.form.fields.subject.label,
      ),
      {
        target: { value: 'Química orgánica' },
      },
    );
    fireEvent.click(
      within(dialog).getByLabelText(
        classroomMessages.form.fields.adultMode.options.adult.title,
      ),
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.createSubmit,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(capturedCreateBody).toEqual({
      name: '4.º Año A - Química',
      subject: 'Química orgánica',
      adultMode: true,
    });

    const cardHeading = await screen.findByRole('heading', {
      level: 3,
      name: '4.º Año A - Química',
    });
    const card = cardHeading.closest('article')!;
    expect(card).toBeTruthy();
    expect(within(card).getByText('Química orgánica')).toBeVisible();
    expect(
      within(card).getByText(classroomMessages.list.paths.school),
    ).toBeVisible();
    expect(
      within(card).getByText(classroomMessages.list.modes.adult),
    ).toBeVisible();
    expect(
      within(card).getByRole('link', {
        name: classroomMessages.list.enterAction,
      }),
    ).toHaveAttribute(
      'href',
      '/classrooms/4e5f6a7b-0000-4000-8000-000000000999',
    );
    expect(
      within(card).getByRole('button', {
        name: classroomMessages.list.configureAction,
      }),
    ).toBeVisible();
  });

  test('S2: student and parent roles do not see create or configure controls', async () => {
    mswServer.use(
      createClassroomListHandler({
        items: [studentClassroom, parentClassroom],
      }),
    );

    const { container } = renderHomeRoute();

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: studentClassroom.name,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: parentClassroom.name }),
    ).toBeVisible();

    expect(
      screen.queryByRole('button', {
        name: classroomMessages.list.createAction,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.list.createFirstAction,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.list.configureAction,
      }),
    ).not.toBeInTheDocument();

    expect(
      screen.getAllByRole('link', { name: classroomMessages.list.enterAction }),
    ).toHaveLength(2);
    await expectAccessible(container);
  });

  test('S2: handles forced 403 forbidden on create and update without pretending success', async () => {
    mswServer.use(
      createClassroomListHandler({ items: [] }),
      createCreateClassroomHandler({
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Students and parents cannot create classrooms',
            correlationId: 'corr-create-403',
          },
        },
      }),
    );

    renderHomeRoute();

    fireEvent.click(
      await screen.findByRole('button', {
        name: classroomMessages.list.createFirstAction,
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.form.createTitle,
    });
    fireEvent.change(
      within(dialog).getByLabelText(classroomMessages.form.fields.name.label),
      { target: { value: 'Aula no autorizada' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.createSubmit,
      }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      classroomMessages.form.errors.forbidden,
    );

    // Close dialog (no unsaved prompt or confirm): creation controls must now be gone.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.cancel,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(classroomMessages.list.forbiddenAlertTitle),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.list.createFirstAction,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Aula no autorizada' }),
    ).not.toBeInTheDocument();
  });

  test('never marks uncertain 500/network creation as created, keeps input, and reconciles via server refetch', async () => {
    let listRequests = 0;
    const serverItems: ClassroomListItemPayload[] = [];
    let releaseCreate!: () => void;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    let createRequests = 0;

    mswServer.use(
      createClassroomListHandler({
        resolveResponse: () => {
          listRequests += 1;
          return {
            items: [...serverItems],
            page: 1,
            pageSize: 20,
            total: serverItems.length,
          };
        },
      }),
      createCreateClassroomHandler({
        resolveResponse: async () => {
          createRequests += 1;
          await createGate;
          return new HttpResponse(
            JSON.stringify({
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Uncertain write',
                correlationId: 'corr-500-create',
              },
            }),
            {
              status: 500,
              headers: { 'content-type': 'application/json' },
            },
          );
        },
      }),
    );

    renderHomeRoute();

    fireEvent.click(
      await screen.findByRole('button', {
        name: classroomMessages.list.createFirstAction,
      }),
    );
    const dialog = await screen.findByRole('dialog');
    const nameInput = within(dialog).getByLabelText(
      classroomMessages.form.fields.name.label,
    );
    fireEvent.change(nameInput, { target: { value: 'Taller de Arte' } });

    const submitButton = within(dialog).getByRole('button', {
      name: classroomMessages.form.actions.createSubmit,
    });
    // Rapid double click triggers only one request (duplicate-submit protection).
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(submitButton).toHaveAttribute('aria-disabled', 'true');
    });
    expect(createRequests).toBe(1);

    const listRequestsBeforeFailure = listRequests;
    releaseCreate();

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(
      classroomMessages.form.errors.uncertainWrite,
    );
    // Must keep form open with user input and trigger server reconciliation refetch.
    expect(nameInput).toHaveValue('Taller de Arte');
    await waitFor(() => {
      expect(listRequests).toBeGreaterThan(listRequestsBeforeFailure);
    });
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Taller de Arte' }),
    ).not.toBeInTheDocument();
  });

  test('edits classroom configuration, guards unsaved changes, and invalidates list and detail queries', async () => {
    let currentClassroom = { ...independentTeacherClassroom };
    let patchedBody: unknown = null;

    mswServer.use(
      createClassroomListHandler({
        resolveResponse: () => ({
          items: [currentClassroom],
          page: 1,
          pageSize: 20,
          total: 1,
        }),
      }),
      createUpdateClassroomHandler({
        classroomId: independentTeacherClassroom.id,
        resolveResponse: (_id, body) => {
          patchedBody = body;
          currentClassroom = {
            ...currentClassroom,
            name: body.name ?? currentClassroom.name,
            subject:
              body.subject === undefined
                ? currentClassroom.subject
                : body.subject,
            adultMode: body.adultMode ?? currentClassroom.adultMode,
            updatedAt: '2026-11-17T22:00:00.000Z',
          };
          return {
            ...currentClassroom,
            deskCount: 12,
            pet: null,
          };
        },
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const detailKey = classroomDetailQueryKey(
      teacherId,
      independentTeacherClassroom.id,
    );
    queryClient.setQueryData(detailKey, { stale: true });

    renderHomeRoute({ queryClient });

    fireEvent.click(
      await screen.findByRole('button', {
        name: classroomMessages.list.configureAction,
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.form.editTitle,
    });
    const nameInput = within(dialog).getByLabelText(
      classroomMessages.form.fields.name.label,
    );
    const subjectInput = within(dialog).getByLabelText(
      classroomMessages.form.fields.subject.label,
    );

    expect(nameInput).toHaveValue(independentTeacherClassroom.name);
    expect(subjectInput).toHaveValue(independentTeacherClassroom.subject!);

    fireEvent.change(nameInput, { target: { value: 'Física II' } });

    // Unsaved changes guard blocks close when user cancels confirmation.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.cancel,
      }),
    );
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeVisible();

    fireEvent.change(subjectInput, { target: { value: '' } });
    fireEvent.click(
      within(dialog).getByLabelText(
        classroomMessages.form.fields.adultMode.options.adult.title,
      ),
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.editSubmit,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(patchedBody).toEqual({
      name: 'Física II',
      subject: null,
      adultMode: true,
    });

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Física II' }),
    ).toBeVisible();
    expect(screen.getByText(classroomMessages.list.noSubject)).toBeVisible();
    expect(screen.getByText(classroomMessages.list.modes.adult)).toBeVisible();
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });

  test('shows active context switcher for multiple memberships, supports schoolId selection, and discards drafts on switch', async () => {
    let capturedSchoolId: string | undefined;
    mswServer.use(
      createClassroomListHandler({
        items: [
          independentTeacherClassroom,
          schoolTeacherClassroom,
          schoolBAdminClassroom,
          studentClassroom,
        ],
      }),
      createCreateClassroomHandler({
        resolveResponse: (body) => {
          capturedSchoolId = body.schoolId;
          return {
            ...schoolTeacherClassroom,
            id: '4e5f6a7b-0000-4000-8000-000000000555',
            name: body.name,
            schoolId: body.schoolId ?? schoolBId,
            deskCount: 12,
            pet: null,
          };
        },
      }),
    );

    renderHomeRoute();

    const switcher = await screen.findByRole('region', {
      name: classroomMessages.list.contextSwitcher.regionLabel,
    });
    expect(switcher).toBeVisible();

    // Multi-school teacher sees school selector when opening Create Classroom from All view.
    fireEvent.click(
      screen.getByRole('button', { name: classroomMessages.list.createAction }),
    );
    const dialog = await screen.findByRole('dialog');
    const schoolSelect = within(dialog).getByLabelText(
      classroomMessages.form.fields.schoolId.label,
    );
    fireEvent.change(schoolSelect, { target: { value: schoolBId } });
    fireEvent.change(
      within(dialog).getByLabelText(classroomMessages.form.fields.name.label),
      { target: { value: 'Química Nocturna' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.createSubmit,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(capturedSchoolId).toBe(schoolBId);

    // Switch active context to Independent Teacher: school classrooms must disappear.
    fireEvent.click(
      within(switcher).getByRole('button', {
        name: /Docente independiente/,
      }),
    );

    expect(
      screen.getByRole('heading', {
        level: 3,
        name: independentTeacherClassroom.name,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', {
        level: 3,
        name: schoolBAdminClassroom.name,
      }),
    ).not.toBeInTheDocument();
  });

  test('handles forced 403 on classroom update by showing forbidden error and reconciling stale controls', async () => {
    let listRequests = 0;
    mswServer.use(
      createClassroomListHandler({
        resolveResponse: () => {
          listRequests += 1;
          if (listRequests === 1) {
            return {
              items: [independentTeacherClassroom],
              page: 1,
              pageSize: 20,
              total: 1,
            };
          }
          return {
            items: [
              {
                ...independentTeacherClassroom,
                myRole: 'STUDENT',
                capabilities: studentCapabilities,
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
          };
        },
      }),
      createUpdateClassroomHandler({
        classroomId: independentTeacherClassroom.id,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Role downgraded to student',
            correlationId: 'corr-patch-403',
          },
        },
      }),
    );

    renderHomeRoute();

    fireEvent.click(
      await screen.findByRole('button', {
        name: classroomMessages.list.configureAction,
      }),
    );

    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.form.editTitle,
    });
    fireEvent.change(
      within(dialog).getByLabelText(classroomMessages.form.fields.name.label),
      { target: { value: 'Cambio rechazado' } },
    );
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.editSubmit,
      }),
    );

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      classroomMessages.form.errors.forbidden,
    );

    // Server reconciliation removes stale configure controls after role change.
    await waitFor(() => {
      expect(listRequests).toBeGreaterThanOrEqual(2);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: classroomMessages.form.actions.cancel,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', {
        name: classroomMessages.list.configureAction,
      }),
    ).not.toBeInTheDocument();
  });

  test('isolates classroom cache and resets active context when switching accounts', async () => {
    const userBId = '00000000-0000-4000-8000-000000000099';
    const userBClassroom: ClassroomListItemPayload = {
      ...studentClassroom,
      id: '4e5f6a7b-0000-4000-8000-000000000888',
      name: 'Aula exclusiva usuario B',
    };

    mswServer.use(
      createClassroomListHandler({
        resolveResponse: ({ request }) => {
          const auth = request.headers.get('authorization');
          if (auth === 'Bearer access-user-b') {
            return { items: [userBClassroom], page: 1, pageSize: 20, total: 1 };
          }
          return {
            items: [independentTeacherClassroom, schoolTeacherClassroom],
            page: 1,
            pageSize: 20,
            total: 2,
          };
        },
      }),
    );

    const firstView = renderHomeRoute({ userId: teacherId });
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: independentTeacherClassroom.name,
      }),
    ).toBeVisible();
    firstView.unmount();

    window.sessionStorage.clear();
    const tabOwnerB = seedAuthenticatedSession('tab-user-b');
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        ...tokens,
        accessToken: 'access-user-b',
        expiresAt: Date.now() + 900_000,
        tabOwner: tabOwnerB,
      }),
    );
    mswServer.use(
      createOwnProfileHandler({
        response: { id: userBId, displayName: 'Estudiante B' },
      }),
    );

    const sessionB = createSession({
      baseUrl: TEST_API_BASE_URL,
      tabOwner: () => tabOwnerB,
    });
    const routerB = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/'],
    });
    render(
      <SessionProvider service={sessionB}>
        <RouterProvider router={routerB} />
      </SessionProvider>,
      { queryClient: firstView.queryClient },
    );

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: userBClassroom.name,
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole('heading', {
        level: 3,
        name: independentTeacherClassroom.name,
      }),
    ).not.toBeInTheDocument();
  });

  test('renders page heading immediately with HomePage title for router/focus compatibility', async () => {
    mswServer.use(createClassroomListHandler({ items: [] }));
    renderHomeRoute();

    const h2 = await screen.findByRole('heading', {
      level: 2,
      name: appMessages.pages.home.title,
    });
    expect(h2).toBeVisible();
    expect(h2).toHaveAttribute('tabindex', '-1');
  });
});
