import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, useParams } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createApiClient } from '@/api/client';
import { createClassroomChatPredicate } from '@/api/query-keys';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import type { components } from '@/api/schema.generated';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  createClassroomChatStore,
  createErrorEnvelopeResponse,
  TEST_API_BASE_URL,
  type ChatStoreMessage,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { createLiveRealtimeHarness } from '@/test/realtime/live-realtime-harness';
import { useClassroomContextEvents } from '../use-classroom-context-events';
import { ChatComposer } from './chat-composer';
import { ChatPanel } from './chat-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_NAME = '3.º Año B - Matemática';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const STUDENT_ID_2 = '00000000-0000-4000-8000-000000007002';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

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
    {
      id: 'chat-member-3',
      userId: STUDENT_ID_2,
      displayName: 'Lucía Fernández',
      role: 'STUDENT' as const,
    },
  ];
}

/**
 * Mirrors the catalog wiring: the real composer rides the ChatPanel composer
 * slot next to one workspace SSE subscription (`use-classroom-context-events`).
 */
function ChatRouteHost() {
  const { classroomId } = useParams();
  useClassroomContextEvents(classroomId ?? '');
  return <ChatPanel composer={<ChatComposer />} />;
}

function renderComposerRoute(
  options: {
    readonly role?: 'STUDENT' | 'TEACHER';
    readonly userId?: string;
    readonly chatMuted?: boolean;
  } = {},
) {
  const role = options.role ?? 'STUDENT';
  const currentUserId =
    options.userId ?? (role === 'TEACHER' ? TEACHER_ID : STUDENT_ID);
  const capabilities: readonly Capability[] =
    role === 'TEACHER'
      ? ['publish_content', 'moderate_chat', 'list_directory']
      : ['participate_activities', 'chat_classmates', 'list_directory'];

  // Mutable so a test can flip the server-confirmed mute state and observe
  // the composer reconciling through the classroom context (S11).
  const detail = { chatMuted: options.chatMuted ?? false };
  const streamControllers: ReadableStreamDefaultController<Uint8Array>[] = [];

  mswServer.use(
    http.get(`${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}`, () =>
      HttpResponse.json({
        id: CLASSROOM_ID,
        name: CLASSROOM_NAME,
        subject: null,
        schoolId: null,
        independentTeacherId: null,
        adultMode: false,
        chatMuted: detail.chatMuted,
        collaborationLocked: false,
        gamesDisabled: false,
        myRole: role,
        capabilities,
        availablePanels: ['chat'],
        deskCount: 12,
        pet: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ),
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
        element: <ChatRouteHost />,
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

  return {
    ...view,
    queryClient,
    sdk,
    hint,
    setChatMuted: (muted: boolean) => {
      detail.chatMuted = muted;
    },
  };
}

function getDraftTextarea() {
  return screen.getByRole('textbox', {
    name: 'Mensaje del chat',
  }) as HTMLTextAreaElement;
}

/** Confirmed history rows only: the draft textarea also holds the message text. */
async function findHistoryRow(text: string) {
  const list = await screen.findByRole('list', {
    name: 'Historial de mensajes del chat',
  });
  return within(list).findByText(text);
}

function queryHistoryRow(text: string) {
  const list = screen.queryByRole('list', {
    name: 'Historial de mensajes del chat',
  });
  return list === null ? null : within(list).queryByText(text);
}

function typeDraft(value: string) {
  const textarea = getDraftTextarea();
  fireEvent.change(textarea, {
    target: { value, selectionStart: value.length, selectionEnd: value.length },
  });
}

async function submitDraft() {
  fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

describe('ChatComposer (#51, send side: S2, S6, S11)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  it('sends a valid message only after server confirmation: pending is never confirmed and the draft clears after the 201', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage({ body: 'Historial previo' })],
      members: makeMembers(),
      writeDelayMs: 300,
    });
    mswServer.use(...store.handlers);

    const view = renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await screen.findByText('Historial previo')).toBeVisible();

    typeDraft('Mensaje nuevo del estudiante');
    await submitDraft();

    // Pending: the button itself shows the progress (no redundant alert), the
    // textarea stays focusable (read-only, never disabled) and nothing is
    // confirmed yet.
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    expect(screen.queryByText('Enviando el mensaje…')).not.toBeInTheDocument();
    expect(getDraftTextarea()).not.toBeDisabled();
    expect(getDraftTextarea()).toHaveAttribute('readonly');
    expect(getDraftTextarea()).toHaveAttribute('aria-busy', 'true');
    expect(
      queryHistoryRow('Mensaje nuevo del estudiante'),
    ).not.toBeInTheDocument();
    expect(getDraftTextarea()).toHaveValue('Mensaje nuevo del estudiante');

    // Server confirmation: the draft clears and the confirmed message arrives
    // through the revalidated history, never from a local optimistic row.
    await waitFor(() => expect(getDraftTextarea()).toHaveValue(''));
    expect(await findHistoryRow('Mensaje nuevo del estudiante')).toBeVisible();
    // Sent is announced once (live region), not duplicated by a toast.
    expect(screen.getAllByText('Mensaje enviado.')).toHaveLength(1);
    expect(store.getCounts().send).toBe(1);
    expect(store.getMessages().at(-1)?.body).toBe(
      'Mensaje nuevo del estudiante',
    );

    await expectAccessible(view.container);
  });

  it('does not duplicate the own message when the room echoes it after the REST send', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Mensaje propio con eco');
    await submitDraft();
    expect(await findHistoryRow('Mensaje propio con eco')).toBeVisible();

    // The server broadcasts the persisted message to the whole room, sender included.
    const persisted = store.getMessages().at(-1)!;
    const { hiddenAt: _hiddenAt, hiddenById: _hiddenById, ...echo } = persisted;
    void _hiddenAt;
    void _hiddenById;
    await waitFor(() => expect(view.sdk.roomFor(CLASSROOM_ID)).toBeDefined());
    act(() =>
      view.sdk
        .roomFor(CLASSROOM_ID)!
        .emitMessage('chat:message', { ...echo, classroomId: CLASSROOM_ID }),
    );

    const list = screen.getByRole('list', {
      name: 'Historial de mensajes del chat',
    });
    expect(within(list).getAllByText('Mensaje propio con eco')).toHaveLength(1);
  });

  it('sends with Enter, inserts a newline with Shift+Enter and ignores Enter while composing', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });
    expect(
      screen.getByText('Enter envía, Shift+Enter agrega una línea.'),
    ).toBeVisible();

    typeDraft('Hola con Enter');
    // Shift+Enter is a newline, never a send; IME composition is ignored.
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(store.getCounts().send).toBe(0);

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(await findHistoryRow('Hola con Enter')).toBeVisible();
    expect(store.getCounts().send).toBe(1);
    expect(getDraftTextarea()).toHaveValue('');
  });

  it('keeps focus in the textarea after a confirmed send', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });
    getDraftTextarea().focus();
    typeDraft('Mensaje con foco');
    fireEvent.keyDown(getDraftTextarea(), { key: 'Enter' });

    expect(await findHistoryRow('Mensaje con foco')).toBeVisible();
    await waitFor(() => expect(getDraftTextarea()).toHaveValue(''));
    expect(getDraftTextarea()).toHaveFocus();
  });

  it('rejects an empty draft client-side without issuing any send request', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(
      await screen.findByRole('textbox', { name: 'Mensaje del chat' }),
    ).toBeVisible();

    await submitDraft();

    expect(
      await screen.findByText('Escribí un mensaje antes de enviar.'),
    ).toBeVisible();
    expect(store.getCounts().send).toBe(0);
    expect(store.getMessages()).toHaveLength(0);
  });

  it('shows the contract length limit and rejects an over-limit draft locally', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    const textarea = await screen.findByRole('textbox', {
      name: /Mensaje del chat/,
    });
    expect(textarea).toHaveAttribute('maxlength', '2000');
    expect(textarea).toHaveAttribute('rows', '1');
    // One compact footer line: the hint always, the counter only near the limit.
    const hint = 'Enter envía, Shift+Enter agrega una línea.';
    expect(screen.getByText(hint)).toBeVisible();
    expect(screen.queryByText(/caracteres$/)).not.toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'x'.repeat(1799) } });
    expect(screen.queryByText(/caracteres$/)).not.toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: 'x'.repeat(1800) } });
    expect(screen.getByText('1800/2000 caracteres')).toBeVisible();
    expect(screen.getByText(hint)).toBeVisible();
    // Raw length, not the trimmed one: whitespace counts toward `maxLength`.
    fireEvent.change(textarea, { target: { value: ' '.repeat(1800) } });
    expect(screen.getByText('1800/2000 caracteres')).toBeVisible();
    // The hint and the counter share the one description of the textbox.
    const describedBy = textarea.getAttribute('aria-describedby') ?? '';
    expect(
      document.getElementById(describedBy.split(' ')[0]),
    ).toHaveTextContent(hint);

    // The browser maxLength blocks typing past the contract limit; a
    // programmatic over-limit value still cannot reach the server.
    fireEvent.change(textarea, {
      target: { value: `x`.repeat(2001), selectionStart: 2001 },
    });
    await submitDraft();

    expect(
      await screen.findByText(
        'El mensaje no puede superar los 2000 caracteres.',
      ),
    ).toBeVisible();
    expect(store.getCounts().send).toBe(0);
  });

  it('filters mention suggestions by the server q prefix and inserts the mention as plain text', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
      mentionDirectory: { 'Sofía Martínez': STUDENT_ID_2 },
    });
    mswServer.use(...store.handlers);

    const view = renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Hola @sof');
    const listbox = await screen.findByRole('listbox', {
      name: 'Integrantes sugeridos para mencionar',
    });
    // The server `q` prefix filter keeps only the matching roster entries.
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(within(listbox).getByText('Sofía Martínez')).toBeVisible();
    expect(
      within(listbox).queryByText('Prof. Ana García'),
    ).not.toBeInTheDocument();
    expect(
      within(listbox).queryByText('Lucía Fernández'),
    ).not.toBeInTheDocument();

    // Keyboard selection keeps focus in the textarea and inserts
    // `@DisplayName ` as plain editable text.
    getDraftTextarea().focus();
    fireEvent.keyDown(getDraftTextarea(), { key: 'ArrowDown' });
    expect(getDraftTextarea()).toHaveFocus();
    fireEvent.keyDown(getDraftTextarea(), { key: 'Enter' });
    expect(getDraftTextarea()).toHaveValue('Hola @Sofía Martínez ');
    expect(store.getCounts().send).toBe(0);

    // Only `body` is sent: the server resolves the mention and answers with
    // the resolved ids (unknown fields or client-assigned ids would 400).
    await submitDraft();
    expect(await findHistoryRow('Hola @Sofía Martínez')).toBeVisible();
    const sent = store.getMessages().at(-1);
    expect(sent?.mentionedUserIds).toEqual([STUDENT_ID_2]);
    expect(getDraftTextarea()).toHaveValue('');

    await expectAccessible(view.container);
  });

  it('keeps an unresolved @token as plain text: no suggestion, no client-side mention claim', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Hola @nadie del aula');
    await waitFor(() => {
      expect(
        screen.queryByRole('listbox', {
          name: 'Integrantes sugeridos para mencionar',
        }),
      ).not.toBeInTheDocument();
    });

    await submitDraft();
    expect(await findHistoryRow('Hola @nadie del aula')).toBeVisible();
    expect(store.getMessages().at(-1)?.mentionedUserIds).toEqual([]);
  });

  it('disables the composer for a muted student with the reason, without issuing any send', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      chatMuted: true,
      initialMessages: [
        makeMessage({ body: 'Historial mientras está silenciado' }),
      ],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderComposerRoute({
      role: 'STUDENT',
      userId: STUDENT_ID,
      chatMuted: true,
    });

    // The muted explanation comes from `chatMuted` on the classroom context
    // (S11), never from a 403 body; the history stays readable.
    expect(await screen.findByText('El chat está silenciado')).toBeVisible();
    expect(
      screen.getByText(
        'El personal del aula silenció el chat por ahora. No podés enviar mensajes, pero el historial sigue visible.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByText('Historial mientras está silenciado'),
    ).toBeVisible();

    // The muted composer is a disabled textarea: no send control at all.
    const textarea = screen.getByRole('textbox', {
      name: 'Mensaje del chat',
    });
    expect(textarea).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'Enviar' }),
    ).not.toBeInTheDocument();
    expect(store.getCounts().send).toBe(0);

    await expectAccessible(view.container);
  });

  it('lets a teacher send while the chat is muted', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      chatMuted: true,
      initialMessages: [makeMessage({ body: 'Aula silenciada' })],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({
      role: 'TEACHER',
      userId: TEACHER_ID,
      chatMuted: true,
    });
    expect(await screen.findByText('Aula silenciada')).toBeVisible();

    // Staff can still write while muted: the composer stays enabled (S11).
    typeDraft('Recordatorio para toda el aula');
    await submitDraft();

    expect(
      await screen.findByText('Recordatorio para toda el aula'),
    ).toBeVisible();
    expect(store.getCounts().send).toBe(1);
    expect(store.getMessages().at(-1)?.authorId).toBe(TEACHER_ID);
  });

  it('presents a server-rejected forced send (muted desync) and reconciles the muted state from the classroom context', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      chatMuted: true,
      initialMessages: [makeMessage()],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    // Desync: the client context still says unmuted while the server rejects
    // student sends as muted. The disabled control is not the enforcement.
    const view = renderComposerRoute({
      role: 'STUDENT',
      userId: STUDENT_ID,
      chatMuted: false,
    });
    expect(
      await screen.findByRole('textbox', { name: 'Mensaje del chat' }),
    ).toBeVisible();

    typeDraft('Envío forzado mientras está silenciado');
    await submitDraft();

    expect(
      await screen.findByText(
        'No tenés permiso para usar el chat de este aula.',
      ),
    ).toBeVisible();
    // A rejected send never becomes a persisted or confirmed message.
    expect(
      queryHistoryRow('Envío forzado mientras está silenciado'),
    ).not.toBeInTheDocument();
    expect(store.getMessages()).toHaveLength(1);
    expect(getDraftTextarea()).toHaveValue(
      'Envío forzado mientras está silenciado',
    );

    // The muted explanation arrives from `chatMuted` on the revalidated
    // classroom context, not from the 403 body.
    view.setChatMuted(true);
    await view.hint();

    expect(await screen.findByText('El chat está silenciado')).toBeVisible();
    // The reconciled muted state is a disabled plain textarea.
    expect(
      screen.getByRole('textbox', { name: 'Mensaje del chat' }),
    ).toBeDisabled();
    expect(
      screen.queryByText('No tenés permiso para usar el chat de este aula.'),
    ).not.toBeInTheDocument();
  });

  it('shows the 429 as rate-limited feedback and preserves the draft', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    // Five admitted sends inside the rolling ten-second window (the contract
    // limit, staff included); the next send from this user is a 429.
    store.resetRateLimit();
    for (let index = 0; index < 5; index += 1) {
      const response = await fetch(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: `Mensaje previo ${index + 1}` }),
        },
      );
      expect(response.status).toBe(201);
    }

    typeDraft('Mensaje que excede el ritmo permitido');
    await submitDraft();

    expect(
      await screen.findByText(
        'Enviaste varios mensajes en poco tiempo. Esperá unos instantes antes de reintentar.',
      ),
    ).toBeVisible();
    expect(
      queryHistoryRow('Mensaje que excede el ritmo permitido'),
    ).not.toBeInTheDocument();
    // Failure keeps the draft for a corrected retry.
    expect(getDraftTextarea()).toHaveValue(
      'Mensaje que excede el ritmo permitido',
    );
  });

  it('keeps the draft and the uncertain notice when the write never reached the server', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
      wallClockCreatedAt: true,
    });
    store.failNext('send', 'network');
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Mensaje que nunca llegó');
    await submitDraft();

    expect(
      await screen.findByText(
        'No pudimos confirmar si el mensaje quedó guardado en el servidor. Conservamos tu borrador mientras verificamos el chat.',
      ),
    ).toBeVisible();
    // The reconciled history does not contain it: the draft stays for a retry.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled(),
    );
    expect(getDraftTextarea()).toHaveValue('Mensaje que nunca llegó');
    expect(queryHistoryRow('Mensaje que nunca llegó')).not.toBeInTheDocument();
    expect(store.getMessages()).toHaveLength(0);
    expect(store.getCounts().send).toBe(1);
  });

  it('treats an uncertain write found in the reconciled history as sent: draft cleared, announced once, no second POST', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
      wallClockCreatedAt: true,
    });
    // The write lands but the confirmation is lost: outcome-uncertain.
    store.failNext('send', 'drop-response');
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Mensaje con confirmación perdida');
    await submitDraft();
    // Send stays disabled while the history is reconciled.
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();

    expect(
      await findHistoryRow('Mensaje con confirmación perdida'),
    ).toBeVisible();
    await waitFor(() => expect(getDraftTextarea()).toHaveValue(''));
    expect(screen.getAllByText('Mensaje enviado.')).toHaveLength(1);
    expect(
      screen.queryByText(/No pudimos confirmar si el mensaje quedó guardado/),
    ).not.toBeInTheDocument();
    expect(store.getCounts().send).toBe(1);
    expect(store.getMessages()).toHaveLength(1);
  });

  it('does not mistake an older identical message for the uncertain send', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
      initialMessages: [makeMessage({ body: 'Mismo texto' })],
    });
    store.failNext('send', 'network');
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    expect(await findHistoryRow('Mismo texto')).toBeVisible();

    typeDraft('Mismo texto');
    await submitDraft();

    expect(
      await screen.findByText(/No pudimos confirmar si el mensaje quedó/),
    ).toBeVisible();
    expect(getDraftTextarea()).toHaveValue('Mismo texto');
  });

  it('maps a server 400 onto the body field and keeps the draft', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
    });
    store.failNext('send', {
      status: 400,
      body: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid length.',
        details: [
          {
            field: 'body',
            messages: ['Length must be between 1 and 2000'],
          },
        ],
        correlationId: 'req-chat-send-400-test',
      },
    });
    mswServer.use(...store.handlers);

    renderComposerRoute({ role: 'STUDENT', userId: STUDENT_ID });
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Mensaje que el servidor rechaza');
    await submitDraft();

    expect(
      await screen.findByText('Length must be between 1 and 2000'),
    ).toBeVisible();
    expect(getDraftTextarea()).toHaveValue('Mensaje que el servidor rechaza');
    expect(
      queryHistoryRow('Mensaje que el servidor rechaza'),
    ).not.toBeInTheDocument();
  });
});

