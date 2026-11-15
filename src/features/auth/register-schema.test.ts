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
import { apiErrorMessages } from '@/api/messages';
import {
  TEST_API_BASE_URL,
  createErrorEnvelopeResponse,
  createRegisterHandler,
} from '@/test/msw/handlers';
import { mswServer } from '@/test/msw/server';
import { authMessages } from './messages';
import {
  registerFormSchema,
  registerResponseSchema,
  toRegisterRequestDto,
} from './register-schema';
import { registerAccount } from './register-service';

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

describe('registerFormSchema & toRegisterRequestDto', () => {
  test('accepts valid INDEPENDENT_TEACHER input, trims displayName/email, lowercases email, and omits schoolName', () => {
    const parsed = registerFormSchema.parse({
      path: 'INDEPENDENT_TEACHER',
      displayName: '  Sofía Martínez  ',
      email: '  Sofia.Martinez@Example.COM ',
      password: '  claveSegura99  ',
      schoolName: 'Nombre residual ignorado',
    });

    const dto = toRegisterRequestDto(parsed);

    expect(dto).toEqual({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Sofía Martínez',
      email: 'sofia.martinez@example.com',
      // Passwords are never trimmed so spaces chosen by the user stay intact.
      password: '  claveSegura99  ',
    });
    expect('schoolName' in dto).toBe(false);
  });

  test('accepts valid SCHOOL input and trims schoolName into RegisterRequestDto', () => {
    const parsed = registerFormSchema.parse({
      path: 'SCHOOL',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: '  Escuela Técnica N.º 4  ',
    });

    expect(toRegisterRequestDto(parsed)).toEqual({
      path: 'SCHOOL',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: 'Escuela Técnica N.º 4',
    });
  });

  test('requires non-empty trimmed schoolName when path is SCHOOL', () => {
    const result = registerFormSchema.safeParse({
      path: 'SCHOOL',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: '   ',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['schoolName'],
        message: authMessages.validation.schoolNameRequired,
      });
    }
  });

  test('rejects schoolName exceeding 150 characters when path is SCHOOL', () => {
    const result = registerFormSchema.safeParse({
      path: 'SCHOOL',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: 'A'.repeat(151),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ['schoolName'],
        message: authMessages.validation.schoolNameTooLong,
      });
    }
  });

  test('rejects INVITATION path as a form submission target', () => {
    const result = registerFormSchema.safeParse({
      path: 'INVITATION',
      displayName: 'Carlos Gómez',
      email: 'carlos@escuela.edu.ar',
      password: 'ClaveSegura123',
      schoolName: '',
    });

    expect(result.success).toBe(false);
  });

  test('validates displayName required and max 100 chars boundaries', () => {
    const empty = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: '   ',
      email: 'docente@example.com',
      password: 'ClaveSegura123',
      schoolName: '',
    });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]).toMatchObject({
        path: ['displayName'],
        message: authMessages.validation.displayNameRequired,
      });
    }

    const tooLong = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'N'.repeat(101),
      email: 'docente@example.com',
      password: 'ClaveSegura123',
      schoolName: '',
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]).toMatchObject({
        path: ['displayName'],
        message: authMessages.validation.displayNameTooLong,
      });
    }
  });

  test('validates email required, format, and max 255 chars boundaries', () => {
    const empty = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: ' ',
      password: 'ClaveSegura123',
      schoolName: '',
    });
    expect(empty.success).toBe(false);
    if (!empty.success) {
      expect(empty.error.issues[0]).toMatchObject({
        path: ['email'],
        message: authMessages.validation.emailRequired,
      });
    }

    const invalid = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: 'not-an-email',
      password: 'ClaveSegura123',
      schoolName: '',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0]).toMatchObject({
        path: ['email'],
        message: authMessages.validation.emailInvalid,
      });
    }

    const tooLong = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: `${'a'.repeat(245)}@example.com`,
      password: 'ClaveSegura123',
      schoolName: '',
    });
    expect(tooLong.success).toBe(false);
    if (!tooLong.success) {
      expect(tooLong.error.issues[0]).toMatchObject({
        path: ['email'],
        message: authMessages.validation.emailTooLong,
      });
    }
  });

  test('enforces password min 8, max 72 chars, and max 72 UTF-8 bytes without trimming', () => {
    const tooShort = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: 'ana@example.com',
      password: '1234567',
      schoolName: '',
    });
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      expect(tooShort.error.issues[0]).toMatchObject({
        path: ['password'],
        message: authMessages.validation.passwordMin,
      });
    }

    const exactBytes = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: 'ana@example.com',
      // 36 two-byte chars = 72 UTF-8 bytes.
      password: 'é'.repeat(36),
      schoolName: '',
    });
    expect(exactBytes.success).toBe(true);

    const tooManyBytes = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: 'ana@example.com',
      // 37 two-byte chars = 37 code units (<72 chars) but 74 UTF-8 bytes (>72 bytes).
      password: 'é'.repeat(37),
      schoolName: '',
    });
    expect(tooManyBytes.success).toBe(false);
    if (!tooManyBytes.success) {
      expect(tooManyBytes.error.issues[0]).toMatchObject({
        path: ['password'],
        message: authMessages.validation.passwordMaxBytes,
      });
    }

    const tooManyChars = registerFormSchema.safeParse({
      path: 'INDEPENDENT_TEACHER',
      displayName: 'Ana',
      email: 'ana@example.com',
      password: 'a'.repeat(73),
      schoolName: '',
    });
    expect(tooManyChars.success).toBe(false);
    if (!tooManyChars.success) {
      expect(tooManyChars.error.issues[0]).toMatchObject({
        path: ['password'],
        message: authMessages.validation.passwordMax,
      });
    }
  });
});

