import { HttpResponse, http, type HttpHandler } from 'msw';
import type { components } from '../../api/schema.generated';

export type HealthStatusPayload = components['schemas']['HealthStatus'];
export type ErrorBodyPayload = components['schemas']['ErrorBody'];
export type ErrorEnvelopePayload = components['schemas']['ErrorEnvelope'];

export type ClassroomDetailPayload =
  components['schemas']['ClassroomDetailResponseDto'];
export type RegisterRequestPayload =
  components['schemas']['RegisterRequestDto'];
export type RegisterResponsePayload =
  components['schemas']['RegisterResponseDto'];
export type LoginRequestPayload = components['schemas']['LoginRequestDto'];
export type TokenPairResponsePayload =
  components['schemas']['TokenPairResponseDto'];
export type OwnProfilePayload = components['schemas']['OwnProfileDto'];
export type PasswordResetRequestPayload =
  components['schemas']['PasswordResetRequestDto'];
export type PasswordResetRequestedResponsePayload =
  components['schemas']['PasswordResetRequestedResponseDto'];
export type PasswordResetConfirmRequestPayload =
  components['schemas']['PasswordResetConfirmRequestDto'];

export interface MswErrorResponseSpec {
  readonly status: number;
  readonly body: ErrorBodyPayload;
}

export const TEST_API_BASE_URL = 'https://api.example.invalid';

/**
 * Builds a contract-faithful `ErrorEnvelope` JSON response (`src/api/schema.generated.ts`)
 * for MSW handlers and tests.
 */
export function createErrorEnvelopeResponse(
  status: number,
  error: ErrorBodyPayload,
): Response {
  const body: ErrorEnvelopePayload = { error };
  return HttpResponse.json(body, {
    status,
    headers: {
      'x-request-id': error.correlationId,
    },
  });
}

/**
 * Contract-faithful MSW handler for `GET /health` (`HealthController_getHealth`).
 */
export function createHealthHandler(
  baseUrl: string = TEST_API_BASE_URL,
  overrides: Partial<HealthStatusPayload> = {},
): HttpHandler {
  const payload: HealthStatusPayload = {
    status: 'ok',
    service: 'api',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return http.get(`${baseUrl}/health`, () => HttpResponse.json(payload));
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}`
 * (`ClassroomsController_findOne`): the caller's `myRole` and `capabilities`.
 */
export function createClassroomDetailHandler(
  id: string,
  overrides: Partial<ClassroomDetailPayload> = {},
  baseUrl: string = TEST_API_BASE_URL,
): HttpHandler {
  const payload: ClassroomDetailPayload = {
    id,
    name: 'Synthetic classroom',
    subject: null,
    schoolId: null,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: [],
    deskCount: 0,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return http.get(`${baseUrl}/classrooms/${id}`, () =>
    HttpResponse.json(payload),
  );
}

export interface CreateRegisterHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<RegisterResponsePayload>;
  readonly onRequest?: (
    request: Request,
    body: RegisterRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /auth/register`
 * (`AuthController_register`), echoing the chosen path and returning a
 * school summary when `path === 'SCHOOL'`.
 */
export function createRegisterHandler(
  options: CreateRegisterHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(`${baseUrl}/auth/register`, async ({ request }) => {
    const body = (await request
      .clone()
      .json()) as Partial<RegisterRequestPayload>;
    await options.onRequest?.(request, body as RegisterRequestPayload);

    const path = body.path === 'SCHOOL' ? 'SCHOOL' : 'INDEPENDENT_TEACHER';
    const defaultSchool =
      path === 'SCHOOL'
        ? {
            id: 'school-test-1',
            name: body.schoolName?.trim() || 'Escuela Demo',
            slug: 'escuela-demo',
            timeZone: 'America/Argentina/Buenos_Aires',
          }
        : undefined;

    const payload: RegisterResponsePayload = {
      id: 'user-test-1',
      email: (body.email ?? 'docente@example.com').trim().toLowerCase(),
      displayName: body.displayName?.trim() || 'Docente Demo',
      path,
      ...(defaultSchool ? { school: defaultSchool } : {}),
      createdAt: '2026-11-14T12:00:00.000Z',
      ...options.response,
    };

    return HttpResponse.json(payload, { status: options.status ?? 201 });
  });
}

export interface CreateLoginHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<TokenPairResponsePayload>;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (
    request: Request,
    body: LoginRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /auth/login` (`AuthController_login`).
 */
export function createLoginHandler(
  options: CreateLoginHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(`${baseUrl}/auth/login`, async ({ request }) => {
    const body = (await request.clone().json()) as Partial<LoginRequestPayload>;
    await options.onRequest?.(request, body as LoginRequestPayload);

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    const payload: TokenPairResponsePayload = {
      accessToken: 'msw-access-token',
      refreshToken: 'msw-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      ...options.response,
    };

    return HttpResponse.json(payload, { status: options.status ?? 200 });
  });
}

export interface CreateLogoutHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /auth/logout` (`AuthController_logout`).
 */
export function createLogoutHandler(
  options: CreateLogoutHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(`${baseUrl}/auth/logout`, async ({ request }) => {
    await options.onRequest?.(request);

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    return new HttpResponse(null, { status: options.status ?? 204 });
  });
}

export interface CreateOwnProfileHandlerOptions {
  readonly baseUrl?: string;
  readonly response?: Partial<OwnProfilePayload>;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `GET /users/me` (`UsersController_getMe`).
 */
export function createOwnProfileHandler(
  options: CreateOwnProfileHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.get(`${baseUrl}/users/me`, async ({ request }) => {
    await options.onRequest?.(request);

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    const payload: OwnProfilePayload = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ana@example.com',
      displayName: 'Ana López',
      avatar: {
        bodyId: 'female',
        hairId: 'original',
        topId: 'tshirt',
        hairColor: '#6C4D48',
        clothingColor: '#5B4F96',
      },
      ...options.response,
    };

    return HttpResponse.json(payload, { status: 200 });
  });
}

export interface CreatePasswordResetRequestHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<PasswordResetRequestedResponsePayload>;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (
    request: Request,
    body: PasswordResetRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /auth/password-reset/request`
 * (`AuthController_requestPasswordReset`), always returning the constant 202 body.
 */
export function createPasswordResetRequestHandler(
  options: CreatePasswordResetRequestHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(
    `${baseUrl}/auth/password-reset/request`,
    async ({ request }) => {
      const body = (await request
        .clone()
        .json()) as Partial<PasswordResetRequestPayload>;
      await options.onRequest?.(request, body as PasswordResetRequestPayload);

      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      const payload: PasswordResetRequestedResponsePayload = {
        message:
          'If the email belongs to an account, a reset link has been sent.',
        ...options.response,
      };

      return HttpResponse.json(payload, { status: options.status ?? 202 });
    },
  );
}

export interface CreatePasswordResetConfirmHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (
    request: Request,
    body: PasswordResetConfirmRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /auth/password-reset/confirm`
 * (`AuthController_confirmPasswordReset`).
 */
export function createPasswordResetConfirmHandler(
  options: CreatePasswordResetConfirmHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(
    `${baseUrl}/auth/password-reset/confirm`,
    async ({ request }) => {
      const body = (await request
        .clone()
        .json()) as Partial<PasswordResetConfirmRequestPayload>;
      await options.onRequest?.(
        request,
        body as PasswordResetConfirmRequestPayload,
      );

      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      return new HttpResponse(null, { status: options.status ?? 204 });
    },
  );
}

export const defaultHandlers: readonly HttpHandler[] = [createHealthHandler()];
