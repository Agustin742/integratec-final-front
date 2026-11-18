import { HttpResponse, http, type HttpHandler } from 'msw';
import type { components, operations } from '../../api/schema.generated';

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
export type ClassroomListItemPayload =
  components['schemas']['ClassroomListItemDto'];
export type RosterGuardianPayload = components['schemas']['RosterGuardianDto'];
export type RosterStudentPayload = components['schemas']['RosterStudentDto'];
export type PaginatedClassroomRosterPayload =
  operations['ClassroomRosterController_list']['responses'][200]['content']['application/json'];
export type PaginatedClassroomListPayload =
  operations['MeClassroomsController_listMyClassrooms']['responses'][200]['content']['application/json'];
export type CreateClassroomRequestPayload =
  components['schemas']['CreateClassroomDto'];
export type UpdateClassroomRequestPayload = Omit<
  components['schemas']['UpdateClassroomDto'],
  'subject'
> & {
  readonly subject?: string | null;
};
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

export interface CreateClassroomListHandlerOptions {
  readonly baseUrl?: string;
  readonly path?: '/me/classrooms' | '/classrooms';
  readonly items?: readonly ClassroomListItemPayload[];
  readonly total?: number;
  readonly page?: number;
  readonly pageSize?: number;
  readonly error?: MswErrorResponseSpec;
  readonly resolveResponse?: (params: {
    readonly page: number;
    readonly pageSize: number;
    readonly sort: string | null;
    readonly request: Request;
  }) =>
    | PaginatedClassroomListPayload
    | Response
    | Promise<PaginatedClassroomListPayload | Response>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `GET /me/classrooms` and `GET /classrooms`
 * (`MeClassroomsController_listMyClassrooms` / `ClassroomsController_list`).
 */
export function createClassroomListHandler(
  options: CreateClassroomListHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const path = options.path ?? '/me/classrooms';
  return http.get(`${baseUrl}${path}`, async ({ request }) => {
    await options.onRequest?.(request);

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    const url = new URL(request.url);
    const parsedPage = Number(
      url.searchParams.get('page') ?? options.page ?? 1,
    );
    const parsedPageSize = Number(
      url.searchParams.get('pageSize') ?? options.pageSize ?? 20,
    );
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const pageSize =
      Number.isFinite(parsedPageSize) && parsedPageSize > 0
        ? parsedPageSize
        : 20;
    const sort = url.searchParams.get('sort');

    if (options.resolveResponse) {
      const resolved = await options.resolveResponse({
        page,
        pageSize,
        sort,
        request,
      });
      if (resolved instanceof Response) {
        return resolved;
      }
      return HttpResponse.json(resolved, { status: 200 });
    }

    const allItems = [...(options.items ?? [])];
    const start = (page - 1) * pageSize;
    const pagedItems = allItems.slice(start, start + pageSize);
    const payload: PaginatedClassroomListPayload = {
      items: pagedItems,
      page,
      pageSize,
      total: options.total ?? allItems.length,
    };

    return HttpResponse.json(payload, { status: 200 });
  });
}

export interface CreateCreateClassroomHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly response?: Partial<ClassroomDetailPayload>;
  readonly error?: MswErrorResponseSpec;
  readonly resolveResponse?: (
    body: CreateClassroomRequestPayload,
    request: Request,
  ) =>
    | ClassroomDetailPayload
    | Response
    | Promise<ClassroomDetailPayload | Response>;
  readonly onRequest?: (
    request: Request,
    body: CreateClassroomRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /classrooms`
 * (`ClassroomsController_create`).
 */
export function createCreateClassroomHandler(
  options: CreateCreateClassroomHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(`${baseUrl}/classrooms`, async ({ request }) => {
    const body = (await request
      .clone()
      .json()) as Partial<CreateClassroomRequestPayload>;
    await options.onRequest?.(request, body as CreateClassroomRequestPayload);

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    if (options.resolveResponse) {
      const resolved = await options.resolveResponse(
        body as CreateClassroomRequestPayload,
        request,
      );
      if (resolved instanceof Response) {
        return resolved;
      }
      return HttpResponse.json(resolved, { status: options.status ?? 201 });
    }

    const schoolId = body.schoolId ?? null;
    const independentTeacherId =
      schoolId === null ? '00000000-0000-4000-8000-000000000001' : null;
    const payload: ClassroomDetailPayload = {
      id: '4e5f6a7b-0000-4000-8000-000000000010',
      name: body.name ?? 'Aula nueva',
      subject: body.subject ?? null,
      schoolId,
      independentTeacherId,
      adultMode: body.adultMode ?? false,
      chatMuted: false,
      collaborationLocked: false,
      gamesDisabled: false,
      myRole: 'TEACHER',
      capabilities: [
        'configure_classroom',
        'invite_members',
        'publish_content',
        'moderate_chat',
        'configure_bot',
        'view_metrics',
        'chat_classmates',
        'list_directory',
        'message_teacher',
      ],
      deskCount: 12,
      pet: {
        id: '9a1b2c3d-0000-4000-8000-000000000001',
        name: 'Michi',
        species: 'cat',
        level: 1,
        experience: 0,
      },
      createdAt: '2026-11-17T21:00:00.000Z',
      updatedAt: '2026-11-17T21:00:00.000Z',
      ...options.response,
    };

    return HttpResponse.json(payload, { status: options.status ?? 201 });
  });
}

export interface CreateUpdateClassroomHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly status?: number;
  readonly response?: Partial<ClassroomDetailPayload>;
  readonly error?: MswErrorResponseSpec;
  readonly resolveResponse?: (
    classroomId: string,
    body: UpdateClassroomRequestPayload,
    request: Request,
  ) =>
    | ClassroomDetailPayload
    | Response
    | Promise<ClassroomDetailPayload | Response>;
  readonly onRequest?: (
    request: Request,
    classroomId: string,
    body: UpdateClassroomRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `PATCH /classrooms/{id}`
 * (`ClassroomsController_update`).
 */
export function createUpdateClassroomHandler(
  options: CreateUpdateClassroomHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const routePath = options.classroomId
    ? `${baseUrl}/classrooms/${options.classroomId}`
    : `${baseUrl}/classrooms/:id`;

  return http.patch(routePath, async ({ request, params }) => {
    const classroomId =
      options.classroomId ?? String(params.id ?? 'classroom-unknown');
    const body = (await request
      .clone()
      .json()) as Partial<UpdateClassroomRequestPayload>;
    await options.onRequest?.(
      request,
      classroomId,
      body as UpdateClassroomRequestPayload,
    );

    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }

    if (options.resolveResponse) {
      const resolved = await options.resolveResponse(
        classroomId,
        body as UpdateClassroomRequestPayload,
        request,
      );
      if (resolved instanceof Response) {
        return resolved;
      }
      return HttpResponse.json(resolved, { status: options.status ?? 200 });
    }

    const payload: ClassroomDetailPayload = {
      id: classroomId,
      name: body.name ?? 'Aula actualizada',
      subject: body.subject === undefined ? null : body.subject,
      schoolId: null,
      independentTeacherId: '00000000-0000-4000-8000-000000000001',
      adultMode: body.adultMode ?? false,
      chatMuted: body.chatMuted ?? false,
      collaborationLocked: body.collaborationLocked ?? false,
      gamesDisabled: body.gamesDisabled ?? false,
      myRole: 'TEACHER',
      capabilities: [
        'configure_classroom',
        'invite_members',
        'publish_content',
        'moderate_chat',
        'configure_bot',
        'view_metrics',
        'chat_classmates',
        'list_directory',
        'message_teacher',
      ],
      deskCount: 12,
      pet: {
        id: '9a1b2c3d-0000-4000-8000-000000000001',
        name: 'Michi',
        species: 'cat',
        level: 1,
        experience: 0,
      },
      createdAt: '2026-11-17T21:00:00.000Z',
      updatedAt: '2026-11-17T21:05:00.000Z',
      ...options.response,
    };

    return HttpResponse.json(payload, { status: options.status ?? 200 });
  });
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

export interface ClassroomMaterialItem {
  readonly id: string;
  readonly classroomId: string;
  readonly authorId: string;
  readonly filename: string;
  readonly contentType: 'application/pdf' | 'image/png' | 'image/jpeg';
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export type MaterialStoreOp = 'list' | 'upload' | 'download' | 'remove';
export type MaterialStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface ClassroomMaterialsStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly authorId?: string;
  readonly initialItems?: readonly ClassroomMaterialItem[];
  readonly signedUrlBase?: string;
  readonly expiresInSeconds?: number;
}

export interface ClassroomMaterialsStore {
  readonly handlers: readonly HttpHandler[];
  read(): readonly ClassroomMaterialItem[];
  failNext(op: MaterialStoreOp, failure: MaterialStoreFailure): void;
}

const ALLOWED_MATERIAL_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);
const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;

/**
 * Stateful, contract-faithful MSW handlers for the study material endpoints
 * (`MaterialsController_list`, `MaterialsController_upload`,
 * `MaterialsController_download`, `MaterialsController_remove`).
 */
export function createClassroomMaterialsStore(
  options: ClassroomMaterialsStoreOptions = {},
): ClassroomMaterialsStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomId =
    options.classroomId ?? '00000000-0000-4000-8000-000000000010';
  const authorId = options.authorId ?? '00000000-0000-4000-8000-000000000001';
  const signedUrlBase =
    options.signedUrlBase ?? 'https://files.example.test/signed';
  const expiresInSeconds = options.expiresInSeconds ?? 120;
  let items: ClassroomMaterialItem[] = [...(options.initialItems ?? [])];
  let seq = items.length + 1;
  const pending: Partial<Record<MaterialStoreOp, MaterialStoreFailure>> = {};

  const fail = (failure: MswErrorResponseSpec | 'network'): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    read: () => [...items],
    failNext(op, failure) {
      pending[op] = failure;
    },
    handlers: [
      http.get(`${baseUrl}/classrooms/:id/materials`, ({ params, request }) => {
        const failure = pending.list;
        pending.list = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }
        if (options.classroomId && params.id !== classroomId) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Classroom not found.',
            correlationId: 'req-materials-list-404',
          });
        }
        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
        );
        const sort = url.searchParams.get('sort') ?? '-createdAt';
        const sorted = [...items].sort((a, b) =>
          sort === 'createdAt'
            ? a.createdAt.localeCompare(b.createdAt)
            : b.createdAt.localeCompare(a.createdAt),
        );
        const start = (page - 1) * pageSize;
        return HttpResponse.json({
          items: sorted.slice(start, start + pageSize),
          page,
          pageSize,
          total: sorted.length,
        });
      }),
      http.post(
        `${baseUrl}/classrooms/:id/materials`,
        async ({ params, request }) => {
          const failure = pending.upload;
          pending.upload = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }
          if (options.classroomId && params.id !== classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-materials-upload-404',
            });
          }
          const formData = await request.formData();
          const entry = formData.get('file');
          if (
            typeof entry !== 'object' ||
            entry === null ||
            !('size' in entry) ||
            !('type' in entry)
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Debe adjuntar un archivo válido.',
              correlationId: 'req-materials-upload-400-missing',
            });
          }
          const fileName =
            'name' in entry && typeof entry.name === 'string'
              ? entry.name
              : 'archivo';
          if (!ALLOWED_MATERIAL_TYPES.has(entry.type)) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Tipo de archivo no permitido por el servidor.',
              correlationId: 'req-materials-upload-400-type',
            });
          }
          if (entry.size <= 0) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'El archivo no puede estar vacío.',
              correlationId: 'req-materials-upload-400-empty',
            });
          }
          if (entry.size > MAX_MATERIAL_BYTES) {
            return createErrorEnvelopeResponse(413, {
              code: 'BAD_REQUEST',
              message: 'El archivo supera el límite de 10 MiB.',
              correlationId: 'req-materials-upload-413',
            });
          }
          const created: ClassroomMaterialItem = {
            id: `00000000-0000-4000-8000-${String(1000 + seq).padStart(12, '0')}`,
            classroomId: String(params.id ?? classroomId),
            authorId,
            filename: fileName,
            contentType: entry.type as ClassroomMaterialItem['contentType'],
            sizeBytes: entry.size,
            createdAt: new Date(
              Date.UTC(2026, 10, 18, 3, seq, 0),
            ).toISOString(),
          };
          seq += 1;
          items = [created, ...items];
          return failure === 'drop-response'
            ? HttpResponse.error()
            : HttpResponse.json(created, { status: 201 });
        },
      ),
      http.get(
        `${baseUrl}/classrooms/:id/materials/:materialId/download`,
        ({ params }) => {
          const failure = pending.download;
          pending.download = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }
          const found = items.find((item) => item.id === params.materialId);
          if (!found) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Material not found.',
              correlationId: 'req-materials-download-404',
            });
          }
          return HttpResponse.json({
            url: `${signedUrlBase}/${found.id}?sig=temp-${seq}`,
            expiresInSeconds,
          });
        },
      ),
      http.delete(
        `${baseUrl}/classrooms/:id/materials/:materialId`,
        ({ params }) => {
          const failure = pending.remove;
          pending.remove = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }
          const index = items.findIndex(
            (item) => item.id === params.materialId,
          );
          if (index === -1) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Material not found.',
              correlationId: 'req-materials-remove-404',
            });
          }
          items = items.filter((item) => item.id !== params.materialId);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    ],
  };
}

export interface CreateClassroomRosterHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly items?: readonly RosterStudentPayload[];
  readonly total?: number;
  readonly page?: number;
  readonly pageSize?: number;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (query: {
    readonly classroomId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly state: 'ACTIVE' | 'INACTIVE' | null;
    readonly q: string | null;
    readonly request: Request;
  }) =>
    | PaginatedClassroomRosterPayload
    | Response
    | Promise<PaginatedClassroomRosterPayload | Response>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

function filterAndOrderRoster(
  items: readonly RosterStudentPayload[],
  state: 'ACTIVE' | 'INACTIVE' | null,
  q: string | null,
): RosterStudentPayload[] {
  const normalizedPrefix = q ? q.trim().toLowerCase() : '';
  return [...items]
    .filter((item) => (state ? item.state === state : true))
    .filter((item) =>
      normalizedPrefix === ''
        ? true
        : item.displayName.toLowerCase().startsWith(normalizedPrefix),
    )
    .sort((a, b) => {
      const byName = a.displayName.localeCompare(b.displayName);
      return byName !== 0
        ? byName
        : a.membershipId.localeCompare(b.membershipId);
    });
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/roster`
 * (`ClassroomRosterController_list`).
 */
export function createClassroomRosterHandler(
  options: CreateClassroomRosterHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.get(
    `${baseUrl}/classrooms/${classroomSegment}/roster`,
    async ({ params, request }) => {
      await options.onRequest?.(request);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      const url = new URL(request.url);
      const parsedPage = Number(
        url.searchParams.get('page') ?? options.page ?? 1,
      );
      const parsedPageSize = Number(
        url.searchParams.get('pageSize') ?? options.pageSize ?? 20,
      );
      const page =
        Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize =
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : 20;
      const rawState = url.searchParams.get('state');
      const state =
        rawState === 'ACTIVE' || rawState === 'INACTIVE' ? rawState : null;
      const rawQuery = url.searchParams.get('q');
      const q = rawQuery !== null && rawQuery.length > 0 ? rawQuery : null;

      if (options.resolveResponse) {
        const resolvedClassroomId =
          options.classroomId ?? String(params.id ?? '');
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          page,
          pageSize,
          state,
          q,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 200 });
      }

      const filtered = filterAndOrderRoster(options.items ?? [], state, q);
      const start = (page - 1) * pageSize;
      const pagedItems = filtered.slice(start, start + pageSize);
      const payload: PaginatedClassroomRosterPayload = {
        items: pagedItems,
        page,
        pageSize,
        total: options.total ?? filtered.length,
      };
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface CreateRemoveClassroomStudentHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly studentId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly studentId: string;
    readonly request: Request;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (
    request: Request,
    studentId: string,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `DELETE /classrooms/{id}/students/{studentId}`
 * (`ClassroomRemovalController_remove`).
 */
export function createRemoveClassroomStudentHandler(
  options: CreateRemoveClassroomStudentHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const studentSegment = options.studentId ?? ':studentId';
  return http.delete(
    `${baseUrl}/classrooms/${classroomSegment}/students/${studentSegment}`,
    async ({ params, request }) => {
      const resolvedClassroomId =
        options.classroomId ?? String(params.id ?? '');
      const resolvedStudentId =
        options.studentId ?? String(params.studentId ?? '');
      await options.onRequest?.(request, resolvedStudentId);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          studentId: resolvedStudentId,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      return new HttpResponse(null, { status: 204 });
    },
  );
}

export type RosterFailureSpec =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface ClassroomRosterStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId: string;
  readonly initialStudents?: readonly RosterStudentPayload[];
  readonly removedAtTimestamp?: string;
  readonly onListRequest?: (request: Request) => void | Promise<void>;
  readonly onDeleteRequest?: (
    request: Request,
    studentUserId: string,
  ) => void | Promise<void>;
}

export interface ClassroomRosterStore {
  readonly read: () => readonly RosterStudentPayload[];
  readonly failNextList: (failure: MswErrorResponseSpec | 'network') => void;
  readonly failNextDelete: (failure: RosterFailureSpec) => void;
  readonly handlers: readonly HttpHandler[];
}

/**
 * Stateful MSW store for `GET /classrooms/{id}/roster` and idempotent
 * `DELETE /classrooms/{id}/students/{studentId}` (`userId`-addressed).
 */
export function createClassroomRosterStore(
  options: ClassroomRosterStoreOptions,
): ClassroomRosterStore {
  let students: RosterStudentPayload[] = (options.initialStudents ?? []).map(
    (student) => ({
      ...student,
      guardians: student.guardians.map((guardian) => ({ ...guardian })),
    }),
  );
  let nextListFailure: MswErrorResponseSpec | 'network' | undefined;
  let nextDeleteFailure: RosterFailureSpec | undefined;

  const toFailureResponse = (
    failure: MswErrorResponseSpec | 'network',
  ): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    read: () => students.map((student) => ({ ...student })),
    failNextList(failure) {
      nextListFailure = failure;
    },
    failNextDelete(failure) {
      nextDeleteFailure = failure;
    },
    handlers: [
      createClassroomRosterHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onListRequest,
        resolveResponse: ({ page, pageSize, state, q }) => {
          if (nextListFailure !== undefined) {
            const failure = nextListFailure;
            nextListFailure = undefined;
            return toFailureResponse(failure);
          }
          const filtered = filterAndOrderRoster(students, state, q);
          const start = (page - 1) * pageSize;
          return {
            items: filtered.slice(start, start + pageSize),
            page,
            pageSize,
            total: filtered.length,
          };
        },
      }),
      createRemoveClassroomStudentHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onDeleteRequest,
        resolveResponse: ({ studentId }) => {
          const failure = nextDeleteFailure;
          nextDeleteFailure = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return toFailureResponse(failure);
          }
          const targetIndex = students.findIndex(
            (student) => student.userId === studentId,
          );
          if (targetIndex === -1) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Student membership not found',
              correlationId: 'corr-roster-404',
            });
          }
          const target = students[targetIndex];
          students = students.map((student, index) =>
            index !== targetIndex
              ? student
              : {
                  ...student,
                  state: 'INACTIVE',
                  deletedAt:
                    student.deletedAt ??
                    options.removedAtTimestamp ??
                    '2026-11-18T15:00:00.000Z',
                  guardians: target.guardians.map((guardian) => ({
                    ...guardian,
                    state: 'INACTIVE',
                  })),
                },
          );
          return failure === 'drop-response'
            ? HttpResponse.error()
            : new HttpResponse(null, { status: 204 });
        },
      }),
    ],
  };
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

