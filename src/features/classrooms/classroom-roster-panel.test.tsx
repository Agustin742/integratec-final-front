import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HttpResponse, http } from 'msw';
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
import { createApiClient } from '@/api/client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomRosterHandler,
  createClassroomRosterStore,
  createRemoveClassroomStudentHandler,
  type RosterStudentPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomPanelRoute } from './classroom-panel-route';
import { ClassroomRosterPanel } from './classroom-roster-panel';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const copy = classroomMessages.roster;
const classroomId = '4e5f6a7b-0000-4000-8000-000000000033';

const anaActive: RosterStudentPayload = {
  membershipId: '11111111-1111-4111-8111-111111111101',
  userId: '22222222-2222-4222-8222-222222222201',
  displayName: 'Ana Álvarez',
  state: 'ACTIVE',
  deletedAt: null,
  guardians: [
    {
      id: '33333333-3333-4333-8333-333333333301',
      displayName: 'Laura Álvarez',
      state: 'ACTIVE',
    },
  ],
};

const brunoActiveNoGuardians: RosterStudentPayload = {
  membershipId: '11111111-1111-4111-8111-111111111102',
  userId: '22222222-2222-4222-8222-222222222202',
  displayName: 'Bruno Benítez',
  state: 'ACTIVE',
  deletedAt: null,
  guardians: [],
};

const carlaInactive: RosterStudentPayload = {
  membershipId: '11111111-1111-4111-8111-111111111103',
  userId: '22222222-2222-4222-8222-222222222203',
  displayName: 'Carla Castro',
  state: 'INACTIVE',
  deletedAt: '2026-11-17T14:30:00.000Z',
  guardians: [
    {
      id: '33333333-3333-4333-8333-333333333303',
      displayName: 'Roberto Castro',
      state: 'INACTIVE',
    },
  ],
};