function trackMemberRequests() {
  const queries: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    if (
      request.method === 'GET' &&
      url.pathname.endsWith(`/classrooms/${CLASSROOM_ID}/members`) &&
      url.searchParams.has('q')
    ) {
      queries.push(url.searchParams.get('q') ?? '');
    }
  };
  mswServer.events.on('request:start', listener);
  return {
    queries,
    stop: () => {
      mswServer.events.removeListener('request:start', listener);
    },
  };
}

describe('ChatComposer hardening (#113: mentions, cooldown)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => mswServer.resetHandlers());
  afterAll(() => mswServer.close());

  function setupStore(
    overrides: Partial<Parameters<typeof createClassroomChatStore>[0]> = {},
  ) {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      members: makeMembers(),
      ...overrides,
    });
    mswServer.use(...store.handlers);
    return store;
  }

  it('debounces the mention lookup: several keystrokes issue a single request', async () => {
    setupStore();
    const tracker = trackMemberRequests();
    try {
      renderComposerRoute();
      await screen.findByRole('textbox', { name: 'Mensaje del chat' });

      typeDraft('@s');
      typeDraft('@so');
      typeDraft('@sof');

      await screen.findByRole('listbox', {
        name: 'Integrantes sugeridos para mencionar',
      });
      // Let any extra (non-debounced) request surface before asserting.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(tracker.queries).toEqual(['sof']);
    } finally {
      tracker.stop();
    }
  });

  it('does not refetch the open mention lookup when the chat is invalidated', async () => {
    const store = setupStore();
    const tracker = trackMemberRequests();
    try {
      const view = renderComposerRoute();
      await screen.findByRole('textbox', { name: 'Mensaje del chat' });
      typeDraft('@sof');
      await screen.findByRole('listbox', {
        name: 'Integrantes sugeridos para mencionar',
      });
      expect(tracker.queries).toEqual(['sof']);
      const listCalls = store.getCounts().list;

      await act(async () => {
        await view.queryClient.invalidateQueries({
          predicate: createClassroomChatPredicate(STUDENT_ID, CLASSROOM_ID),
        });
      });

      // The history was revalidated, the mention directory was not.
      expect(store.getCounts().list).toBeGreaterThan(listCalls);
      expect(tracker.queries).toEqual(['sof']);
    } finally {
      tracker.stop();
    }
  });

  it('keeps the draft a native textbox that points at the listbox popup', async () => {
    setupStore();
    const view = renderComposerRoute();
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });
    // Native textbox: only attributes valid on it, no combobox semantics.
    expect(textarea).not.toHaveAttribute('role');
    expect(textarea).not.toHaveAttribute('aria-expanded');
    expect(textarea).not.toHaveAttribute('aria-haspopup');
    expect(textarea).toHaveAttribute('aria-autocomplete', 'list');
    expect(textarea).not.toHaveAttribute('aria-controls');
    expect(textarea).not.toHaveAttribute('aria-activedescendant');

    textarea.focus();
    typeDraft('Hola @sof');
    const listbox = await screen.findByRole('listbox', {
      name: 'Integrantes sugeridos para mencionar',
    });
    expect(textarea).toHaveAttribute('aria-controls', listbox.id);
    // The polite notice tells screen readers the suggestions are open.
    expect(
      screen.getByText(/Hay sugerencias de mención disponibles/),
    ).toBeVisible();
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    expect(textarea).toHaveFocus();
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0].id).not.toBe('');
    expect(textarea).toHaveAttribute('aria-activedescendant', options[0].id);

    await expectAccessible(view.container);
  });

  it('moves the highlight with the arrows (wrapping) and selects with Enter without sending', async () => {
    const store = setupStore({
      members: [
        ...makeMembers(),
        {
          id: 'chat-member-4',
          userId: '00000000-0000-4000-8000-000000007003',
          displayName: 'Sara Gómez',
          role: 'STUDENT' as const,
        },
      ],
    });
    renderComposerRoute();
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });

    typeDraft('@s');
    const listbox = await screen.findByRole('listbox');
    await waitFor(() =>
      expect(within(listbox).getAllByRole('option')).toHaveLength(2),
    );
    const options = within(listbox).getAllByRole('option');

    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    expect(textarea).toHaveAttribute('aria-activedescendant', options[0].id);
    fireEvent.keyDown(textarea, { key: 'ArrowUp' });
    // Wraps from the first option back to the last one.
    expect(textarea).toHaveAttribute('aria-activedescendant', options[1].id);
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    // And forward again from the last one to the first.
    expect(textarea).toHaveAttribute('aria-activedescendant', options[0].id);
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });

    // Enter picks the highlighted option: it neither sends nor adds a newline.
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(getDraftTextarea()).toHaveValue('@Sara Gómez ');
    expect(store.getCounts().send).toBe(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes the picker with Escape without changing the text, and Tab selects the highlighted option', async () => {
    setupStore();
    renderComposerRoute();
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });

    textarea.focus();
    typeDraft('Hola @sof');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(textarea).not.toHaveAttribute('aria-controls');
    expect(getDraftTextarea()).toHaveValue('Hola @sof');
    expect(textarea).toHaveFocus();

    typeDraft('Hola @sofí');
    await screen.findByRole('listbox');
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect(getDraftTextarea()).toHaveValue('Hola @Sofía Martínez ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects an option with the mouse without stealing focus from the textarea', async () => {
    setupStore();
    renderComposerRoute();
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });
    textarea.focus();
    typeDraft('Hola @sof');
    const option = await screen.findByRole('option', {
      name: /Sofía Martínez/,
    });

    // The `mousedown` default is prevented so the textarea keeps focus.
    const notPrevented = fireEvent.mouseDown(option);
    expect(notPrevented).toBe(false);
    expect(getDraftTextarea()).toHaveValue('Hola @Sofía Martínez ');
    expect(textarea).toHaveFocus();
  });

  it('describes the disabled muted textarea with the muted explanation', async () => {
    setupStore({ chatMuted: true });
    renderComposerRoute({ chatMuted: true });
    const textarea = await screen.findByRole('textbox', {
      name: 'Mensaje del chat',
    });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAccessibleDescription(
      /El personal del aula silenció el chat por ahora/,
    );
  });

  it('disables send for the Retry-After seconds after a 429 and re-enables it automatically', async () => {
    const store = setupStore();
    mswServer.use(
      http.post(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`,
        () => {
          const response = createErrorEnvelopeResponse(429, {
            code: 'TOO_MANY_REQUESTS',
            message: 'Slow down.',
            correlationId: 'req-chat-send-429-cooldown',
          });
          response.headers.set('Retry-After', '1');
          return response;
        },
      ),
    );
    renderComposerRoute();
    await screen.findByRole('textbox', { name: 'Mensaje del chat' });

    typeDraft('Demasiado rápido');
    await submitDraft();

    expect(
      await screen.findByText(
        'Enviaste varios mensajes en poco tiempo. Esperá unos instantes antes de reintentar.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    // Enter cannot bypass the cooldown either.
    fireEvent.keyDown(getDraftTextarea(), { key: 'Enter' });
    expect(store.getCounts().send).toBe(0);

    await waitFor(
      () =>
        expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled(),
      { timeout: 3000 },
    );
    expect(getDraftTextarea()).toHaveValue('Demasiado rápido');
  });

  it('falls back to a 5 second cooldown when Retry-After is not exposed', async () => {
    setupStore();
    mswServer.use(
      http.post(
        `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages`,
        () =>
          createErrorEnvelopeResponse(429, {
            code: 'TOO_MANY_REQUESTS',
            message: 'Slow down.',
            correlationId: 'req-chat-send-429-default',
          }),
      ),
    );
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ['setTimeout', 'clearTimeout'],
    });
    try {
      renderComposerRoute();
      await screen.findByRole('textbox', { name: 'Mensaje del chat' });
      typeDraft('Otra vez demasiado rápido');
      await submitDraft();
      await screen.findByText(/Enviaste varios mensajes en poco tiempo/);
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
