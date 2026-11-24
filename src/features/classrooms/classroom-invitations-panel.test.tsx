import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
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
import { classroomDetailQueryKey } from '@/api/query-keys';
import { fakeSession } from '@/app/router/fake-session';
import { Toast } from '@/components/ui/toast';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createClassroomDetailHandler,
  createClassroomInvitationsHandler,
  createClassroomInvitationsStore,
  createClassroomRosterHandler,
  type ClassroomDetailPayload,
  type ClassroomInvitationPayload,
} from '@/test/msw/handlers';

vi.setConfig({ testTimeout: 20_000 });
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import { ClassroomInvitationsPanel } from './classroom-invitations-panel';
import { ClassroomPanelRoute } from './classroom-panel-route';
import { ClassroomWorkspace } from './classroom-workspace';
import { classroomMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

const copy = classroomMessages.invitations;
const classroomId = '4e5f6a7b-0000-4000-8000-000000000032';

const pendingEmailInvite: ClassroomInvitationPayload = {
  id: '71000000-0000-4000-8000-000000000001',
  kind: 'EMAIL',
  targetEmail: 'sofia@example.edu.ar',
  role: 'STUDENT',
  maxUses: 1,
  useCount: 0,
  state: 'PENDING',
  expiresAt: '2026-11-25T16:00:00.000Z',
  createdAt: '2026-11-18T15:00:00.000Z',
};

const usedEmailInvite: ClassroomInvitationPayload = {
  id: '71000000-0000-4000-8000-000000000002',
  kind: 'EMAIL',
  targetEmail: 'mateo@example.edu.ar',
  role: 'STUDENT',
  maxUses: 1,
  useCount: 1,
  state: 'USED',
  expiresAt: '2026-11-25T16:00:00.000Z',
  createdAt: '2026-11-18T14:00:00.000Z',
};

const revokedEmailInvite: ClassroomInvitationPayload = {
  id: '71000000-0000-4000-8000-000000000003',
  kind: 'EMAIL',
  targetEmail: 'lucas@example.edu.ar',
  role: 'STUDENT',
  maxUses: 1,
  useCount: 0,
  state: 'REVOKED',
  expiresAt: '2026-11-25T16:00:00.000Z',
  createdAt: '2026-11-18T13:00:00.000Z',
};

const expiredEmailInvite: ClassroomInvitationPayload = {
  id: '71000000-0000-4000-8000-000000000004',
  kind: 'EMAIL',
  targetEmail: 'clara@example.edu.ar',
  role: 'STUDENT',
  maxUses: 1,
  useCount: 0,
  state: 'EXPIRED',
  expiresAt: '2026-11-10T16:00:00.000Z',
  createdAt: '2026-11-01T13:00:00.000Z',
};

function createStaffDetailHandler(
  overrides: Partial<ClassroomDetailPayload> = {},
) {
  return createClassroomDetailHandler(classroomId, {
    myRole: 'TEACHER',
    capabilities: ['invite_members'],
    ...overrides,
  });
}

function renderInvitationsPanel(
  options: { readonly queryClient?: QueryClient } = {},
) {
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  const session = fakeSession(
    { status: 'authenticated', user: profile },
    createApiClient({ baseUrl: TEST_API_BASE_URL }),
  );
  const view = render(
    <SessionProvider service={session.service}>
      <Toast />
      <ClassroomInvitationsPanel classroomId={classroomId} />
    </SessionProvider>,
    { queryClient },
  );
  return { queryClient, session, ...view };
}

describe('ClassroomInvitationsPanel (#32)', () => {
  test('hides invitation controls and executes zero requests when invite_members is absent', async () => {
    let invitationsRequests = 0;
    mswServer.use(
      createClassroomDetailHandler(classroomId, {
        myRole: 'STUDENT',
        capabilities: ['participate_activities'],
      }),
      createClassroomInvitationsHandler({
        classroomId,
        onRequest: () => {
          invitationsRequests += 1;
        },
      }),
    );

    renderInvitationsPanel();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy.forbiddenTitle);
    expect(alert).toHaveTextContent(copy.forbiddenDescription);
    expect(invitationsRequests).toBe(0);
    expect(
      screen.queryByRole('button', { name: copy.email.submitAction }),
    ).not.toBeInTheDocument();
  });

  test('renders non-disclosing 403 and 404 states and invalidates classroom context on 404', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    mswServer.use(
      createStaffDetailHandler(),
      createClassroomInvitationsHandler({
        classroomId,
        error: {
          status: 403,
          body: {
            code: 'FORBIDDEN',
            message: 'Missing capability',
            correlationId: 'corr-inv-403',
          },
        },
      }),
    );

    const first = renderInvitationsPanel({ queryClient });
    expect(await screen.findByText(copy.forbiddenTitle)).toBeVisible();
    first.unmount();

    mswServer.use(
      createStaffDetailHandler(),
      createClassroomInvitationsHandler({
        classroomId,
        error: {
          status: 404,
          body: {
            code: 'NOT_FOUND',
            message: 'Foreign classroom',
            correlationId: 'corr-inv-404',
          },
        },
      }),
    );

    renderInvitationsPanel({ queryClient });
    expect(await screen.findByText(copy.notFoundTitle)).toBeVisible();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: classroomDetailQueryKey(profile.id, classroomId),
      exact: true,
    });
  });

  test('validates email input, preserves draft on error, shows one-time token/link and clipboard fallback', async () => {
    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [],
    });
    mswServer.use(createStaffDetailHandler(), ...store.handlers);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderInvitationsPanel();

    const emailInput = await screen.findByLabelText(copy.email.emailLabel);
    expect(screen.getByText(copy.email.roleValue)).toBeVisible();
    expect(screen.getByText(copy.email.nonDisclosureNote)).toBeVisible();

    // Client validation prevents empty / invalid email submissions.
    fireEvent.click(
      screen.getByRole('button', { name: copy.email.submitAction }),
    );
    expect(
      await screen.findByText(copy.email.validation.emailRequired),
    ).toBeVisible();

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(
      screen.getByRole('button', { name: copy.email.submitAction }),
    );
    expect(
      await screen.findByText(copy.email.validation.emailInvalid),
    ).toBeVisible();

    // Uncertain write (drop-response after server commit) preserves input and reconciles list.
    store.failNextCreateInvitation('drop-response');
    fireEvent.change(emailInput, {
      target: { value: 'nueva.estudiante@example.edu.ar' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: copy.email.submitAction }),
    );

    expect(await screen.findByText(copy.email.errors.uncertain)).toBeVisible();
    expect(emailInput).toHaveValue('nueva.estudiante@example.edu.ar');
    // Reconciliation fetched the committed invitation from the server.
    expect(
      await screen.findByText('nueva.estudiante@example.edu.ar'),
    ).toBeVisible();

    // Confirmed 201 resets draft and exposes one-time link & token.
    fireEvent.change(emailInput, {
      target: { value: 'segunda@example.edu.ar' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: copy.email.submitAction }),
    );

    expect(
      await screen.findByRole('heading', { name: copy.email.createdTitle }),
    ).toBeVisible();
    expect(emailInput).toHaveValue('');
    expect(
      screen.getByText(/\/invitations\/accept\?token=inv-token-/),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: copy.email.copyLinkAction }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining('/invitations/accept?token=inv-token-'),
      ),
    );
    expect(
      await screen.findByText(copy.email.copiedLinkAnnouncement),
    ).toBeInTheDocument();

    // Clipboard failure shows explicit manual fallback instruction.
    writeText.mockRejectedValueOnce(new Error('Clipboard blocked'));
    fireEvent.click(
      screen.getByRole('button', { name: copy.email.copyTokenAction }),
    );
    expect(
      await screen.findByText(copy.email.copyTokenFallbackInstruction),
    ).toBeVisible();
  });

  test('filters lifecycle states, paginates, revokes inline, and handles 400/uncertain revoke', async () => {
    const manyPending: ClassroomInvitationPayload[] = Array.from(
      { length: 22 },
      (_, index) => ({
        id: `71000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        kind: 'EMAIL',
        targetEmail: `estudiante${String(index + 1).padStart(2, '0')}@example.edu.ar`,
        role: 'STUDENT',
        maxUses: 1,
        useCount: 0,
        state: 'PENDING',
        expiresAt: '2026-11-25T16:00:00.000Z',
        createdAt: '2026-11-18T15:00:00.000Z',
      }),
    );

    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [
        ...manyPending,
        usedEmailInvite,
        revokedEmailInvite,
        expiredEmailInvite,
      ],
    });
    mswServer.use(createStaffDetailHandler(), ...store.handlers);

    const { container } = renderInvitationsPanel();

    expect(
      await screen.findByText('estudiante01@example.edu.ar'),
    ).toBeVisible();
    // Explicitly no Resend button anywhere.
    expect(
      screen.queryByRole('button', { name: /reenviar/i }),
    ).not.toBeInTheDocument();

    await expectAccessible(container);

    // Pagination works across pages.
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(
      await screen.findByText('estudiante21@example.edu.ar'),
    ).toBeVisible();
    expect(screen.getByText('estudiante22@example.edu.ar')).toBeVisible();

    // Switch back to page 1 / USED filter / REVOKED / EXPIRED / ALL.
    fireEvent.click(
      screen.getByRole('button', { name: copy.list.filters.USED }),
    );
    expect(await screen.findByText('mateo@example.edu.ar')).toBeVisible();
    expect(screen.getByText(copy.list.states.USED)).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: copy.list.revokeAriaLabel('mateo@example.edu.ar'),
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: copy.list.filters.EXPIRED }),
    );
    expect(await screen.findByText('clara@example.edu.ar')).toBeVisible();
    expect(screen.getByText(copy.list.states.EXPIRED)).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: copy.list.filters.REVOKED }),
    );
    expect(await screen.findByText('lucas@example.edu.ar')).toBeVisible();
    expect(screen.getByText(copy.list.states.REVOKED)).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: copy.list.filters.ALL }),
    );
    expect(
      await screen.findByText('estudiante01@example.edu.ar'),
    ).toBeVisible();
    expect(screen.getByText(/Página 1 de 2/)).toBeVisible();

    // Return to PENDING and test inline revoke confirmation + focus restoration.
    fireEvent.click(
      screen.getByRole('button', { name: copy.list.filters.PENDING }),
    );
    const revokeTrigger = await screen.findByRole('button', {
      name: copy.list.revokeAriaLabel('estudiante01@example.edu.ar'),
    });
    revokeTrigger.focus();
    fireEvent.click(revokeTrigger);

    const confirmHeading = await screen.findByRole('heading', {
      name: copy.list.confirmRevokeTitle('estudiante01@example.edu.ar'),
    });
    expect(confirmHeading).toHaveFocus();

    await expectAccessible(container);

    // Cancel restores focus to the trigger button.
    fireEvent.click(
      screen.getByRole('button', { name: copy.list.confirmRevokeCancel }),
    );
    await waitFor(() => expect(revokeTrigger).toHaveFocus());

    // Confirm 400 already used/not pending reconciles list.
    fireEvent.click(revokeTrigger);
    store.failNextRevokeInvitation({
      status: 400,
      body: {
        code: 'BAD_REQUEST',
        message: 'Already used',
        correlationId: 'corr-rev-400',
      },
    });
    fireEvent.click(
      screen.getByRole('button', { name: copy.list.confirmRevokeSubmit }),
    );
    expect(await screen.findByText(copy.list.revokeBadRequest)).toBeVisible();

    // Confirm 200 revokes and moves item out of PENDING.
    fireEvent.click(
      screen.getByRole('button', { name: copy.list.confirmRevokeSubmit }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('estudiante01@example.edu.ar'),
      ).not.toBeInTheDocument(),
    );
    expect(
      store
        .read()
        .find((item) => item.targetEmail === 'estudiante01@example.edu.ar')
        ?.state,
    ).toBe('REVOKED');
  });

  test('generates, copies, confirms regeneration, revokes join code, and handles 404 on revoke', async () => {
    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [],
    });
    mswServer.use(createStaffDetailHandler(), ...store.handlers);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderInvitationsPanel();

    // Revoke active code when none exists surfaces honest 404 message.
    const revokeActiveBtn = await screen.findByRole('button', {
      name: copy.joinCode.revokeActiveAction,
    });
    fireEvent.click(revokeActiveBtn);
    expect(
      await screen.findByText(copy.joinCode.errors.notFoundRevoke),
    ).toBeVisible();

    // Client-side bounds validation on maxUses.
    const maxUsesInput = screen.getByLabelText(copy.joinCode.maxUsesLabel);
    fireEvent.change(maxUsesInput, { target: { value: '1001' } });
    fireEvent.click(
      screen.getByRole('button', { name: copy.joinCode.generateSubmit }),
    );
    expect(
      await screen.findByText(copy.joinCode.validation.maxUsesInvalid),
    ).toBeVisible();

    // Valid generate with maxUses=30 and 24h lifetime.
    fireEvent.change(maxUsesInput, { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText(copy.joinCode.expiresLabel), {
      target: { value: '24h' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: copy.joinCode.generateSubmit }),
    );

    expect(
      await screen.findByText(copy.joinCode.activeCardTitle),
    ).toBeVisible();
    expect(screen.getByText('CODE0001')).toBeVisible();
    expect(screen.getByText('Usos: 0 de 30')).toBeVisible();

    fireEvent.click(
      screen.getByRole('button', { name: copy.joinCode.copyAction }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('CODE0001'));
    expect(
      await screen.findByText(copy.joinCode.copiedAnnouncement),
    ).toBeInTheDocument();

    // Regenerating requires inline confirmation and atomically revokes previous code.
    fireEvent.click(
      screen.getByRole('button', { name: copy.joinCode.regenerateSubmit }),
    );
    const regenConfirmHeading = await screen.findByRole('heading', {
      name: copy.joinCode.confirmRegenerateTitle,
    });
    expect(regenConfirmHeading).toHaveFocus();

    fireEvent.click(
      screen.getByRole('button', {
        name: copy.joinCode.confirmRegenerateSubmit,
      }),
    );

    expect(await screen.findByText('CODE0002')).toBeVisible();
    expect(screen.queryByText('CODE0001')).not.toBeInTheDocument();
    expect(
      store
        .read()
        .filter(
          (item) => item.kind === 'JOIN_CODE' && item.state === 'REVOKED',
        ),
    ).toHaveLength(1);

    // Revoking current active code clears card.
    fireEvent.click(
      screen.getByRole('button', { name: copy.joinCode.revokeCurrentAction }),
    );
    await waitFor(() =>
      expect(screen.queryByText('CODE0002')).not.toBeInTheDocument(),
    );
  });

  test('SSE context invalidation unmounts the panel and wipes one-time code and token from memory', async () => {
    let capabilities: ClassroomDetailPayload['capabilities'] = [
      'invite_members',
    ];
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    let holdRead = false;
    let releaseRead: (() => void) | undefined;

    const store = createClassroomInvitationsStore({
      classroomId,
      initialInvitations: [pendingEmailInvite],
    });
    mswServer.use(
      ...store.handlers,
      createClassroomRosterHandler({ classroomId, items: [] }),
      http.get(
        `${TEST_API_BASE_URL}/classrooms/${classroomId}/context-events`,
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                stream = controller;
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
      http.get(`${TEST_API_BASE_URL}/classrooms/${classroomId}`, async () => {
        if (holdRead) {
          await new Promise<void>((resolve) => {
            releaseRead = resolve;
          });
        }
        return HttpResponse.json({
          id: classroomId,
          name: 'Matemática 3° B',
          subject: null,
          schoolId: null,
          independentTeacherId: 'teacher-1',
          adultMode: false,
          chatMuted: false,
          collaborationLocked: false,
          gamesDisabled: false,
          deskCount: 0,
          pet: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          myRole: 'TEACHER',
          capabilities,
          availablePanels: ['members'],
        });
      }),
    );

    const session = fakeSession(
      { status: 'authenticated', user: profile },
      createApiClient({ baseUrl: TEST_API_BASE_URL }),
    );
    const router = createMemoryRouter(
      [
        {
          path: '/classrooms/:classroomId',
          element: <ClassroomWorkspace />,
          children: [
            { path: 'panels/:panelKey', Component: ClassroomPanelRoute },
          ],
        },
      ],
      { initialEntries: [`/classrooms/${classroomId}/panels/members`] },
    );

    render(
      <SessionProvider service={session.service}>
        <Toast />
        <RouterProvider router={router} />
      </SessionProvider>,
    );

    const dialog = await screen.findByRole('dialog', { name: 'Integrantes' });
    const invitationsTab = within(dialog).getByRole('tab', {
      name: classroomMessages.members.invitationsTab,
    });
    // Radix Tabs activates tabs on mouseDown/focus+keyboard or click; click tab.
    fireEvent.mouseDown(invitationsTab);
    fireEvent.click(invitationsTab);

    const genBtn = await screen.findByRole('button', {
      name: copy.joinCode.generateSubmit,
    });
    fireEvent.click(genBtn);
    expect(await screen.findByText('CODE0001')).toBeVisible();

    // Trigger SSE revocation + capability removal.
    capabilities = ['participate_activities'];
    holdRead = true;
    // The first hint of a connection is the registration hint and never resets;
    // the second one is the real invalidation.
    const hintFrame = new TextEncoder().encode(
      `event: classroom.context-invalidated\ndata: {"classroomId":"${classroomId}"}\n\n`,
    );
    await act(async () => {
      stream?.enqueue(hintFrame);
    });
    await act(async () => {
      stream?.enqueue(hintFrame);
    });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('CODE0001')).not.toBeInTheDocument();

    holdRead = false;
    await act(async () => {
      releaseRead?.();
    });
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
  });
});
