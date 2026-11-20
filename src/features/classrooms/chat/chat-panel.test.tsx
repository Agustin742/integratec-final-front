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
} from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { formatInstant } from '@/lib/dates';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomChatStore,
  createClassroomDetailHandler,
  TEST_API_BASE_URL,
  type ChatStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomPanelRoute } from '../classroom-panel-route';
import { ClassroomWorkspace } from '../classroom-workspace';
import { resetClassroomModeStore } from '../classroom-mode-store';
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
 * subscription mounted next to the panel, so live chat revalidation is
 * exercised through the committed seam instead of a bespoke test protocol.
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

  const streamControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

  mswServer.use(
    createClassroomDetailHandler(CLASSROOM_ID, {
      name: CLASSROOM_NAME,
      myRole: role,
      capabilities: [...capabilities],
      chatMuted: false,
    }),
    http.get(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/context-events`,
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamControllers.push(controller);
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    ),
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

  const view = render(
    <SessionProvider service={session.service}>
      <ApiQueryProvider client={queryClient}>
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  const hint = async () => {
    await act(async () => {
      streamControllers
        .at(-1)
        ?.enqueue(
          new TextEncoder().encode(
            `event: classroom.context-invalidated\ndata: {"classroomId":"${CLASSROOM_ID}"}\n\n`,
          ),
        );
    });
  };

  return { ...view, queryClient, hint };
}

describe('ChatPanel (#51, read side)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('renders paginated history newest first as safe plain text and paginates', async () => {
    const history = Array.from({ length: 25 }, () => makeMessage());
    // Created last, so the server orders it newest first on page 1.
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

    // Newest first: the last-created message leads the first page.
    expect(
      await screen.findByText(/<script>alert\(1\)<\/script>/),
    ).toBeVisible();
    // Message bodies render as plain text, never as markup.
    expect(document.querySelector('script')).toBeNull();
    expect(screen.getAllByText('Sofía Martínez (Vos)')).toHaveLength(20);
    expect(
      screen.getByText(`Enviado ${formatInstant(xssMessage.createdAt)}`),
    ).toBeVisible();
    expect(screen.getByText('Mostrando 20 de 26 mensajes.')).toBeVisible();

    // Second page keeps the oldest messages and drops the newest.
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Mensaje 1 del chat')).toBeVisible();
    expect(screen.getByText('Mensaje 6 del chat')).toBeVisible();
    expect(
      screen.queryByText(/<script>alert\(1\)<\/script>/),
    ).not.toBeInTheDocument();

    // Back to the first page.
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
    expect(
      await screen.findByText(/<script>alert\(1\)<\/script>/),
    ).toBeVisible();

    await expectAccessible(view.container);
  });

  it('recovers when the current page falls out of range after a live refresh', async () => {
    let liveMessages = Array.from({ length: 45 }, () => makeMessage());
    mswServer.use(
      http.get(
        `${TEST_API_BASE_URL}/classrooms/:id/messages`,
        ({ request }) => {
          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.max(
            1,
            Number(url.searchParams.get('pageSize') ?? '20'),
          );
          return HttpResponse.json({
            items: liveMessages
              .slice((page - 1) * pageSize, page * pageSize)
              .map(toHistoryPayload),
            page,
            pageSize,
            total: liveMessages.length,
          });
        },
      ),
    );

    const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(
      await screen.findByText('Mostrando 20 de 45 mensajes.'),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Página 3 de 3')).toBeVisible();

    // The server drops the newest messages; page 3 no longer exists.
    liveMessages = liveMessages.slice(0, 10);
    await view.hint();

    expect(
      await screen.findByText('No hay mensajes en esta página'),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Volver a la primera página' }),
    );
    expect(
      await screen.findByText('Mostrando 10 de 10 mensajes.'),
    ).toBeVisible();
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
    expect(screen.getByText('Mostrando 1 de 1 mensajes.')).toBeVisible();
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
    expect(screen.getByText('Mostrando 2 de 2 mensajes.')).toBeVisible();
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
    await view.hint();

    expect(
      await screen.findByText('Chat pendiente de sincronización'),
    ).toBeVisible();
    expect(screen.getByText('Mensaje confirmado')).toBeVisible();
    expect(
      screen.queryByText('No pudimos cargar el chat'),
    ).not.toBeInTheDocument();
  });

  it('revalidates on a context-invalidated SSE event so a new message appears once, newest first', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [
        makeMessage({
          body: 'Primer mensaje del aula',
          createdAt: '2026-11-19T02:00:00.000Z',
        }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderChatRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await screen.findByText('Primer mensaje del aula')).toBeVisible();
    const listCountBefore = store.getCounts().list;

    // A classmate's send lands on the server; no per-message broadcast
    // exists yet, so the panel only learns through the SSE revalidation seam.
    store.setCurrentUserId(STUDENT_ID_2);
    await fetch(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Nuevo mensaje en vivo' }),
    });
    store.setCurrentUserId(STUDENT_ID);
    expect(screen.queryByText('Nuevo mensaje en vivo')).not.toBeInTheDocument();

    await view.hint();

    const liveMessage = await screen.findByText('Nuevo mensaje en vivo');
    expect(liveMessage).toBeVisible();
    // Deduplicated by id even if the revalidated page repeats it.
    expect(screen.getAllByText('Nuevo mensaje en vivo')).toHaveLength(1);
    // Contract order (createdAt DESC, id DESC): the live message precedes the
    // older confirmed message in the DOM.
    const older = screen.getByText('Primer mensaje del aula');
    expect(
      liveMessage.compareDocumentPosition(older) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(store.getCounts().list).toBeGreaterThan(listCountBefore);
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

      const detail = buildDetail('a');
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