describe('registerResponseSchema', () => {
  test('accepts confirmed INDEPENDENT_TEACHER and SCHOOL responses', () => {
    const independent = registerResponseSchema.safeParse({
      id: 'user-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      path: 'INDEPENDENT_TEACHER',
      createdAt: '2026-11-14T12:00:00.000Z',
    });
    expect(independent.success).toBe(true);

    const school = registerResponseSchema.safeParse({
      id: 'user-2',
      email: 'dir@escuela.edu.ar',
      displayName: 'Dirección',
      path: 'SCHOOL',
      school: {
        id: 'school-1',
        name: 'Escuela Técnica N.º 4',
        slug: 'escuela-tecnica-n-4',
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      createdAt: '2026-11-14T12:00:00.000Z',
    });
    expect(school.success).toBe(true);
  });

  test('rejects SCHOOL confirmation payload that omits school summary', () => {
    const malformed = registerResponseSchema.safeParse({
      id: 'user-2',
      email: 'dir@escuela.edu.ar',
      displayName: 'Dirección',
      path: 'SCHOOL',
      createdAt: '2026-11-14T12:00:00.000Z',
    });

    expect(malformed.success).toBe(false);
  });
});

describe('registerAccount & createRegisterHandler', () => {
  test('posts RegisterRequestDto with credentials omit and redirect error and returns validated 201 payload', async () => {
    let observedCredentials: RequestCredentials | undefined;
    let observedRedirect: RequestRedirect | undefined;
    let observedBody: unknown;

    mswServer.use(
      createRegisterHandler({
        onRequest: (_request, body) => {
          observedBody = body;
        },
        response: {
          id: 'user-99',
          email: 'ana@example.com',
          displayName: 'Ana García',
          path: 'SCHOOL',
          school: {
            id: 'school-99',
            name: 'Colegio Sur',
            slug: 'colegio-sur',
            timeZone: 'America/Argentina/Buenos_Aires',
          },
          createdAt: '2026-11-14T12:05:00.000Z',
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
    const response = await registerAccount(client, {
      path: 'SCHOOL',
      displayName: 'Ana García',
      email: 'ana@example.com',
      password: 'ClaveSegura123',
      schoolName: 'Colegio Sur',
    });

    expect(observedCredentials).toBe('omit');
    expect(observedRedirect).toBe('error');
    expect(observedBody).toEqual({
      path: 'SCHOOL',
      displayName: 'Ana García',
      email: 'ana@example.com',
      password: 'ClaveSegura123',
      schoolName: 'Colegio Sur',
    });
    expect(response.school?.name).toBe('Colegio Sur');
  });

  test('maps 409 email conflict to email field error without implying duplicate creation', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(409, {
          code: 'CONFLICT',
          message: 'A user with this email address already exists',
          correlationId: 'corr-409-email',
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      registerAccount(client, {
        path: 'INDEPENDENT_TEACHER',
        displayName: 'Ana García',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      userMessage: authMessages.errors.emailConflict,
      fieldErrors: {
        email: [authMessages.errors.emailConflict],
      },
    });
  });

  test('maps 409 slug collision to root conflict message', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(409, {
          code: 'CONFLICT',
          message:
            'Unable to reserve school slug due to concurrent registration. Please retry.',
          correlationId: 'corr-409-slug',
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      registerAccount(client, {
        path: 'SCHOOL',
        displayName: 'Ana García',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
        schoolName: 'Colegio Sur',
      }),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      userMessage: authMessages.errors.slugConflict,
      fieldErrors: {},
    });
  });

  test('preserves 400 VALIDATION_FAILED fieldErrors and maps unexpected/malformed responses safely', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          correlationId: 'corr-400',
          details: [
            {
              field: 'email',
              messages: ['El correo ya fue rechazado por el servidor.'],
            },
          ],
        }),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      registerAccount(client, {
        path: 'INDEPENDENT_TEACHER',
        displayName: 'Ana',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      }),
    ).rejects.toMatchObject({
      kind: 'validation',
      status: 400,
      userMessage: authMessages.errors.validationFailed,
      fieldErrors: {
        email: ['El correo ya fue rechazado por el servidor.'],
      },
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        HttpResponse.json(
          {
            id: 'user-1',
            email: 'ana@example.com',
            displayName: 'Ana',
            path: 'SCHOOL',
            createdAt: '2026-11-14T12:00:00.000Z',
          },
          { status: 201 },
        ),
      ),
    );

    await expect(
      registerAccount(client, {
        path: 'SCHOOL',
        displayName: 'Ana',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
        schoolName: 'Colegio Sur',
      }),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      userMessage: authMessages.errors.invalidResponse,
    });

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(500, {
          code: 'INTERNAL_ERROR',
          message: 'Database connection reset',
          correlationId: 'corr-500-unit',
        }),
      ),
    );

    await expect(
      registerAccount(client, {
        path: 'INDEPENDENT_TEACHER',
        displayName: 'Ana',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      }),
    ).rejects.toMatchObject({
      kind: 'unexpected',
      status: 500,
      userMessage: authMessages.errors.unexpected,
    });
    expect(authMessages.errors.unexpected).not.toMatch(
      /No se guardó ninguna estructura/i,
    );

    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        createErrorEnvelopeResponse(400, {
          code: 'BAD_REQUEST',
          message: 'Malformed payload',
          correlationId: 'corr-400-bad',
        }),
      ),
    );

    await expect(
      registerAccount(client, {
        path: 'INDEPENDENT_TEACHER',
        displayName: 'Ana',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      }),
    ).rejects.toMatchObject({
      kind: 'bad-request',
      status: 400,
      userMessage: apiErrorMessages.badRequest,
    });
  });

  test('propagates AbortError and maps network failures cleanly', async () => {
    mswServer.use(
      http.post(`${TEST_API_BASE_URL}/auth/register`, () =>
        HttpResponse.error(),
      ),
    );

    const client = createApiClient({ baseUrl: TEST_API_BASE_URL });
    await expect(
      registerAccount(client, {
        path: 'INDEPENDENT_TEACHER',
        displayName: 'Ana',
        email: 'ana@example.com',
        password: 'ClaveSegura123',
      }),
    ).rejects.toMatchObject({
      kind: 'network',
      status: null,
      userMessage: authMessages.errors.networkUncertain,
    });
    expect(authMessages.errors.networkUncertain).not.toBe(
      apiErrorMessages.network,
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      registerAccount(
        client,
        {
          path: 'INDEPENDENT_TEACHER',
          displayName: 'Ana',
          email: 'ana@example.com',
          password: 'ClaveSegura123',
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