export type TeacherActivityPayload =
  components['schemas']['TeacherActivityResponseDto'];
export type StudentActivityPayload =
  components['schemas']['StudentActivityResponseDto'];
export type ActivitySummaryPayload = components['schemas']['ActivitySummaryDto'];
export type CreateActivityRequestPayload =
  components['schemas']['CreateActivityDto'];
export type UpdateActivityRequestPayload =
  components['schemas']['UpdateActivityDto'];
export type PaginatedClassroomActivitiesPayload =
  operations['ActivitiesController_list']['responses'][200]['content']['application/json'];

function orderActivitySummaries(
  items: readonly ActivitySummaryPayload[],
  sort: string | null,
): readonly ActivitySummaryPayload[] {
  const descending = sort !== null && sort.startsWith('-');
  const field = descending ? (sort as string).slice(1) : sort;
  const comparable = [...items].sort((a, b) => {
    if (field === 'createdAt') {
      const byCreatedAt = a.createdAt.localeCompare(b.createdAt);
      return byCreatedAt !== 0 ? byCreatedAt : a.id.localeCompare(b.id);
    }
    const byDueAt = a.dueAt.localeCompare(b.dueAt);
    return byDueAt !== 0 ? byDueAt : a.id.localeCompare(b.id);
  });
  return descending ? [...comparable].reverse() : comparable;
}

export interface CreateClassroomActivitiesListHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly items?: readonly ActivitySummaryPayload[];
  readonly page?: number;
  readonly pageSize?: number;
  readonly total?: number;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly sort: string | null;
    readonly state: 'DRAFT' | 'PUBLISHED' | null;
    readonly request: Request;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/activities`
 * (`ActivitiesController_list`): paginated summaries without questions.
 */
export function createClassroomActivitiesListHandler(
  options: CreateClassroomActivitiesListHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.get(
    `${baseUrl}/classrooms/${classroomSegment}/activities`,
    async ({ params, request }) => {
      await options.onRequest?.(request);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      const url = new URL(request.url);
      const parsedPage = Number(
        url.searchParams.get('page') ?? options.page ?? 1,
      );
      const parsedPageSize = Number(
        url.searchParams.get('pageSize') ?? options.pageSize ?? 20,
      );
      const page =
        Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const pageSize =
        Number.isFinite(parsedPageSize) && parsedPageSize > 0
          ? parsedPageSize
          : 20;
      const rawSort = url.searchParams.get('sort');
      const sort =
        rawSort === 'createdAt' ||
        rawSort === '-createdAt' ||
        rawSort === '-dueAt' ||
        rawSort === null
          ? rawSort
          : 'dueAt';
      const rawState = url.searchParams.get('state');
      const state =
        rawState === 'DRAFT' || rawState === 'PUBLISHED' ? rawState : null;

      if (options.resolveResponse) {
        const resolvedClassroomId =
          options.classroomId ?? String(params.id ?? '');
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          page,
          pageSize,
          sort,
          state,
          request,
        });
        if (resolved !== undefined) {
          return resolved instanceof Response
            ? resolved
            : HttpResponse.json(resolved, { status: 200 });
        }
      }

      const filtered = (options.items ?? []).filter(
        (item) => state === null || item.state === state,
      );
      const ordered = orderActivitySummaries(filtered, sort);
      const start = (page - 1) * pageSize;
      const payload: PaginatedClassroomActivitiesPayload = {
        items: ordered.slice(start, start + pageSize),
        page,
        pageSize,
        total: options.total ?? filtered.length,
      };
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface CreateActivityDetailHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly activityId?: string;
  /** Teacher view payload (includes `isCorrect` on every option). */
  readonly activity?: TeacherActivityPayload;
  /** Student view payload (never includes `isCorrect`). */
  readonly student?: StudentActivityPayload;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly activityId: string;
    readonly request: Request;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/activities/{activityId}`
 * (`ActivitiesController_get`): teacher view for staff, student view for
 * students, decided by whichever payload the test provides.
 */
