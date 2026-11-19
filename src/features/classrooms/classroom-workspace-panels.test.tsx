import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter, Link } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { expect, test } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { render } from '@/test/render';
import { ClassroomWorkspace } from './classroom-workspace';
import { ClassroomPanelRoute } from './classroom-panel-route';
import { useClassroomPanels } from './panels/classroom-panels';

function SyntheticGrades() {
  return <input aria-label="Synthetic draft" defaultValue="" />;
}
const panels = [
  { key: 'grades', title: 'Synthetic grades', component: SyntheticGrades },
] as const;
function Consumer() {
  const { openPanel } = useClassroomPanels();
  return (
    <button onClick={(event) => openPanel('grades', event.currentTarget)}>
      Open grades
    </button>
  );
}
function setup(
  availablePanels: unknown = ['grades'],
  path = '/classrooms/a',
  productionCatalog = false,
  capabilities: readonly string[] = [],
) {
  let availability = availablePanels;
  let status = 200;
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  let holdRead = false;
  let releaseRead: (() => void) | undefined;
  const streamSignals: AbortSignal[] = [];
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        if (request.url.endsWith('/context-events')) {
          streamSignals.push(request.signal);
          return new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                stream = controller;
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }
        if (holdRead)
          await new Promise<void>((resolve) => {
            releaseRead = resolve;
          });
        const url = new URL(request.url);
        if (
          url.pathname.endsWith('/roster') ||
          url.pathname.endsWith('/invitations')
        ) {
          return Response.json({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        if (url.pathname.endsWith('/activities')) {
          return Response.json({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        if (url.pathname.endsWith('/submissions')) {
          return Response.json({
            items: [],
            page: 1,
            pageSize: 10,
            total: 0,
          });
        }
        // The default catalog maps `grades` to ClassroomGradesPanel (#44 + #46);
        // the TEACHER context without publish_content reads classroom metrics.
        if (url.pathname.endsWith('/activity-metrics')) {
          return Response.json({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
          });
        }
        const id = url.pathname.split('/').pop();
        return status !== 200
          ? new Response(null, { status })
          : Response.json({
              id,
              name: `Classroom ${id}`,
              subject: null,
              schoolId: null,
              independentTeacherId: null,
              adultMode: false,
              chatMuted: false,
              collaborationLocked: false,
              gamesDisabled: false,
              deskCount: 0,
              pet: null,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              myRole: 'TEACHER',
              capabilities,
              availablePanels: availability,
            });
      },
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: productionCatalog ? (
          <ClassroomWorkspace />
        ) : (
          <ClassroomWorkspace panels={panels} />
        ),
        children: [
          { index: true, Component: Consumer },
          { path: 'panels/:panelKey', Component: ClassroomPanelRoute },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
  return {
    router,
    session,
    streamSignals,
    hint: async (next: unknown = []) => {
      availability = next;
      holdRead = true;
      await act(async () => {
        stream?.enqueue(
          new TextEncoder().encode(
            'event: classroom.context-invalidated\ndata: {"classroomId":"a"}\n\n',
          ),
        );
      });
    },
    release: async () => {
      holdRead = false;
      await act(async () => {
        releaseRead?.();
      });
    },
    refresh: async (next: unknown, nextStatus = 200) => {
      availability = next;
      status = nextStatus;
      await act(() =>
        queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(profile.id, 'a'),
        }),
      );
    },
  };
}
const pendingCatalogCases = [
  ['chat', 'Chat'],

  ['settings', 'Configuración'],
] as const;

test('default catalog opens activities by URL with ActivitiesPanel and closes cleanly', async () => {
  const view = setup(['activities'], '/classrooms/a/panels/activities', true);
  const dialog = await screen.findByRole('dialog', { name: 'Actividades' });
  expect(dialog).toHaveTextContent('Trabajos prácticos y exámenes del aula.');
  expect(
    await within(dialog).findByText('Todavía no hay actividades'),
  ).toBeVisible();
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});

test('default catalog opens members by URL with the roster panel and closes cleanly', async () => {
  const view = setup(['members'], '/classrooms/a/panels/members', true);
  const dialog = await screen.findByRole('dialog', { name: 'Integrantes' });
  expect(dialog).toHaveTextContent('Nómina de estudiantes');
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});

test('default catalog opens members with tabs when invite_members is granted', async () => {
  setup(['members'], '/classrooms/a/panels/members', true, ['invite_members']);
  const dialog = await screen.findByRole('dialog', { name: 'Integrantes' });
  const rosterTab = await screen.findByRole('tab', { name: 'Nómina' });
  const invitationsTab = screen.getByRole('tab', {
    name: 'Invitaciones y código',
  });
  expect(rosterTab).toHaveAttribute('aria-selected', 'true');
  expect(dialog).toHaveTextContent('Nómina de estudiantes');

  fireEvent.mouseDown(invitationsTab);
  fireEvent.click(invitationsTab);
  expect(
    await screen.findByRole('heading', { name: 'Código de acceso al aula' }),
  ).toBeVisible();
});

test('default catalog opens shop by URL with ShopPanel and closes cleanly', async () => {
  const view = setup(['shop'], '/classrooms/a/panels/shop', true);
  const dialog = await screen.findByRole('dialog', { name: 'Tienda' });
  expect(
    await within(dialog).findByText('Tienda disponible solo para estudiantes'),
  ).toBeVisible();
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});

test('default catalog opens grades with teacher grading queue when publish_content is granted', async () => {
  setup(['grades'], '/classrooms/a/panels/grades', true, ['publish_content']);
  const dialog = await screen.findByRole('dialog', { name: 'Calificaciones' });
  expect(
    await within(dialog).findByRole('heading', { name: 'Cola de corrección' }),
  ).toBeVisible();
  expect(
    await within(dialog).findByText('Todavía no hay entregas para revisar'),
  ).toBeVisible();
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
});

test('default catalog opens grades by URL with the GradesPanel teacher view', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades', true);
  const dialog = await screen.findByRole('dialog', { name: 'Calificaciones' });
  expect(
    await screen.findByRole('heading', { name: 'Seguimiento del aula' }),
  ).toBeVisible();
  expect(dialog).toHaveTextContent('No hay alumnos para mostrar');
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});

test.each(pendingCatalogCases)(
  'default catalog opens %s by URL with honest pending content and no action capabilities',
  async (key, title) => {
    const view = setup([key], `/classrooms/a/panels/${key}`, true);
    const dialog = await screen.findByRole('dialog', { name: title });
    expect(dialog).toHaveTextContent('Funcionalidad pendiente');
    expect(dialog).toHaveTextContent(
      'Este panel todavía no incluye su contenido. Podés cerrarlo y volver al aula.',
    );
    expect(dialog).not.toHaveTextContent('Synthetic');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await screen.findByRole('button', { name: 'Open grades' });
    expect(view.router.state.location.pathname).toBe('/classrooms/a');
    expect(view.router.state.historyAction).toBe('REPLACE');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toHaveTextContent('Classroom a');
  },
);

test('default catalog opens material by URL with MaterialPanel and closes cleanly', async () => {
  const view = setup(['material'], '/classrooms/a/panels/material', true);
  const dialog = await screen.findByRole('dialog', { name: 'Material' });
  expect(dialog).toHaveTextContent('Cargando material del aula…');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});

test('default catalog opens notices by URL with NoticeBoardPanel and closes cleanly', async () => {
  const view = setup(['notices'], '/classrooms/a/panels/notices', true);
  const dialog = await screen.findByRole('dialog', { name: 'Avisos' });
  expect(dialog).toHaveTextContent('Tablón de anuncios');
  expect(dialog).not.toHaveTextContent('Funcionalidad pendiente');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.activeElement).toHaveTextContent('Classroom a');
});
test.each([
  [[], 'grades'],
  [['pet'], 'pet'],
  [['unknown'], 'unknown'],
  [undefined, 'settings'],
  [['settings', 42], 'settings'],
])(
  'default catalog denies %j for %s without exposing a panel',
  async (keys, key) => {
    setup(keys, `/classrooms/a/panels/${key}`, true);
    await screen.findByRole('heading', { name: 'Página no encontrada' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Funcionalidad pendiente'),
    ).not.toBeInTheDocument();
  },
);

test('default catalog shares controller opening and closes immediately on revoked availability', async () => {
  const view = setup(['grades'], '/classrooms/a', true);
  const trigger = await screen.findByRole('button', { name: 'Open grades' });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByRole('dialog', { name: 'Calificaciones' });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  await view.refresh([]);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await view.refresh(['grades']);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('default catalog drops an open panel when the classroom changes', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades', true);
  await screen.findByRole('dialog', { name: 'Calificaciones' });
  await act(() => view.router.navigate('/classrooms/b'));
  await screen.findByRole('heading', { name: 'Classroom b' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  expect(view.router.state.location.pathname).toBe('/classrooms/b');
});

test('SSE hint immediately removes private panel and guards until fresh REST confirmation', async () => {
  const view = setup();
  await open();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'restricted draft' },
  });
  await view.hint();
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await waitFor(() => {
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBeVisible();
    expect(document.activeElement).toHaveAccessibleName();
    expect(document.activeElement).toHaveAttribute('tabindex', '-1');
  });
  await view.release();
  await screen.findByRole('heading', { name: 'Classroom a' });
  await open();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(view.streamSignals).toHaveLength(1);
});

test('nested registry URL closes to the workspace without reopening or adding history', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog', { name: 'Synthetic grades' });
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await screen.findByRole('button', { name: 'Open grades' });
  expect(view.router.state.location.pathname).toBe('/classrooms/a');
  expect(view.router.state.historyAction).toBe('REPLACE');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each([
  [['grades'], 'unknown'],
  [[], 'grades'],
  [['settings'], 'settings'],
] as const)(
  'nested URL denies unavailable, unknown and unregistered keys uniformly (%j, %s)',
  async (availability, key) => {
    setup(availability, `/classrooms/a/panels/${key}`);
    await screen.findByRole('heading', { name: 'Página no encontrada' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);

test('invalidating a nested panel consumes the old URL intent and drops its draft', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'private' },
  });
  await view.hint(['grades']);
  await waitFor(() =>
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument(),
  );
  await view.release();
  await screen.findByRole('heading', { name: 'Classroom a' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('a user change cannot reopen the retained nested URL intent', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog');
  act(() =>
    view.session.set({
      status: 'authenticated',
      user: { ...profile, id: 'other' },
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await screen.findByRole('heading', { name: 'Classroom a' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('leaving a nested dialog for another classroom cannot redirect back or retain its draft', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'old draft' },
  });
  await act(() => view.router.navigate('/classrooms/b'));
  await screen.findByRole('heading', { name: 'Classroom b' });
  expect(view.router.state.location.pathname).toBe('/classrooms/b');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await open();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test('F1: valid to unknown URL removes the owned dialog and draft without redirecting', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'old draft' },
  });
  await act(() => view.router.navigate('/classrooms/a/panels/unknown'));
  await screen.findByRole('heading', { name: 'Página no encontrada' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(view.router.state.location.pathname).toBe(
    '/classrooms/a/panels/unknown',
  );
});

test('F1: old URL teardown cannot redirect or retain a draft in a newer valid URL', async () => {
  const view = setup(['grades'], '/classrooms/a/panels/grades');
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'old draft' },
  });
  await act(() =>
    view.router.navigate('/classrooms/a/panels/grades?replacement=1'),
  );
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  expect(view.router.state.location.pathname).toBe(
    '/classrooms/a/panels/grades',
  );
  expect(view.router.state.location.search).toBe('?replacement=1');
});

async function open() {
  const trigger = await screen.findByRole('button', { name: 'Open grades' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

test('workspace opens only server-available registered panels, without action capability inference', async () => {
  setup();
  const trigger = await open();
  expect(
    screen.getByRole('dialog', { name: 'Synthetic grades' }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

test.each([undefined, null, [], ['settings'], 'grades', { includes: true }])(
  'workspace denies absent or malformed availability %j despite teacher role',
  async (availability) => {
    // Pass undefined through explicitly instead of using setup's default.
    const view = setup([]);
    await screen.findByRole('button', { name: 'Open grades' });
    await view.refresh(availability);
    const trigger = await open();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  },
);

test('observed availability loss closes the panel and clears its draft without reopening', async () => {
  const view = setup();
  await open();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'private draft' },
  });
  await view.refresh([]);
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  await view.refresh(['grades']);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await open();
  expect(screen.getByRole('textbox')).toHaveValue('');
});

test.each([403, 404, 500])(
  'refresh failure %i removes the mounted panel host',
  async (status) => {
    const view = setup();
    await open();
    await view.refresh(['grades'], status);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Classroom a')).not.toBeInTheDocument();
  },
);

test.each(['classroom', 'user'] as const)(
  'changing %s clears the active panel and its draft',
  async (scope) => {
    const view = setup();
    await open();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'private draft' },
    });
    if (scope === 'classroom')
      await act(() => view.router.navigate('/classrooms/b'));
    else
      act(() =>
        view.session.set({
          status: 'authenticated',
          user: { ...profile, id: 'other-user' },
        }),
      );
    await screen.findByRole('heading', {
      name: scope === 'classroom' ? 'Classroom b' : 'Classroom a',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await open();
    expect(screen.getByRole('textbox')).toHaveValue('');
  },
);

test('clicking an outgoing Link inside an open panel navigates cleanly without bouncing back to the classroom', async () => {
  function OutgoingLinkPanel() {
    return (
      <Link to="/classrooms/a/activities/act-1">Open activity detail</Link>
    );
  }
  const outgoingPanels = [
    {
      key: 'activities',
      title: 'Outgoing activities',
      component: OutgoingLinkPanel,
    },
  ] as const;

  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({
      baseUrl: 'https://api.example.invalid',
      fetch: async (input) => {
        const request = input as Request;
        if (request.url.endsWith('/context-events')) {
          return new Response(new ReadableStream<Uint8Array>({ start() {} }), {
            headers: { 'content-type': 'text/event-stream' },
          });
        }
        return Response.json({
          id: 'a',
          name: 'Classroom a',
          subject: null,
          schoolId: null,
          independentTeacherId: null,
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          deskCount: 0,
          pet: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          myRole: 'STUDENT',
          capabilities: ['participate_activities'],
          availablePanels: ['activities'],
        });
      },
    }),
  );

  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: <ClassroomWorkspace panels={outgoingPanels} />,
        children: [
          { index: true, Component: Consumer },
          { path: 'panels/:panelKey', Component: ClassroomPanelRoute },
        ],
      },
      {
        path: '/classrooms/:classroomId/activities/:activityId',
        element: <h2>Activity detail destination</h2>,
      },
    ],
    { initialEntries: ['/classrooms/a/panels/activities'] },
  );

  render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  await screen.findByRole('dialog', { name: 'Outgoing activities' });
  fireEvent.click(screen.getByRole('link', { name: 'Open activity detail' }));

  expect(
    await screen.findByRole('heading', { name: 'Activity detail destination' }),
  ).toBeInTheDocument();
  await act(async () => {
    await Promise.resolve();
  });
  expect(router.state.location.pathname).toBe('/classrooms/a/activities/act-1');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
