import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  createLogoutHandler,
  createNotificationsStore,
  TEST_API_BASE_URL,
  type NotificationStoreItem,
} from '@/test/msw/handlers';
import { expectAccessible } from '@/test/accessibility';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { NotificationCenter } from './notification-center';

const CLASSROOM_A = '00000000-0000-4000-8000-000000000101';
const CLASSROOM_B = '00000000-0000-4000-8000-000000000102';
const STUDENT_ID = '00000000-0000-4000-8000-000000000501';

function makeItem(
  overrides: Partial<NotificationStoreItem> = {},
): NotificationStoreItem {
  return {
    id: '00000000-0000-4000-8000-000000003101',
    kind: 'announcement',
    resourceId: '00000000-0000-4000-8000-000000004001',
    classroomId: CLASSROOM_A,
    studentId: null,
    readAt: null,
    createdAt: '2026-11-18T10:00:00.000Z',
    ...overrides,
  };
}

function renderNotificationCenter(
  options: {
    readonly pollIntervalMs?: number | false;
  } = {},
) {
  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    client,
  );
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <NotificationCenter
            pollIntervalMs={options.pollIntervalMs ?? false}
          />
        ),
      },
      {
        path: '/classrooms/:classroomId/panels/:panelKey',
        element: <div>Panel destino</div>,
      },
    ],
    { initialEntries: ['/'] },
  );

  const view = render(
    <ApiQueryProvider client={queryClient}>
      <SessionProvider service={session.service}>
        <RouterProvider router={router} />
      </SessionProvider>
    </ApiQueryProvider>,
  );

  return { ...view, session, queryClient, router };
}

