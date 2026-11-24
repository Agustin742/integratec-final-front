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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApiClient } from '@/api/client';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { Toast, toast } from '@/components/ui/toast';
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
import { useClassroomContextEvents } from '../use-classroom-context-events';
import { ChatPanel } from './chat-panel';

const CLASSROOM_ID = '00000000-0000-4000-8000-000000000051';
const CLASSROOM_NAME = '3.º Año B - Matemática';
const STUDENT_ID = '00000000-0000-4000-8000-000000007001';
const TEACHER_ID = '00000000-0000-4000-8000-000000000001';
const TEACHER_ID_2 = '00000000-0000-4000-8000-000000000002';
// The MSW hide handler stamps this fixed instant on every first hide.
const HIDDEN_AT = '2026-11-19T04:00:00.000Z';

type Capability =
  components['schemas']['ClassroomContextResponseDto']['capabilities'][number];

type ModerationRole = 'OWNER' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

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
      userId: TEACHER_ID_2,
      displayName: 'Prof. Beatriz López',
      role: 'TEACHER' as const,
    },
  ];
}

/**
 * Mirrors the panel suite: one SSE `classroom.context-invalidated`
 * subscription mounted next to the panel plus the app toaster, so confirmed
 * and reconciled moderation outcomes are observable like in the shell.
 */
function ChatRouteHost() {
  const { classroomId } = useParams();
  useClassroomContextEvents(classroomId ?? '');
  return <ChatPanel />;
}

function renderModerationRoute(
  options: {
    readonly role?: ModerationRole;
    readonly userId?: string;
    readonly capabilities?: readonly Capability[];
  } = {},
) {
  const role = options.role ?? 'TEACHER';
  const currentUserId = options.userId ?? TEACHER_ID;
  const capabilities: readonly Capability[] =
    options.capabilities ??
    (role === 'TEACHER' || role === 'OWNER' || role === 'ADMIN'
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
        element: <ChatRouteHost />,
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
        <Toast />
        <RouterProvider router={router} />
      </ApiQueryProvider>
    </SessionProvider>,
  );

  return view;
}

/** Accessible name of the row moderation control, as the panel composes it. */
function hideButtonName(author: string, createdAt: string) {
  return `Ocultar el mensaje de ${author} del ${formatInstant(createdAt)}`;
}

async function openHideDialog(message: {
  readonly id: string;
  readonly author: string;
  readonly createdAt: string;
}) {
  fireEvent.click(
    screen.getByRole('button', {
      name: hideButtonName(message.author, message.createdAt),
    }),
  );
  return screen.findByRole('dialog', { name: 'Ocultar mensaje del chat' });
}

async function confirmHide(dialog: HTMLElement) {
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Ocultar mensaje' }),
  );
}

