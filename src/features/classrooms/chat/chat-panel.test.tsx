import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { createMemoryRouter, useParams } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { formatInstant, formatTimeOfDay } from '@/lib/dates';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomChatStore,
  createClassroomContextEventsHandler,
  createClassroomDetailHandler,
  TEST_API_BASE_URL,
  type ChatStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomPanelRoute } from '../classroom-panel-route';
import { ClassroomWorkspace } from '../classroom-workspace';
import { resetClassroomModeStore } from '../classroom-mode-store';
import { createLiveRealtimeHarness } from '@/test/realtime/live-realtime-harness';
import { useClassroomContextEvents } from '../use-classroom-context-events';
import { ChatPanel } from './chat-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_NAME = '3.º Año B - Matemática';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const STUDENT_ID_2 = '00000000-0000-4000-8000-000000007002';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

type ContextDetail = components['schemas']['ClassroomContextResponseDto'];

let messageSeq = 0;

function makeMessage(
  overrides: Partial<ChatStoreMessage> = {},
): ChatStoreMessage {
  messageSeq += 1;
  const index = messageSeq;
  return {
    id: `chat-message-${String(index).padStart(4, '0')}`,
    authorId: STUDENT_ID,
    body: `Mensaje ${index} del chat`,
    mentionedUserIds: [],
    createdAt: new Date(
      Date.parse('2026-11-19T03:00:00.000Z') + index * 60_000,
    ).toISOString(),
    hiddenAt: null,
    hiddenById: null,
    ...overrides,
  };
}

function toHistoryPayload(message: ChatStoreMessage) {
  return { ...message, classroomId: CLASSROOM_ID };
}

function makeMembers() {
  return [
    {
      id: 'chat-member-1',
      userId: STUDENT_ID,
      displayName: 'Sofía Martínez',
      role: 'STUDENT' as const,
    },
    {
      id: 'chat-member-2',
      userId: TEACHER_ID,
      displayName: 'Prof. Ana García',
      role: 'TEACHER' as const,
    },
  ];
}

/**
 * Mirrors the real workspace owner: one SSE `classroom.context-invalidated`
 * subscription mounted next to the panel. Live chat messages do not ride it:
 * they arrive through the Colyseus room of the realtime provider.
 */
function ChatRouteHost({ composer }: { readonly composer?: ReactNode }) {
  const { classroomId } = useParams();
  useClassroomContextEvents(classroomId ?? '');
  return <ChatPanel composer={composer} />;
}

function renderChatRoute(
  options: {
    readonly userId?: string;
    readonly role?: 'STUDENT' | 'TEACHER' | 'PARENT';
    readonly capabilities?: readonly Capability[];
    readonly composer?: ReactNode;
  } = {},
) {
  const role = options.role ?? 'STUDENT';
  const currentUserId =
    options.userId ??
    (role === 'TEACHER'
      ? TEACHER_ID
      : role === 'PARENT'
        ? 'parent-1'
        : STUDENT_ID);
  const capabilities: readonly Capability[] =
    options.capabilities ??
    (role === 'TEACHER'
      ? ['publish_content', 'moderate_chat', 'list_directory']
      : role === 'STUDENT'
        ? ['participate_activities', 'chat_classmates', 'list_directory']
        : ['message_teacher']);

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      name: CLASSROOM_NAME,
      myRole: role,
      capabilities: [...capabilities],
      chatMuted: false,
    }),
    createClassroomContextEventsHandler(CLASSROOM_ID),
  );

  const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
  const queryClient = createAppQueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = fakeSession(
    { status: 'authenticated', user: { ...profile, id: currentUserId } },
    client,
  );

  const router = createMemoryRouter(
    [
      {
        path: '/classrooms/:classroomId/panels/chat',
        element: <ChatRouteHost composer={options.composer} />,
      },
      {
        path: '/classrooms/:classroomId',
        element: <div>Classroom</div>,
      },
    ],
    { initialEntries: [`/classrooms/${CLASSROOM_ID}/panels/chat`] },
  );

  const { sdk, LiveRealtimeProvider } = createLiveRealtimeHarness(session);
  const view = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <LiveRealtimeProvider>
          <RouterProvider router={router} />
        </LiveRealtimeProvider>
      </ApiQueryProvider>
    </SessionProvider>,
  );

  /** The Colyseus room the panel joined, once the connection is up. */
  const liveRoom = async () => {
    await waitFor(() => {
      expect(sdk.roomFor(CLASSROOM_ID)).toBeDefined();
    });
    return sdk.roomFor(CLASSROOM_ID)!;
  };
  const emitLive = async (type: string, payload: unknown) => {
    const room = await liveRoom();
    act(() => room.emitMessage(type, payload));
  };

  return { ...view, queryClient, sdk, liveRoom, emitLive };
}

