import { HttpResponse, http, type HttpHandler } from 'msw';
import type { components } from '../../api/schema.generated';

export type HealthStatusPayload = components['schemas']['HealthStatus'];
export type ErrorBodyPayload = components['schemas']['ErrorBody'];
export type ErrorEnvelopePayload = components['schemas']['ErrorEnvelope'];

export type ClassroomDetailPayload =
  components['schemas']['ClassroomDetailResponseDto'];
export type ClassroomContextPayload =
  components['schemas']['ClassroomContextResponseDto'];
export type AcceptInvitationPayload =
  components['schemas']['AcceptInvitationDto'];
export type JoinClassroomWithCodePayload =
  components['schemas']['JoinClassroomWithCodeDto'];
export type JoinClassroomResponsePayload =
  components['schemas']['JoinClassroomResponseDto'];
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

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}` returning
 * `ClassroomContextResponseDto` with `availablePanels` for workspace loading.
 */
export function createClassroomContextHandler(
  id = 'classroom-demo-1',
  overrides: Partial<ClassroomContextPayload> = {},
  baseUrl: string = TEST_API_BASE_URL,
): HttpHandler {
  const payload: ClassroomContextPayload = {
    id,
    name: '3° Año B - Matemática',
    subject: 'Matemática y Geometría',
    schoolId: null,
    independentTeacherId: null,
    adultMode: false,
    chatMuted: false,
    collaborationLocked: false,
    gamesDisabled: false,
    myRole: 'STUDENT',
    capabilities: [
      'participate_activities',
      'chat_classmates',
      'list_directory',
    ],
    availablePanels: [
      'activities',
      'material',
      'grades',
      'chat',
      'notices',
      'shop',
      'bot',
      'members',
    ],
    deskCount: 12,
    pet: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
  return http.get(`${baseUrl}/classrooms/${id}`, () =>
    HttpResponse.json(payload, { status: 200 }),
  );
}

/**
 * MSW SSE stream handler for `GET /classrooms/{id}/context-events` that keeps
 * the stream open until the request signal aborts.
 */
export function createClassroomContextEventsHandler(
  id = '*',
  baseUrl: string = TEST_API_BASE_URL,
): HttpHandler {
  return http.get(
    `${baseUrl}/classrooms/${id}/context-events`,
    ({ request }) => {
      const stream = new ReadableStream({
        start(controller) {
          request.signal.addEventListener(
            'abort',
            () => {
              try {
                controller.close();
              } catch {
                // Stream already closed.
              }
            },
            { once: true },
          );
        },
      });
      return new HttpResponse(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream',
        },
      });
    },
  );
}

function readBearerAuthorization(request: Request): string | null {
  const header = request.headers.get('authorization')?.trim();
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  const token = header.slice(7).trim();
  return token === '' ? null : header;
}

export interface CreateAcceptInvitationHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<JoinClassroomResponsePayload>;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (
    request: Request,
    body: AcceptInvitationPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /invitations/accept`
 * (`InvitationsController_accept`), enforcing single-use consumption across
 * different accounts and idempotent re-acceptance for the same caller.
 */
export function createAcceptInvitationHandler(
  options: CreateAcceptInvitationHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const redeemedByAuth = new Map<string, string>();

  return http.post(`${baseUrl}/invitations/accept`, async ({ request }) => {
    const body = (await request
      .clone()
      .json()) as Partial<AcceptInvitationPayload>;
    await options.onRequest?.(request, body as AcceptInvitationPayload);

    const auth = readBearerAuthorization(request);
    if (!auth) {
      return createErrorEnvelopeResponse(401, {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        correlationId: 'msw-accept-401',
      });
    }

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token) {
      return createErrorEnvelopeResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'Invitation token is required',
        correlationId: 'msw-accept-validation',
        details: [{ field: 'token', messages: ['Token is required'] }],
      });
    }

    if (
      token === 'inv-expired-token' ||
      token === 'inv-revoked-token' ||
      token === 'inv-used-token'
    ) {
      return createErrorEnvelopeResponse(400, {
        code: 'BAD_REQUEST',
        message: 'Invitation is no longer valid',
        correlationId: 'msw-accept-400',
      });
    }

    if (token === 'inv-unknown-token') {
      return createErrorEnvelopeResponse(404, {
        code: 'NOT_FOUND',
        message: 'Invitation not found',
        correlationId: 'msw-accept-404',
      });
    }

    if (token === 'inv-conflict-token') {
      return createErrorEnvelopeResponse(409, {
        code: 'CONFLICT',
        message: 'Cannot accept invitation for this account',
        correlationId: 'msw-accept-409',
      });
    }

    if (token === 'inv-rate-limited-token') {
      return createErrorEnvelopeResponse(429, {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests',
        correlationId: 'msw-accept-429',
      });
    }

    if (token === 'inv-already-member-token') {
      const payload: JoinClassroomResponsePayload = {
        classroomId: 'classroom-demo-1',
        membershipId: 'membership-student-1',
        role: 'STUDENT',
        desk: { id: 'desk-1', deskIndex: 1 },
        alreadyMember: true,
        ...options.response,
      };
      return HttpResponse.json(payload, { status: options.status ?? 200 });
    }

    const existingOwner = redeemedByAuth.get(token);
    if (existingOwner && existingOwner !== auth) {
      return createErrorEnvelopeResponse(400, {
        code: 'BAD_REQUEST',
        message: 'Invitation has already been consumed',
        correlationId: 'msw-accept-consumed',
      });
    }

    const alreadyMember = existingOwner === auth;
    redeemedByAuth.set(token, auth);

    const payload: JoinClassroomResponsePayload = {
      classroomId: 'classroom-demo-1',
      membershipId: 'membership-student-1',
      role: 'STUDENT',
      desk: { id: 'desk-4', deskIndex: 4 },
      alreadyMember,
      ...options.response,
    };
    return HttpResponse.json(payload, { status: options.status ?? 200 });
  });
}

export interface CreateJoinClassroomByCodeHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<JoinClassroomResponsePayload>;
  readonly error?: MswErrorResponseSpec;
  readonly onRequest?: (
    request: Request,
    body: JoinClassroomWithCodePayload,
  ) => void | Promise<void>;
}

const normalizeCrockfordCode = (value: string): string =>
  value.trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');

/**
 * Contract-faithful MSW handler for `POST /classrooms/join`
 * (`ClassroomsController_joinClassroom`), normalizing join codes and supporting
 * idempotent re-join (`alreadyMember: true`) plus error classes (`400`, `401`, `404`, `409`, `429`).
 */
export function createJoinClassroomByCodeHandler(
  options: CreateJoinClassroomByCodeHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const enrolledByAuth = new Set<string>();

  return http.post(`${baseUrl}/classrooms/join`, async ({ request }) => {
    const body = (await request
      .clone()
      .json()) as Partial<JoinClassroomWithCodePayload>;
    await options.onRequest?.(request, body as JoinClassroomWithCodePayload);

    const auth = readBearerAuthorization(request);
    if (!auth) {
      return createErrorEnvelopeResponse(401, {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
        correlationId: 'msw-join-401',
      });
    }

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    const upper =
      typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!upper || !/^[A-Z0-9]{4,32}$/.test(upper)) {
      return createErrorEnvelopeResponse(400, {
        code: 'VALIDATION_FAILED',
        message: 'Invalid join code format',
        correlationId: 'msw-join-validation',
        details: [{ field: 'code', messages: ['Invalid code'] }],
      });
    }

    if (upper === 'EXPIRED1' || upper === 'REVOKED1') {
      return createErrorEnvelopeResponse(400, {
        code: 'BAD_REQUEST',
        message: 'Join code expired or revoked',
        correlationId: 'msw-join-400',
      });
    }

    if (upper === 'UNKNOWN1' || upper === 'NOEXIST1') {
      return createErrorEnvelopeResponse(404, {
        code: 'NOT_FOUND',
        message: 'Join code not found',
        correlationId: 'msw-join-404',
      });
    }

    if (upper === 'FULLCODE' || upper === 'EXHAUST1' || upper === 'STAFF409') {
      return createErrorEnvelopeResponse(409, {
        code: 'CONFLICT',
        message: 'Join code limit reached',
        correlationId: 'msw-join-409',
      });
    }

    if (upper === 'RATELIM1') {
      return createErrorEnvelopeResponse(429, {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many invalid attempts',
        correlationId: 'msw-join-429',
      });
    }

    if (upper === 'ALREADY1') {
      const payload: JoinClassroomResponsePayload = {
        classroomId: 'classroom-demo-1',
        membershipId: 'membership-student-1',
        role: 'STUDENT',
        desk: { id: 'desk-1', deskIndex: 1 },
        alreadyMember: true,
        ...options.response,
      };
      return HttpResponse.json(payload, { status: options.status ?? 201 });
    }

    const crockfordKey = `${auth}:${normalizeCrockfordCode(upper)}`;
    const alreadyMember = enrolledByAuth.has(crockfordKey);
    enrolledByAuth.add(crockfordKey);

    const payload: JoinClassroomResponsePayload = {
      classroomId: 'classroom-demo-1',
      membershipId: 'membership-student-1',
      role: 'STUDENT',
      desk: { id: 'desk-4', deskIndex: 4 },
      alreadyMember,
      ...options.response,
    };
    return HttpResponse.json(payload, { status: options.status ?? 201 });
  });
}

export const defaultHandlers: readonly HttpHandler[] = [createHealthHandler()];
