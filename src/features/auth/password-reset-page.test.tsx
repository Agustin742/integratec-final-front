import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
import { createAppRoutes } from '@/app/router/routes';
import { createAppQueryClient } from '@/api/query-client';
import { createSession } from '@/session/controller';
import {
  deferred,
  harness,
  json,
  login,
  profile,
  storageKey,
  tokens,
} from '@/session/test-fixtures';
import { SessionProvider } from '@/session/provider';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
  createPasswordResetConfirmHandler,
  createPasswordResetRequestHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import '@/app/pages/login-page';
import '@/app/pages/password-reset-page';
import { authMessages } from './messages';

beforeAll(() => {
  mswServer.listen({ onUnhandledFrame: 'error' });
});

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubEnv('VITE_APP_ENV', 'test');
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL);
  vi.stubEnv('VITE_REALTIME_URL', 'wss://realtime.example.invalid');
});

afterEach(() => {
  mswServer.resetHandlers();
  window.sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(() => {
  mswServer.close();
});

function renderPasswordResetRoute(
  initialPath = '/password-reset',
  session = createSession({ baseUrl: TEST_API_BASE_URL }),
) {
  const queryClient = createAppQueryClient();
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [initialPath],
  });

  const view = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
    { queryClient },
  );

  return { router, session, queryClient, ...view };
}

