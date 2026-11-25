import { QueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomActivitiesListHandler,
  createClassroomDetailHandler,
  type ActivitySummaryPayload,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ActivitiesPanel } from './activities-panel';

const classroomId = '4e5f6a7b-0000-4000-8000-000000000044';
const NOW = '2026-11-24T12:00:00.000Z';

function activity(
  overrides: Partial<ActivitySummaryPayload> & { id: string; title: string },
): ActivitySummaryPayload {
  return {
    classroomId,
    type: 'TP',
    format: 'FILE',
    state: 'PUBLISHED',
    description: '',
    opensAt: null,
    dueAt: '2026-12-07T12:00:00.000Z',
    allowLate: false,
    maxScore: 10,
    weightMultiplier: 1,
    publishedAt: '2026-11-18T10:00:00.000Z',
    timeZone: 'America/Argentina/Buenos_Aires',
    questionCount: 0,
    createdAt: '2026-11-10T12:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
    ...overrides,
  };
}

const draft = activity({
  id: '6a6b6c6d-0000-4000-8000-0000000000b1',
  title: 'Borrador de ecuaciones',
  state: 'DRAFT',
  publishedAt: null,
  dueAt: '2026-11-30T12:00:00.000Z',
});
const open = activity({
  id: '6a6b6c6d-0000-4000-8000-0000000000b2',
  title: 'TP de funciones',
  dueAt: '2026-12-07T12:00:00.000Z',
});
const past = activity({
  id: '6a6b6c6d-0000-4000-8000-0000000000b3',
  title: 'Examen de álgebra',
  type: 'EXAM',
  format: 'MULTIPLE_CHOICE',
  questionCount: 4,
  dueAt: '2026-11-20T12:00:00.000Z',
});

// Menu and dialog flows with axe scans exceed the 5s default on busy machines.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
  vi.useRealTimers();
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  return render(
    <MemoryRouter>
      <SessionProvider service={session.service}>
        <Toast />
        <ActivitiesPanel classroomId={classroomId} />
      </SessionProvider>
    </MemoryRouter>,
    { queryClient },
  );
}

function useTeacher(items: readonly ActivitySummaryPayload[]) {
  mswServer.use(
    createClassroomDetailHandler(classroomId, {
      myRole: 'TEACHER',
      capabilities: ['publish_content'],
    }),
    createClassroomActivitiesListHandler({ classroomId, items }),
  );
}

async function openMenu(title: string): Promise<HTMLElement> {
  const trigger = await screen.findByRole('button', {
    name: `Acciones de «${title}»`,
  });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return trigger;
}

