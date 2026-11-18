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

export type AvatarPayload = components['schemas']['AvatarDto'];
export type UpdateProfileRequestPayload =
  components['schemas']['UpdateProfileDto'];
export type ErrorDetailPayload = components['schemas']['ErrorDetail'];

const AVATAR_KEYS = [
  'bodyId',
  'hairId',
  'topId',
  'hairColor',
  'clothingColor',
] as const satisfies readonly (keyof AvatarPayload)[];

/** Option sets and combination rules published in the `AvatarDto` contract. */
const AVATAR_CONTRACT = {
  bodyId: ['male', 'female'],
  hairId: ['afro', 'dreads', 'original'],
  topId: ['hoodie', 'tank', 'tshirt'],
  hairColor: ['#6C4D48', '#AF6D63', '#E5AD58', '#353849', '#C77DAA'],
  clothingColor: [
    '#5B4F96',
    '#75B7DA',
    '#F2C85C',
    '#EFA5AE',
    '#7EBA8B',
    '#F4E6D2',
  ],
  hairByBody: { male: ['afro', 'dreads'], female: ['afro', 'original'] },
  topByBody: {
    male: ['hoodie', 'tank'],
    female: ['hoodie', 'tank', 'tshirt'],
  },
} as const;

export const DEFAULT_OWN_AVATAR: AvatarPayload = {
  bodyId: 'male',
  hairId: 'afro',
  topId: 'hoodie',
  hairColor: '#6C4D48',
  clothingColor: '#5B4F96',
};

function validationEnvelope(details: ErrorDetailPayload[]): Response {
  return createErrorEnvelopeResponse(400, {
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    details,
    correlationId: 'corr-validation-profile',
  });
}

/** Mirrors the `UpdateProfileDto.displayName` rules from the contract. */
function validateDisplayName(
  body: Record<string, unknown>,
): { readonly value: string } | { readonly details: ErrorDetailPayload[] } {
  const unknown = Object.keys(body).filter((key) => key !== 'displayName');
  if (unknown.length > 0) {
    return {
      details: unknown.map((field) => ({
        field,
        messages: ['property should not exist'],
      })),
    };
  }
  const raw = body.displayName;
  if (typeof raw !== 'string' || /[\p{Cc}\u2028\u2029]/u.test(raw)) {
    return {
      details: [
        { field: 'displayName', messages: ['displayName is not valid'] },
      ],
    };
  }
  const value = raw.trim();
  if (
    value.length < 1 ||
    value.length > 100 ||
    !/[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{M}\u2800]/u.test(
      value,
    )
  ) {
    return {
      details: [
        { field: 'displayName', messages: ['displayName is not valid'] },
      ],
    };
  }
  return { value };
}

/** Mirrors the `AvatarDto` rules: five required fields, palette, combinations. */
function validateAvatar(
  body: Record<string, unknown>,
):
  | { readonly value: AvatarPayload }
  | { readonly details: ErrorDetailPayload[] } {
  const details: ErrorDetailPayload[] = [];
  for (const key of Object.keys(body)) {
    if (!(AVATAR_KEYS as readonly string[]).includes(key)) {
      details.push({ field: key, messages: ['property should not exist'] });
    }
  }
  const read = (key: (typeof AVATAR_KEYS)[number]): string | undefined => {
    const value = body[key];
    if (typeof value !== 'string') {
      details.push({ field: key, messages: [`${key} is required`] });
      return undefined;
    }
    // Colors are case-insensitive and returned uppercase.
    const normalized = key.endsWith('Color') ? value.toUpperCase() : value;
    if (!(AVATAR_CONTRACT[key] as readonly string[]).includes(normalized)) {
      details.push({ field: key, messages: [`${key} is not allowed`] });
      return undefined;
    }
    return normalized;
  };
  const bodyId = read('bodyId') as AvatarPayload['bodyId'] | undefined;
  const hairId = read('hairId') as AvatarPayload['hairId'] | undefined;
  const topId = read('topId') as AvatarPayload['topId'] | undefined;
  const hairColor = read('hairColor') as AvatarPayload['hairColor'] | undefined;
  const clothingColor = read('clothingColor') as
    AvatarPayload['clothingColor'] | undefined;
  if (
    bodyId &&
    hairId &&
    !AVATAR_CONTRACT.hairByBody[bodyId].some((v) => v === hairId)
  ) {
    details.push({ field: 'hairId', messages: ['hairId is incompatible'] });
  }
  if (
    bodyId &&
    topId &&
    !AVATAR_CONTRACT.topByBody[bodyId].some((v) => v === topId)
  ) {
    details.push({ field: 'topId', messages: ['topId is incompatible'] });
  }
  if (
    details.length > 0 ||
    !bodyId ||
    !hairId ||
    !topId ||
    !hairColor ||
    !clothingColor
  ) {
    return { details };
  }
  return { value: { bodyId, hairId, topId, hairColor, clothingColor } };
}

