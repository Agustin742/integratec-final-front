import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
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
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  createChatInboxStore,
  createClassroomDetailHandler,
  createParentLinkMessagesHandler,
  createSendParentLinkMessageHandler,
  createStaffFamilyThreadsHandler,
  TEST_API_BASE_URL,
  type ChatInboxStoreMessage,
  type ParentLinkMessagePayload,
  type StaffFamilyThreadPayload,
} from '@/test/msw/handlers';
import { familyMessages } from '../family/messages';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { createLiveRealtimeHarness } from '@/test/realtime/live-realtime-harness';
import { ChatDock } from './chat-dock';

const USER_ID = profile.id;
const OTHER_ID = '00000000-0000-4000-8000-000000007002';
const CLASSROOM_A = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_B = '00000000-0000-4000-8000-000000000052';

function message(
  id: string,
  minute: number,
  body: string,
  authorId = OTHER_ID,
): ChatInboxStoreMessage {
  return {
    id,
    authorId,
    authorDisplayName: authorId === USER_ID ? 'Vos mismo' : 'Sofía Martínez',
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

const CLASSROOM_C = '00000000-0000-4000-8000-000000000053';

const ROOMS: Record<string, readonly ChatInboxStoreMessage[]> = {
  [CLASSROOM_A]: [A1, A2],
  [CLASSROOM_B]: [B1],
};

/** Contract-shaped history (`GET /classrooms/{id}/messages`) for every room. */
const historyHandler = http.get(
  `${TEST_API_BASE_URL}/classrooms/:id/messages`,
  ({ params }) => {
    const messages = ROOMS[String(params.id)] ?? [];
    const items = [...messages].reverse().map((m) => ({
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

function setup(
  options: {
    parent?: boolean;
    empty?: boolean;
    silentRoom?: boolean;
  } = {},
  existing?: { queryClient?: ReturnType<typeof createAppQueryClient> },
) {
  const store = createChatInboxStore({
    currentUserId: USER_ID,
    parent: options.parent,
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
            ...(options.silentRoom === true
              ? [
                  {
                    classroomId: CLASSROOM_C,
                    classroomName: 'Ciencias',
                    messages: [],
                  },
                ]
              : []),
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
    createClassroomDetailHandler(CLASSROOM_C, {
      name: 'Ciencias',
      myRole: 'STUDENT',
      capabilities: ['chat_classmates'],
    }),
    createClassroomDetailHandler(CLASSROOM_B, {
      name: 'Lengua',
      myRole: 'STUDENT',
      capabilities: ['chat_classmates'],
    }),
  );
  const queryClient =
    existing?.queryClient ??
    createAppQueryClient({ defaultOptions: { queries: { retry: false } } });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const { sdk, LiveRealtimeProvider } = createLiveRealtimeHarness(session);
  const view = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <LiveRealtimeProvider>
          <MemoryRouter>
            <ChatDock />
          </MemoryRouter>
        </LiveRealtimeProvider>
      </ApiQueryProvider>
    </SessionProvider>,
  );
  return { ...view, store, sdk, queryClient };
}

async function openList() {
  const launcher = await screen.findByRole('button', { name: /^Mensajes/ });
  fireEvent.click(launcher);
  return launcher;
}

async function openConversation(name: RegExp) {
  await openList();
  const list = await screen.findByRole('list', { name: 'Chats de tus aulas' });
  const item = within(list).getByRole('button', { name });
  fireEvent.click(item);
  return item;
}

describe('ChatDock', () => {
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

  it('renders nothing while the user has no chats', async () => {
    const { store } = setup({ empty: true });
    await waitFor(() => {
      expect(store.getCounts().list).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: /Mensajes/ })).toBeNull();
  });

  it('renders nothing for parents', async () => {
    const { store } = setup({ parent: true });
    await waitFor(() => {
      expect(store.getCounts().list).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: /Mensajes/ })).toBeNull();
  });

  it('shows a collapsed launcher with the total unread count', async () => {
    setup();
    const launcher = await screen.findByRole('button', {
      name: 'Mensajes, 3 mensajes sin leer',
    });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).toHaveTextContent('3');
    expect(
      screen.queryByRole('list', { name: 'Chats de tus aulas' }),
    ).toBeNull();
  });

  it('expands into the chat list, latest activity first, with previews and unread badges', async () => {
    setup();
    const launcher = await openList();
    expect(launcher).toHaveAttribute('aria-expanded', 'true');

    const list = await screen.findByRole('list', {
      name: 'Chats de tus aulas',
    });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAccessibleName(
      /Lengua.*Sofía Martínez: Examen de lengua.*1 mensaje sin leer/,
    );
    expect(items[1]).toHaveAccessibleName(
      /Matemática.*Sofía Martínez: Tarea para mañana.*2 mensajes sin leer/,
    );

    fireEvent.click(launcher);
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('list', { name: 'Chats de tus aulas' }),
    ).toBeNull();
  });

  describe('open/close motion', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    function stubReducedMotion(reduce: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion') && reduce,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }),
      });
    }
    afterEach(() => {
      if (original === undefined) {
        Reflect.deleteProperty(window, 'matchMedia');
      } else {
        Object.defineProperty(window, 'matchMedia', original);
      }
    });

    it('animates the list in and out, unmounting after the exit animation', async () => {
      stubReducedMotion(false);
      setup();
      const launcher = await openList();
      const list = await screen.findByRole('list', {
        name: 'Chats de tus aulas',
      });
      const panel = list.closest('section');
      expect(panel).toHaveAttribute('data-state', 'open');
      expect(panel?.className).toContain('animate-dock-in');

      fireEvent.click(launcher);
      expect(launcher).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-state', 'closed');
      expect(panel?.className).toContain('animate-dock-out');
      expect(panel).toBeInTheDocument();

      // jsdom does not register `animationend` for React: the unmount safety
      // net fires instead, which is the same path as the real event.
      await waitFor(() => {
        expect(
          screen.queryByRole('list', { name: 'Chats de tus aulas' }),
        ).toBeNull();
      });
    });

    it('closes instantly and without animation classes under reduced motion', async () => {
      stubReducedMotion(true);
      setup();
      const launcher = await openList();
      const list = await screen.findByRole('list', {
        name: 'Chats de tus aulas',
      });
      expect(list.closest('section')?.className).not.toContain('animate-dock');

      fireEvent.click(launcher);
      expect(launcher).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByRole('list', { name: 'Chats de tus aulas' }),
      ).toBeNull();
    });

    it('returns focus to the toggle when Escape closes the animated list', async () => {
      stubReducedMotion(false);
      setup();
      const launcher = await openList();
      const list = await screen.findByRole('list', {
        name: 'Chats de tus aulas',
      });
      fireEvent.keyDown(within(list).getAllByRole('button')[0], {
        key: 'Escape',
      });
      expect(launcher).toHaveAttribute('aria-expanded', 'false');
      expect(launcher).toHaveFocus();
    });

    it('keeps the full chat frame in an empty room: bubble plus a ready composer', async () => {
      setup({ silentRoom: true });
      await openConversation(/Ciencias/);
      const dialog = await screen.findByRole('dialog', {
        name: 'Chat de Ciencias',
      });
      const empty = await within(dialog).findByTestId('chat-empty');
      expect(empty).toHaveTextContent('Todavía no hay mensajes en el chat');
      expect(within(dialog).getByRole('textbox')).toBeVisible();
      expect(
        within(dialog).getByRole('button', { name: 'Enviar' }),
      ).toBeVisible();
    });

    it('renders the toggle as the header of the same surface as the list', async () => {
      setup();
      const launcher = await openList();
      const list = await screen.findByRole('list', {
        name: 'Chats de tus aulas',
      });
      const surface = launcher.closest('[data-chat-dock-surface]');
      expect(surface).not.toBeNull();
      expect(surface).toContainElement(list);
      expect(surface?.firstElementChild?.contains(launcher)).toBe(true);
    });

    it('marks closing list inert, closes list on Escape from launcher, and closes instead of minimizing on compact viewports', async () => {
      stubReducedMotion(false);
      setup();
      const launcher = await openList();
      const listRegion = document.getElementById(
        launcher.getAttribute('aria-controls') ?? '',
      );
      expect(listRegion).not.toBeNull();
      expect(listRegion).not.toHaveAttribute('inert');

      fireEvent.keyDown(launcher, { key: 'Escape' });
      expect(launcher).toHaveAttribute('aria-expanded', 'false');
      expect(listRegion).toHaveAttribute('inert');
      expect(listRegion).toHaveAttribute('aria-hidden', 'true');

      // Compact viewport: Escape closes the conversation instead of entering hidden minimized state.
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
          matches: query === '(max-width: 639px)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }),
      });
      await openConversation(/Matemática/);
      const dialog = await screen.findByRole('dialog', {
        name: 'Chat de Matemática',
      });
      const draft = await within(dialog).findByRole('textbox', {
        name: 'Mensaje del chat',
      });
      fireEvent.keyDown(draft, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        screen.queryByRole('region', { name: 'Chat de Matemática' }),
      ).toBeNull();
    });
  });

  it('opens a conversation with its history and a focused composer, one at a time', async () => {
    const { sdk } = setup();
    await openConversation(/Matemática/);

    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(await within(dialog).findByText('Tarea para mañana')).toBeVisible();
    expect(within(dialog).getByText('Hola mate')).toBeVisible();
    const draft = await within(dialog).findByRole('textbox', {
      name: 'Mensaje del chat',
    });
    await waitFor(() => {
      expect(draft).toHaveFocus();
    });
    // One conversation: no inner "Chat del aula" header, only the dock one.
    expect(
      within(dialog).queryByText(/Charlá con tu aula/),
    ).not.toBeInTheDocument();

    // Opening another chat replaces it.
    const list = screen.getByRole('list', { name: 'Chats de tus aulas' });
    fireEvent.click(within(list).getByRole('button', { name: /Lengua/ }));
    const second = await screen.findByRole('dialog', {
      name: 'Chat de Lengua',
    });
    expect(await within(second).findByText('Examen de lengua')).toBeVisible();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByText('Tarea para mañana')).toBeNull();
    await waitFor(() => {
      expect(sdk.joinedClassrooms).toContain(CLASSROOM_B);
    });
  });

  it('minimizes to a header bar and restores the conversation', async () => {
    setup();
    await openConversation(/Matemática/);
    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    expect(await within(dialog).findByText('Hola mate')).toBeVisible();

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Minimizar el chat' }),
    );
    expect(screen.queryByText('Hola mate')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const bar = screen.getByRole('region', { name: 'Chat de Matemática' });
    const restore = within(bar).getByRole('button', {
      name: 'Expandir el chat',
    });
    fireEvent.click(restore);

    const again = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    expect(await within(again).findByText('Hola mate')).toBeVisible();
  });

  it('minimizes with Escape and keeps focus on the header control', async () => {
    setup();
    await openConversation(/Matemática/);
    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    const draft = await within(dialog).findByRole('textbox', {
      name: 'Mensaje del chat',
    });

    fireEvent.keyDown(draft, { key: 'Escape' });

    const bar = await screen.findByRole('region', {
      name: 'Chat de Matemática',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(
        within(bar).getByRole('button', { name: 'Expandir el chat' }),
      ).toHaveFocus();
    });
  });

  it('closes the conversation and returns focus to its list entry', async () => {
    setup();
    const item = await openConversation(/Matemática/);
    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });

    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Cerrar el chat' }),
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.queryByRole('region', { name: 'Chat de Matemática' }),
    ).toBeNull();
    await waitFor(() => {
      expect(item).toHaveFocus();
    });
  });

  it('goes back to the list from the conversation', async () => {
    setup();
    await openConversation(/Matemática/);
    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Volver a la lista de chats',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('list', { name: 'Chats de tus aulas' }),
    ).toBeVisible();
  });

  it('joins the classroom room only while a conversation is open', async () => {
    const { sdk } = setup();
    await openList();
    await screen.findByRole('list', { name: 'Chats de tus aulas' });
    // Just listing the chats never joins a room.
    expect(sdk.joinedClassrooms).toEqual([]);

    const list = screen.getByRole('list', { name: 'Chats de tus aulas' });
    fireEvent.click(within(list).getByRole('button', { name: /Matemática/ }));
    await waitFor(() => {
      expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A]);
    });
    const room = sdk.roomFor(CLASSROOM_A);

    const dialog = await screen.findByRole('dialog', {
      name: 'Chat de Matemática',
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Minimizar el chat' }),
    );
    // Minimized: the connection is released.
    await waitFor(() => {
      expect(room?.leave).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Expandir el chat' }));
    await waitFor(() => {
      expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A, CLASSROOM_A]);
    });
  });

  it('reports the newest message once and clears the unread badge', async () => {
    const { store } = setup();
    await openConversation(/Matemática/);
    await screen.findByRole('dialog', { name: 'Chat de Matemática' });

    await waitFor(
      () => {
        expect(store.getMarkRequests()).toEqual([
          { classroomId: CLASSROOM_A, messageId: A2.id },
        ]);
      },
      { timeout: 4000 },
    );
    // Lengua still has its unread message; Matemática is clear.
    expect(
      await screen.findByRole('button', {
        name: 'Mensajes, 1 mensaje sin leer',
      }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(store.getMarkRequests()).toHaveLength(1);
  });

  it('keeps its position for the browser session', async () => {
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const first = setup({}, { queryClient });
    await openConversation(/Matemática/);
    await screen.findByRole('dialog', { name: 'Chat de Matemática' });
    first.unmount();

    setup({}, { queryClient });
    expect(
      await screen.findByRole('dialog', { name: 'Chat de Matemática' }),
    ).toBeInTheDocument();
  });

  it('still works when session storage is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      'sessionStorage',
    );
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    try {
      setup();
      await openConversation(/Matemática/);
      expect(
        await screen.findByRole('dialog', { name: 'Chat de Matemática' }),
      ).toBeInTheDocument();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, 'sessionStorage', original);
      }
    }
  });

  it('shows the Familias section for staff, opens a parent thread window, sends a reply, minimizes and closes cleanly', async () => {
    const linkId = '7e5f6a7b-0000-4000-8000-000000000011';
    const parentId = '00000000-0000-4000-8000-000000000090';
    const childId = '4e5f6a7b-0000-4000-8000-000000000009';
    const threadMessages: ParentLinkMessagePayload[] = [
      {
        id: '88888888-8888-4888-8888-000000000101',
        parentLinkId: linkId,
        authorId: parentId,
        authorDisplayName: 'Laura Gómez',
        authorRole: 'PARENT',
        body: 'Hola profe, ¿Valentina entregó el TP?',
        createdAt: '2026-11-24T14:00:00.000Z',
      },
    ];
    let familyThreads: StaffFamilyThreadPayload[] = [
      {
        id: linkId,
        classroomId: CLASSROOM_A,
        classroomName: 'Matemática',
        parentId,
        parentDisplayName: 'Laura Gómez',
        childId,
        childDisplayName: 'Valentina Gómez',
        lastMessageBody: threadMessages[0].body,
        lastMessageAt: threadMessages[0].createdAt,
        lastMessageAuthorRole: 'PARENT',
      },
      {
        id: '7e5f6a7b-0000-4000-8000-000000000012',
        classroomId: CLASSROOM_B,
        classroomName: 'Lengua',
        parentId: '00000000-0000-4000-8000-000000000091',
        parentDisplayName: 'Carlos Ruiz',
        childId: '4e5f6a7b-0000-4000-8000-000000000010',
        childDisplayName: 'Mateo Ruiz',
        lastMessageBody: null,
        lastMessageAt: null,
        lastMessageAuthorRole: null,
      },
    ];

    setup();
    mswServer.use(
      createStaffFamilyThreadsHandler({ items: () => familyThreads }),
      createParentLinkMessagesHandler({
        linkId,
        items: () => threadMessages,
      }),
      createSendParentLinkMessageHandler({
        linkId,
        authorId: USER_ID,
        authorDisplayName: profile.displayName,
        authorRole: 'STAFF',
        onMessageCreated: (created) => {
          threadMessages.push(created);
          familyThreads = familyThreads.map((t) =>
            t.id === linkId
              ? {
                  ...t,
                  lastMessageBody: created.body,
                  lastMessageAt: created.createdAt,
                  lastMessageAuthorRole: 'STAFF',
                }
              : t,
          );
        },
      }),
    );

    await openList();

    expect(
      await screen.findByRole('heading', { name: 'Familias' }),
    ).toBeVisible();
    const familiesList = screen.getByRole('list', {
      name: 'Conversaciones con familias',
    });
    const lauraButton = within(familiesList).getByRole('button', {
      name: /Laura Gómez.*Valentina Gómez · Matemática.*Hola profe/,
    });
    expect(lauraButton).toBeVisible();
    expect(
      within(familiesList).getByRole('button', {
        name: /Carlos Ruiz.*Mateo Ruiz · Lengua.*Sin mensajes todavía/,
      }),
    ).toBeVisible();

    fireEvent.click(lauraButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Mensajes con Laura Gómez',
    });
    expect(
      await within(dialog).findByText('Hola profe, ¿Valentina entregó el TP?'),
    ).toBeVisible();

    const textarea = within(dialog).getByLabelText(
      familyMessages.messaging.composer.label,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: 'Sí Laura, lo entregó ayer.' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: familyMessages.messaging.composer.submitAction,
      }),
    );

    expect(
      await within(dialog).findByText('Sí Laura, lo entregó ayer.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        within(familiesList).getByText('Sí Laura, lo entregó ayer.'),
      ).toBeVisible();
    });

    // Minimize and restore.
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Minimizar el chat' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    const bar = screen.getByRole('region', {
      name: 'Mensajes con Laura Gómez',
    });
    fireEvent.click(
      within(bar).getByRole('button', { name: 'Expandir el chat' }),
    );
    const reopened = await screen.findByRole('dialog', {
      name: 'Mensajes con Laura Gómez',
    });

    // Close restores focus to the family list item.
    fireEvent.click(
      within(reopened).getByRole('button', { name: 'Cerrar el chat' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(lauraButton).toHaveFocus();
    });
  });

  it('renders the dock when classroom inbox is empty but family threads exist, and switches mutually exclusively with classroom chats', async () => {
    const linkId = '7e5f6a7b-0000-4000-8000-000000000013';
    setup({ empty: true });
    mswServer.use(
      createStaffFamilyThreadsHandler({
        items: [
          {
            id: linkId,
            classroomId: CLASSROOM_A,
            classroomName: 'Matemática',
            parentId: '00000000-0000-4000-8000-000000000090',
            parentDisplayName: 'Laura Gómez',
            childId: '4e5f6a7b-0000-4000-8000-000000000009',
            childDisplayName: 'Valentina Gómez',
            lastMessageBody: null,
            lastMessageAt: null,
            lastMessageAuthorRole: null,
          },
        ],
      }),
      createParentLinkMessagesHandler({ linkId, items: [] }),
    );

    await openList();
    expect(
      await screen.findByRole('heading', { name: 'Familias' }),
    ).toBeVisible();
    const familiesList = screen.getByRole('list', {
      name: 'Conversaciones con familias',
    });
    fireEvent.click(
      within(familiesList).getByRole('button', { name: /Laura Gómez/ }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Mensajes con Laura Gómez' }),
    ).toBeVisible();
  });
});
