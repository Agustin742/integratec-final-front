import { QueryClient } from '@tanstack/react-query';
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
  test,
  vi,
} from 'vitest';
import { messages } from '@/app/messages';
import { createAppRoutes } from '@/app/router/routes';
import { forbidden } from '@/app/router/route-errors';
import { createSession } from '@/session/controller';
import { SessionProvider } from '@/session/provider';
import { storageKey } from '@/session/test-fixtures';
import { expectAccessible } from '@/test/accessibility';
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
  createLoginHandler,
  createOwnProfileHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { render } from '@/test/render';
import '@/app/pages/login-page';
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
});

afterAll(() => {
  mswServer.close();
});

function renderLoginRoute(
  initialPath = '/login',
  options?: {
    protectedRoutes?: Parameters<typeof createAppRoutes>[0];
    tabOwner?: string;
  },
) {
  const session = createSession({
    baseUrl: TEST_API_BASE_URL,
    ...(options?.tabOwner ? { tabOwner: () => options.tabOwner } : {}),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(createAppRoutes(options?.protectedRoutes), {
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

async function waitForLoginForm() {
  return screen.findByLabelText(authMessages.login.fields.email.label);
}

describe('LoginPage (/login)', () => {
  test('S1: signs in with valid credentials, verifies /users/me, lands on protected home, and passes accessibility checks', async () => {
    const capturedLogins: unknown[] = [];

    mswServer.use(
      createLoginHandler({
        onRequest: (_request, body) => {
          capturedLogins.push(body);
        },
        response: {
          accessToken: 'login-access-1',
          refreshToken: 'login-refresh-1',
        },
      }),
      createOwnProfileHandler({
        response: {
          displayName: 'Sofía Martínez',
          email: 'sofia@ejemplo.com',
        },
      }),
    );

    const { container, router } = renderLoginRoute('/login');
    const emailInput = await waitForLoginForm();
    const passwordInput = screen.getByLabelText(
      authMessages.login.fields.password.label,
    );

    await expectAccessible(container);

    fireEvent.change(emailInput, { target: { value: '  Sofia@Ejemplo.COM ' } });
    fireEvent.change(passwordInput, {
      target: { value: '  ClaveSegura123  ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: messages.pages.home.title,
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
    expect(capturedLogins).toEqual([
      {
        email: 'sofia@ejemplo.com',
        // Password must preserve intentional leading/trailing whitespace.
        password: '  ClaveSegura123  ',
      },
    ]);
    expect(window.sessionStorage.getItem(storageKey)).toContain(
      'login-access-1',
    );
  });

  test('renders contextual notice and preserves approved ?next= across sibling auth links, while stripping unsafe targets', async () => {
    mswServer.use(createLoginHandler(), createOwnProfileHandler());

    const safeView = renderLoginRoute('/login?next=%2F');
    await waitForLoginForm();

    expect(
      screen.getByText(authMessages.login.returnContextNotice),
    ).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: authMessages.login.actions.forgotPasswordLink,
      }),
    ).toHaveAttribute('href', '/password-reset?next=%2F');
    expect(
      screen.getByRole('link', {
        name: authMessages.login.actions.registerLink,
      }),
    ).toHaveAttribute('href', '/register?next=%2F');
    safeView.unmount();

    const unsafeView = renderLoginRoute(
      '/login?next=https://evil.example/phish',
    );
    await waitForLoginForm();

    expect(
      screen.queryByText(authMessages.login.returnContextNotice),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: authMessages.login.actions.forgotPasswordLink,
      }),
    ).toHaveAttribute('href', '/password-reset');
    expect(
      screen.getByRole('link', {
        name: authMessages.login.actions.registerLink,
      }),
    ).toHaveAttribute('href', '/register');

    fireEvent.change(
      screen.getByLabelText(authMessages.login.fields.email.label),
      { target: { value: 'ana@ejemplo.com' } },
    );
    fireEvent.change(
      screen.getByLabelText(authMessages.login.fields.password.label),
      { target: { value: 'ClaveSegura123' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );

    await screen.findByRole('heading', {
      level: 2,
      name: messages.pages.home.title,
    });
    expect(unsafeView.router.state.location.pathname).toBe('/');
    expect(unsafeView.router.state.location.search).toBe('');
  });

  test('S2: displays a generic alert without field hints on 401 and clears the password while keeping email', async () => {
    mswServer.use(
      createLoginHandler({
        error: {
          status: 401,
          body: {
            code: 'UNAUTHENTICATED',
            message: 'Invalid email or password',
            correlationId: 'corr-401-login',
          },
        },
      }),
    );

    renderLoginRoute('/login');
    const emailInput = (await waitForLoginForm()) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(
      authMessages.login.fields.password.label,
    ) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'ana@ejemplo.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveIncorrecta' } });
    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      authMessages.login.errors.invalidCredentials,
    );
    expect(emailInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(emailInput.value).toBe('ana@ejemplo.com');
    expect(passwordInput.value).toBe('');
  });

  test('distinguishes 429 rate limit, network failure, and 500 unexpected errors from 401 and clears password', async () => {
    mswServer.use(
      createLoginHandler({
        error: {
          status: 429,
          body: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts',
            correlationId: 'corr-429-login',
          },
        },
      }),
    );

    renderLoginRoute('/login');
    const emailInput = (await waitForLoginForm()) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(
      authMessages.login.fields.password.label,
    ) as HTMLInputElement;
    const submit = () =>
      fireEvent.click(
        screen.getByRole('button', { name: authMessages.login.actions.submit }),
      );

    fireEvent.change(emailInput, { target: { value: 'ana@ejemplo.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    submit();

    const rateAlert = await screen.findByRole('alert');
    expect(rateAlert).toHaveTextContent(authMessages.login.errors.rateLimited);
    expect(rateAlert).not.toHaveTextContent(
      authMessages.login.errors.invalidCredentials,
    );
    expect(passwordInput.value).toBe('');

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/login`, () => HttpResponse.error()),
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    submit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.login.errors.network,
      );
    });
    expect(passwordInput.value).toBe('');

    mswServer.use(
      createLoginHandler({
        error: {
          status: 500,
          body: {
            code: 'INTERNAL_ERROR',
            message: 'Internal error',
            correlationId: 'corr-500-login',
          },
        },
      }),
    );
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    submit();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        authMessages.login.errors.unexpected,
      );
    });
    expect(passwordInput.value).toBe('');
  });

  test('validates required fields on client before sending requests and focuses the first invalid control', async () => {
    let requests = 0;
    mswServer.use(
      createLoginHandler({
        onRequest: () => {
          requests += 1;
        },
      }),
    );

    renderLoginRoute('/login');
    const emailInput = await waitForLoginForm();

    fireEvent.click(
      screen.getByRole('button', { name: authMessages.login.actions.submit }),
    );

    expect(
      await screen.findByText(authMessages.login.validation.emailRequired),
    ).toBeVisible();
    expect(
      screen.getByText(authMessages.login.validation.passwordRequired),
    ).toBeVisible();
    await waitFor(() => expect(emailInput).toHaveFocus());
    expect(requests).toBe(0);
  });

  test('prevents duplicate concurrent submissions on rapid double click', async () => {
    let resolveLogin!: () => void;
    let requestCount = 0;

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/login`, async () => {
        requestCount += 1;
        await new Promise<void>((resolve) => {
          resolveLogin = resolve;
        });
        return createErrorEnvelopeResponse(401, {
          code: 'UNAUTHENTICATED',
          message: 'Bad credentials',
          correlationId: 'corr-double-click',
        });
      }),
    );

    renderLoginRoute('/login');
    const emailInput = await waitForLoginForm();
    const passwordInput = screen.getByLabelText(
      authMessages.login.fields.password.label,
    );
    const submitBtn = screen.getByRole('button', {
      name: authMessages.login.actions.submit,
    });

    fireEvent.change(emailInput, { target: { value: 'ana@ejemplo.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ClaveSegura123' } });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => expect(requestCount).toBe(1));
    expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    expect(
      within(submitBtn).getByText(authMessages.login.actions.submitting),
    ).toBeVisible();

    resolveLogin();
    await screen.findByRole('alert');
    expect(requestCount).toBe(1);
  });

  test('returns to /login?next=%2F after expired session and renders 403 without redirecting back to login', async () => {
    mswServer.use(createOwnProfileHandler());

    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        accessToken: 'expired-access',
        refreshToken: 'valid-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner: 'test-tab-403',
      }),
    );

    const { router } = renderLoginRoute('/solo-docente', {
      tabOwner: 'test-tab-403',
      protectedRoutes: {
        protectedRoutes: [
          {
            path: 'solo-docente',
            loader: () => {
              throw forbidden();
            },
            Component: () => <p>Contenido restringido</p>,
          },
        ],
      },
    });

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: messages.pages.forbidden.title,
      }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/solo-docente');

    let refreshCalls = 0;
    mswServer.use(
      createOwnProfileHandler({
        error: {
          status: 401,
          body: {
            code: 'UNAUTHENTICATED',
            message: 'Token expired',
            correlationId: 'corr-expired-session',
          },
        },
      }),
      http.post(`${TEST_API_BASE_URL}/auth/refresh`, () => {
        refreshCalls += 1;
        return createErrorEnvelopeResponse(401, {
          code: 'UNAUTHENTICATED',
          message: 'Refresh expired',
          correlationId: 'corr-expired-refresh',
        });
      }),
    );

    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({
        accessToken: 'expired-access',
        refreshToken: 'expired-refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        expiresAt: Date.now() + 900_000,
        tabOwner: 'test-tab-expired',
      }),
    );
    const expiredSession = createSession({
      baseUrl: TEST_API_BASE_URL,
      tabOwner: () => 'test-tab-expired',
    });
    const expiredRouter = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/'],
    });

    render(
      <SessionProvider service={expiredSession}>
        <RouterProvider router={expiredRouter} />
      </SessionProvider>,
    );

    await waitForLoginForm();
    expect(refreshCalls).toBe(1);
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
    expect(expiredRouter.state.location.pathname).toBe('/login');
    expect(expiredRouter.state.location.search).toBe('?next=%2F');
    expect(
      screen.getByText(authMessages.login.returnContextNotice),
    ).toBeVisible();
  });
});