describe('Activities board for teachers', () => {
  test('groups activities by state: drafts, published and past due', async () => {
    useTeacher([draft, open, past]);
    renderPanel();

    const drafts = await screen.findByRole('region', { name: 'Borradores' });
    const published = screen.getByRole('region', { name: 'Publicadas' });
    const closed = screen.getByRole('region', { name: 'Vencidas' });

    expect(within(drafts).getByText(draft.title)).toBeInTheDocument();
    expect(within(drafts).queryByText(open.title)).not.toBeInTheDocument();
    expect(within(published).getByText(open.title)).toBeInTheDocument();
    expect(within(closed).getByText(past.title)).toBeInTheDocument();
  });

  test('omits groups that have no activities', async () => {
    useTeacher([open]);
    renderPanel();

    await screen.findByRole('region', { name: 'Publicadas' });
    expect(
      screen.queryByRole('region', { name: 'Borradores' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Vencidas' }),
    ).not.toBeInTheDocument();
  });

  test('each row shows type, title as detail link, relative and absolute due date and state badge', async () => {
    useTeacher([past, open]);
    renderPanel();

    const closed = await screen.findByRole('region', { name: 'Vencidas' });
    expect(within(closed).getByText('Examen')).toBeInTheDocument();
    expect(
      within(closed).getByRole('link', { name: /Examen de álgebra/ }),
    ).toHaveAttribute(
      'href',
      `/classrooms/${classroomId}/activities/${past.id}`,
    );
    expect(within(closed).getByText(/hace 4 días/i)).toBeInTheDocument();
    const time = closed.querySelector('time');
    expect(time).toHaveAttribute('datetime', past.dueAt);
    expect(within(closed).getByText('Vencida')).toBeInTheDocument();

    const published = screen.getByRole('region', { name: 'Publicadas' });
    expect(
      within(published).getByText(/dentro de 13 días/i),
    ).toBeInTheDocument();
  });

  test('keeps edit, publish and delete out of the row and inside the overflow menu', async () => {
    useTeacher([draft]);
    renderPanel();

    const trigger = await screen.findByRole('button', {
      name: `Acciones de «${draft.title}»`,
    });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Editar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Publicar/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Desactivar/ }),
    ).not.toBeInTheDocument();

    await openMenu(draft.title);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Editar', 'Publicar', 'Desactivar']);
  });

  test('the publish menu item exists only for drafts', async () => {
    useTeacher([open]);
    renderPanel();

    await openMenu(open.title);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Editar', 'Desactivar']);
  });

  test('the menu is keyboard operable: arrows move focus, Escape closes and returns focus to the trigger', async () => {
    useTeacher([draft]);
    renderPanel();

    const trigger = await openMenu(draft.title);
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    await waitFor(() => expect(items[0]).toHaveFocus());

    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    await waitFor(() => expect(items[1]).toHaveFocus());

    fireEvent.keyDown(items[1], { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test('the primary create action is a prominent "Nueva actividad" button', async () => {
    useTeacher([open]);
    renderPanel();

    expect(
      await screen.findByRole('button', { name: 'Nueva actividad' }),
    ).toBeEnabled();
  });

  test('delete from the menu asks for confirmation and cancel returns focus to the row menu', async () => {
    useTeacher([open]);
    renderPanel();

    const trigger = await openMenu(open.title);
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Desactivar' }));

    const confirmation = await screen.findByRole('heading', {
      name: `Confirmar desactivación de «${open.title}»`,
    });
    await waitFor(() => expect(confirmation).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(
      screen.queryByRole('heading', { name: /Confirmar desactivación/ }),
    ).not.toBeInTheDocument();
  });

  test('empty state offers a clear first action for teachers', async () => {
    useTeacher([]);
    renderPanel();

    const empty = await screen.findByRole('heading', {
      name: 'Todavía no hay actividades en el aula',
    });
    expect(empty).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Nueva actividad' }).length,
    ).toBeGreaterThan(0);
  });

  test('has no accessibility violations', async () => {
    useTeacher([draft, open, past]);
    const { container } = renderPanel();
    await screen.findByRole('region', { name: 'Borradores' });
    await expectAccessible(container);
  });
});

describe('Activities board for students', () => {
  const pending = {
    ...open,
    status: 'pending',
    canSubmit: true,
  } as unknown as ActivitySummaryPayload;
  const submitted = {
    ...activity({
      id: '6a6b6c6d-0000-4000-8000-0000000000b4',
      title: 'TP entregado',
    }),
    status: 'submitted',
    canSubmit: false,
  } as unknown as ActivitySummaryPayload;
  const graded = {
    ...activity({
      id: '6a6b6c6d-0000-4000-8000-0000000000b5',
      title: 'TP corregido',
    }),
    status: 'graded',
    canSubmit: false,
  } as unknown as ActivitySummaryPayload;
  const overdue = {
    ...past,
    status: 'overdue',
    canSubmit: false,
  } as unknown as ActivitySummaryPayload;

  function useStudent(items: readonly ActivitySummaryPayload[]) {
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'STUDENT',
        capabilities: ['participate_activities'],
      }),
      createClassroomActivitiesListHandler({ classroomId, items }),
    );
  }

  test('shows their own submission status grouped into to-do and delivered, without teacher actions', async () => {
    useStudent([pending, overdue, submitted, graded]);
    renderPanel();

    const todo = await screen.findByRole('region', { name: 'Pendientes' });
    const done = screen.getByRole('region', { name: 'Entregadas' });

    expect(within(todo).getByText(pending.title)).toBeInTheDocument();
    expect(within(todo).getByText('Pendiente')).toBeInTheDocument();
    expect(within(todo).getByText(overdue.title)).toBeInTheDocument();
    expect(within(todo).getByText('Atrasada')).toBeInTheDocument();
    expect(within(done).getByText('Entregada')).toBeInTheDocument();
    expect(within(done).getByText('Calificada')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /^Acciones de/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nueva actividad' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Borradores')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Ver actividad/ }).length).toBe(
      4,
    );
  });

  test('falls back to a single published group when the server sends no own status', async () => {
    useStudent([open]);
    renderPanel();

    const group = await screen.findByRole('region', { name: 'Publicadas' });
    expect(within(group).getByText(open.title)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Acciones de/ }),
    ).not.toBeInTheDocument();
  });
});
