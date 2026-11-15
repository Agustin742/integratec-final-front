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
import { createAppRoutes } from '@/app/router/routes';
import { createSession } from '@/session/controller';
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
});

afterAll(() => {
  mswServer.close();
});

function renderPasswordResetRoute(initialPath = '/password-reset') {
  const session = createSession({ baseUrl: TEST_API_BASE_URL });
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [initialPath],
  });

  const view = render(
    <SessionProvider service={session}>
      <RouterProvider router={router} />
    </SessionProvider>,
  );

  return { router, session, ...view };
}

describe('PasswordResetPage (/password-reset)', () => {
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

    const { container } = renderPasswordResetRoute(
      '/password-reset?token=opaque-reset-token-123&next=%2F',
    );
    const passwordInput = (await screen.findByLabelText(
      authMessages.passwordReset.confirm.fields.newPassword.label,
    )) as HTMLInputElement;

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

      renderPasswordResetRoute(malformedUrl);

      const alert = await screen.findByRole('alert');
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
      expect(
        screen.getByRole('link', {
          name: authMessages.passwordReset.confirm.actions.requestNewLink,
        }),
      ).toHaveAttribute('href', '/password-reset');
      expect(apiCalls).toBe(0);
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
});
