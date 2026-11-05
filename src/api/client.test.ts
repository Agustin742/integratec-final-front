import { HttpResponse, http } from 'msw';
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
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
} from '../test/msw/handlers';
import { mswServer } from '../test/msw/server';
import { createApiClient, requestApi, requestApiVoid } from './client';
import { ApiError, mapApiError } from './errors';
import {
  IDEMPOTENCY_HEADER,
  createIdempotencyKey,
  withIdempotencyKey,
} from './idempotency';
import { apiErrorMessages } from './messages';

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

describe('createApiClient and requestApi', () => {
  test('calls a typed endpoint and returns the contract-typed payload', async () => {
    const client = createApiClient();
    const health = await requestApi(() => client.GET('/health'));

    expect(health).toEqual({
      status: 'ok',
      service: 'api',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  test('enforces generated OpenAPI path and method types at compile time', () => {
    const client = createApiClient();

    if (false as boolean) {
      // @ts-expect-error Unknown endpoint path must not compile against generated paths
      void client.GET('/unknown-endpoint');
      // @ts-expect-error Unsupported HTTP method on /health must not compile
      void client.POST('/health');
    }

    expect(client).toBeDefined();
  });

  test('maps 400 VALIDATION_FAILED with dotted field paths into a validation ApiError', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/health`, () =>
        createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          correlationId: 'corr-validation-1',
          details: [
            {
              field: 'school.name',
              messages: ['name must not be empty'],
            },
            {
              field: 'address.city',
              messages: [
                'city must be longer than or equal to 3 characters',
                'city must contain only letters',
              ],
            },
          ],
        }),
      ),
    );

    const client = createApiClient();
    expect.assertions(7);

    try {
      await requestApi(() => client.GET('/health'));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.kind).toBe('validation');
      expect(apiError.status).toBe(400);
      expect(apiError.code).toBe('VALIDATION_FAILED');
      expect(apiError.userMessage).toBe(apiErrorMessages.validation);
      expect(apiError.correlationId).toBe('corr-validation-1');
      expect(apiError.fieldErrors).toEqual({
        'school.name': ['name must not be empty'],
        'address.city': [
          'city must be longer than or equal to 3 characters',
          'city must contain only letters',
        ],
      });
    }
  });

  test.each([
    [
      400,
      'BAD_REQUEST' as const,
      'bad-request' as const,
      apiErrorMessages.badRequest,
    ],
    [
      401,
      'UNAUTHENTICATED' as const,
      'unauthenticated' as const,
      apiErrorMessages.unauthenticated,
    ],
    [
      403,
      'FORBIDDEN' as const,
      'forbidden' as const,
      apiErrorMessages.forbidden,
    ],
    [
      404,
      'NOT_FOUND' as const,
      'not-found' as const,
      apiErrorMessages.notFound,
    ],
    [409, 'CONFLICT' as const, 'conflict' as const, apiErrorMessages.conflict],
    [
      429,
      'TOO_MANY_REQUESTS' as const,
      'rate-limited' as const,
      apiErrorMessages.rateLimited,
    ],
    [
      500,
      'INTERNAL_ERROR' as const,
      'unexpected' as const,
      apiErrorMessages.unexpected,
    ],
    [
      503,
      'SERVICE_UNAVAILABLE' as const,
      'unexpected' as const,
      apiErrorMessages.unexpected,
    ],
  ])(
    'maps HTTP %i (%s) to kind %s with safe UI message',
    async (status, code, expectedKind, expectedMessage) => {
      mswServer.use(
        http.get(`${TEST_API_BASE_URL}/health`, () =>
          createErrorEnvelopeResponse(status, {
            code,
            message: 'Internal backend diagnostic that must not leak',
            correlationId: `corr-${status}`,
          }),
        ),
      );

      const client = createApiClient();
      expect.assertions(6);

      try {
        await requestApi(() => client.GET('/health'));
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.kind).toBe(expectedKind);
        expect(apiError.status).toBe(status);
        expect(apiError.code).toBe(code);
        expect(apiError.userMessage).toBe(expectedMessage);
        expect(apiError.userMessage).not.toContain(
          'Internal backend diagnostic',
        );
      }
    },
  );

  test('maps network failures to kind="network" and never treats them as unauthenticated or invalid credentials', async () => {
    mswServer.use(
      http.get(`${TEST_API_BASE_URL}/health`, () => HttpResponse.error()),
    );

    const client = createApiClient();
    expect.assertions(6);

    try {
      await requestApi(() => client.GET('/health'));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.kind).toBe('network');
      expect(apiError.kind).not.toBe('unauthenticated');
      expect(apiError.status).toBeNull();
      expect(apiError.code).toBeNull();
      expect(apiError.userMessage).toBe(apiErrorMessages.network);
    }
  });

  test('throws an unexpected ApiError when requestApi receives a 2xx response with undefined data', async () => {
    await expect(
      requestApi(async () => ({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 204 }),
      })),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'unexpected',
      status: 204,
      userMessage: apiErrorMessages.unexpected,
    });
  });

  test('requestApiVoid resolves cleanly on bodiless 204 responses and throws ApiError on failures', async () => {
    await expect(
      requestApiVoid(async () => ({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 204 }),
      })),
    ).resolves.toBeUndefined();

    await expect(
      requestApiVoid(async () => ({
        data: undefined,
        error: {
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden',
            correlationId: 'corr-void-403',
          },
        },
        response: new Response(null, { status: 403 }),
      })),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'forbidden',
      status: 403,
    });
  });

  test('falls back to HTTP status and x-request-id header when error body is not an ErrorEnvelope', () => {
    const response = new Response(null, {
      status: 404,
      headers: { 'x-request-id': 'header-corr-404' },
    });
    const mapped = mapApiError('plain text error', response);

    expect(mapped.kind).toBe('not-found');
    expect(mapped.status).toBe(404);
    expect(mapped.code).toBeNull();
    expect(mapped.userMessage).toBe(apiErrorMessages.notFound);
    expect(mapped.correlationId).toBe('header-corr-404');
  });
});

describe('idempotency helpers', () => {
  test('generates a UUID v4 key and attaches Idempotency-Key header while preserving existing headers', () => {
    const key = createIdempotencyKey();
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const headers = withIdempotencyKey({ 'X-Custom': 'value' }, key);
    expect(headers).toEqual({
      'X-Custom': 'value',
      [IDEMPOTENCY_HEADER]: key,
    });
  });

  test('rejects blank idempotency keys', () => {
    expect(() => withIdempotencyKey({}, '   ')).toThrowError(
      'Idempotency-Key must be a non-empty string.',
    );
  });
});