describe('ChatPanel moderation (#51, S3/S10: teacher-level hide)', () => {
  beforeAll(() => mswServer.listen());
  afterEach(() => {
    mswServer.resetHandlers();
    // Sonner's toast store is module-global: dismiss leftovers so a toast
    // from one test cannot leak into the next test's Toaster.
    act(() => {
      toast.dismiss();
    });
  });
  afterAll(() => mswServer.close());

  it('hides a message only after a confirmed moderation: the control opens a confirmation and the 204 marks the row hidden with the audit', async () => {
    const target = makeMessage({
      body: 'Mensaje a moderar',
      createdAt: '2026-11-19T03:10:00.000Z',
    });
    const remaining = makeMessage({ body: 'Mensaje que sigue' });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target, remaining],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderModerationRoute();
    expect(await screen.findByText('Mensaje a moderar')).toBeVisible();

    // The moderation control is offered per visible row for the teacher.
    const trigger = screen.getByRole('button', {
      name: hideButtonName('Sofía Martínez', target.createdAt),
    });
    expect(trigger).toBeVisible();
    // Compact icon control: named for assistive tech, no visible text label.
    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();
    expect(store.getCounts().hide).toBe(0);

    // Confirmation dialog: the exact message is shown before anything is sent.
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', {
      name: 'Ocultar mensaje del chat',
    });
    expect(within(dialog).getByText('Mensaje a moderar')).toBeVisible();
    expect(
      within(dialog).getByText(/deja de verse para el alumnado/),
    ).toBeVisible();
    // Nothing is faked while the confirmation is open: no badge, no request.
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();
    expect(store.getCounts().hide).toBe(0);

    await confirmHide(dialog);

    // Server-confirmed: the dialog closes and the revalidated history keeps
    // the row for the teacher with the moderation audit (S10).
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Mensaje a moderar')).toBeVisible();
    expect(screen.getByText('Ocultado')).toBeVisible();
    expect(
      screen.getByText(
        `Ocultado por Prof. Ana García el ${formatInstant(HIDDEN_AT)}`,
      ),
    ).toBeVisible();
    expect(
      await screen.findByText('Mensaje ocultado: el alumnado deja de verlo.'),
    ).toBeVisible();
    expect(store.getCounts().hide).toBe(1);
    expect(
      store.getMessages().find((m) => m.id === target.id)?.hiddenById,
    ).toBe(TEACHER_ID);

    // A hidden row offers no further moderation (no unhide exists in the
    // contract, S13), while other visible rows keep their own control.
    expect(
      screen.queryByRole('button', {
        name: hideButtonName('Sofía Martínez', target.createdAt),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: hideButtonName('Sofía Martínez', remaining.createdAt),
      }),
    ).toBeVisible();
    expect(screen.getByText('Mensaje que sigue')).toBeVisible();

    await expectAccessible(view.container);
  });

  it('keeps the moderation control outside the bubble, still focusable and named, on the free side', async () => {
    const target = makeMessage({
      body: 'Mensaje ajeno',
      createdAt: '2026-11-19T03:25:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    renderModerationRoute();
    expect(await screen.findByText('Mensaje ajeno')).toBeVisible();

    const button = screen.getByRole('button', {
      name: hideButtonName('Sofía Martínez', target.createdAt),
    });
    const bubble = screen.getByText('Mensaje ajeno').closest('[data-bubble]');
    expect(bubble).not.toBeNull();
    // Out of the bubble: it reserves no space inside it...
    expect(bubble).not.toContainElement(button);
    // ...but hides with opacity only, so it stays in the tab order.
    expect(button.classList.contains('hidden')).toBe(false);
    expect(button.classList.contains('invisible')).toBe(false);
    button.focus();
    expect(button).toHaveFocus();
    // Others' messages sit on the left with the control as a sibling outside [data-bubble].
    const row = bubble?.closest('li');
    expect(row).not.toBeNull();
    expect(row).toContainElement(button);
    expect(row?.className).toContain('justify-start');
    expect(row?.className).not.toContain('flex-row-reverse');
    expect(button.className).toContain('size-11');
    expect(button.className).not.toContain('pointer-fine:pointer-events-none');
  });

  it('shows the pending state during the hide request and never presents the row as hidden before the 204', async () => {
    const target = makeMessage({
      body: 'Mensaje con demora',
      createdAt: '2026-11-19T03:20:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
      writeDelayMs: 300,
    });
    mswServer.use(...store.handlers);

    renderModerationRoute();
    expect(await screen.findByText('Mensaje con demora')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', {
        name: hideButtonName('Sofía Martínez', target.createdAt),
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Ocultar mensaje del chat',
    });
    await confirmHide(dialog);

    // Pending: visible notice, disabled controls, nothing confirmed yet.
    expect(
      await within(dialog).findByText('Ocultando el mensaje…'),
    ).toBeVisible();
    expect(
      within(dialog).getByRole('button', { name: 'Ocultando…' }),
    ).toBeDisabled();
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();
    expect(store.getCounts().hide).toBe(1);

    // The 204 lands: the confirmed state arrives through revalidation.
    expect(await screen.findByText('Ocultado')).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
  });

  it('never offers the moderation control to students or parents, or without the server-granted moderate_chat capability', async () => {
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: STUDENT_ID,
      role: 'STUDENT',
      initialMessages: [makeMessage({ body: 'Mensaje visible' })],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    // Students never see the control, and no hide request is ever issued.
    const studentView = renderModerationRoute({
      role: 'STUDENT',
      userId: STUDENT_ID,
    });
    expect(await screen.findByText('Mensaje visible')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Ocultar el mensaje de/ }),
    ).not.toBeInTheDocument();
    expect(store.getCounts().hide).toBe(0);
    studentView.unmount();

    // Parents are denied the chat entirely (S5, read side) so there is no
    // moderation surface at all.
    const parentView = renderModerationRoute({
      role: 'PARENT',
      userId: 'parent-1',
    });
    expect(
      await screen.findByText(
        'El chat del aula no está disponible para tu rol',
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Ocultar el mensaje de/ }),
    ).not.toBeInTheDocument();
    parentView.unmount();

    // Gating is capability-driven, not a role-name guess: without the
    // server-granted `moderate_chat` capability the control is absent even
    // for a staff role name.
    const uncappedView = renderModerationRoute({
      role: 'TEACHER',
      userId: TEACHER_ID,
      capabilities: ['list_directory'],
    });
    expect(await screen.findByText('Mensaje visible')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Ocultar el mensaje de/ }),
    ).not.toBeInTheDocument();
    uncappedView.unmount();
  });

  it('handles a later server denial: failure copy shown, dialog closed, message kept and retryable', async () => {
    const target = makeMessage({
      body: 'Mensaje que el servidor rechaza',
      createdAt: '2026-11-19T03:30:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
    });
    store.failNext('hide', {
      status: 403,
      body: {
        code: 'FORBIDDEN',
        message: 'Only classroom staff can moderate the chat.',
        correlationId: 'req-chat-hide-403',
      },
    });
    mswServer.use(...store.handlers);

    renderModerationRoute();
    expect(
      await screen.findByText('Mensaje que el servidor rechaza'),
    ).toBeVisible();

    const dialog = await openHideDialog({
      id: target.id,
      author: 'Sofía Martínez',
      createdAt: target.createdAt,
    });
    await confirmHide(dialog);

    // The denial is presented with the failure copy, the dialog closes and
    // nothing is faked: the row keeps its body, no badge, control available.
    expect(
      await screen.findByText('No pudimos ocultar el mensaje'),
    ).toBeVisible();
    expect(
      screen.getByText('No tenés permiso para usar el chat de este aula.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText('Mensaje que el servidor rechaza')).toBeVisible();
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: hideButtonName('Sofía Martínez', target.createdAt),
      }),
    ).toBeVisible();
    expect(store.getCounts().hide).toBe(1);
    expect(
      store.getMessages().find((m) => m.id === target.id)?.hiddenAt,
    ).toBeNull();
  });

  it('reconciles an uncertain hide instead of retrying: the landed hide surfaces via revalidation', async () => {
    const target = makeMessage({
      body: 'Mensaje con confirmación perdida',
      createdAt: '2026-11-19T03:40:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
    });
    // The moderation lands on the server but the 204 is lost: uncertain.
    store.failNext('hide', 'drop-response');
    mswServer.use(...store.handlers);

    renderModerationRoute();
    expect(
      await screen.findByText('Mensaje con confirmación perdida'),
    ).toBeVisible();

    const dialog = await openHideDialog({
      id: target.id,
      author: 'Sofía Martínez',
      createdAt: target.createdAt,
    });
    await confirmHide(dialog);

    // No blind retry: reconciliation against the revalidated history proves
    // the hide landed, so the row is hidden with the audit and the dialog
    // closes without a second request.
    expect(await screen.findByText('Ocultado')).toBeVisible();
    expect(
      screen.getByText(
        `Ocultado por Prof. Ana García el ${formatInstant(HIDDEN_AT)}`,
      ),
    ).toBeVisible();
    expect(
      await screen.findByText(
        'Confirmamos con el servidor que el mensaje ya está oculto.',
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
    expect(store.getCounts().hide).toBe(1);
  });

  it('keeps an uncertain hide that did not land visible, with one manual retry after reconciliation', async () => {
    const target = makeMessage({
      body: 'Mensaje que no llegó al servidor',
      createdAt: '2026-11-19T03:50:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
    });
    // The request never reaches the server: the hide definitively did not
    // land, but the caller cannot know that from the transport loss.
    store.failNext('hide', 'network');
    mswServer.use(...store.handlers);

    renderModerationRoute();
    expect(
      await screen.findByText('Mensaje que no llegó al servidor'),
    ).toBeVisible();

    const dialog = await openHideDialog({
      id: target.id,
      author: 'Sofía Martínez',
      createdAt: target.createdAt,
    });
    await confirmHide(dialog);

    // Reconciliation shows the message is still visible server-side: the
    // uncertainty is reported and the dialog stays for a manual retry.
    expect(
      await within(dialog).findByText('No pudimos confirmar la ocultación'),
    ).toBeVisible();
    expect(
      within(dialog).getByText(
        'No sabemos si el mensaje quedó oculto en el servidor. Verificamos el chat: si el mensaje sigue visible, podés volver a intentarlo.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Ocultado')).not.toBeInTheDocument();

    // One bounded manual retry (idempotent endpoint, user-initiated only).
    await confirmHide(dialog);
    expect(await screen.findByText('Ocultado')).toBeVisible();
    expect(
      await screen.findByText('Mensaje ocultado: el alumnado deja de verlo.'),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
    expect(store.getCounts().hide).toBe(2);
  });

  it('preserves the original audit when the message was already hidden server-side (idempotent double-hide)', async () => {
    const target = makeMessage({
      body: 'Mensaje ya ocultado por otra docente',
      createdAt: '2026-11-19T03:55:00.000Z',
    });
    const store = createClassroomChatStore({
      classroomId: CLASSROOM_ID,
      currentUserId: TEACHER_ID,
      role: 'TEACHER',
      initialMessages: [target],
      members: makeMembers(),
    });
    mswServer.use(...store.handlers);

    const view = renderModerationRoute();
    expect(
      await screen.findByText('Mensaje ya ocultado por otra docente'),
    ).toBeVisible();

    // Another teacher moderates the same message first (concurrent staff
    // action the local view has not seen yet).
    store.setCurrentUserId(TEACHER_ID_2);
    const concurrent = await fetch(
      `${TEST_API_BASE_URL}/classrooms/${CLASSROOM_ID}/messages/${target.id}`,
      { method: 'DELETE' },
    );
    expect(concurrent.status).toBe(204);
    store.setCurrentUserId(TEACHER_ID);

    // The stale local row still offers the control; confirming sends the
    // second hide, which the server answers idempotently (204) without
    // overwriting the original audit.
    const dialog = await openHideDialog({
      id: target.id,
      author: 'Sofía Martínez',
      createdAt: target.createdAt,
    });
    await confirmHide(dialog);

    expect(await screen.findByText('Ocultado')).toBeVisible();
    expect(
      screen.getByText(
        `Ocultado por Prof. Beatriz López el ${formatInstant(HIDDEN_AT)}`,
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Ocultar mensaje del chat' }),
      ).not.toBeInTheDocument();
    });
    expect(store.getCounts().hide).toBe(2);
    expect(
      store.getMessages().find((m) => m.id === target.id)?.hiddenById,
    ).toBe(TEACHER_ID_2);

    await expectAccessible(view.container);
  });
});