function renderRosterPanel(
  options: { readonly queryClient?: QueryClient } = {},
) {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const view = render(
    <SessionProvider service={session.service}>
      <Toast />
      <ClassroomRosterPanel classroomId={classroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { queryClient, session, ...view };
}

async function openActionsMenu(name: string) {
  const trigger = await screen.findByRole('button', {
    name: copy.actionsAriaLabel(name),
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return trigger;
}

async function chooseRemoval(name: string) {
  const trigger = await openActionsMenu(name);
  fireEvent.click(
    await screen.findByRole('menuitem', { name: copy.removeAction }),
  );
  await screen.findByRole('region', { name: copy.confirmTitle(name) });
  return trigger;
}

describe('ClassroomRosterPanel (#33)', () => {
  test('renders roster states, guardians, formatted deletedAt, and passes accessibility checks', async () => {
    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: [anaActive, brunoActiveNoGuardians, carlaInactive],
    });
    mswServer.use(...store.handlers);

    const { container } = renderRosterPanel();

    expect(await screen.findByText('Ana Álvarez')).toBeVisible();
    expect(screen.getByText('Laura Álvarez')).toBeVisible();
    expect(screen.getByText(copy.guardianStates.ACTIVE)).toBeVisible();

    expect(screen.getByText('Bruno Benítez')).toBeVisible();
    expect(screen.getByText(copy.guardiansEmpty)).toBeVisible();

    expect(screen.getByText('Carla Castro')).toBeVisible();
    expect(screen.getByText(copy.states.INACTIVE)).toBeVisible();
    expect(screen.getByText(/Baja lógica:/)).toBeVisible();
    expect(screen.getByText('Roberto Castro')).toBeVisible();
    expect(screen.getByText(copy.guardianStates.INACTIVE)).toBeVisible();

    expect(
      screen.getByRole('button', {
        name: copy.actionsAriaLabel('Ana Álvarez'),
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', {
        name: copy.actionsAriaLabel('Carla Castro'),
      }),
    ).not.toBeInTheDocument();
    // Identity and counts: initials disc and a student count next to the heading.
    expect(screen.getByText(copy.studentCount(3))).toBeVisible();
    expect(screen.getByText('AÁ')).toBeInTheDocument();

    await expectAccessible(container);
  });

  test('shows loading, initial error with retry, and stale refresh notice keeping confirmed rows', async () => {
    let releaseInitial!: () => void;
    const initialGate = new Promise<void>((resolve) => {
      releaseInitial = resolve;
    });
    let calls = 0;

    mswServer.use(
      createClassroomRosterHandler({
        classroomId,
        resolveResponse: async () => {
          calls += 1;
          if (calls === 1) {
            await initialGate;
            return HttpResponse.json(
              {
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'DB failure must never leak',
                  correlationId: 'corr-roster-1',
                },
              },
              { status: 500 },
            );
          }
          if (calls === 2) {
            return {
              items: [anaActive],
              page: 1,
              pageSize: 20,
              total: 1,
            };
          }
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Background refresh failure',
                correlationId: 'corr-roster-3',
              },
            },
            { status: 500 },
          );
        },
      }),
    );

    const { queryClient } = renderRosterPanel();
    expect(await screen.findByText(copy.loading)).toBeVisible();

    releaseInitial();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.errorTitle);
    expect(alert).not.toHaveTextContent('DB failure');

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ana Álvarez')).toBeVisible();

    await act(() => queryClient.invalidateQueries());
    expect(await screen.findByText(copy.staleTitle)).toBeVisible();
    expect(screen.getByText('Ana Álvarez')).toBeVisible();
  });

  test('supports state filter, prefix search, empty filtered recovery, and pagination', async () => {
    const manyStudents: RosterStudentPayload[] = Array.from(
      { length: 22 },
      (_, index) => ({
        membershipId: `11111111-1111-4111-8111-11111111${String(index).padStart(4, '0')}`,
        userId: `22222222-2222-4222-8222-22222222${String(index).padStart(4, '0')}`,
        displayName: `Estudiante ${String(index + 1).padStart(2, '0')}`,
        state: index === 0 ? 'INACTIVE' : 'ACTIVE',
        deletedAt: index === 0 ? '2026-11-17T10:00:00.000Z' : null,
        guardians: [],
      }),
    );
    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: manyStudents,
    });
    mswServer.use(...store.handlers);

    renderRosterPanel();

    expect(await screen.findByText('Estudiante 01')).toBeVisible();
    expect(screen.getByText('Estudiante 20')).toBeVisible();
    expect(screen.queryByText('Estudiante 21')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Estudiante 21')).toBeVisible();
    expect(screen.getByText('Estudiante 22')).toBeVisible();
    expect(screen.queryByText('Estudiante 01')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: copy.stateOptions.INACTIVE }),
    );
    expect(await screen.findByText('Estudiante 01')).toBeVisible();
    expect(screen.queryByText('Estudiante 21')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(copy.searchLabel), {
      target: { value: 'Zzz' },
    });
    expect(await screen.findByText(copy.emptyFilteredTitle)).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: copy.clearFiltersAction }),
    );
    expect(await screen.findByText('Estudiante 02')).toBeVisible();
  });

  test('renders non-disclosing 403 and 404 without member data and invalidates classroom detail on 404', async () => {
    mswServer.use(
      createClassroomRosterHandler({
        classroomId,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Student role cannot read staff roster',
            correlationId: 'corr-roster-403',
          },
        },
      }),
    );

    const view403 = renderRosterPanel();
    const alert403 = await screen.findByRole('alert');
    expect(alert403).toHaveTextContent(copy.forbiddenTitle);
    expect(alert403).not.toHaveTextContent('Student role');
    expect(screen.queryByText('Ana Álvarez')).not.toBeInTheDocument();
    view403.unmount();

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(classroomDetailQueryKey(profile.id, classroomId), {
      id: classroomId,
      name: 'Aula vieja',
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mswServer.use(
      createClassroomRosterHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Classroom not found for user',
            correlationId: 'corr-roster-404',
          },
        },
      }),
    );

    renderRosterPanel({ queryClient });
    const alert404 = await screen.findByRole('alert');
    expect(alert404).toHaveTextContent(copy.notFoundTitle);
    expect(alert404).not.toHaveTextContent('Classroom not found');
    expect(screen.queryByText('Ana Álvarez')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: classroomDetailQueryKey(profile.id, classroomId),
        exact: true,
      });
    });
  });

  test('removal flow shows history preservation, cancels with focus return, and reconciles on confirmation using userId', async () => {
    let releaseDelete!: () => void;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const deletedStudentIds: string[] = [];

    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: [anaActive, brunoActiveNoGuardians],
      onDeleteRequest: async (_request, studentUserId) => {
        deletedStudentIds.push(studentUserId);
        await deleteGate;
      },
    });
    mswServer.use(...store.handlers);

    renderRosterPanel();

    const trigger = await chooseRemoval('Ana Álvarez');

    const confirmRegion = await screen.findByRole('region', {
      name: copy.confirmTitle('Ana Álvarez'),
    });
    expect(confirmRegion).toHaveTextContent(copy.confirmDescription);
    expect(
      within(confirmRegion).getByRole('heading', { level: 4 }),
    ).toHaveFocus();

    fireEvent.click(
      within(confirmRegion).getByRole('button', { name: copy.confirmCancel }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: copy.confirmTitle('Ana Álvarez'),
        }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();

    await chooseRemoval('Ana Álvarez');
    const activeConfirmRegion = await screen.findByRole('region', {
      name: copy.confirmTitle('Ana Álvarez'),
    });
    const confirmSubmit = within(activeConfirmRegion).getByRole('button', {
      name: copy.confirmSubmit,
    });
    fireEvent.click(confirmSubmit);

    await waitFor(() => {
      expect(
        within(activeConfirmRegion).getByRole('button', {
          name: copy.confirmPending,
        }),
      ).toHaveAttribute('aria-disabled', 'true');
    });

    releaseDelete();

    await waitFor(() => {
      expect(
        screen.queryByRole('region', {
          name: copy.confirmTitle('Ana Álvarez'),
        }),
      ).not.toBeInTheDocument();
    });
    expect(deletedStudentIds).toEqual([anaActive.userId]);
    expect(deletedStudentIds).not.toContain(anaActive.membershipId);
    expect(await screen.findByText(copy.states.INACTIVE)).toBeVisible();
    expect(screen.getByText(copy.guardianStates.INACTIVE)).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 3, name: copy.heading }),
    ).toHaveFocus();
  });

  test('keeps confirmation open on removal failure and reconciles server state after uncertain failure', async () => {
    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: [anaActive],
    });
    mswServer.use(...store.handlers);

    renderRosterPanel();

    await chooseRemoval('Ana Álvarez');

    store.failNextDelete({
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Role downgraded',
        correlationId: 'corr-del-403',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: copy.confirmSubmit }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.removeForbidden);
    expect(alert).not.toHaveTextContent('Role downgraded');
    expect(store.read()[0]?.state).toBe('ACTIVE');

    // Dropped response after server actually deactivated Ana: uncertain error triggers reconcile.
    store.failNextDelete('drop-response');
    fireEvent.click(screen.getByRole('button', { name: copy.confirmSubmit }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(copy.removeUncertain);
    });
    expect(await screen.findByText(copy.states.INACTIVE)).toBeVisible();
    expect(store.read()[0]?.state).toBe('INACTIVE');
  });

  test('aborts in-flight removal cleanly on unmount without unhandled rejections', async () => {
    let observedAbort = false;
    let releaseDelete!: () => void;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });

    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: [anaActive],
    });
    mswServer.use(
      store.handlers[0],
      createRemoveClassroomStudentHandler({
        classroomId,
        onRequest: (request) => {
          request.signal.addEventListener('abort', () => {
            observedAbort = true;
          });
        },
        resolveResponse: async () => {
          await deleteGate;
        },
      }),
    );

    const view = renderRosterPanel();
    await chooseRemoval('Ana Álvarez');
    fireEvent.click(screen.getByRole('button', { name: copy.confirmSubmit }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: copy.confirmPending }),
      ).toHaveAttribute('aria-disabled', 'true');
    });

    view.unmount();
    expect(observedAbort).toBe(true);
    releaseDelete();
    await act(async () => {
      await Promise.resolve();
    });
  });

  test('F16 lost-access integration closes open members dialog and shows not-found immediately on revocation', async () => {
    let streamController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    let classroomStatus = 200;

    const store = createClassroomRosterStore({
      classroomId,
      initialStudents: [anaActive],
    });

    mswServer.use(
      ...store.handlers,
      http.get(`${TEST_API_BASE_URL}/classrooms/${classroomId}`, () =>
        classroomStatus === 200
          ? HttpResponse.json({
              id: classroomId,
              name: 'Aula de prueba',
              subject: null,
              schoolId: null,
              independentTeacherId: profile.id,
              adultMode: false,
              chatMuted: false,
              collaborationLocked: false,
              gamesDisabled: false,
              myRole: 'TEACHER',
              capabilities: ['invite_members'],
              availablePanels: ['members'],
              deskCount: 10,
              pet: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            })
          : HttpResponse.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Removed from classroom',
                  correlationId: 'corr-lost-access',
                },
              },
              { status: 404 },
            ),
      ),
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${classroomId}/context-events`,
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                streamController = controller;
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({ baseUrl: TEST_API_BASE_URL }),
    );
    const router = createMemoryRouter(
      [
        {
          path: '/classrooms/:classroomId',
          element: <ClassroomWorkspace />,
          children: [
            { path: 'panels/:panelKey', Component: ClassroomPanelRoute },
          ],
        },
      ],
      { initialEntries: [`/classrooms/${classroomId}/panels/members`] },
    );

    render(
      <SessionProvider service={session.service}>
        <Toast />
        <RouterProvider router={router} />
      </SessionProvider>,
      { queryClient },
    );

    const dialog = await screen.findByRole('dialog', {
      name: classroomMessages.panels.members,
    });
    expect(await within(dialog).findByText('Ana Álvarez')).toBeVisible();

    classroomStatus = 404;
    await act(async () => {
      streamController?.enqueue(
        new TextEncoder().encode(
          `event: classroom.context-invalidated\ndata: {"classroomId":"${classroomId}"}\n\n`,
        ),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole('heading', { name: 'Página no encontrada' }),
    ).toBeVisible();
    expect(screen.queryByText('Ana Álvarez')).not.toBeInTheDocument();
  });
});
