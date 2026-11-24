import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  createChatInboxStore,
  createClassroomDetailHandler,
  TEST_API_BASE_URL,
  type ChatInboxStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { createLiveRealtimeHarness } from '@/test/realtime/live-realtime-harness';
import { fakeSession } from '../router/fake-session';
import { createAppRoutes } from '../router/routes';

const USER_ID = profile.id;
const OTHER_ID = '00000000-0000-4000-8000-000000007002';
const CLASSROOM_A = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_B = '00000000-0000-4000-8000-000000000052';
const UNKNOWN = '00000000-0000-4000-8000-000000000099';

function message(
  id: string,
  minute: number,
  body: string,
): ChatInboxStoreMessage {
  return {
    id,
    authorId: OTHER_ID,
    authorDisplayName: 'Sofía Martínez',
    body,
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + minute * 60_000,
    ).toISOString(),
  };
}

const A1 = message('00000000-0000-4000-8000-600000000a01', 1, 'Hola mate');
const A2 = message(
  '00000000-0000-4000-8000-600000000a02',
  2,
  'Tarea para mañana',
);
const B1 = message(
  '00000000-0000-4000-8000-600000000b01',
  5,
  'Examen de lengua',
);

const ROOMS: Record<string, readonly ChatInboxStoreMessage[]> = {
  [CLASSROOM_A]: [A1, A2],
  [CLASSROOM_B]: [B1],
};

const historyHandler = http.get(
  `${TEST_API_BASE_URL}/classrooms/:id/messages`,
  ({ params }) => {
    const items = [...(ROOMS[String(params.id)] ?? [])].reverse().map((m) => ({
      id: m.id,
      classroomId: String(params.id),
      authorId: m.authorId,
      body: m.body,
      mentionedUserIds: [],
      createdAt: m.createdAt,
      hiddenAt: null,
      hiddenById: null,
    }));
    return HttpResponse.json({
      items,
      page: 1,
      pageSize: 20,
      total: items.length,
    });
  },
);

function setup(path: string, options: { empty?: boolean } = {}) {
  const store = createChatInboxStore({
    currentUserId: USER_ID,
    classrooms:
      options.empty === true
        ? []
        : [
            {
              classroomId: CLASSROOM_A,
              classroomName: 'Matemática',
              messages: ROOMS[CLASSROOM_A],
            },
            {
              classroomId: CLASSROOM_B,
              classroomName: 'Lengua',
              messages: ROOMS[CLASSROOM_B],
            },
          ],
  });
  mswServer.use(
    ...store.handlers,
    historyHandler,
    createClassroomDetailHandler(CLASSROOM_A, {
      name: 'Matemática',
      myRole: 'STUDENT',
      capabilities: ['chat_classmates'],
    }),
    createClassroomDetailHandler(CLASSROOM_B, {
      name: 'Lengua',
      myRole: 'STUDENT',
      capabilities: ['chat_classmates'],
    }),
  );
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const { sdk, LiveRealtimeProvider } = createLiveRealtimeHarness(session);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  const view = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <LiveRealtimeProvider>
          <RouterProvider router={router} />
        </LiveRealtimeProvider>
      </ApiQueryProvider>
    </SessionProvider>,
  );
  return { ...view, store, sdk, router };
}

const chatList = () =>
  screen.findByRole('navigation', { name: 'Chats de tus aulas' });