export type OwnProfileFailure =
  | MswErrorResponseSpec
  | 'network'
  /** The write is stored but the response never arrives (uncertain outcome). */
  | 'drop-response';

export interface OwnProfileStoreOptions {
  readonly baseUrl?: string;
  readonly initial?: Partial<OwnProfilePayload>;
  readonly onProfileRequest?: (body: unknown) => void | Promise<void>;
  readonly onAvatarRequest?: (body: unknown) => void | Promise<void>;
}

export interface OwnProfileStore {
  /** `GET /users/me`, `PATCH /users/me/profile` and `PATCH /users/me/avatar`. */
  readonly handlers: readonly HttpHandler[];
  /** The server-side saved state: what a reload or another device would read. */
  read(): OwnProfilePayload;
  /** Makes the next write of that kind fail the given way. */
  failNext(target: 'profile' | 'avatar', failure: OwnProfileFailure): void;
  /** Makes the next `GET /users/me` fail with the given error. */
  failNextRead(failure: MswErrorResponseSpec | 'network'): void;
}

/**
 * Stateful, contract-faithful MSW handlers for the profile endpoints
 * (`UsersController_getMe`, `UsersController_updateProfile`,
 * `UsersController_updateAvatar`). Writes are validated with the contract rules
 * and persist in the store, so a reload re-reads what was saved; rejected
 * writes leave the saved state untouched. Works before the backend lands.
 */
export function createOwnProfileStore(
  options: OwnProfileStoreOptions = {},
): OwnProfileStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  let saved: OwnProfilePayload = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ana@example.com',
    displayName: 'Ana López',
    avatar: { ...DEFAULT_OWN_AVATAR },
    ...options.initial,
  };
  const pending: Partial<Record<'profile' | 'avatar', OwnProfileFailure>> = {};
  let pendingRead: MswErrorResponseSpec | 'network' | undefined;

  const fail = (failure: MswErrorResponseSpec | 'network'): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    read: () => saved,
    failNext(target, failure) {
      pending[target] = failure;
    },
    failNextRead(failure) {
      pendingRead = failure;
    },
    handlers: [
      http.get(`${baseUrl}/users/me`, () => {
        if (pendingRead !== undefined) {
          const failure = pendingRead;
          pendingRead = undefined;
          return fail(failure);
        }
        return HttpResponse.json(saved);
      }),
      http.patch(`${baseUrl}/users/me/profile`, async ({ request }) => {
        const body = (await request.clone().json()) as Record<string, unknown>;
        await options.onProfileRequest?.(body);
        const failure = pending.profile;
        pending.profile = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }
        const result = validateDisplayName(body);
        if ('details' in result) return validationEnvelope(result.details);
        saved = { ...saved, displayName: result.value };
        return failure === 'drop-response'
          ? HttpResponse.error()
          : HttpResponse.json(saved);
      }),
      http.patch(`${baseUrl}/users/me/avatar`, async ({ request }) => {
        const body = (await request.clone().json()) as Record<string, unknown>;
        await options.onAvatarRequest?.(body);
        const failure = pending.avatar;
        pending.avatar = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }
        const result = validateAvatar(body);
        if ('details' in result) return validationEnvelope(result.details);
        saved = { ...saved, avatar: result.value };
        return failure === 'drop-response'
          ? HttpResponse.error()
          : HttpResponse.json(saved.avatar);
      }),
    ],
  };
}

export const defaultHandlers: readonly HttpHandler[] = [createHealthHandler()];
