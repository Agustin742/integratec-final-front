import { http, HttpResponse } from 'msw';
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
import { ApiError } from '@/api/errors';
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
  createPasswordResetConfirmHandler,
  createPasswordResetRequestHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { loginFormSchema } from './login-schema';
import { authMessages } from './messages';
import {
  passwordResetConfirmFormSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestFormSchema,
} from './password-reset-schema';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from './password-reset-service';

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
});

afterAll(() => {
  mswServer.close();
});

describe('loginFormSchema', () => {
  test('trims and lowercases email without trimming intentional spaces in password', () => {
    const parsed = loginFormSchema.parse({
      email: '  Docente@Ejemplo.EDU.AR ',
      password: '  claveConEspacios  ',
    });

    expect(parsed).toEqual({
      email: 'docente@ejemplo.edu.ar',
      password: '  claveConEspacios  ',
    });
  });

  test('requires non-empty password and rejects passwords exceeding 72 UTF-8 bytes', () => {
    const missingPassword = loginFormSchema.safeParse({
      email: 'docente@ejemplo.com',
      password: '',
    });
    expect(missingPassword.success).toBe(false);

    // Three-byte UTF-8 glyphs push byte length past 72 while char length is under 72.
    const multiByteOverflow = 'ñ'.repeat(37);
    const tooManyBytes = loginFormSchema.safeParse({
      email: 'docente@ejemplo.com',
      password: multiByteOverflow,
    });
    expect(tooManyBytes.success).toBe(false);
    if (!tooManyBytes.success) {
      expect(tooManyBytes.error.issues[0]).toMatchObject({
        path: ['password'],
        message: authMessages.login.validation.passwordMaxBytes,
      });
    }
  });
});

describe('passwordReset schemas', () => {
  test('normalizes email on reset request schema', () => {
    expect(
      passwordResetRequestFormSchema.parse({ email: '  Ana@Example.COM ' }),
    ).toEqual({ email: 'ana@example.com' });
  });

  test('enforces policy limits on reset confirmation without trimming newPassword', () => {
    expect(
      passwordResetConfirmFormSchema.parse({
        newPassword: '  NuevaClave99  ',
      }),
    ).toEqual({
      newPassword: '  NuevaClave99  ',
    });

    const tooShort = passwordResetConfirmFormSchema.safeParse({
      newPassword: '1234567',
    });
    expect(tooShort.success).toBe(false);

    const blankToken = passwordResetConfirmRequestSchema.safeParse({
      token: '   ',
      newPassword: 'ClaveValida123',
    });
    expect(blankToken.success).toBe(false);
  });
});

describe('password reset cancellation and programming errors', () => {
  test.each(['request', 'confirm'] as const)(
    '%s propagates AbortError identity and unknown programming errors',
    async (mode) => {
      const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
      const failure = new Error('Synthetic programming error');
      const cancellation = new DOMException(
        'Synthetic cancellation',
        'AbortError',
      );
      const post = vi.spyOn(client, 'POST');
      for (const error of [cancellation, failure]) {
        post.mockRejectedValueOnce(error);
        const pending =
          mode === 'request'
            ? requestPasswordReset(client, { email: 'ana@example.com' })
            : confirmPasswordReset(client, {
                token: 'synthetic-reset-token',
                newPassword: 'NuevaPassword2026',
              });
        await expect(pending).rejects.toBe(error);
      }
      expect(post).toHaveBeenCalledTimes(2);
    },
  );
});