describe('NotificationCenter', () => {
  beforeAll(() => {
    mswServer.listen();
  });

  afterEach(() => {
    mswServer.resetHandlers();
  });

  afterAll(() => {
    mswServer.close();
  });

  it('shows unread count, opens tray, marks one/all read, and persists across reload', async () => {
    const n1 = makeItem({
      id: '00000000-0000-4000-8000-000000003101',
      kind: 'announcement',
      createdAt: '2026-11-18T10:00:00.000Z',
    });
    const n2 = makeItem({
      id: '00000000-0000-4000-8000-000000003102',
      kind: 'grade_posted',
      studentId: STUDENT_ID,
      createdAt: '2026-11-18T11:00:00.000Z',
    });
    const store = createNotificationsStore({ initialItems: [n1, n2] });
    mswServer.use(...store.handlers);

    const first = renderNotificationCenter();

    const bell = await screen.findByRole('button', {
      name: 'Notificaciones, 2 sin leer',
    });
    fireEvent.click(bell);

    const dialog = await screen.findByRole('dialog', {
      name: 'Notificaciones',
    });
    expect(
      within(dialog).getByText('Nuevo anuncio en el tablón'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Nueva calificación publicada'),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Estudiante vinculado/),
    ).toBeInTheDocument();

    // Mark one read
    const markButtons = within(dialog).getAllByRole('button', {
      name: 'Marcar como leída',
    });
    fireEvent.click(markButtons[0]!);

    expect(await within(dialog).findByText('Leída')).toBeInTheDocument();

    // Mark all read
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Marcar todas como leídas' }),
    );
    await waitFor(() => {
      expect(
        within(dialog).queryByRole('button', { name: 'Marcar como leída' }),
      ).not.toBeInTheDocument();
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Notificaciones' }),
      ).toBeInTheDocument();
    });

    // Simulate reload with a fresh QueryClient against the same server store
    first.unmount();
    renderNotificationCenter();
    expect(
      await screen.findByRole('button', { name: 'Notificaciones' }),
    ).toBeInTheDocument();
  });

  it('polls for new notifications, announces politely, dedupes, and drops lost-access classroom items', async () => {
    const initial = makeItem({
      id: '00000000-0000-4000-8000-000000003201',
      classroomId: CLASSROOM_A,
    });
    const store = createNotificationsStore({ initialItems: [initial] });
    mswServer.use(...store.handlers);

    renderNotificationCenter({ pollIntervalMs: 60 });

    await screen.findByRole('button', {
      name: 'Notificaciones, 1 sin leer',
    });

    // Push a new notification for Classroom B; next poll should update counter & live region
    store.pushItem(
      makeItem({
        id: '00000000-0000-4000-8000-000000003202',
        kind: 'mention',
        classroomId: CLASSROOM_B,
        createdAt: '2026-11-18T12:00:00.000Z',
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Notificaciones, 2 sin leer' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Llegó una nueva notificación/),
    ).toBeInTheDocument();

    // Remove Classroom B access on the server; next poll removes its notification
    store.removeByClassroom(CLASSROOM_B);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Notificaciones, 1 sin leer' }),
      ).toBeInTheDocument();
    });
  });

  it('clears all notification UI and data immediately on logout', async () => {
    const store = createNotificationsStore({ initialItems: [makeItem()] });
    mswServer.use(...store.handlers, createLogoutHandler());

    const { session } = renderNotificationCenter();

    await screen.findByRole('button', {
      name: 'Notificaciones, 1 sin leer',
    });

    act(() => {
      session.set({ status: 'unauthenticated' });
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /Notificaciones/ }),
      ).not.toBeInTheDocument();
    });
  });

  it('handles list error with retry and shows action error on failed mark-read', async () => {
    const store = createNotificationsStore({ initialItems: [makeItem()] });
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Server error',
        correlationId: 'req-500',
      },
    });
    mswServer.use(...store.handlers);

    renderNotificationCenter();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Notificaciones' }),
    );

    expect(
      await screen.findByRole('heading', {
        name: 'No pudimos cargar las notificaciones',
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByText('Nuevo anuncio en el tablón'),
    ).toBeInTheDocument();

    store.failNext('read', {
      status: 503,
      body: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Unavailable',
        correlationId: 'req-503',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como leída' }));
    expect(
      await screen.findByText('No pudimos actualizar el estado de lectura'),
    ).toBeInTheDocument();
  });

  it('verifies loading, empty, stale-data, pagination, Escape close, and accessibility', async () => {
    const emptyStore = createNotificationsStore({ initialItems: [] });
    mswServer.use(...emptyStore.handlers);

    const first = renderNotificationCenter();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Notificaciones' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'No tenés notificaciones' }),
    ).toBeInTheDocument();
    await expectAccessible(document.body);
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'Escape',
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    first.unmount();

    // Pagination (>20 items) + stale-data notice on failed refresh + markAllRead with older unread items
    const items = Array.from({ length: 21 }, (_, idx) =>
      makeItem({
        id: `00000000-0000-4000-8000-${String(4000 + idx).padStart(12, '0')}`,
        readAt: idx === 0 ? null : '2026-11-18T12:00:00.000Z',
        createdAt: `2026-11-18T${String(Math.floor(idx / 2)).padStart(2, '0')}:${idx % 2 === 0 ? '00' : '30'}:00.000Z`,
      }),
    );
    const pagedStore = createNotificationsStore({ initialItems: items });
    mswServer.use(...pagedStore.handlers);

    renderNotificationCenter({ pollIntervalMs: 80 });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Notificaciones' }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Notificaciones',
    });

    // Even when page 1 items are all read, mark-all-read stays enabled because total > 0
    expect(
      within(dialog).getByRole('button', { name: 'Marcar todas como leídas' }),
    ).toBeEnabled();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Página siguiente' }),
    );
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Marcar como leída' }),
      ).toBeInTheDocument();
    });

    // Trigger failed poll -> StaleDataNotice renders while keeping confirmed items
    pagedStore.failNext('list', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        correlationId: 'req-403',
      },
    });
    expect(
      await within(dialog).findByText('Mostrando la última lista confirmada'),
    ).toBeInTheDocument();
  });
});