describe('ChatsPage', () => {
  beforeAll(() => mswServer.listen());
  beforeEach(() => {
    try {
      sessionStorage.clear();
    } catch {
      /* storage is optional */
    }
  });
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('starts with a back link to the classrooms list', async () => {
    setup('/chats');
    const back = await screen.findByRole('link', {
      name: 'Volver a mis aulas',
    });
    expect(back).toHaveAttribute('href', '/');
    expect(back).toHaveClass('min-h-11');
  });

  it('lists the chats of every classroom, latest first, with previews and unread', async () => {
    const { router } = setup('/chats');
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Mensajes' }),
    ).toBeVisible();
    const links = within(await chatList()).getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAccessibleName(
      /Lengua.*Sofía Martínez: Examen de lengua.*1 mensaje sin leer/,
    );
    expect(links[1]).toHaveAccessibleName(
      /Matemática.*Sofía Martínez: Tarea para mañana.*2 mensajes sin leer/,
    );
    expect(links[0]).toHaveAttribute('href', `/chats/${CLASSROOM_B}`);
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Elegí un chat')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/chats');
    expect(document.title).toBe('Mensajes · IntegrarTec');
  });

  it('opens a conversation from the list, marks it as current and clears its unread', async () => {
    const { router, store } = setup('/chats');
    const list = await chatList();
    fireEvent.click(within(list).getByRole('link', { name: /Matemática/ }));

    expect(router.state.location.pathname).toBe(`/chats/${CLASSROOM_A}`);
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Matemática' }),
    ).toBeVisible();
    expect(await screen.findByText('Tarea para mañana')).toBeVisible();
    expect(
      await screen.findByRole('textbox', { name: 'Mensaje del chat' }),
    ).toBeVisible();
    expect(
      within(list).getByRole('link', { name: /Matemática/ }),
    ).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Chat de Matemática · IntegrarTec');

    await waitFor(
      () => {
        expect(store.getMarkRequests()).toEqual([
          { classroomId: CLASSROOM_A, messageId: A2.id },
        ]);
      },
      { timeout: 4000 },
    );
    await waitFor(() => {
      expect(
        within(list).getByRole('link', { name: /Matemática/ }),
      ).not.toHaveAccessibleName(/sin leer/);
    });
    expect(
      within(list).getByRole('link', { name: /Lengua.*1 mensaje sin leer/ }),
    ).toBeInTheDocument();
  });

  it('shows the list alone on small screens at /chats and the conversation at /chats/:id', async () => {
    const first = setup('/chats');
    await chatList();
    const listPane = screen.getByTestId('chats-list-pane');
    const conversationPane = screen.getByTestId('chats-conversation-pane');
    expect(listPane.className).not.toContain('max-md:hidden');
    expect(conversationPane.className).toContain('max-md:hidden');
    expect(
      screen.queryByRole('link', { name: 'Volver a los chats' }),
    ).toBeNull();
    first.unmount();

    setup(`/chats/${CLASSROOM_A}`);
    await screen.findByRole('heading', { level: 3, name: 'Matemática' });
    expect(screen.getByTestId('chats-list-pane').className).toContain(
      'max-md:hidden',
    );
    expect(
      screen.getByTestId('chats-conversation-pane').className,
    ).not.toContain('max-md:hidden');
    const back = screen.getByRole('link', { name: 'Volver a los chats' });
    expect(back).toHaveAttribute('href', '/chats');
    expect(back.className).toContain('md:hidden');
  });

  it('goes back to the list from the conversation', async () => {
    const { router } = setup(`/chats/${CLASSROOM_A}`);
    fireEvent.click(
      await screen.findByRole('link', { name: 'Volver a los chats' }),
    );
    expect(router.state.location.pathname).toBe('/chats');
    expect(await screen.findByText('Elegí un chat')).toBeInTheDocument();
  });

  it('explains an unknown or forbidden chat and links back', async () => {
    setup(`/chats/${UNKNOWN}`);
    expect(
      await screen.findByRole('heading', { name: 'No encontramos ese chat' }),
    ).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Volver a los chats' }),
    ).toHaveAttribute('href', '/chats');
  });

  it('shows an empty state when the user has no chats', async () => {
    setup('/chats', { empty: true });
    expect(
      await screen.findByRole('heading', { name: 'Todavía no tenés chats' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: 'Chats de tus aulas' }),
    ).toBeNull();
  });

  it('shows a retryable error when the inbox cannot be loaded', async () => {
    const { store } = setup('/chats');
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'boom',
        correlationId: 'req-chats-500',
      },
    });
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await chatList()).toBeVisible();
  });

  it('hides the floating dock on the chats page', async () => {
    setup(`/chats/${CLASSROOM_A}`);
    await chatList();
    await screen.findByRole('heading', { level: 3, name: 'Matemática' });
    expect(screen.queryByRole('region', { name: 'Mensajes' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Mensajes/ })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('joins a classroom room only while its conversation is shown', async () => {
    const { sdk } = setup('/chats');
    const list = await chatList();
    expect(sdk.joinedClassrooms).toEqual([]);

    fireEvent.click(within(list).getByRole('link', { name: /Matemática/ }));
    await waitFor(() => {
      expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A]);
    });

    fireEvent.click(screen.getByRole('link', { name: 'Volver a los chats' }));
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_A)?.leave).toHaveBeenCalled();
    });
  });
});