describe('requestPasswordReset service', () => {
  test('sends credentials: omit and redirect: error and returns validated 202 response', async () => {
    let observedCredentials: RequestCredentials | undefined;
    let observedRedirect: RequestRedirect | undefined;
    const capturedBodies: unknown[] = [];

    mswServer.use(
      createPasswordResetRequestHandler({
        onRequest: (_request, body) => {
          capturedBodies.push(body);
        },
      }),
    );

    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      fetch: (input, init) => {
        if (input instanceof Request) {
          observedCredentials = input.credentials;
          observedRedirect = input.redirect;
        }
        return globalThis.fetch(input, init);
      },
    });
    const response = await requestPasswordReset(client, {
      email: 'ana@example.com',
    });

    expect(response.message).toBeTruthy();
    expect(capturedBodies).toEqual([{ email: 'ana@example.com' }]);
    expect(observedCredentials).toBe('omit');
    expect(observedRedirect).toBe('error');
  });

  test('maps 429 and network errors to distinct ApiError kinds with centralized Spanish copy', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/request`, () =>
        createErrorEnvelopeResponse(429, {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many reset requests',
          correlationId: 'corr-429-req',
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      requestPasswordReset(client, { email: 'ana@example.com' }),
    ).rejects.toMatchObject({
      kind: 'rate-limited',
      userMessage: authMessages.passwordReset.request.errors.rateLimited,
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/request`, () =>
        HttpResponse.error(),
      ),
    );

    await expect(
      requestPasswordReset(client, { email: 'ana@example.com' }),
    ).rejects.toMatchObject({
      kind: 'network',
      userMessage: authMessages.passwordReset.request.errors.network,
    });
  });

  test('rejects malformed 202 payloads instead of silently succeeding', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/request`, () =>
        HttpResponse.json({ ok: true }, { status: 202 }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      requestPasswordReset(client, { email: 'ana@example.com' }),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: authMessages.passwordReset.request.errors.unexpected,
    });
  });

  test('rethrows AbortError unchanged on cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      requestPasswordReset(
        client,
        { email: 'ana@example.com' },
        { signal: controller.signal },
      ),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof Error && err.name === 'AbortError',
    );
  });
});

describe('confirmPasswordReset service', () => {
  test('succeeds on strict 204 No Content and omits credentials / rejects redirects', async () => {
    let observedCredentials: RequestCredentials | undefined;
    let observedRedirect: RequestRedirect | undefined;
    const capturedBodies: unknown[] = [];

    mswServer.use(
      createPasswordResetConfirmHandler({
        onRequest: (_request, body) => {
          capturedBodies.push(body);
        },
      }),
    );

    const client = createApiClient({
      baseUrl: TEST_API_BASE_URL,
      fetch: (input, init) => {
        if (input instanceof Request) {
          observedCredentials = input.credentials;
          observedRedirect = input.redirect;
        }
        return globalThis.fetch(input, init);
      },
    });
    await expect(
      confirmPasswordReset(client, {
        token: 'reset-token-1',
        newPassword: 'NuevaPassword2026',
      }),
    ).resolves.toBeUndefined();

    expect(capturedBodies).toEqual([
      { token: 'reset-token-1', newPassword: 'NuevaPassword2026' },
    ]);
    expect(observedCredentials).toBe('omit');
    expect(observedRedirect).toBe('error');
  });

  test('rejects unexpected 200 status on confirm so proxy HTML cannot claim success', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/confirm`, () =>
        HttpResponse.json({ unexpected: true }, { status: 200 }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      confirmPasswordReset(client, {
        token: 'reset-token-1',
        newPassword: 'NuevaPassword2026',
      }),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: authMessages.passwordReset.confirm.errors.unexpected,
    });
  });

  test('maps 400 BAD_REQUEST invalid/expired token without field errors', async () => {
    mswServer.use(
      createPasswordResetConfirmHandler({
        error: {
          status: 400,
          body: {
            code: 'BAD_REQUEST',
            message: 'Invalid or expired password reset token',
            correlationId: 'corr-bad-token',
          },
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      confirmPasswordReset(client, {
        token: 'expired-token',
        newPassword: 'NuevaPassword2026',
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof ApiError &&
        err.kind === 'bad-request' &&
        err.status === 400 &&
        Object.keys(err.fieldErrors).length === 0 &&
        err.userMessage ===
          authMessages.passwordReset.confirm.errors.invalidOrExpiredToken,
    );
  });

  test('preserves newPassword field validation errors on 400 VALIDATION_FAILED', async () => {
    mswServer.use(
      createPasswordResetConfirmHandler({
        error: {
          status: 400,
          body: {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            correlationId: 'corr-val-confirm',
            details: [
              {
                field: 'newPassword',
                messages: ['Password does not meet complexity policy'],
              },
            ],
          },
        },
      }),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      confirmPasswordReset(client, {
        token: 'reset-token-1',
        newPassword: 'weak',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      userMessage: authMessages.passwordReset.confirm.errors.validationFailed,
      fieldErrors: {
        newPassword: ['Password does not meet complexity policy'],
      },
    });
  });

  test('maps 429 and network failures to distinct outcome-aware messages', async () => {
    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/confirm`, () =>
        createErrorEnvelopeResponse(429, {
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
          correlationId: 'corr-429-confirm',
        }),
      ),
    );
    await expect(
      confirmPasswordReset(client, {
        token: 'reset-token-1',
        newPassword: 'NuevaPassword2026',
      }),
    ).rejects.toMatchObject({
      kind: 'rate-limited',
      userMessage: authMessages.passwordReset.confirm.errors.rateLimited,
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/password-reset/confirm`, () =>
        HttpResponse.error(),
      ),
    );
    await expect(
      confirmPasswordReset(client, {
        token: 'reset-token-1',
        newPassword: 'NuevaPassword2026',
      }),
    ).rejects.toMatchObject({
      kind: 'network',
      userMessage: authMessages.passwordReset.confirm.errors.network,
    });
  });
});