describe('PasswordResetPage (/password-reset)', () => {
  test.each(['request', 'confirm'] as const)(
    'S1: signed-in %s mode stays reachable and only confirmed reset clears session and private cache',
    async (mode) => {
      const h = harness((request) => {
        if (request.url.endsWith('/auth/password-reset/request')) {
          return json({ message: 'Synthetic accepted request' }, 202);
        }
        if (
          request.url.endsWith('/auth/password-reset/confirm') ||
          request.url.endsWith('/auth/logout')
        ) {
          return new Response(null, { status: 204 });
        }
        return request.url.endsWith('/users/me') ? json(profile) : json(tokens);
      });
      const session = createSession(h);
      expect((await session.controller.login(login)).ok).toBe(true);
      const before = h.storage.getItem(storageKey);
      const { router, queryClient } = renderPasswordResetRoute(
        mode === 'confirm'
          ? '/password-reset?token=synthetic-reset-token&next=%2F'
          : '/password-reset',
        session,
      );
      const copy = authMessages.passwordReset[mode];
      const field = await screen.findByLabelText(
        mode === 'confirm'
          ? authMessages.passwordReset.confirm.fields.newPassword.label
          : authMessages.passwordReset.request.fields.email.label,
      );
      queryClient.setQueryData(['private', 'synthetic-user'], {
        private: true,
      });
      expect(router.state.location.pathname).toBe('/password-reset');
      await waitFor(() =>
        expect(router.state.location.search).not.toContain('token'),
      );
      expect(JSON.stringify(router.state.location.state)).not.toContain(
        'synthetic-reset-token',
      );
      fireEvent.change(field, {
        target: {
          value: mode === 'confirm' ? 'NuevaPassword2026' : 'ana@example.com',
        },
      });
      fireEvent.click(
        screen.getByRole('button', { name: copy.actions.submit }),
      );
      await screen.findByRole('status');
      expect(session.controller.getSnapshot().status).toBe(
        mode === 'confirm' ? 'unauthenticated' : 'authenticated',
      );
      expect(h.storage.getItem(storageKey)).toBe(
        mode === 'confirm' ? null : before,
      );
      expect(queryClient.getQueryData(['private', 'synthetic-user'])).toEqual(
        mode === 'confirm' ? undefined : { private: true },
      );
      expect(
        h.requests.filter((request) => request.url.endsWith('/auth/logout')),
      ).toHaveLength(mode === 'confirm' ? 1 : 0);
    },
  );

  test.each(['request', 'confirm'] as const)(
    'S1: %s cancellation settles without an alert, success, credential drift or unhandled rejection',
    async (mode) => {
      let rejectReset!: (reason: unknown) => void;
      const h = harness((request) => {
        if (request.url.includes('/auth/password-reset/')) {
          return new Promise<Response>((_resolve, reject) => {
            rejectReset = reject;
          });
        }
        throw new Error('Unexpected API request');
      });
      const session = createSession(h);
      const { queryClient } = renderPasswordResetRoute(
        mode === 'confirm'
          ? '/password-reset?token=synthetic-reset-token'
          : '/password-reset',
        session,
      );
      const copy = authMessages.passwordReset[mode];
      const field = await screen.findByLabelText(
        mode === 'confirm'
          ? authMessages.passwordReset.confirm.fields.newPassword.label
          : authMessages.passwordReset.request.fields.email.label,
      );
      queryClient.setQueryData(['public-test'], 'unchanged');
      const before = h.storage.getItem(storageKey);
      fireEvent.change(field, {
        target: {
          value: mode === 'confirm' ? 'NuevaPassword2026' : 'ana@example.com',
        },
      });
      fireEvent.click(
        screen.getByRole('button', { name: copy.actions.submit }),
      );
      await waitFor(() => expect(rejectReset).toBeTypeOf('function'));
      rejectReset(new DOMException('Synthetic cancellation', 'AbortError'));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: copy.actions.submit }),
        ).toBeEnabled(),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(h.storage.getItem(storageKey)).toBe(before);
      expect(queryClient.getQueryData(['public-test'])).toBe('unchanged');
      expect(h.requests).toHaveLength(1);
      expect(session.controller.getSnapshot().status).toBe('unauthenticated');
    },
  );

  test.each(['request', 'confirm'] as const)(
    'S1: late %s response cannot affect a newer session even if fetch ignores abort',
    async (mode) => {
      const response = deferred<Response>();
      let resetSignal: AbortSignal | undefined;
      let loginCount = 0;
      const h = harness((request) => {
        if (request.url.includes('/auth/password-reset/')) {
          resetSignal = request.signal;
          return response.promise;
        }
        if (request.url.endsWith('/users/me')) return json(profile);
        if (request.url.endsWith('/auth/login')) {
          loginCount += 1;
          return json({
            ...tokens,
            accessToken: `synthetic-access-${loginCount}`,
          });
        }
        throw new Error('Unexpected API request');
      });
      const session = createSession(h);
      expect((await session.controller.login(login)).ok).toBe(true);
      const { queryClient } = renderPasswordResetRoute(
        mode === 'confirm'
          ? '/password-reset?token=synthetic-reset-token'
          : '/password-reset',
        session,
      );
      const copy = authMessages.passwordReset[mode];
      const field = await screen.findByLabelText(
        mode === 'confirm'
          ? authMessages.passwordReset.confirm.fields.newPassword.label
          : authMessages.passwordReset.request.fields.email.label,
      );
      fireEvent.change(field, {
        target: {
          value: mode === 'confirm' ? 'NuevaPassword2026' : 'ana@example.com',
        },
      });
      fireEvent.click(
        screen.getByRole('button', { name: copy.actions.submit }),
      );
      await waitFor(() => expect(resetSignal).toBeDefined());
      await act(async () => {
        expect((await session.controller.login(login)).ok).toBe(true);
      });
      expect(resetSignal?.aborted).toBe(true);
      const credentials = h.storage.getItem(storageKey);
      queryClient.setQueryData(['private', 'new-session'], 'new private data');
      response.resolve(
        mode === 'confirm'
          ? new Response(null, { status: 204 })
          : json({ message: 'Accepted' }, 202),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: copy.actions.submit }),
        ).toBeEnabled(),
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(h.storage.getItem(storageKey)).toBe(credentials);
      expect(queryClient.getQueryData(['private', 'new-session'])).toBe(
        'new private data',
      );
      expect(session.controller.getSnapshot().status).toBe('authenticated');
      expect(
        h.requests.filter((request) =>
          request.url.includes('/auth/password-reset/'),
        ),
      ).toHaveLength(1);
      expect(
        h.requests.filter((request) => request.url.endsWith('/auth/logout')),
      ).toHaveLength(0);
    },
  );

  test.each(['request', 'confirm'] as const)(
    'S1: leaving %s mode aborts the caller signal without retrying',
    async (mode) => {
      let resetSignal: AbortSignal | undefined;
      const h = harness((request) => {
        resetSignal = request.signal;
        return new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener(
            'abort',
            () => reject(request.signal.reason),
            { once: true },
          );
        });
      });
      const session = createSession(h);
      const { unmount } = renderPasswordResetRoute(
        mode === 'confirm'
          ? '/password-reset?token=synthetic-reset-token'
          : '/password-reset',
        session,
      );
      const copy = authMessages.passwordReset[mode];
      const field = await screen.findByLabelText(
        mode === 'confirm'
          ? authMessages.passwordReset.confirm.fields.newPassword.label
          : authMessages.passwordReset.request.fields.email.label,
      );
      fireEvent.change(field, {
        target: {
          value: mode === 'confirm' ? 'NuevaPassword2026' : 'ana@example.com',
        },
      });
      fireEvent.click(
        screen.getByRole('button', { name: copy.actions.submit }),
      );
      await waitFor(() => expect(resetSignal).toBeDefined());
      unmount();
      expect(resetSignal?.aborted).toBe(true);
      expect(h.requests).toHaveLength(1);
      expect(h.storage.getItem(storageKey)).toBeNull();
    },
  );

  test('S3: shows the identical confirmation message for any submitted email and focuses the confirmation heading', async () => {
    const capturedEmails: string[] = [];
    mswServer.use(
      createPasswordResetRequestHandler({
        onRequest: (_request, body) => {
          capturedEmails.push(body.email);
        },
      }),
    );

    const { container } = renderPasswordResetRoute('/password-reset?next=%2F');
    const emailInput = (await screen.findByLabelText(
      authMessages.passwordReset.request.fields.email.label,
    )) as HTMLInputElement;

    await expectAccessible(container);
    expect(
      screen.getByRole('link', {
        name: authMessages.passwordReset.request.actions.backToLogin,
      }),
    ).toHaveAttribute('href', '/login?next=%2F');

    fireEvent.change(emailInput, { target: { value: '  Ana@Example.COM ' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.submit,
      }),
    );

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      authMessages.passwordReset.request.confirmation.title,
    );
    expect(status).toHaveTextContent(
      authMessages.passwordReset.request.confirmation.body,
    );
    const firstHeading = within(status).getByRole('heading', {
      level: 3,
      name: authMessages.passwordReset.request.confirmation.title,
    });
    await waitFor(() => expect(firstHeading).toHaveFocus());
    expect(
      screen.getByRole('link', {
        name: authMessages.passwordReset.request.actions.backToLogin,
      }),
    ).toHaveAttribute('href', '/login?next=%2F');

    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.sendAnother,
      }),
    );

    const secondEmailInput = await screen.findByLabelText(
      authMessages.passwordReset.request.fields.email.label,
    );
    fireEvent.change(secondEmailInput, {
      target: { value: 'unregistered@unknown.example' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.submit,
      }),
    );

    const secondStatus = await screen.findByRole('status');
    expect(secondStatus).toHaveTextContent(
      authMessages.passwordReset.request.confirmation.body,
    );
    expect(capturedEmails).toEqual([
      'ana@example.com',
      'unregistered@unknown.example',
    ]);
  });

  test('request mode strips hostile ?next=, validates email on client, and handles 429 and network errors while keeping email', async () => {
    let requestCalls = 0;
    mswServer.use(
      createPasswordResetRequestHandler({
        onRequest: () => {
          requestCalls += 1;
        },
        error: {
          status: 429,
          body: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests',
            correlationId: 'corr-reset-req-429',
          },
        },
      }),
    );

    renderPasswordResetRoute('/password-reset?next=https://evil.example/steal');
    const emailInput = (await screen.findByLabelText(
      authMessages.passwordReset.request.fields.email.label,
    )) as HTMLInputElement;

    expect(
      screen.getByRole('link', {
        name: authMessages.passwordReset.request.actions.backToLogin,
      }),
    ).toHaveAttribute('href', '/login');

    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.submit,
      }),
    );
    expect(
      await screen.findByText(
        authMessages.passwordReset.request.validation.emailRequired,
      ),
    ).toBeVisible();
    await waitFor(() => expect(emailInput).toHaveFocus());
    expect(requestCalls).toBe(0);

    fireEvent.change(emailInput, { target: { value: 'ana@example.com' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.submit,
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.passwordReset.request.errors.rateLimited,
      ),
    );
    expect(emailInput.value).toBe('ana@example.com');

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/request`, () =>
        HttpResponse.error(),
      ),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.request.actions.submit,
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.passwordReset.request.errors.network,
      ),
    );
    expect(emailInput.value).toBe('ana@example.com');
  });

  test('confirm mode completes password reset on 204, clears password, moves focus, and links to /login preserving safe ?next=', async () => {
    const capturedBodies: unknown[] = [];
    mswServer.use(
      createPasswordResetConfirmHandler({
        onRequest: (_request, body) => {
          capturedBodies.push(body);
        },
      }),
    );

    const { container, router } = renderPasswordResetRoute(
      '/password-reset?token=opaque-reset-token-123&next=%2F',
    );
    const passwordInput = (await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    )) as HTMLInputElement;

    await waitFor(() => expect(router.state.location.search).toBe('?next=%2F'));

    expect(
      screen.getByText(
        authMessages.passwordReset.confirm.fields.newPassword.description,
      ),
    ).toBeVisible();
    await expectAccessible(container);

    fireEvent.change(passwordInput, {
      target: { value: '  NuevaClaveSegura2026  ' },
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.confirm.actions.submit,
      }),
    );

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      authMessages.passwordReset.confirm.confirmed.title,
    );
    expect(status).toHaveTextContent(
      authMessages.passwordReset.confirm.confirmed.body,
    );
    const confirmedHeading = within(status).getByRole('heading', {
      level: 3,
      name: authMessages.passwordReset.confirm.confirmed.title,
    });
    await waitFor(() => expect(confirmedHeading).toHaveFocus());
    expect(capturedBodies).toEqual([
      {
        token: 'opaque-reset-token-123',
        newPassword: '  NuevaClaveSegura2026  ',
      },
    ]);
    expect(
      screen.getByRole('link', {
        name: authMessages.passwordReset.confirm.actions.goToLogin,
      }),
    ).toHaveAttribute('href', '/login?next=%2F');
  });

  test('confirm mode handles expired/used 400 token clearly, clears password, and allows returning to request mode', async () => {
    mswServer.use(
      createPasswordResetConfirmHandler({
        error: {
          status: 400,
          body: {
            code: 'BAD_REQUEST',
            message: 'Invalid or expired reset token',
            correlationId: 'corr-expired-token',
          },
        },
      }),
    );

    renderPasswordResetRoute('/password-reset?token=used-or-expired-token');
    const passwordInput = (await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    )) as HTMLInputElement;

    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura2026' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.confirm.actions.submit,
      }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      authMessages.passwordReset.confirm.errors.invalidOrExpiredToken,
    );
    expect(passwordInput.value).toBe('');

    const requestNewLink = screen.getByRole('link', {
      name: authMessages.passwordReset.confirm.actions.requestNewLink,
    });
    expect(requestNewLink).toHaveAttribute('href', '/password-reset');

    fireEvent.click(requestNewLink);
    expect(
      await screen.findByLabelText(
        authMessages.passwordReset.request.fields.email.label,
      ),
    ).toBeVisible();
  });

  test.each([
    '/password-reset?token=',
    '/password-reset?token=%20%20',
    '/password-reset?token=first&token=second',
  ])(
    'confirm mode rejects malformed query %s immediately without calling the API',
    async (malformedUrl) => {
      let apiCalls = 0;
      mswServer.use(
        createPasswordResetConfirmHandler({
          onRequest: () => {
            apiCalls += 1;
          },
        }),
      );

      const { router } = renderPasswordResetRoute(malformedUrl);

      const alert = await screen.findByRole('alert');
      await waitFor(() => expect(router.state.location.search).toBe(''));
      expect(alert).toHaveTextContent(
        authMessages.passwordReset.confirm.invalidToken.title,
      );
      expect(alert).toHaveTextContent(
        authMessages.passwordReset.confirm.invalidToken.body,
      );
      expect(
        screen.queryByLabelText(
          authMessages.passwordReset.confirm.fields.newPassword.label,
        ),
      ).not.toBeInTheDocument();
      const requestNewLink = screen.getByRole('link', {
        name: authMessages.passwordReset.confirm.actions.requestNewLink,
      });
      expect(requestNewLink).toHaveAttribute('href', '/password-reset');
      expect(apiCalls).toBe(0);

      fireEvent.click(requestNewLink);
      expect(
        await screen.findByLabelText(
          authMessages.passwordReset.request.fields.email.label,
        ),
      ).toBeVisible();
    },
  );

  test('confirm mode validates password length and separates 429, network, and 500 outcome-uncertain errors while clearing password', async () => {
    mswServer.use(
      createPasswordResetConfirmHandler({
        error: {
          status: 429,
          body: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many confirmation attempts',
            correlationId: 'corr-confirm-429',
          },
        },
      }),
    );

    renderPasswordResetRoute('/password-reset?token=valid-token-123');
    const passwordInput = (await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    )) as HTMLInputElement;
    const submitBtn = screen.getByRole('button', {
      name: authMessages.passwordReset.confirm.actions.submit,
    });

    fireEvent.change(passwordInput, { target: { value: 'corta' } });
    fireEvent.click(submitBtn);
    expect(
      await screen.findByText(
        authMessages.passwordReset.confirm.validation.passwordMin,
      ),
    ).toBeVisible();

    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura2026' } });
    fireEvent.click(submitBtn);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.passwordReset.confirm.errors.rateLimited,
      ),
    );
    expect(passwordInput.value).toBe('');

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/confirm`, () =>
        HttpResponse.error(),
      ),
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura2026' } });
    fireEvent.click(submitBtn);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.passwordReset.confirm.errors.network,
      ),
    );
    expect(passwordInput.value).toBe('');

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/confirm`, () =>
        createErrorEnvelopeResponse(500, {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected database error',
          correlationId: 'corr-confirm-500',
        }),
      ),
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura2026' } });
    fireEvent.click(submitBtn);
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.passwordReset.confirm.errors.unexpected,
      ),
    );
    expect(passwordInput.value).toBe('');
  });

  test('guards unsaved email and newPassword links and clears password dirty state on failed confirm submit', async () => {
    mswServer.use(
      createPasswordResetConfirmHandler({
        error: {
          status: 400,
          body: {
            code: 'BAD_REQUEST',
            message: 'Invalid or expired reset token',
            correlationId: 'corr-400-guard',
          },
        },
      }),
    );

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const requestView = renderPasswordResetRoute('/password-reset');
    const emailInput = (await screen.findByLabelText(
      authMessages.passwordReset.request.fields.email.label,
    )) as HTMLInputElement;
    const backToLoginLink = screen.getByRole('link', {
      name: authMessages.passwordReset.request.actions.backToLogin,
    });

    fireEvent.change(emailInput, { target: { value: 'ana@ejemplo.com' } });
    fireEvent.click(backToLoginLink);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(requestView.router.state.location.pathname).toBe('/password-reset');

    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.click(backToLoginLink);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(requestView.router.state.location.pathname).toBe('/login'),
    );
    requestView.unmount();

    const confirmView = renderPasswordResetRoute(
      '/password-reset?token=valid-token-guard',
    );
    const passwordInput = (await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    )) as HTMLInputElement;
    await waitFor(() =>
      expect(confirmView.router.state.location.search).toBe(''),
    );

    fireEvent.change(passwordInput, {
      target: { value: 'NuevaClaveSegura2026' },
    });
    const requestNewLink = screen.getByRole('link', {
      name: authMessages.passwordReset.confirm.actions.requestNewLink,
    });
    fireEvent.click(requestNewLink);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput.value).toBe('NuevaClaveSegura2026');

    fireEvent.click(
      screen.getByRole('button', {
        name: authMessages.passwordReset.confirm.actions.submit,
      }),
    );
    await screen.findByRole('alert');
    expect(passwordInput.value).toBe('');

    fireEvent.click(requestNewLink);
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByLabelText(
        authMessages.passwordReset.request.fields.email.label,
      ),
    ).toBeVisible();
  });

  test('returns to request mode on browser Back after URL token scrubbing without storing token in history state', async () => {
    const { router } = renderPasswordResetRoute('/password-reset');
    await screen.findByLabelText(
      authMessages.passwordReset.request.fields.email.label,
    );

    await router.navigate('/password-reset?token=valid-reset-token-123');
    await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(JSON.stringify(router.state.location.state ?? null)).not.toContain(
      'valid-reset-token-123',
    );

    await router.navigate(-1);
    expect(
      await screen.findByLabelText(
        authMessages.passwordReset.request.fields.email.label,
      ),
    ).toBeVisible();
  });
});