export function createActivityDetailHandler(
  options: CreateActivityDetailHandlerOptions,
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const activitySegment = options.activityId ?? ':activityId';
  return http.get(
    `${baseUrl}/classrooms/${classroomSegment}/activities/${activitySegment}`,
    async ({ params, request }) => {
      await options.onRequest?.(request);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: options.classroomId ?? String(params.id ?? ''),
          activityId: options.activityId ?? String(params.activityId ?? ''),
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      const payload =
        options.student !== undefined ? options.student : options.activity;
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface CreateCreateActivityHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly activity?: TeacherActivityPayload;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly request: Request;
    readonly body: CreateActivityRequestPayload;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (
    request: Request,
    body: CreateActivityRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /classrooms/{id}/activities`
 * (`ActivitiesController_create`): echoes the created draft activity.
 */
export function createCreateActivityHandler(
  options: CreateCreateActivityHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.post(
    `${baseUrl}/classrooms/${classroomSegment}/activities`,
    async ({ params, request }) => {
      const body = (await request.json()) as CreateActivityRequestPayload;
      await options.onRequest?.(request, body);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: options.classroomId ?? String(params.id ?? ''),
          request,
          body,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      return HttpResponse.json(options.activity, { status: 201 });
    },
  );
}

export interface CreateUpdateActivityHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly activityId?: string;
  readonly activity?: TeacherActivityPayload;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly activityId: string;
    readonly request: Request;
    readonly body: UpdateActivityRequestPayload;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (
    request: Request,
    body: UpdateActivityRequestPayload,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `PATCH /classrooms/{id}/activities/{activityId}`
 * (`ActivitiesController_update`): `409` represents "questions can no longer
 * change because a submission exists".
 */
export function createUpdateActivityHandler(
  options: CreateUpdateActivityHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const activitySegment = options.activityId ?? ':activityId';
  return http.patch(
    `${baseUrl}/classrooms/${classroomSegment}/activities/${activitySegment}`,
    async ({ params, request }) => {
      const body = (await request.json()) as UpdateActivityRequestPayload;
      await options.onRequest?.(request, body);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: options.classroomId ?? String(params.id ?? ''),
          activityId: options.activityId ?? String(params.activityId ?? ''),
          request,
          body,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      return HttpResponse.json(options.activity, { status: 200 });
    },
  );
}

export interface CreatePublishActivityHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly activityId?: string;
  readonly activity?: TeacherActivityPayload;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly activityId: string;
    readonly request: Request;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /classrooms/{id}/activities/{activityId}/publish`
 * (`ActivitiesController_publish`): `400` for not publishable (past `dueAt`,
 * invalid questions) and `409` for already published.
 */
export function createPublishActivityHandler(
  options: CreatePublishActivityHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const activitySegment = options.activityId ?? ':activityId';
  return http.post(
    `${baseUrl}/classrooms/${classroomSegment}/activities/${activitySegment}/publish`,
    async ({ params, request }) => {
      await options.onRequest?.(request);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: options.classroomId ?? String(params.id ?? ''),
          activityId: options.activityId ?? String(params.activityId ?? ''),
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      return HttpResponse.json(options.activity, { status: 200 });
    },
  );
}

export interface CreateDeactivateActivityHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly activityId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly activityId: string;
    readonly request: Request;
  }) => Response | void | Promise<Response | void>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `DELETE /classrooms/{id}/activities/{activityId}`
 * (`ActivitiesController_deactivate`): logical deactivation; `409` means the
 * activity has submissions and cannot be deleted.
 */
export function createDeactivateActivityHandler(
  options: CreateDeactivateActivityHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const activitySegment = options.activityId ?? ':activityId';
  return http.delete(
    `${baseUrl}/classrooms/${classroomSegment}/activities/${activitySegment}`,
    async ({ params, request }) => {
      await options.onRequest?.(request);

      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: options.classroomId ?? String(params.id ?? ''),
          activityId: options.activityId ?? String(params.activityId ?? ''),
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
      }

      return new HttpResponse(null, { status: 204 });
    },
  );
}
