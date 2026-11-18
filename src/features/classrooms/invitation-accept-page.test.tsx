import { QueryClient } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { createApiClient } from '@/api/client';
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
  test,
  vi,
} from 'vitest';
import { messages } from '@/app/messages';
import { createAppRoutes } from '@/app/router/routes';
import { authMessages } from '@/features/auth/messages';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createAcceptInvitationHandler,
  createClassroomContextEventsHandler,
  createClassroomContextHandler,
  createJoinClassroomByCodeHandler,
  createLoginHandler,
  createOwnProfileHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import '@/app/pages/invitation-accept-page';
import '@/app/pages/login-page';
import '@/app/pages/register-page';
import '@/features/classrooms/classroom-workspace';
import { joinMessages } from './join-messages';
import { acceptClassroomInvitation } from './join-service';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function seedStoredSession(
  tabOwner = '00000000-0000-4000-8000-000000000099',
  accessToken = 'student-access-token',
) {
  window.name = `\n[integratec-tab:${tabOwner}]`;
  window.sessionStorage.setItem(
    'integratec.session',
    JSON.stringify({
      accessToken,
      refreshToken: 'student-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      expiresAt: Date.now() + 900_000,
      tabOwner,
    }),
  );
  return tabOwner;
}

function renderInvitationRoute(
  initialEntry = '/invitations/accept',
  options?: { signedIn?: boolean; email?: string },
) {
  const tabOwner = '00000000-0000-4000-8000-000000000099';
  if (options?.signedIn) {
    seedStoredSession(tabOwner);
    mswServer.use(
      createOwnProfileHandler({
        response: {
          email: options.email ?? 'estudiante@ejemplo.com',
          displayName: 'Lucía Estudiante',
        },
      }),
    );
  }
  const session = createSession({
    baseUrl: TEST_API_BASE_URL,
    tabOwner: () => tabOwner,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [initialEntry],
  });

  const view = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );

  return { router, session, queryClient, ...view };
}

