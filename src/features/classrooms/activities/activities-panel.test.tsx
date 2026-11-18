import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { classroomActivityDetailQueryKey } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomActivitiesStore,
  createClassroomDetailHandler,
  TEST_API_BASE_URL,
  type ActivityStoreItem,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivitiesPanel } from './activities-panel';
import { ActivityDetailPage } from './activity-detail-page';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000010';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000005101';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

function makeActivity(
  overrides: Partial<ActivityStoreItem> = {},
): ActivityStoreItem {
  return {
    id: ACTIVITY_ID,
    classroomId: CLASSROOM_ID,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    title: 'TP 1: Funciones',
    description: 'Entregar el archivo PDF con los ejercicios resueltos.',
    opensAt: null,
    dueAt: '2026-11-25T02:30:00.000Z',
    allowLate: true,
    maxScore: 100,
    weightMultiplier: 1.5,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function renderActivitiesRoute(options: {
  readonly path?: string;
  readonly role?: 'TEACHER' | 'STUDENT' | 'PARENT';
  readonly capabilities?: readonly Capability[];
  readonly skipClassroomHandler?: boolean;
  readonly skipContextEventsHandler?: boolean;
}) {
  const role = options.role ?? 'STUDENT';
  const capabilities: Capability[] =
    options.capabilities !== undefined
      ? [...options.capabilities]
      : role === 'TEACHER'
        ? ['publish_content', 'configure_classroom']
        : role === 'PARENT'
          ? ['message_teacher']
          : ['participate_activities'];

  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  if (!options.skipClassroomHandler) {
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_ID, {
        myRole: role,
        capabilities,
      }),
    );
  }

  if (!options.skipContextEventsHandler) {
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/context-events`,
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
  }

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId',
        element: (
          <main>
            <ActivitiesPanel />
          </main>
        ),
      },
      {
        path: '/classrooms/:classroomId/activities/:activityId',
        element: (
          <main>
            <ActivityDetailPage />
          </main>
        ),
      },
    ],
    { initialEntries: [options.path ?? `/classrooms/${CLASSROOM_ID}`] },
  );

  const rendered = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return {
    ...rendered,
    queryClient,
    router,
    emitContextInvalidated: async () => {
      await waitFor(() => {
        expect(streamController).toBeDefined();
      });
      await act(async () => {
        streamController?.enqueue(
          new TextEncoder().encode(
            `event: classroom.context-invalidated\ndata: {"classroomId":"${CLASSROOM_ID}"}\n\n`,
          ),
        );
      });
    },
  };
}

describe('ActivitiesPanel and ActivityDetailPage', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
    document.title = '';
  });

  afterAll(() => {
    mswServer.close();
  });

  it('shows loading, error/retry, empty state, and published activities in school timeZone', async () => {
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-500',
      },
    });
    mswServer.use(...store.handlers);

    renderActivitiesRoute({ role: 'STUDENT' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cargando actividades',
    );
    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar las actividades',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    const list = await screen.findByRole('list', {
      name: 'Actividades del aula',
    });
    expect(within(list).getByText('TP 1: Funciones')).toBeInTheDocument();
    // 2026-11-25T02:30:00.000Z in America/Argentina/Buenos_Aires (-03:00) is 24/11/2026, 23:30
    expect(
      within(list).getByText(
        /24\/11\/2026, 23:30 \(America\/Argentina\/Buenos_Aires\)/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Estado de publicación'),
    ).not.toBeInTheDocument();

    await expectAccessible(document.body);
  });

  it('supports sorting and pagination (>10 items) and navigates to activity detail', async () => {
    const items = Array.from({ length: 12 }, (_, idx) =>
      makeActivity({
        id: `00000000-0000-4000-8000-${String(5200 + idx).padStart(12, '0')}`,
        title: `Actividad ${String(idx + 1).padStart(2, '0')}`,
        dueAt: `2026-11-${String(10 + idx).padStart(2, '0')}T15:00:00.000Z`,
      }),
    );
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: items,
    });
    mswServer.use(...store.handlers);

    const view = renderActivitiesRoute({ role: 'STUDENT' });
    expect(await screen.findByText('Actividad 01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Actividad 11')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ordenar por'), {
      target: { value: '-dueAt' },
    });
    expect(await screen.findByText('Actividad 12')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('link', { name: 'Ver actividad: Actividad 12' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Actividad 12' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Volver al aula' }),
    ).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(
      `/classrooms/${CLASSROOM_ID}/activities/00000000-0000-4000-8000-000000005211`,
    );
  });

  it('renders ActivityDetailPage tabs for student without correct answers and for teacher with review tab', async () => {
    const mcActivity = makeActivity({
      type: 'EXAM',
      format: 'MULTIPLE_CHOICE',
      opensAt: '2026-11-24T12:00:00.000Z',
      questionCount: 1,
      questions: [
        {
          id: '00000000-0000-4000-8000-000000006001',
          position: 1,
          prompt: 'Capital de Argentina',
          options: [
            {
              id: '00000000-0000-4000-8000-000000007001',
              position: 1,
              label: 'Buenos Aires',
              isCorrect: true,
            },
          ],
        },
      ],
    });
    const studentStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [mcActivity],
    });
    mswServer.use(...studentStore.handlers);

    const first = renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });

    expect(
      await screen.findByRole('heading', { name: 'TP 1: Funciones' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Capital de Argentina/)).toBeInTheDocument();
    expect(screen.queryByText('Correcta')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Entrega' })).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Revisión docente' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Puntaje máximo')).toBeInTheDocument();
    expect(screen.getByText('Ponderación')).toBeInTheDocument();
    expect(screen.getByText('Entrega tardía')).toBeInTheDocument();
    await expectAccessible(document.body);
    first.unmount();

    // Teacher view sees Correcta badge and Revisión docente tab, without Entrega tab
    const teacherStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [mcActivity],
    });
    mswServer.use(...teacherStore.handlers);
    renderActivitiesRoute({
      role: 'TEACHER',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });
    expect(await screen.findByText('Correcta')).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Revisión docente' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Entrega' }),
    ).not.toBeInTheDocument();
  });

  it('denies parent access to ActivitiesPanel list and ActivityDetailPage with 403 error state', async () => {
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialItems: [makeActivity()],
    });
    mswServer.use(...store.handlers);

    const listView = renderActivitiesRoute({ role: 'PARENT' });
    expect(
      await screen.findByRole('heading', {
        name: 'No tenés acceso a las actividades',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('TP 1: Funciones')).not.toBeInTheDocument();
    listView.unmount();

    renderActivitiesRoute({
      role: 'PARENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés acceso a esta actividad',
      }),
    ).toBeInTheDocument();
  });

  it('renders empty state, staff DRAFT filter with clear-filter, out-of-range page recovery, and non-default timeZone', async () => {
    const emptyStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [],
    });
    mswServer.use(...emptyStore.handlers);

    const first = renderActivitiesRoute({ role: 'STUDENT' });
    expect(
      await screen.findByRole('heading', {
        name: 'Todavía no hay actividades',
      }),
    ).toBeInTheDocument();
    first.unmount();

    // Staff state filter (PUBLISHED vs DRAFT -> empty filtered -> clear filter) + non-default IANA timeZone
    const staffStore = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [
        makeActivity({
          state: 'PUBLISHED',
          timeZone: 'America/Cordoba',
        }),
      ],
    });
    mswServer.use(...staffStore.handlers);

    const second = renderActivitiesRoute({ role: 'TEACHER' });
    expect(
      await screen.findByText(/24\/11\/2026, 23:30 \(America\/Cordoba\)/),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Estado de publicación'), {
      target: { value: 'DRAFT' },
    });
    expect(
      await screen.findByText(
        'No hay actividades para el estado seleccionado.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver todas las actividades' }),
    );
    expect(await screen.findByText('TP 1: Funciones')).toBeInTheDocument();
    second.unmount();

    // Out-of-range page recovery (page > 1 returns empty while total > 0 -> recover to page 1)
    const pagedItems = Array.from({ length: 11 }, (_, idx) =>
      makeActivity({
        id: `00000000-0000-4000-8000-${String(5300 + idx).padStart(12, '0')}`,
        title: `Actividad paginada ${String(idx + 1).padStart(2, '0')}`,
        dueAt: `2026-11-${String(10 + idx).padStart(2, '0')}T15:00:00.000Z`,
      }),
    );
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/activities`,
        ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page') ?? 1);
          if (page > 1) {
            return HttpResponse.json({
              items: [],
              page,
              pageSize: 10,
              total: 5,
            });
          }
          return HttpResponse.json({
            items: pagedItems.slice(0, 10),
            page: 1,
            pageSize: 10,
            total: 11,
          });
        },
      ),
    );

    renderActivitiesRoute({ role: 'STUDENT' });
    expect(
      await screen.findByText('Actividad paginada 01'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(
      await screen.findByRole('heading', {
        name: 'No hay más actividades en esta página',
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a la primera página' }),
    );
    expect(
      await screen.findByText('Actividad paginada 01'),
    ).toBeInTheDocument();
  });

  it('renders ErrorState immediately on ActivityDetailPage when classroom context fails (F-02)', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json(
          {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            correlationId: 'req-403',
          },
          { status: 403 },
        ),
      ),
    );

    renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
      skipClassroomHandler: true,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés acceso a esta actividad',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Volver al aula' }),
    ).toBeInTheDocument();
  });

  it('preserves ActivityDetailPage data with StaleDataNotice on transient refetch error (F-04) and handles 404', async () => {
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    mswServer.use(...store.handlers);

    const first = renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });
    expect(
      await screen.findByRole('heading', { name: 'TP 1: Funciones' }),
    ).toBeInTheDocument();
    expect(document.title).toContain('TP 1: Funciones');

    store.failNext('get', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Raw backend failure details',
        correlationId: 'req-503',
      },
    });
    await act(async () => {
      await first.queryClient.refetchQueries({
        queryKey: classroomActivityDetailQueryKey(
          profile.id,
          CLASSROOM_ID,
          ACTIVITY_ID,
        ),
      });
    });

    expect(
      await screen.findByText('Mostrando la última lista confirmada'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'TP 1: Funciones' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Entregar el archivo PDF con los ejercicios resueltos.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Raw backend failure details/),
    ).not.toBeInTheDocument();
    expect(document.title).toContain('TP 1: Funciones');
    first.unmount();

    // 404 on unknown activity
    renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/00000000-0000-4000-8000-000000009999`,
    });
    expect(
      await screen.findByRole('heading', { name: 'Actividad no encontrada' }),
    ).toBeInTheDocument();
    expect(document.title).not.toContain('TP 1: Funciones');
  });

  it('does not loop refetches on terminal 404 in ActivitiesPanel or ActivityDetailPage', async () => {
    let listRequests = 0;
    let detailRequests = 0;
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/activities`,
        () => {
          listRequests += 1;
          return HttpResponse.json(
            {
              error: {
                code: 'NOT_FOUND',
                message: 'Classroom not found.',
                correlationId: 'req-list-404',
              },
            },
            { status: 404 },
          );
        },
      ),
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
        () => {
          detailRequests += 1;
          return HttpResponse.json(
            {
              error: {
                code: 'NOT_FOUND',
                message: 'Activity not found.',
                correlationId: 'req-detail-404',
              },
            },
            { status: 404 },
          );
        },
      ),
    );

    const listView = renderActivitiesRoute({ role: 'STUDENT' });
    expect(
      await screen.findByRole('heading', { name: 'Aula no encontrada' }),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(listRequests).toBe(1);
    listView.unmount();

    const detailView = renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });
    expect(
      await screen.findByRole('heading', { name: 'Actividad no encontrada' }),
    ).toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(detailRequests).toBe(1);
    detailView.unmount();
  });

  it('reacts to live SSE revocation on ActivityDetailPage and resets document.title on 403/404', async () => {
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'STUDENT',
      initialItems: [makeActivity()],
    });
    mswServer.use(...store.handlers);

    // 1. Detail refetch returning 403 immediately hides private content and resets document.title
    const forbiddenView = renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
    });
    expect(
      await screen.findByRole('heading', { name: 'TP 1: Funciones' }),
    ).toBeInTheDocument();
    expect(document.title).toContain('TP 1: Funciones');

    store.failNext('get', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Access revoked',
        correlationId: 'req-403-revoked',
      },
    });
    await act(async () => {
      await forbiddenView.queryClient.refetchQueries({
        queryKey: classroomActivityDetailQueryKey(
          profile.id,
          CLASSROOM_ID,
          ACTIVITY_ID,
        ),
      });
    });

    expect(
      await screen.findByRole('heading', {
        name: 'No tenés acceso a esta actividad',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'TP 1: Funciones' }),
    ).not.toBeInTheDocument();
    expect(document.title).not.toContain('TP 1: Funciones');
    expect(document.title).toContain('Actividades');
    forbiddenView.unmount();

    // 2. Live SSE classroom.context-invalidated revokes access when classroom context returns 404
    let classroomRevoked = false;
    mswServer.use(
      ...store.handlers,
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        classroomRevoked
          ? HttpResponse.json(
              {
                error: {
                  code: 'NOT_FOUND',
                  message: 'Expelled',
                  correlationId: 'req-sse-404',
                },
              },
              { status: 404 },
            )
          : HttpResponse.json({
              id: CLASSROOM_ID,
              name: '3.º Año B',
              subject: 'Matemática',
              schoolId: null,
              independentTeacherId: null,
              adultMode: false,
              chatMuted: false,
              collaborationLocked: false,
              gamesDisabled: false,
              myRole: 'STUDENT',
              capabilities: ['participate_activities'],
              availablePanels: ['activities'],
              deskCount: 12,
              pet: null,
              createdAt: '2026-11-01T00:00:00.000Z',
              updatedAt: '2026-11-01T00:00:00.000Z',
            }),
      ),
    );

    const sseView = renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
      skipClassroomHandler: true,
    });
    expect(
      await screen.findByRole('heading', { name: 'TP 1: Funciones' }),
    ).toBeInTheDocument();
    expect(document.title).toContain('TP 1: Funciones');

    classroomRevoked = true;
    await sseView.emitContextInvalidated();

    expect(
      await screen.findByRole('heading', { name: 'Actividad no encontrada' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'TP 1: Funciones' }),
    ).not.toBeInTheDocument();
    expect(document.title).not.toContain('TP 1: Funciones');
    expect(document.title).toContain('Actividades');
  });

  it('hides Entrega tab for staff and falls back controlled tab to overview when demoted from review', async () => {
    let role: 'TEACHER' | 'STUDENT' = 'TEACHER';
    let capabilities: Capability[] = ['publish_content', 'configure_classroom'];

    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'TEACHER',
      initialItems: [makeActivity()],
    });

    mswServer.use(
      ...store.handlers,
      http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
        HttpResponse.json({
          id: CLASSROOM_ID,
          name: '3.º Año B',
          subject: 'Matemática',
          schoolId: null,
          independentTeacherId: null,
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          myRole: role,
          capabilities,
          availablePanels: ['activities'],
          deskCount: 12,
          pet: null,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
        }),
      ),
    );

    const view = renderActivitiesRoute({
      role: 'TEACHER',
      path: `/classrooms/${CLASSROOM_ID}/activities/${ACTIVITY_ID}`,
      skipClassroomHandler: true,
    });

    const reviewTab = await screen.findByRole('tab', {
      name: 'Revisión docente',
    });
    expect(
      screen.queryByRole('tab', { name: 'Entrega' }),
    ).not.toBeInTheDocument();

    // Activate the review tab (Radix Tabs responds to mouseDown / click / keyboard)
    fireEvent.mouseDown(reviewTab, { button: 0 });
    fireEvent.click(reviewTab);
    expect(reviewTab).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByText(
        'Próximamente vas a poder revisar entregas y calificar esta actividad desde esta sección.',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/HU-(?:ACT|COM)-\d+/);

    // Live demotion via SSE from TEACHER -> STUDENT while on 'review' tab
    role = 'STUDENT';
    capabilities = ['participate_activities'];
    await view.emitContextInvalidated();

    await waitFor(() => {
      expect(
        screen.queryByRole('tab', { name: 'Revisión docente' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: 'Entrega' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Consigna' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByText('Entregar el archivo PDF con los ejercicios resueltos.'),
    ).toBeVisible();
  });
});
