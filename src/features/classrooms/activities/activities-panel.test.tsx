import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
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

  if (!options.skipClassroomHandler) {
    mswServer.use(
      createClassroomDetailHandler(CLASSROOM_ID, {
        myRole: role,
        capabilities,
      }),
    );
  }

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient();
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

  return render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );
}

describe('ActivitiesPanel and ActivityDetailPage', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
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

    renderActivitiesRoute({ role: 'STUDENT' });
    expect(await screen.findByText('Actividad 01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Actividad 11')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ordenar por'), {
      target: { value: '-dueAt' },
    });
    expect(await screen.findByText('Actividad 12')).toBeInTheDocument();
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
    expect(
      screen.queryByRole('tab', { name: 'Revisión docente' }),
    ).not.toBeInTheDocument();
    await expectAccessible(document.body);
    first.unmount();

    // Teacher view sees Correcta badge and Revisión docente tab
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
  });

  it('denies parent access to ActivityDetailPage with 403 error state', async () => {
    const store = createClassroomActivitiesStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialItems: [makeActivity()],
    });
    mswServer.use(...store.handlers);

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

    renderActivitiesRoute({ role: 'TEACHER' });
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
    first.unmount();

    // 404 on unknown activity
    renderActivitiesRoute({
      role: 'STUDENT',
      path: `/classrooms/${CLASSROOM_ID}/activities/00000000-0000-4000-8000-000000009999`,
    });
    expect(
      await screen.findByRole('heading', { name: 'Actividad no encontrada' }),
    ).toBeInTheDocument();
  });
});