describe('InvitationAcceptPage (/invitations/accept)', () => {
  test('gates unauthenticated visitors behind login/register return targets, scrubs ?token= after sign-in, and lands in classroom on acceptance', async () => {
    const capturedAcceptBodies: unknown[] = [];
    mswServer.use(
      createLoginHandler(),
      createOwnProfileHandler({
        response: {
          email: 'cuenta.distinta@ejemplo.com',
          displayName: 'Lucía Estudiante',
        },
      }),
      createAcceptInvitationHandler({
        onRequest: (_request, body) => {
          capturedAcceptBodies.push(body);
        },
      }),
      createClassroomContextHandler('classroom-demo-1'),
      createClassroomContextEventsHandler('classroom-demo-1'),
    );

    const { container, router } = renderInvitationRoute(
      '/invitations/accept?token=inv-valid-student-token',
    );

    const main = await screen.findByRole('main');
    expect(
      await within(main).findByRole('heading', {
        level: 2,
        name: messages.pages.invitationAccept.title,
      }),
    ).toBeVisible();
    expect(
      within(main).getByRole('heading', {
        level: 3,
        name: joinMessages.gate.title,
      }),
    ).toBeVisible();

    const loginLink = within(main).getByRole('link', {
      name: joinMessages.gate.loginCta,
    });
    const registerLink = within(main).getByRole('link', {
      name: joinMessages.gate.registerCta,
    });
    expect(loginLink).toHaveAttribute(
      'href',
      '/login?next=%2Finvitations%2Faccept%3Ftoken%3Dinv-valid-student-token',
    );
    expect(registerLink).toHaveAttribute(
      'href',
      '/register?next=%2Finvitations%2Faccept%3Ftoken%3Dinv-valid-student-token',
    );
    await expectAccessible(container);

    fireEvent.click(loginLink);

    const emailInput = await screen.findByLabelText(
      authMessages.login.fields.email.label,
    );
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      '?next=%2Finvitations%2Faccept%3Ftoken%3Dinv-valid-student-token',
    );

    fireEvent.change(emailInput, {
      target: { value: 'cuenta.distinta@ejemplo.com' },
    });
    fireEvent.change(
      screen.getByLabelText(authMessages.login.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: joinMessages.invitation.readyTitle,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/invitations/accept');
      expect(router.state.location.search).toBe('');
    });
    expect(JSON.stringify(router.state.location.state)).not.toContain(
      'inv-valid-student-token',
    );
    expect(
      screen.getByText(joinMessages.invitation.emailMismatchHint),
    ).toBeVisible();
    await expectAccessible(container);

    fireEvent.click(
      screen.getByRole('button', {
        name: joinMessages.invitation.acceptAction,
      }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: '3° Año B - Matemática',
      }),
    ).toBeVisible();
    const outcomeBanner = screen.getByTestId('classroom-join-outcome');
    expect(outcomeBanner).toHaveTextContent(joinMessages.outcome.joinedBody);
    expect(outcomeBanner).toHaveTextContent('Pupitre asignado: #4.');
    expect(router.state.location.pathname).toBe('/classrooms/classroom-demo-1');
    expect(capturedAcceptBodies).toEqual([
      { token: 'inv-valid-student-token' },
    ]);
    // The banner is one-shot: router/history state is cleared, banner stays.
    await waitFor(() => {
      expect(JSON.stringify(router.state.location.state)).not.toContain(
        'joinOutcome',
      );
    });
    expect(router.state.location.pathname).toBe('/classrooms/classroom-demo-1');
    expect(screen.getByTestId('classroom-join-outcome')).toHaveTextContent(
      joinMessages.outcome.joinedBody,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '3° Año B - Matemática' }),
    ).toBeVisible();
  });

  test.each(['', '?token=a&token=b'])(
    'keeps the unauthenticated code gate and rejects malformed tokens for %s',
    async (query) => {
      renderInvitationRoute(`/invitations/accept${query}`);
      expect(
        await screen.findByRole('link', { name: joinMessages.gate.loginCta }),
      ).toHaveAttribute('href', '/login?next=%2Finvitations%2Faccept');
      expect(
        screen.getByRole('link', { name: joinMessages.gate.registerCta }),
      ).toHaveAttribute('href', '/register?next=%2Finvitations%2Faccept');
      expect(
        screen.queryByLabelText(joinMessages.code.fieldLabel),
      ).not.toBeInTheDocument();
      if (query) {
        expect(screen.getByRole('alert')).toHaveTextContent(
          joinMessages.invitation.invalidTokenDescription,
        );
      }
    },
  );

  test('recovers the scrubbed invitation after definitive session expiration and reauthentication as another account', async () => {
    const capturedBodies: unknown[] = [];
    mswServer.use(
      createAcceptInvitationHandler({
        onRequest: (_request, body) => {
          capturedBodies.push(body);
        },
      }),
    );
    const { router, session } = renderInvitationRoute(
      '/invitations/accept?token=inv-valid-student-token&next=https://evil.example',
      { signedIn: true },
    );
    await screen.findByRole('button', {
      name: joinMessages.invitation.acceptAction,
    });
    await waitFor(() => {
      expect(router.state.location.search).not.toContain('token=');
    });
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/users/me`, () =>
        HttpResponse.json({}, { status: 401 }),
      ),
      http.post(`${TEST_API_BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({}, { status: 401 }),
      ),
    );
    await act(async () => {
      await session.client.GET('/users/me').catch(() => undefined);
    });
    expect(session.controller.getSnapshot().status).toBe('unauthenticated');
    const loginLink = await screen.findByRole('link', {
      name: joinMessages.gate.loginCta,
    });
    const expectedReturn =
      '%2Finvitations%2Faccept%3Ftoken%3Dinv-valid-student-token';
    expect(loginLink).toHaveAttribute('href', `/login?next=${expectedReturn}`);
    expect(
      screen.getByRole('link', { name: joinMessages.gate.registerCta }),
    ).toHaveAttribute('href', `/register?next=${expectedReturn}`);
    expect(
      screen.queryByText('estudiante@ejemplo.com'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(joinMessages.code.fieldLabel),
    ).not.toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(JSON.stringify(router.state.location.state)).not.toContain(
      'inv-valid',
    );

    mswServer.use(
      createLoginHandler(),
      createOwnProfileHandler({
        response: {
          id: 'another-student',
          email: 'otra@ejemplo.com',
          displayName: 'Otra Estudiante',
        },
      }),
    );
    fireEvent.click(loginLink);
    fireEvent.change(
      await screen.findByLabelText(authMessages.login.fields.email.label),
      { target: { value: 'otra@ejemplo.com' } },
    );
    fireEvent.change(
      screen.getByLabelText(authMessages.login.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );
    const acceptButton = await screen.findByRole('button', {
      name: joinMessages.invitation.acceptAction,
    });
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.getByText('otra@ejemplo.com')).toBeVisible();
    expect(
      screen.queryByText('estudiante@ejemplo.com'),
    ).not.toBeInTheDocument();
    expect(capturedBodies).toEqual([]);
    mswServer.use(
      http.post(
        `${TEST_API_BASE_URL}/invitations/accept`,
        async ({ request }) => {
          capturedBodies.push(await request.json());
          return HttpResponse.json({}, { status: 400 });
        },
      ),
    );
    fireEvent.click(acceptButton);
    await screen.findByRole('alert');
    expect(capturedBodies).toEqual([{ token: 'inv-valid-student-token' }]);
    expect(
      screen.queryByTestId('classroom-join-outcome'),
    ).not.toBeInTheDocument();
  });

  test('rejects an invitation consumed by another account without showing private classroom data', async () => {
    mswServer.use(createAcceptInvitationHandler());
    const otherClient = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      headers: { Authorization: 'Bearer another-account-token' },
    });
    await acceptClassroomInvitation(otherClient, {
      token: 'inv-valid-student-token',
    });
    const { router } = renderInvitationRoute(
      '/invitations/accept?token=inv-valid-student-token',
      { signedIn: true },
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: joinMessages.invitation.acceptAction,
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      joinMessages.errors.invitationInvalidOrExpired,
    );
    expect(router.state.location.pathname).toBe('/invitations/accept');
    expect(
      screen.queryByTestId('classroom-join-outcome'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('3° Año B - Matemática')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /membership-student|classroom-demo|another-account-token/,
      ),
    ).not.toBeInTheDocument();
  });

  test.each([
    ['inv-revoked-token', joinMessages.errors.invitationInvalidOrExpired],
    ['inv-used-token', joinMessages.errors.invitationInvalidOrExpired],
    ['inv-expired-token', joinMessages.errors.invitationInvalidOrExpired],
    ['inv-unknown-token', joinMessages.errors.invitationInvalidOrExpired],
    ['inv-conflict-token', joinMessages.errors.invitationConflict],
    ['inv-rate-limited-token', joinMessages.errors.rateLimited],
  ] as const)(
    'shows privacy-safe invitation error for %s without creating membership',
    async (token, expectedError) => {
      mswServer.use(createAcceptInvitationHandler());

      const { router } = renderInvitationRoute(
        `/invitations/accept?token=${token}`,
        { signedIn: true },
      );

      const acceptButton = await screen.findByRole('button', {
        name: joinMessages.invitation.acceptAction,
      });
      await waitFor(() => {
        expect(router.state.location.search).toBe('');
      });

      fireEvent.click(acceptButton);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedError);
      expect(router.state.location.pathname).toBe('/invitations/accept');
      expect(
        screen.queryByTestId('classroom-join-outcome'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('3° Año B - Matemática'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/membership-student|classroom-demo/),
      ).not.toBeInTheDocument();
    },
  );

  test('shows an uncertain invitation outcome on network failure without announcing success', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/invitations/accept`, () =>
        HttpResponse.error(),
      ),
    );
    const { router } = renderInvitationRoute(
      '/invitations/accept?token=inv-valid-student-token',
      { signedIn: true },
    );
    const acceptButton = await screen.findByRole('button', {
      name: joinMessages.invitation.acceptAction,
    });
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });

    fireEvent.click(acceptButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      joinMessages.errors.network,
    );
    expect(router.state.location.pathname).toBe('/invitations/accept');
  });

  test('rejects malformed or duplicate query tokens client-side without calling the API and allows switching to code mode', async () => {
    let acceptCalls = 0;
    mswServer.use(
      createAcceptInvitationHandler({
        onRequest: () => {
          acceptCalls += 1;
        },
      }),
    );

    const { router } = renderInvitationRoute(
      '/invitations/accept?token=a&token=b',
      { signedIn: true },
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      joinMessages.invitation.invalidTokenDescription,
    );
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
    expect(acceptCalls).toBe(0);

    fireEvent.click(
      screen.getByRole('button', {
        name: joinMessages.invitation.switchToCodeAction,
      }),
    );
    expect(
      await screen.findByLabelText(joinMessages.code.fieldLabel),
    ).toBeVisible();
  });

  test('allows authenticated students to join with a code without role choice or storage persistence, and renders idempotent re-join', async () => {
    const capturedJoinBodies: unknown[] = [];
    mswServer.use(
      createJoinClassroomByCodeHandler({
        onRequest: (_request, body) => {
          capturedJoinBodies.push(body);
        },
      }),
      createClassroomContextHandler('classroom-demo-1'),
      createClassroomContextEventsHandler('classroom-demo-1'),
    );

    const firstView = renderInvitationRoute('/invitations/accept', {
      signedIn: true,
    });

    const codeInput = (await screen.findByLabelText(
      joinMessages.code.fieldLabel,
    )) as HTMLInputElement;
    expect(screen.queryByLabelText(/rol/i)).not.toBeInTheDocument();
    await expectAccessible(firstView.container);

    fireEvent.change(codeInput, { target: { value: '  k7p9x2m  ' } });
    fireEvent.click(
      screen.getByRole('button', { name: joinMessages.code.submitAction }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: '3° Año B - Matemática',
      }),
    ).toBeVisible();
    expect(firstView.router.state.location.pathname).toBe(
      '/classrooms/classroom-demo-1',
    );
    expect(capturedJoinBodies).toEqual([{ code: 'K7P9X2M' }]);
    expect(window.sessionStorage.getItem('integratec.session')).not.toContain(
      'K7P9X2M',
    );
    expect(window.localStorage.length).toBe(0);
    expect(screen.getByTestId('classroom-join-outcome')).toHaveTextContent(
      joinMessages.outcome.joinedBody,
    );
    firstView.unmount();

    const rejoinView = renderInvitationRoute('/invitations/accept', {
      signedIn: true,
    });
    const rejoinInput = await screen.findByLabelText(
      joinMessages.code.fieldLabel,
    );
    fireEvent.change(rejoinInput, { target: { value: 'ALREADY1' } });
    fireEvent.click(
      screen.getByRole('button', { name: joinMessages.code.submitAction }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: '3° Año B - Matemática',
      }),
    ).toBeVisible();
    const rejoinBanner = screen.getByTestId('classroom-join-outcome');
    expect(rejoinBanner).toHaveTextContent(
      joinMessages.outcome.alreadyMemberBody,
    );
    expect(rejoinBanner).toHaveTextContent('Pupitre asignado: #1.');
    expect(rejoinView.router.state.location.pathname).toBe(
      '/classrooms/classroom-demo-1',
    );
  });

  test('shows distinct error classes on join-by-code failure and keeps the typed code for correction', async () => {
    mswServer.use(createJoinClassroomByCodeHandler());

    const { router } = renderInvitationRoute('/invitations/accept', {
      signedIn: true,
    });
    const codeInput = (await screen.findByLabelText(
      joinMessages.code.fieldLabel,
    )) as HTMLInputElement;
    const submitButton = screen.getByRole('button', {
      name: joinMessages.code.submitAction,
    });

    for (const [code, expectedError] of [
      ['REVOKED1', joinMessages.errors.codeInvalidOrExpired],
      ['EXPIRED1', joinMessages.errors.codeInvalidOrExpired],
      ['UNKNOWN1', joinMessages.errors.codeInvalidOrExpired],
      ['FULLCODE', joinMessages.errors.codeExhaustedOrConflict],
      ['RATELIM1', joinMessages.errors.rateLimited],
    ] as const) {
      fireEvent.change(codeInput, { target: { value: code } });
      fireEvent.click(submitButton);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(expectedError);
      expect(codeInput.value).toBe(code);
      expect(router.state.location.pathname).toBe('/invitations/accept');
      expect(
        screen.queryByTestId('classroom-join-outcome'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('3° Año B - Matemática'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/membership-student|classroom-demo/),
      ).not.toBeInTheDocument();
    }

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/classrooms/join`, () =>
        HttpResponse.error(),
      ),
    );
    fireEvent.change(codeInput, { target: { value: 'K7P9X2M' } });
    fireEvent.click(submitButton);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      joinMessages.errors.network,
    );
    expect(codeInput.value).toBe('K7P9X2M');
  });
});