/**
 * Controllable `IntersectionObserver`: jsdom has no layout, so the test fires
 * the top-sentinel intersection itself, like the browser would when the user
 * scrolls near the oldest loaded message.
 */
interface FakeObserver {
  readonly callback: IntersectionObserverCallback;
  readonly targets: Set<Element>;
  disconnected: boolean;
}
const fakeObservers: FakeObserver[] = [];

class FakeIntersectionObserver {
  private readonly record: FakeObserver;
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, targets: new Set(), disconnected: false };
    fakeObservers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.add(target);
  }
  unobserve(target: Element) {
    this.record.targets.delete(target);
  }
  disconnect() {
    this.record.disconnected = true;
    this.record.targets.clear();
  }
  takeRecords() {
    return [];
  }
}

async function scrollToTopSentinel() {
  const sentinel = await screen.findByTestId('chat-history-top');
  await act(async () => {
    for (const observer of fakeObservers) {
      if (observer.disconnected || !observer.targets.has(sentinel)) continue;
      observer.callback(
        [
          {
            isIntersecting: true,
            target: sentinel,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    }
  });
}

/** Message bodies starting with `prefix`, in DOM order (oldest first). */
function renderedBodies(prefix: string): string[] {
  const list = screen.getByRole('list', {
    name: 'Historial de mensajes del chat',
  });
  return within(list)
    .queryAllByText(new RegExp(`^${prefix}`))
    .map((node) => node.textContent ?? '');
}

function makeNumberedHistory(count: number) {
  return Array.from({ length: count }, (_, index) =>
    makeMessage({ body: `Historial ${String(index + 1).padStart(2, '0')}` }),
  );
}

describe('ChatPanel (#51, read side)', () => {
  beforeAll(() => mswServer.listen());
  beforeEach(() => {
    fakeObservers.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });
  afterEach(() => {
    mswServer.resetHandlers();
    vi.unstubAllGlobals();
  });
  afterAll(() => mswServer.close());

  it('spends no space on a repeated header: the section keeps its accessible name', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage({ body: 'Un mensaje' })],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(await screen.findByText('Un mensaje')).toBeVisible();
    const section = screen.getByRole('region', { name: 'Chat del aula' });
    // The heading stays for assistive technology only.
    expect(
      within(section).getByRole('heading', { name: 'Chat del aula' }),
    ).toHaveClass('sr-only');
    expect(screen.queryByText(/Charlá con tu aula/)).not.toBeInTheDocument();
  });

  it('drops the author line on own bubbles (screen-reader marker kept) and keeps a compact Docente badge on others', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [
        makeMessage({ authorId: TEACHER_ID, body: 'Del docente' }),
        makeMessage({ authorId: STUDENT_ID, body: 'Mío' }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    await screen.findByText('Mío');
    const own = screen.getByText('Mío').closest('li') as HTMLElement;
    expect(within(own).queryByText(/Sofía Martínez/)).not.toBeInTheDocument();
    expect(within(own).getByText('Vos')).toHaveClass('sr-only');
    const other = screen.getByText('Del docente').closest('li') as HTMLElement;
    expect(within(other).getByText('Prof. Ana García')).toBeVisible();
    expect(within(other).getByText('Docente')).toHaveClass('text-[10px]');
  });

  it('renders history oldest to newest as safe plain text, with no pager', async () => {
    const history = makeNumberedHistory(25);
    // Created last, so it is the newest message and renders at the bottom.
    const xssMessage = makeMessage({
      body: 'Hola <script>alert(1)</script>',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [...history, xssMessage],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    const xssNode = await screen.findByText(/<script>alert\(1\)<\/script>/);
    expect(xssNode).toBeVisible();
    // Message bodies render as plain text, never as markup.
    expect(document.querySelector('script')).toBeNull();

    // Only the newest page is loaded, rendered oldest first.
    const bodies = renderedBodies('Historial');
    expect(bodies).toHaveLength(19);
    expect(bodies[0]).toBe('Historial 07');
    expect(bodies.at(-1)).toBe('Historial 25');
    expect(
      screen.getByText('Historial 25').compareDocumentPosition(xssNode) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // No pager, no results summary: older history loads by scrolling up.
    expect(
      screen.queryByRole('button', { name: /Página (siguiente|anterior)/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando \d+ de/)).not.toBeInTheDocument();

    await expectAccessible(view.container);
  });

  it('loads older messages when the top sentinel intersects, prepending them without duplicates', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: makeNumberedHistory(25),
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await screen.findByText('Historial 25')).toBeVisible();
    expect(screen.queryByText('Historial 05')).not.toBeInTheDocument();
    expect(store.getCounts().list).toBe(1);

    await scrollToTopSentinel();

    expect(await screen.findByText('Historial 01')).toBeVisible();
    expect(store.getCounts().list).toBe(2);
    const bodies = renderedBodies('Historial');
    expect(bodies).toHaveLength(25);
    expect(new Set(bodies).size).toBe(25);
    expect(bodies[0]).toBe('Historial 01');
    expect(bodies.at(-1)).toBe('Historial 25');

    // Everything is loaded: the conversation start is marked and no further
    // page is ever requested.
    expect(await screen.findByText('Inicio de la conversación')).toBeVisible();
    await scrollToTopSentinel();
    expect(store.getCounts().list).toBe(2);
  });

  it('deduplicates by id when new messages shift the offset pagination', async () => {
    const liveMessages = makeNumberedHistory(25);
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/:id/messages`,
        ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page') ?? '1');
          const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
          const newestFirst = [...liveMessages].reverse();
          return HttpResponse.json({
            items: newestFirst
              .slice((page - 1) * pageSize, page * pageSize)
              .map(toHistoryPayload),
            page,
            pageSize,
            total: liveMessages.length,
          });
        },
      ),
    );

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await screen.findByText('Historial 25')).toBeVisible();

    // A classmate writes while page 1 is already on screen: page 2 now starts
    // with the message that used to close page 1.
    liveMessages.push(makeMessage({ body: 'Historial 26' }));
    await scrollToTopSentinel();

    expect(await screen.findByText('Historial 01')).toBeVisible();
    expect(screen.getAllByText('Historial 06')).toHaveLength(1);
    const bodies = renderedBodies('Historial');
    expect(new Set(bodies).size).toBe(bodies.length);
    expect(bodies).toHaveLength(25);
  });

  it('anchors at the newest message and keeps the scroll position stable when older messages are prepended', async () => {
    // jsdom has no layout: model each message row as 100px of content.
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.dataset.testid === 'chat-scroll'
          ? this.querySelectorAll('li').length * 100
          : 0;
      });
    try {
      const store = createClassroomChatStore({
        classroomId: CLASSROOM_ID,
        currentUserId: STUDENT_ID,
        role: 'STUDENT',
        initialMessages: makeNumberedHistory(25),
        members: makeMembers(),
      });
      mswServer.use(...store.handlers);

      renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      expect(await screen.findByText('Historial 25')).toBeVisible();

      // Opening anchors the view at the newest message (bottom).
      const scroller = screen.getByTestId('chat-scroll');
      const rowsBefore = scroller.querySelectorAll('li').length;
      expect(scroller.scrollTop).toBe(rowsBefore * 100);

      // The user scrolls up near the top and older messages arrive: the
      // visible content must not jump, so scrollTop grows by the added height.
      scroller.scrollTop = 40;
      await scrollToTopSentinel();
      expect(await screen.findByText('Historial 01')).toBeVisible();
      const rowsAfter = scroller.querySelectorAll('li').length;
      expect(rowsAfter).toBeGreaterThan(rowsBefore);
      expect(scroller.scrollTop).toBe(40 + (rowsAfter - rowsBefore) * 100);
    } finally {
      scrollHeight.mockRestore();
    }
  });

  it('distinguishes own messages from others and separates days', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [
        makeMessage({
          body: 'Mensaje de ayer',
          authorId: TEACHER_ID,
          createdAt: '2026-11-17T13:23:00.000Z',
        }),
        makeMessage({
          body: 'Respuesta de hoy',
          authorId: STUDENT_ID,
          createdAt: '2026-11-18T13:30:00.000Z',
        }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);
    vi.useFakeTimers({
      toFake: ['Date'],
      now: new Date('2026-11-18T15:00:00Z'),
    });

    try {
      renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      const own = (await screen.findByText('Respuesta de hoy')).closest('li');
      const other = screen.getByText('Mensaje de ayer').closest('li');

      expect(own).toHaveAttribute('data-own', 'true');
      expect(other).toHaveAttribute('data-own', 'false');
      expect(within(other as HTMLElement).getByText('Docente')).toBeVisible();

      // Time-only stamps inside <time>, day separators between days.
      const time = within(own as HTMLElement).getByText(
        formatTimeOfDay('2026-11-18T13:30:00.000Z'),
      );
      expect(time.tagName).toBe('TIME');
      expect(time).toHaveAttribute('datetime', '2026-11-18T13:30:00.000Z');
      expect(screen.getByText('Ayer')).toBeVisible();
      expect(screen.getByText('Hoy')).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it('distinguishes an empty history from a pending first load', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    let resolveList: ((response: Response) => void) | undefined;
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/:id/messages`,
        () =>
          new Promise<Response>((resolve) => {
            resolveList = resolve;
          }),
      ),
    );

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(await screen.findByText('Cargando el chat del aula…')).toBeVisible();
    expect(
      screen.queryByText('Todavía no hay mensajes en el chat'),
    ).not.toBeInTheDocument();
    // The chat history request itself is still pending, not just the context.
    await waitFor(() => expect(resolveList).toBeDefined());

    await act(async () => {
      resolveList?.(
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
      );
    });

    expect(
      await screen.findByText('Todavía no hay mensajes en el chat'),
    ).toBeVisible();
    expect(
      screen.queryByText('Cargando el chat del aula…'),
    ).not.toBeInTheDocument();
  });

  it('shows a retryable load error distinct from empty, and retry recovers the history', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage({ body: 'Mensaje recuperado' })],
      members: makeMembers(),
    });
    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error.',
        correlationId: 'req-chat-list-500',
      },
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(await screen.findByText('No pudimos cargar el chat')).toBeVisible();
    expect(
      screen.queryByText('Todavía no hay mensajes en el chat'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Mensaje recuperado')).toBeVisible();
  });

  it('omits hidden rows entirely for students, count included', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [
        makeMessage({
          body: 'Mensaje moderado',
          hiddenAt: '2026-11-19T04:00:00.000Z',
          hiddenById: TEACHER_ID,
        }),
        makeMessage({ body: 'Mensaje visible' }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(await screen.findByText('Mensaje visible')).toBeVisible();
    expect(screen.queryByText('Mensaje moderado')).not.toBeInTheDocument();
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();
  });

  it('keeps hidden rows with the moderation audit for staff roles', async () => {
    const hiddenAt = '2026-11-19T04:00:00.000Z';
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [
        makeMessage({
          body: 'Mensaje moderado',
          hiddenAt,
          hiddenById: TEACHER_ID,
        }),
        makeMessage({ body: 'Mensaje visible' }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'TEACHER', userId: TEACHER_ID });

    expect(await screen.findByText('Mensaje moderado')).toBeVisible();
    expect(screen.getByText('Ocultado')).toBeVisible();
    expect(
      screen.getByText(
        `Ocultado por Prof. Ana García el ${formatInstant(hiddenAt)}`,
      ),
    ).toBeVisible();
    expect(screen.getByText('Mensaje moderado')).toHaveAttribute(
      'data-hidden',
      'true',
    );
  });

  it('denies parents up front without issuing any chat request', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialMessages: [makeMessage()],
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'PARENT' });

    expect(
      await screen.findByText(
        'El chat del aula no está disponible para tu rol',
      ),
    ).toBeVisible();
    expect(store.getCounts().list).toBe(0);
    expect(store.getCounts().send).toBe(0);
    expect(
      screen.queryByText('Todavía no hay mensajes en el chat'),
    ).not.toBeInTheDocument();
  });

  it('shows a server denial state when history is rejected with 403', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      role: 'PARENT',
      initialMessages: [makeMessage()],
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(
      await screen.findByText('Sin acceso al chat del aula'),
    ).toBeVisible();
    expect(
      screen.queryByText('Todavía no hay mensajes en el chat'),
    ).not.toBeInTheDocument();
  });

  it('shows a not-found state when the chat classroom disappears', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage()],
    });
    store.failNext('list', {
      status: 404,
      body: {
        code: 'NOT_FOUND',
        message: 'Classroom not found.',
        correlationId: 'req-chat-list-404',
      },
    });
    mswServer.use(...store.handlers);

    renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });

    expect(
      await screen.findByText('No encontramos el chat del aula'),
    ).toBeVisible();
  });

  it('preserves visible history behind a stale notice when a background refresh fails', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage({ body: 'Mensaje confirmado' })],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await screen.findByText('Mensaje confirmado')).toBeVisible();

    store.failNext('list', {
      status: 500,
      body: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error.',
        correlationId: 'req-chat-refresh-500',
      },
    });
    // A reconnect revalidates the history; that refresh fails.
    const room = await view.liveRoom();
    act(() => room.emitDrop());

    expect(
      await screen.findByText('Chat pendiente de sincronización'),
    ).toBeVisible();
    expect(screen.getByText('Mensaje confirmado')).toBeVisible();
    expect(
      screen.queryByText('No pudimos cargar el chat'),
    ).not.toBeInTheDocument();
  });

  describe('live messages through the classroom room', () => {
    // The realtime contract requires UUID ids (the REST fixtures use slugs).
    let liveSeq = 0;
    const liveId = () => {
      liveSeq += 1;
      return `00000000-0000-4000-8000-${String(900 + liveSeq).padStart(12, '0')}`;
    };

    function liveMessage(
      body: string,
      overrides: Partial<ChatStoreMessage> = {},
    ) {
      const {
        hiddenAt: _hiddenAt,
        hiddenById: _hiddenById,
        ...message
      } = makeMessage({
        id: liveId(),
        body,
        authorId: STUDENT_ID_2,
        ...overrides,
      });
      void _hiddenAt;
      void _hiddenById;
      return { ...message, classroomId: CLASSROOM_ID };
    }

    function seedStore(role: 'STUDENT' | 'TEACHER' = 'STUDENT') {
      const store = createClassroomChatStore({
        classroomId: CLASSROOM_ID,
        currentUserId: role === 'TEACHER' ? TEACHER_ID : STUDENT_ID,
        role,
        initialMessages: [
          makeMessage({
            id: liveId(),
            body: 'Primer mensaje del aula',
            createdAt: '2026-11-19T02:00:00.000Z',
          }),
        ],
        members: makeMembers(),
      });
      mswServer.use(...store.handlers);
      return store;
    }

    it('shows a received chat:message at the bottom without refetching the history', async () => {
      const store = seedStore();
      const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      expect(await screen.findByText('Primer mensaje del aula')).toBeVisible();
      const listCountBefore = store.getCounts().list;

      await view.emitLive('chat:message', liveMessage('Nuevo mensaje en vivo'));

      const live = await screen.findByText('Nuevo mensaje en vivo');
      expect(live).toBeVisible();
      expect(
        screen
          .getByText('Primer mensaje del aula')
          .compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(store.getCounts().list).toBe(listCountBefore);
    });

    it('still reaches the oldest message after a live message shifted the pages', async () => {
      const store = createClassroomChatStore({
        classroomId: CLASSROOM_ID,
        currentUserId: STUDENT_ID,
        role: 'STUDENT',
        initialMessages: makeNumberedHistory(40),
        members: makeMembers(),
      });
      mswServer.use(...store.handlers);
      const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      expect(await screen.findByText('Historial 40')).toBeVisible();

      store.setCurrentUserId(STUDENT_ID_2);
      await fetch(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Mensaje en vivo' }),
      });
      store.setCurrentUserId(STUDENT_ID);
      const {
        hiddenAt: _hiddenAt,
        hiddenById: _hiddenById,
        ...echo
      } = store.getMessages().at(-1)!;
      void _hiddenAt;
      void _hiddenById;
      await view.emitLive('chat:message', {
        ...echo,
        classroomId: CLASSROOM_ID,
      });
      expect(await screen.findByText('Mensaje en vivo')).toBeVisible();

      await scrollToTopSentinel();
      expect(await screen.findByText('Historial 20')).toBeVisible();
      await scrollToTopSentinel();

      expect(await screen.findByText('Historial 01')).toBeVisible();
    });

    it('renders a duplicated event once', async () => {
      seedStore();
      const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      await screen.findByText('Primer mensaje del aula');
      const message = liveMessage('Mensaje repetido');

      await view.emitLive('chat:message', message);
      await view.emitLive('chat:message', message);

      expect(await screen.findAllByText('Mensaje repetido')).toHaveLength(1);
    });

    it('removes a message hidden by a teacher from a student view', async () => {
      const store = seedStore();
      const [first] = store.getMessages();
      const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      expect(await screen.findByText('Primer mensaje del aula')).toBeVisible();

      await view.emitLive('chat:message.hidden', {
        messageId: first.id,
        hiddenAt: '2026-11-19T05:00:00.000Z',
      });

      await waitFor(() => {
        expect(
          screen.queryByText('Primer mensaje del aula'),
        ).not.toBeInTheDocument();
      });
    });

    it('refetches for staff when a message is hidden, so the audit trail comes from the server', async () => {
      const store = seedStore('TEACHER');
      const [first] = store.getMessages();
      const view = renderChatRoute({ role: 'TEACHER', userId: TEACHER_ID });
      expect(await screen.findByText('Primer mensaje del aula')).toBeVisible();
      const listCountBefore = store.getCounts().list;

      await view.emitLive('chat:message.hidden', {
        messageId: first.id,
        hiddenAt: '2026-11-19T05:00:00.000Z',
      });

      await waitFor(() => {
        expect(store.getCounts().list).toBeGreaterThan(listCountBefore);
      });
      expect(screen.getByText('Primer mensaje del aula')).toBeVisible();
    });

    it('revalidates the history after the live connection is recovered', async () => {
      const store = seedStore();
      const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
      expect(await screen.findByText('Primer mensaje del aula')).toBeVisible();
      const listCountBefore = store.getCounts().list;

      // A message committed while the socket was down is never replayed.
      store.setCurrentUserId(STUDENT_ID_2);
      await fetch(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Mensaje perdido durante el corte' }),
      });
      store.setCurrentUserId(STUDENT_ID);
      act(() => view.sdk.roomFor(CLASSROOM_ID)!.emitDrop());

      expect(
        await screen.findByText('Mensaje perdido durante el corte'),
      ).toBeVisible();
      expect(store.getCounts().list).toBeGreaterThan(listCountBefore);
    });
  });

  describe('typing arbitration (S4)', () => {
    beforeEach(() => {
      resetClassroomModeStore();
    });

    function buildDetail(
      id: string,
      overrides: Partial<ContextDetail> = {},
    ): ContextDetail {
      return {
        id,
        name: `Aula ${id}`,
        subject: null,
        schoolId: null,
        independentTeacherId: null,
        adultMode: false,
        chatMuted: false,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: 'STUDENT',
        capabilities: [
          'participate_activities',
          'chat_classmates',
          'list_directory',
        ],
        availablePanels: ['chat'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
      };
    }

    function renderWorkspaceWithChatDialog() {
      function ChatProbePanel() {
        return (
          <ChatPanel
            composer={<textarea aria-label="Borrador del chat" rows={2} />}
          />
        );
      }
      const panels = [
        { key: 'chat', title: 'Chat', component: ChatProbePanel },
      ] as const;

      const session = fakeSession(
        { status: 'authenticated', user: profile },
        createApiClient({
          baseUrl: 'https://api.example.invalid',
          fetch: async (input) => {
            const request = input as Request;
            if (request.url.endsWith('/context-events')) {
              return new Response(new ReadableStream(), {
                headers: { 'content-type': 'text/event-stream' },
              });
            }
            const url = new URL(request.url);
            if (url.pathname.endsWith('/messages')) {
              return Response.json({
                items: [
                  {
                    id: 'chat-message-workspace',
                    classroomId: 'a',
                    authorId: profile.id,
                    body: 'Historial del aula en 3D',
                    mentionedUserIds: [],
                    createdAt: '2026-11-19T03:00:00.000Z',
                    hiddenAt: null,
                    hiddenById: null,
                  },
                ],
                page: 1,
                pageSize: 20,
                total: 1,
              });
            }
            if (url.pathname.endsWith('/members')) {
              return Response.json({
                items: [],
                page: 1,
                pageSize: 20,
                total: 0,
              });
            }
            const id = url.pathname.split('/').pop() ?? 'a';
            return Response.json(buildDetail(id));
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
            element: <ClassroomWorkspace panels={panels} />,
            children: [
              { path: 'panels/:panelKey', Component: ClassroomPanelRoute },
            ],
          },
        ],
        { initialEntries: ['/classrooms/a/panels/chat'] },
      );
      const view = render(
        <ApiQueryProvider client={queryClient}>
          <SessionProvider service={session.service}>
            <RouterProvider router={router} />
          </SessionProvider>
        </ApiQueryProvider>,
      );
      return view;
    }

    it('never triggers the workspace mode shortcut while typing in the chat panel', async () => {
      renderWorkspaceWithChatDialog();

      const dialog = await screen.findByRole('dialog', { name: 'Chat' });
      expect(
        await within(dialog).findByText('Historial del aula en 3D'),
      ).toBeVisible();

      // Typing in the composer slot must never trigger the Alt+M shortcut:
      // the workspace guards editable targets (isEditableShortcutTarget).
      const draft = screen.getByLabelText('Borrador del chat');
      fireEvent.change(draft, { target: { value: 'escribiendo en el chat' } });
      draft.focus();
      fireEvent.keyDown(draft, { key: 'm', code: 'KeyM', altKey: true });
      fireEvent.keyDown(draft, { key: 'w', code: 'KeyW' });
      fireEvent.keyDown(draft, { key: 'm', code: 'KeyM', altKey: true });
      expect(
        screen.queryByRole('heading', { name: 'Modo 2D Clásico' }),
      ).not.toBeInTheDocument();

      // The open modal dialog is itself a guard for non-editable targets.
      fireEvent.keyDown(document.body, {
        key: 'm',
        code: 'KeyM',
        altKey: true,
      });
      expect(
        screen.queryByRole('heading', { name: 'Modo 2D Clásico' }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Chat' })).toBeVisible();

      // Control: the same shortcut works once the chat dialog is closed,
      // proving the guard (not a broken shortcut) blocked it.
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      fireEvent.keyDown(document.body, {
        key: 'm',
        code: 'KeyM',
        altKey: true,
      });
      expect(
        await screen.findByRole('heading', { name: 'Modo 2D Clásico' }),
      ).toBeVisible();
    });
  });
});
