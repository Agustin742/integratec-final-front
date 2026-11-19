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

export type InvitationKindPayload =
  components['schemas']['ClassroomInvitationResponseDto']['kind'];
export type InvitationRolePayload =
  components['schemas']['ClassroomInvitationResponseDto']['role'];
export type InvitationStatePayload =
  components['schemas']['ClassroomInvitationResponseDto']['state'];
export type InvitationStateFilterPayload = InvitationStatePayload | 'ALL';

export type ClassroomInvitationPayload = Omit<
  components['schemas']['ClassroomInvitationResponseDto'],
  'targetEmail' | 'maxUses'
> & {
  readonly targetEmail: string | null;
  readonly maxUses: number | null;
};

export type CreatedClassroomInvitationPayload = Omit<
  components['schemas']['CreatedClassroomInvitationResponseDto'],
  'targetEmail' | 'maxUses'
> & {
  readonly targetEmail: string | null;
  readonly maxUses: number | null;
};

export interface PaginatedClassroomInvitationsPayload {
  readonly items: ClassroomInvitationPayload[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export type CreateClassroomInvitationRequestPayload =
  components['schemas']['CreateClassroomInvitationDto'];
export type RevokeInvitationResponsePayload =
  components['schemas']['RevokeInvitationResponseDto'];
export type CreateJoinCodeRequestPayload =
  components['schemas']['CreateJoinCodeDto'];

export type JoinCodeResponsePayload = Omit<
  components['schemas']['JoinCodeResponseDto'],
  'maxUses'
> & {
  readonly maxUses: number | null;
};

export type RevokeJoinCodeResponsePayload =
  operations['ClassroomsController_revokeJoinCode']['responses'][200]['content']['application/json'];

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

export type MaterialStoreOp =
  'list' | 'upload' | 'download' | 'remove' | 'botList' | 'botToggle';
export type MaterialStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface BotMaterialStateEntry {
  readonly materialId: string;
  readonly classroomId: string;
  readonly botEnabled: boolean;
  readonly indexingStatus: 'disabled' | 'pending' | 'ready' | 'failed';
  readonly indexingError?: string | null;
  readonly updatedAt: string;
}

export interface ClassroomMaterialsStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly authorId?: string;
  readonly initialItems?: readonly ClassroomMaterialItem[];
  readonly initialBotStates?: readonly BotMaterialStateEntry[];
  readonly signedUrlBase?: string;
  readonly expiresInSeconds?: number;
}

export interface ClassroomMaterialsStore {
  readonly handlers: readonly HttpHandler[];
  read(): readonly ClassroomMaterialItem[];
  readBotStates(): readonly BotMaterialStateEntry[];
  setBotState(
    materialId: string,
    state: Pick<
      BotMaterialStateEntry,
      'botEnabled' | 'indexingStatus' | 'indexingError'
    >,
  ): void;
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
  const botStates = new Map<string, BotMaterialStateEntry>(
    (options.initialBotStates ?? []).map((entry) => [entry.materialId, entry]),
  );
  let seq = items.length + 1;
  const pending: Partial<Record<MaterialStoreOp, MaterialStoreFailure>> = {};

  const fail = (failure: MswErrorResponseSpec | 'network'): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    read: () => [...items],
    readBotStates: () => [...botStates.values()],
    setBotState(materialId, state) {
      botStates.set(materialId, {
        materialId,
        classroomId,
        botEnabled: state.botEnabled,
        indexingStatus: state.indexingStatus,
        indexingError: state.indexingError ?? null,
        updatedAt: '2026-11-19T01:30:00.000Z',
      });
    },
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
          botStates.delete(String(params.materialId));
          return new HttpResponse(null, { status: 204 });
        },
      ),
      http.get(`${baseUrl}/classrooms/:id/bot/materials`, ({ params }) => {
        const failure = pending.botList;
        pending.botList = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }
        if (options.classroomId && params.id !== classroomId) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Classroom not found.',
            correlationId: 'req-bot-materials-list-404',
          });
        }
        return HttpResponse.json({
          items: [...botStates.values()],
        });
      }),
      http.put(
        `${baseUrl}/classrooms/:id/bot/materials/:materialId`,
        async ({ params, request }) => {
          const failure = pending.botToggle;
          pending.botToggle = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }
          if (options.classroomId && params.id !== classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-bot-materials-toggle-404',
            });
          }
          const materialId = String(params.materialId);
          const found = items.find((item) => item.id === materialId);
          if (!found) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Material not found.',
              correlationId: 'req-bot-materials-toggle-404',
            });
          }
          const body = (await request.json().catch(() => null)) as {
            enabled?: unknown;
          } | null;
          if (!body || typeof body.enabled !== 'boolean') {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'enabled must be a boolean.',
              correlationId: 'req-bot-materials-toggle-400',
            });
          }
          seq += 1;
          const nextEntry: BotMaterialStateEntry = {
            materialId,
            classroomId: found.classroomId,
            botEnabled: body.enabled,
            indexingStatus: body.enabled ? 'pending' : 'disabled',
            indexingError: null,
            updatedAt: '2026-11-19T01:30:00.000Z',
          };
          botStates.set(materialId, nextEntry);
          return HttpResponse.json(nextEntry);
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

export type InvitationFailureSpec =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface CreateClassroomInvitationsHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly items?: readonly ClassroomInvitationPayload[];
  readonly total?: number;
  readonly page?: number;
  readonly pageSize?: number;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (query: {
    readonly classroomId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly status: InvitationStateFilterPayload;
    readonly request: Request;
  }) =>
    | PaginatedClassroomInvitationsPayload
    | Response
    | Promise<PaginatedClassroomInvitationsPayload | Response>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

const VALID_INVITATION_FILTER_SET: ReadonlySet<InvitationStateFilterPayload> =
  new Set(['PENDING', 'USED', 'REVOKED', 'EXPIRED', 'ALL']);

function filterInvitations(
  items: readonly ClassroomInvitationPayload[],
  status: InvitationStateFilterPayload,
): ClassroomInvitationPayload[] {
  return items.filter((item) =>
    status === 'ALL' ? true : item.state === status,
  );
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/invitations`
 * (`ClassroomsController_listInvitations`).
 */
export function createClassroomInvitationsHandler(
  options: CreateClassroomInvitationsHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.get(
    `${baseUrl}/classrooms/${classroomSegment}/invitations`,
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
      const rawStatus = url.searchParams.get('status') ?? 'PENDING';
      const status: InvitationStateFilterPayload =
        VALID_INVITATION_FILTER_SET.has(
          rawStatus as InvitationStateFilterPayload,
        )
          ? (rawStatus as InvitationStateFilterPayload)
          : 'PENDING';

      if (options.resolveResponse) {
        const resolvedClassroomId =
          options.classroomId ?? String(params.id ?? '');
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          page,
          pageSize,
          status,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 200 });
      }

      const filtered = filterInvitations(options.items ?? [], status);
      const start = (page - 1) * pageSize;
      const payload: PaginatedClassroomInvitationsPayload = {
        items: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total: options.total ?? filtered.length,
      };
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface CreateCreateClassroomInvitationHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly body: unknown;
    readonly request: Request;
  }) =>
    | CreatedClassroomInvitationPayload
    | Response
    | Promise<CreatedClassroomInvitationPayload | Response>;
  readonly onRequest?: (
    request: Request,
    body: unknown,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /classrooms/{id}/invitations`
 * (`ClassroomsController_createInvitation`).
 */
export function createCreateClassroomInvitationHandler(
  options: CreateCreateClassroomInvitationHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.post(
    `${baseUrl}/classrooms/${classroomSegment}/invitations`,
    async ({ params, request }) => {
      const body: unknown = await request
        .clone()
        .json()
        .catch(() => undefined);
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

      const resolvedClassroomId =
        options.classroomId ?? String(params.id ?? '');

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          body,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 201 });
      }

      const email =
        typeof body === 'object' &&
        body !== null &&
        'email' in body &&
        typeof body.email === 'string'
          ? body.email.trim()
          : 'student@example.edu.ar';
      const created: CreatedClassroomInvitationPayload = {
        id: '70000000-0000-4000-8000-000000000001',
        kind: 'EMAIL',
        targetEmail: email,
        role: 'STUDENT',
        maxUses: 1,
        useCount: 0,
        state: 'PENDING',
        expiresAt: '2026-11-25T16:00:00.000Z',
        createdAt: '2026-11-18T16:00:00.000Z',
        token: 'invite-secret-token-0001',
      };
      return HttpResponse.json(created, { status: 201 });
    },
  );
}

export interface CreateRevokeClassroomInvitationHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly invitationId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly invitationId: string;
    readonly request: Request;
  }) =>
    | RevokeInvitationResponsePayload
    | Response
    | Promise<RevokeInvitationResponsePayload | Response>;
  readonly onRequest?: (
    request: Request,
    invitationId: string,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `DELETE /classrooms/{id}/invitations/{invitationId}`
 * (`ClassroomsController_revokeInvitation`).
 */
export function createRevokeClassroomInvitationHandler(
  options: CreateRevokeClassroomInvitationHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  const invitationSegment = options.invitationId ?? ':invitationId';
  return http.delete(
    `${baseUrl}/classrooms/${classroomSegment}/invitations/${invitationSegment}`,
    async ({ params, request }) => {
      const resolvedClassroomId =
        options.classroomId ?? String(params.id ?? '');
      const resolvedInvitationId =
        options.invitationId ?? String(params.invitationId ?? '');
      await options.onRequest?.(request, resolvedInvitationId);

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
          invitationId: resolvedInvitationId,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 200 });
      }

      const payload: RevokeInvitationResponsePayload = {
        id: resolvedInvitationId,
        state: 'REVOKED',
      };
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface CreateGenerateJoinCodeHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly body: unknown;
    readonly request: Request;
  }) =>
    | JoinCodeResponsePayload
    | Response
    | Promise<JoinCodeResponsePayload | Response>;
  readonly onRequest?: (
    request: Request,
    body: unknown,
  ) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `POST /classrooms/{id}/join-code`
 * (`ClassroomsController_generateJoinCode`).
 */
export function createGenerateJoinCodeHandler(
  options: CreateGenerateJoinCodeHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.post(
    `${baseUrl}/classrooms/${classroomSegment}/join-code`,
    async ({ params, request }) => {
      const body: unknown = await request
        .clone()
        .json()
        .catch(() => ({}));
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

      const resolvedClassroomId =
        options.classroomId ?? String(params.id ?? '');

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          body,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 201 });
      }

      const maxUses =
        typeof body === 'object' &&
        body !== null &&
        'maxUses' in body &&
        typeof body.maxUses === 'number'
          ? body.maxUses
          : null;
      const payload: JoinCodeResponsePayload = {
        id: '80000000-0000-4000-8000-000000000001',
        code: 'K7P9X2M',
        role: 'STUDENT',
        maxUses,
        useCount: 0,
        state: 'PENDING',
        expiresAt: '2026-11-25T16:00:00.000Z',
        createdAt: '2026-11-18T16:00:00.000Z',
      };
      return HttpResponse.json(payload, { status: 201 });
    },
  );
}

export interface CreateRevokeJoinCodeHandlerOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly error?: MswErrorResponseSpec | 'network';
  readonly resolveResponse?: (args: {
    readonly classroomId: string;
    readonly request: Request;
  }) =>
    | RevokeJoinCodeResponsePayload
    | Response
    | Promise<RevokeJoinCodeResponsePayload | Response>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/**
 * Contract-faithful MSW handler for `DELETE /classrooms/{id}/join-code`
 * (`ClassroomsController_revokeJoinCode`).
 */
export function createRevokeJoinCodeHandler(
  options: CreateRevokeJoinCodeHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomSegment = options.classroomId ?? ':id';
  return http.delete(
    `${baseUrl}/classrooms/${classroomSegment}/join-code`,
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

      const resolvedClassroomId =
        options.classroomId ?? String(params.id ?? '');

      if (options.resolveResponse) {
        const resolved = await options.resolveResponse({
          classroomId: resolvedClassroomId,
          request,
        });
        if (resolved instanceof Response) {
          return resolved;
        }
        return HttpResponse.json(resolved, { status: 200 });
      }

      const payload: RevokeJoinCodeResponsePayload = {
        success: true,
        message: 'Join code revoked successfully',
      };
      return HttpResponse.json(payload, { status: 200 });
    },
  );
}

export interface ClassroomInvitationsStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId: string;
  readonly initialInvitations?: readonly ClassroomInvitationPayload[];
  readonly onListRequest?: (request: Request) => void | Promise<void>;
  readonly onCreateInvitationRequest?: (
    request: Request,
    body: unknown,
  ) => void | Promise<void>;
  readonly onRevokeInvitationRequest?: (
    request: Request,
    invitationId: string,
  ) => void | Promise<void>;
  readonly onGenerateJoinCodeRequest?: (
    request: Request,
    body: unknown,
  ) => void | Promise<void>;
  readonly onRevokeJoinCodeRequest?: (request: Request) => void | Promise<void>;
}

export interface ClassroomInvitationsStore {
  readonly read: () => readonly ClassroomInvitationPayload[];
  readonly failNextList: (failure: MswErrorResponseSpec | 'network') => void;
  readonly failNextCreateInvitation: (failure: InvitationFailureSpec) => void;
  readonly failNextRevokeInvitation: (failure: InvitationFailureSpec) => void;
  readonly failNextGenerateJoinCode: (failure: InvitationFailureSpec) => void;
  readonly failNextRevokeJoinCode: (failure: InvitationFailureSpec) => void;
  readonly handlers: readonly HttpHandler[];
}

/**
 * Stateful MSW store for `/classrooms/{id}/invitations` and `/classrooms/{id}/join-code`.
 * Enforces one-time token/code exposure, atomic join-code regeneration
 * (marking any prior `PENDING` `JOIN_CODE` as `REVOKED`), `404` when no active
 * join code exists, `400` when revoking a non-`PENDING` invitation, and
 * `failNext*` fault injection including `'drop-response'` after server commit.
 */
export function createClassroomInvitationsStore(
  options: ClassroomInvitationsStoreOptions,
): ClassroomInvitationsStore {
  let items: ClassroomInvitationPayload[] = (
    options.initialInvitations ?? []
  ).map((item) => ({ ...item }));
  let seq = 1;
  let nextListFailure: MswErrorResponseSpec | 'network' | undefined;
  let nextCreateFailure: InvitationFailureSpec | undefined;
  let nextRevokeFailure: InvitationFailureSpec | undefined;
  let nextGenerateCodeFailure: InvitationFailureSpec | undefined;
  let nextRevokeCodeFailure: InvitationFailureSpec | undefined;

  const toFailureResponse = (
    failure: MswErrorResponseSpec | 'network',
  ): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    read: () => items.map((item) => ({ ...item })),
    failNextList(failure) {
      nextListFailure = failure;
    },
    failNextCreateInvitation(failure) {
      nextCreateFailure = failure;
    },
    failNextRevokeInvitation(failure) {
      nextRevokeFailure = failure;
    },
    failNextGenerateJoinCode(failure) {
      nextGenerateCodeFailure = failure;
    },
    failNextRevokeJoinCode(failure) {
      nextRevokeCodeFailure = failure;
    },
    handlers: [
      createClassroomInvitationsHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onListRequest,
        resolveResponse: ({ page, pageSize, status }) => {
          if (nextListFailure !== undefined) {
            const failure = nextListFailure;
            nextListFailure = undefined;
            return toFailureResponse(failure);
          }
          const filtered = filterInvitations(items, status);
          const start = (page - 1) * pageSize;
          return {
            items: filtered.slice(start, start + pageSize),
            page,
            pageSize,
            total: filtered.length,
          };
        },
      }),
      createCreateClassroomInvitationHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onCreateInvitationRequest,
        resolveResponse: ({ body }) => {
          const failure = nextCreateFailure;
          nextCreateFailure = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return toFailureResponse(failure);
          }

          const record =
            typeof body === 'object' && body !== null
              ? (body as Record<string, unknown>)
              : {};
          const rawEmail =
            typeof record.email === 'string' ? record.email.trim() : '';
          const role = record.role;
          if (
            rawEmail === '' ||
            !rawEmail.includes('@') ||
            role !== 'STUDENT'
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Validation failed on invitation payload.',
              correlationId: 'corr-inv-create-400',
              details:
                rawEmail === '' || !rawEmail.includes('@')
                  ? [
                      {
                        field: 'email',
                        messages: ['Ingresá un correo electrónico válido.'],
                      },
                    ]
                  : undefined,
            });
          }

          const currentSeq = seq;
          seq += 1;
          const createdAt = new Date(
            Date.UTC(2026, 10, 18, 16, currentSeq, 0),
          ).toISOString();
          const expiresAt = new Date(
            Date.UTC(2026, 10, 25, 16, currentSeq, 0),
          ).toISOString();
          const id = `71000000-0000-4000-8000-${String(currentSeq).padStart(12, '0')}`;
          const listItem: ClassroomInvitationPayload = {
            id,
            kind: 'EMAIL',
            targetEmail: rawEmail,
            role: 'STUDENT',
            maxUses: 1,
            useCount: 0,
            state: 'PENDING',
            expiresAt,
            createdAt,
          };
          items = [listItem, ...items];

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }

          return {
            ...listItem,
            token: `inv-token-${String(currentSeq).padStart(4, '0')}`,
          };
        },
      }),
      createRevokeClassroomInvitationHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onRevokeInvitationRequest,
        resolveResponse: ({ invitationId }) => {
          const failure = nextRevokeFailure;
          nextRevokeFailure = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return toFailureResponse(failure);
          }

          const target = items.find((item) => item.id === invitationId);
          if (!target) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Invitation not found.',
              correlationId: 'corr-inv-revoke-404',
            });
          }
          if (target.state !== 'PENDING') {
            return createErrorEnvelopeResponse(400, {
              code: 'BAD_REQUEST',
              message: 'Only pending invitations can be revoked.',
              correlationId: 'corr-inv-revoke-400',
            });
          }

          items = items.map((item) =>
            item.id === invitationId ? { ...item, state: 'REVOKED' } : item,
          );

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }

          return {
            id: invitationId,
            state: 'REVOKED',
          };
        },
      }),
      createGenerateJoinCodeHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onGenerateJoinCodeRequest,
        resolveResponse: ({ body }) => {
          const failure = nextGenerateCodeFailure;
          nextGenerateCodeFailure = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return toFailureResponse(failure);
          }

          const record =
            typeof body === 'object' && body !== null
              ? (body as Record<string, unknown>)
              : {};
          const maxUses =
            record.maxUses === undefined ? null : Number(record.maxUses);
          if (
            maxUses !== null &&
            (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000)
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid maxUses parameter.',
              correlationId: 'corr-join-code-400-uses',
              details: [
                {
                  field: 'maxUses',
                  messages: ['Ingresá un entero entre 1 y 1000.'],
                },
              ],
            });
          }

          const expiresInSeconds =
            record.expiresInSeconds === undefined
              ? 604_800
              : Number(record.expiresInSeconds);
          if (
            !Number.isInteger(expiresInSeconds) ||
            expiresInSeconds < 60 ||
            expiresInSeconds > 2_592_000
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid expiresInSeconds parameter.',
              correlationId: 'corr-join-code-400-ttl',
            });
          }

          const currentSeq = seq;
          seq += 1;
          const createdAtMs = Date.UTC(2026, 10, 18, 16, currentSeq, 0);
          const createdAt = new Date(createdAtMs).toISOString();
          const expiresAt = new Date(
            createdAtMs + expiresInSeconds * 1000,
          ).toISOString();
          const id = `81000000-0000-4000-8000-${String(currentSeq).padStart(12, '0')}`;
          const code = `CODE${String(currentSeq).padStart(4, '0')}`;

          // Atomic regeneration marks any existing active JOIN_CODE as REVOKED.
          items = items.map((item) =>
            item.kind === 'JOIN_CODE' && item.state === 'PENDING'
              ? { ...item, state: 'REVOKED' }
              : item,
          );

          const newItem: ClassroomInvitationPayload = {
            id,
            kind: 'JOIN_CODE',
            targetEmail: null,
            role: 'STUDENT',
            maxUses,
            useCount: 0,
            state: 'PENDING',
            expiresAt,
            createdAt,
          };
          items = [newItem, ...items];

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }

          return {
            id,
            code,
            role: 'STUDENT',
            maxUses,
            useCount: 0,
            state: 'PENDING',
            expiresAt,
            createdAt,
          };
        },
      }),
      createRevokeJoinCodeHandler({
        baseUrl: options.baseUrl,
        classroomId: options.classroomId,
        onRequest: options.onRevokeJoinCodeRequest,
        resolveResponse: () => {
          const failure = nextRevokeCodeFailure;
          nextRevokeCodeFailure = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return toFailureResponse(failure);
          }

          const hasActiveCode = items.some(
            (item) => item.kind === 'JOIN_CODE' && item.state === 'PENDING',
          );
          if (!hasActiveCode) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'No active join code exists for this classroom.',
              correlationId: 'corr-join-code-revoke-404',
            });
          }

          items = items.map((item) =>
            item.kind === 'JOIN_CODE' && item.state === 'PENDING'
              ? { ...item, state: 'REVOKED' }
              : item,
          );

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }

          return {
            success: true,
            message: 'Join code revoked successfully',
          };
        },
      }),
    ],
  };
}
export interface ClassroomAnnouncementItem {
  readonly id: string;
  readonly classroomId: string;
  readonly authorId: string;
  readonly title: string;
  readonly content: string;
  readonly mentionedUserIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AnnouncementStoreOp = 'list' | 'create' | 'update' | 'remove';
export type AnnouncementStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface ClassroomAnnouncementsStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly authorId?: string;
  readonly initialItems?: readonly ClassroomAnnouncementItem[];
  readonly mentionDirectory?: Readonly<Record<string, string>>;
}

export interface ClassroomAnnouncementsStore {
  readonly handlers: readonly HttpHandler[];
  getItems: () => readonly ClassroomAnnouncementItem[];
  failNext: (
    op: AnnouncementStoreOp,
    failure: AnnouncementStoreFailure,
  ) => void;
}

function resolveMentionsFromContent(
  content: string,
  directory: Readonly<Record<string, string>>,
): string[] {
  const resolved: string[] = [];
  for (const [name, userId] of Object.entries(directory)) {
    const token = `@${name}`;
    if (content.includes(token) && !resolved.includes(userId)) {
      resolved.push(userId);
    }
  }
  return resolved.slice(0, 20);
}

/**
 * Stateful contract-faithful MSW store for classroom announcements
 * (`AnnouncementsController_list`, `AnnouncementsController_create`,
 * `AnnouncementsController_update`, `AnnouncementsController_remove`).
 */
export function createClassroomAnnouncementsStore(
  options: ClassroomAnnouncementsStoreOptions = {},
): ClassroomAnnouncementsStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomId =
    options.classroomId ?? '00000000-0000-4000-8000-000000000101';
  const authorId = options.authorId ?? '00000000-0000-4000-8000-000000000001';
  const mentionDirectory = options.mentionDirectory ?? {};

  let items: ClassroomAnnouncementItem[] = [...(options.initialItems ?? [])];
  let seq = items.length + 1;
  const pending: Partial<
    Record<AnnouncementStoreOp, AnnouncementStoreFailure>
  > = {};

  const fail = (failure: AnnouncementStoreFailure): Response => {
    if (failure === 'network' || failure === 'drop-response') {
      return HttpResponse.error();
    }
    return createErrorEnvelopeResponse(failure.status, failure.body);
  };

  return {
    getItems: () => items,
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    handlers: [
      http.get(`${baseUrl}/classrooms/:id/announcements`, ({ request }) => {
        const failure = pending.list;
        pending.list = undefined;
        if (failure !== undefined) {
          return fail(failure);
        }

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)),
        );
        const ordered = [...items].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        const start = (page - 1) * pageSize;
        return HttpResponse.json({
          items: ordered.slice(start, start + pageSize),
          page,
          pageSize,
          total: ordered.length,
        });
      }),
      http.post(
        `${baseUrl}/classrooms/:id/announcements`,
        async ({ params, request }) => {
          const failure = pending.create;
          pending.create = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }

          const body = (await request.json().catch(() => null)) as {
            title?: unknown;
            content?: unknown;
          } | null;
          const title =
            typeof body?.title === 'string' ? body.title.trim() : '';
          const content =
            typeof body?.content === 'string' ? body.content.trim() : '';
          if (title.length === 0 || content.length === 0) {
            return createErrorEnvelopeResponse(400, {
              code: 'BAD_REQUEST',
              message: 'Validation failed.',
              correlationId: 'req-announcements-create-400',
              details: [
                {
                  field: title.length === 0 ? 'title' : 'content',
                  messages: ['El campo es obligatorio.'],
                },
              ],
            });
          }

          const timestamp = new Date(
            Date.UTC(2026, 10, 18, 12, seq, 0),
          ).toISOString();
          const created: ClassroomAnnouncementItem = {
            id: `00000000-0000-4000-8000-${String(2000 + seq).padStart(12, '0')}`,
            classroomId: String(params.id ?? classroomId),
            authorId,
            title,
            content,
            mentionedUserIds: resolveMentionsFromContent(
              content,
              mentionDirectory,
            ),
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          seq += 1;
          items = [created, ...items];
          return failure === 'drop-response'
            ? HttpResponse.error()
            : HttpResponse.json(created, { status: 201 });
        },
      ),
      http.patch(
        `${baseUrl}/classrooms/:id/announcements/:announcementId`,
        async ({ params, request }) => {
          const failure = pending.update;
          pending.update = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }

          const index = items.findIndex(
            (item) => item.id === params.announcementId,
          );
          if (index === -1) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Announcement not found.',
              correlationId: 'req-announcements-update-404',
            });
          }

          const body = (await request.json().catch(() => null)) as {
            title?: unknown;
            content?: unknown;
          } | null;
          const current = items[index];
          const nextTitle =
            typeof body?.title === 'string' ? body.title.trim() : current.title;
          const nextContent =
            typeof body?.content === 'string'
              ? body.content.trim()
              : current.content;
          if (nextTitle.length === 0 || nextContent.length === 0) {
            return createErrorEnvelopeResponse(400, {
              code: 'BAD_REQUEST',
              message: 'Validation failed.',
              correlationId: 'req-announcements-update-400',
            });
          }

          const updated: ClassroomAnnouncementItem = {
            ...current,
            title: nextTitle,
            content: nextContent,
            mentionedUserIds: resolveMentionsFromContent(
              nextContent,
              mentionDirectory,
            ),
            updatedAt: new Date(
              Date.UTC(2026, 10, 18, 12, seq, 30),
            ).toISOString(),
          };
          seq += 1;
          items = items.map((item, idx) => (idx === index ? updated : item));
          return failure === 'drop-response'
            ? HttpResponse.error()
            : HttpResponse.json(updated);
        },
      ),
      http.delete(
        `${baseUrl}/classrooms/:id/announcements/:announcementId`,
        ({ params }) => {
          const failure = pending.remove;
          pending.remove = undefined;
          if (failure !== undefined && failure !== 'drop-response') {
            return fail(failure);
          }

          const exists = items.some(
            (item) => item.id === params.announcementId,
          );
          if (!exists) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Announcement not found.',
              correlationId: 'req-announcements-remove-404',
            });
          }
          items = items.filter((item) => item.id !== params.announcementId);
          return failure === 'drop-response'
            ? HttpResponse.error()
            : new HttpResponse(null, { status: 204 });
        },
      ),
    ],
  };
}

export type StudentWalletPayload = components['schemas']['StudentWalletDto'];
export type PointMovementPayload = components['schemas']['PointMovementDto'];

export interface CreateStudentWalletHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly error?: ErrorBodyPayload;
  readonly response?: Partial<StudentWalletPayload>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/** Synthetic `ErrorBody` matching the status, so failure tests stay valid. */
function syntheticWalletErrorBody(status: number): ErrorBodyPayload {
  if (status === 400) {
    return {
      code: 'BAD_REQUEST',
      message: 'Invalid pagination parameters.',
      correlationId: 'corr-wallet-400',
    };
  }
  if (status === 401) {
    return {
      code: 'UNAUTHENTICATED',
      message: 'Missing or invalid session.',
      correlationId: 'corr-wallet-401',
    };
  }
  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      message: 'Caller is not an active enrolled student in this classroom.',
      correlationId: 'corr-wallet-403',
    };
  }
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      message: 'Classroom not found.',
      correlationId: 'corr-wallet-404',
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Wallet request failed.',
    correlationId: `corr-wallet-${status}`,
  };
}

const WALLET_MOVEMENTS: readonly PointMovementPayload[] = [
  {
    id: '00000000-0000-4000-8000-000000000301',
    entryKind: 'EARNING',
    amount: 50,
    sourceType: 'submission_grade',
    sourceId: '00000000-0000-4000-8000-000000000311',
    reason: 'Activity graded: Fractions Quiz',
    actorId: '00000000-0000-4000-8000-000000000321',
    createdAt: '2026-11-10T12:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000302',
    entryKind: 'DEBIT',
    amount: -20,
    sourceType: 'shop_purchase',
    sourceId: '00000000-0000-4000-8000-000000000312',
    reason: 'Shop purchase: Blue Classroom Cap',
    actorId: null,
    createdAt: '2026-11-12T15:30:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000303',
    entryKind: 'COMPENSATION',
    amount: 5,
    sourceType: 'grade_revision',
    sourceId: '00000000-0000-4000-8000-000000000313',
    reason: 'Regrade adjustment: Fractions Quiz',
    actorId: '00000000-0000-4000-8000-000000000321',
    createdAt: '2026-11-14T09:15:00.000Z',
  },
];

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/points`
 * (`PointsController_getOwnWallet`): the caller's own server-computed balance
 * and one page of movements. Works before the backend implementation lands.
 */
export function createStudentWalletHandler(
  classroomId: string,
  options: CreateStudentWalletHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.get(
    `${baseUrl}/classrooms/${classroomId}/points`,
    async ({ request }) => {
      await options.onRequest?.(request);

      const status = options.status ?? 200;
      if (status >= 400) {
        return createErrorEnvelopeResponse(
          status,
          options.error ?? syntheticWalletErrorBody(status),
        );
      }

      const url = new URL(request.url);
      const rawPage = url.searchParams.get('page');
      const rawPageSize = url.searchParams.get('pageSize');
      const parsedPage = rawPage === null ? 1 : Number(rawPage);
      const parsedPageSize = rawPageSize === null ? 20 : Number(rawPageSize);
      const page =
        Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
      const pageSize =
        Number.isInteger(parsedPageSize) && parsedPageSize >= 1
          ? parsedPageSize
          : 20;
      const start = (page - 1) * pageSize;

      const payload: StudentWalletPayload = {
        classroomId,
        studentId: '00000000-0000-4000-8000-000000000011',
        balance: 130,
        items: WALLET_MOVEMENTS.slice(start, start + pageSize),
        page,
        pageSize,
        total: WALLET_MOVEMENTS.length,
        ...options.response,
      };
      return HttpResponse.json(payload, { status });
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

export interface ActivityStoreQuestionOption {
  readonly id: string;
  readonly position: number;
  readonly label: string;
  readonly isCorrect: boolean;
}

export interface ActivityStoreQuestion {
  readonly id: string;
  readonly position: number;
  readonly prompt: string;
  readonly options: readonly ActivityStoreQuestionOption[];
}

export interface ActivityStoreItem {
  readonly id: string;
  readonly classroomId: string;
  readonly type: 'TP' | 'EXAM';
  readonly format: 'FILE' | 'MULTIPLE_CHOICE';
  readonly state: 'DRAFT' | 'PUBLISHED';
  readonly title: string;
  readonly description: string;
  readonly opensAt: string | null;
  readonly dueAt: string;
  readonly allowLate: boolean;
  readonly maxScore: number;
  readonly weightMultiplier: number;
  readonly publishedAt: string | null;
  readonly timeZone: string;
  readonly questionCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdById?: string;
  readonly questions?: readonly ActivityStoreQuestion[];
}

export type ActivityStoreOp = 'list' | 'get';
export type ActivityStoreFailure = MswErrorResponseSpec | 'network';

export interface ClassroomActivitiesStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly role?: 'TEACHER' | 'SCHOOL_OWNER' | 'STUDENT' | 'PARENT';
  readonly initialItems?: readonly ActivityStoreItem[];
}

export interface ClassroomActivitiesStore {
  readonly handlers: readonly HttpHandler[];
  failNext: (op: ActivityStoreOp, failure: ActivityStoreFailure) => void;
}

const DEFAULT_ACTIVITY_CREATOR_ID = '00000000-0000-4000-8000-000000000099';

/**
 * Stateful contract-faithful MSW store for classroom activities
 * (`ActivitiesController_list` and `ActivitiesController_get`).
 */
export function createClassroomActivitiesStore(
  options: ClassroomActivitiesStoreOptions = {},
): ClassroomActivitiesStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const role = options.role ?? 'STUDENT';
  const isStaff = role === 'TEACHER' || role === 'SCHOOL_OWNER';
  const items: ActivityStoreItem[] = [...(options.initialItems ?? [])];
  const pending: Partial<Record<ActivityStoreOp, ActivityStoreFailure>> = {};

  const fail = (failure: ActivityStoreFailure): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    handlers: [
      http.get(
        `${baseUrl}/classrooms/:id/activities`,
        ({ params, request }) => {
          const failure = pending.list;
          pending.list = undefined;
          if (failure !== undefined) {
            return fail(failure);
          }

          if (options.classroomId && params.id !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-activities-list-404',
            });
          }

          if (role === 'PARENT') {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Parents cannot view classroom activities.',
              correlationId: 'req-activities-list-403',
            });
          }

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)),
          );
          const sort = url.searchParams.get('sort') ?? 'dueAt';
          const stateFilter = url.searchParams.get('state');

          let visible = items.filter((item) =>
            isStaff ? true : item.state === 'PUBLISHED',
          );
          if (
            isStaff &&
            (stateFilter === 'DRAFT' || stateFilter === 'PUBLISHED')
          ) {
            visible = visible.filter((item) => item.state === stateFilter);
          }

          const sorted = [...visible].sort((a, b) => {
            if (sort === '-dueAt') return b.dueAt.localeCompare(a.dueAt);
            if (sort === 'createdAt')
              return a.createdAt.localeCompare(b.createdAt);
            if (sort === '-createdAt')
              return b.createdAt.localeCompare(a.createdAt);
            return a.dueAt.localeCompare(b.dueAt);
          });

          const start = (page - 1) * pageSize;
          const summaries = sorted
            .slice(start, start + pageSize)
            .map((item) => {
              const {
                questions: omittedQuestions,
                createdById: omittedCreatedById,
                ...summary
              } = item;
              void omittedQuestions;
              void omittedCreatedById;
              return summary;
            });

          return HttpResponse.json({
            items: summaries,
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.get(
        `${baseUrl}/classrooms/:id/activities/:activityId`,
        ({ params }) => {
          const failure = pending.get;
          pending.get = undefined;
          if (failure !== undefined) {
            return fail(failure);
          }

          if (options.classroomId && params.id !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-activities-get-404',
            });
          }

          if (role === 'PARENT') {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Parents cannot view activity detail.',
              correlationId: 'req-activities-get-403',
            });
          }

          const found = items.find((item) => item.id === params.activityId);
          if (!found || (!isStaff && found.state !== 'PUBLISHED')) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Activity not found.',
              correlationId: 'req-activities-get-404',
            });
          }

          const { questions = [], createdById, ...summary } = found;
          if (isStaff) {
            return HttpResponse.json({
              ...summary,
              createdById: createdById ?? DEFAULT_ACTIVITY_CREATOR_ID,
              questions,
            });
          }

          return HttpResponse.json({
            ...summary,
            questions: questions.map((q) => ({
              id: q.id,
              position: q.position,
              prompt: q.prompt,
              options: q.options.map(({ id, position, label }) => ({
                id,
                position,
                label,
              })),
            })),
          });
        },
      ),
    ],
  };
}

export interface SubmissionStoreFile {
  readonly id: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly position: number;
}

export interface SubmissionStoreItem {
  readonly id: string;
  readonly activityId: string;
  readonly submittedAt: string;
  readonly isLate: boolean;
  readonly status: 'submitted' | 'graded';
  readonly files: readonly SubmissionStoreFile[];
  readonly idempotencyKey: string;
}

export type SubmissionStoreOp = 'create' | 'readOwn';
export type SubmissionStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface ClassroomSubmissionsStoreOptions {
  readonly baseUrl?: string;
  readonly role?: 'TEACHER' | 'SCHOOL_OWNER' | 'STUDENT' | 'PARENT';
  /** Published `FILE` activity the store accepts submissions for. */
  readonly activity?: ActivityStoreItem;
  /** Server-clock instant used to decide the submission window. */
  readonly now?: string;
  /** Per-file size limit the store enforces (contract default: 10 MB). */
  readonly fileSizeLimitBytes?: number;
  readonly initialItems?: readonly SubmissionStoreItem[];
}

export interface SubmissionCreateRequestRecord {
  readonly idempotencyKey: string | null;
  readonly authorization: string | null;
  readonly accessTokenUsed: string | null;
}

export interface ClassroomSubmissionsStore {
  readonly handlers: readonly HttpHandler[];
  getItems: () => readonly SubmissionStoreItem[];
  getLastCreateRequest: () => SubmissionCreateRequestRecord | null;
  failNext: (op: SubmissionStoreOp, failure: SubmissionStoreFailure) => void;
}

async function sniffSubmissionContentType(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const startsWith = (prefix: number[]) =>
    prefix.every((byte, index) => bytes[index] === byte);
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}

/**
 * Minimal multipart reader for the submissions store. The jsdom XHR interceptor
 * produces a raw body undici's `formData()` cannot always parse, so the mock
 * reads the boundary-delimited parts at the byte level (only headers are
 * decoded as text) so file content and size stay byte-exact.
 */
async function readMultipartFiles(request: Request): Promise<File[] | null> {
  const contentType = request.headers.get('content-type') ?? '';
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!match) {
    return null;
  }
  const boundary = new TextEncoder().encode(
    `--${(match[1] ?? match[2] ?? '').trim()}`,
  );
  const body = new Uint8Array(await request.arrayBuffer());

  const findSequence = (
    haystack: Uint8Array,
    needle: Uint8Array,
    from: number,
  ): number => {
    outer: for (let i = from; i <= haystack.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) {
          continue outer;
        }
      }
      return i;
    }
    return -1;
  };

  const files: File[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const start = findSequence(body, boundary, cursor);
    if (start === -1) {
      break;
    }
    const next = findSequence(body, boundary, start + boundary.length);
    const partEnd = next === -1 ? body.length : next;
    let partStart = start + boundary.length;
    let partStop = partEnd;
    if (body[partStart] === 0x0d && body[partStart + 1] === 0x0a) {
      partStart += 2;
    }
    if (
      partStop >= partStart + 2 &&
      body[partStop - 2] === 0x0d &&
      body[partStop - 1] === 0x0a
    ) {
      partStop -= 2;
    }
    const part = body.subarray(partStart, partStop);
    const headerEnd = findSequence(
      part,
      new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a]),
      0,
    );
    if (headerEnd !== -1) {
      const headerText = new TextDecoder().decode(part.subarray(0, headerEnd));
      const nameMatch = /filename="([^"]*)"/i.exec(headerText);
      if (nameMatch) {
        const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
        files.push(
          new File([part.subarray(headerEnd + 4)], nameMatch[1] ?? 'file', {
            type: typeMatch?.[1]?.trim() ?? '',
          }),
        );
      }
    }
    cursor = partEnd;
  }
  return files;
}

/**
 * Stateful contract-faithful MSW store for student file submissions
 * (`SubmissionsController_create` and `SubmissionsController_readOwn`).
 * Models the calling student; staff and linked parents answer `403`, and
 * non-members or unknown/draft activities answer `404` so nothing leaks.
 */
export function createClassroomSubmissionsStore(
  options: ClassroomSubmissionsStoreOptions = {},
): ClassroomSubmissionsStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const role = options.role ?? 'STUDENT';
  const activity = options.activity;
  const now = options.now ?? '2026-11-18T12:00:00.000Z';
  const fileSizeLimitBytes = options.fileSizeLimitBytes ?? 10 * 1024 * 1024;
  const items: SubmissionStoreItem[] = [...(options.initialItems ?? [])];
  const pending: Partial<Record<SubmissionStoreOp, SubmissionStoreFailure>> =
    {};
  let lastCreateRequest: SubmissionCreateRequestRecord | null = null;

  // jsdom's XHR enforces CORS, so every store response carries the header a
  // real API gateway would add; `HttpResponse.error()` stays unwrapped.
  const withCors = (response: Response): Response => {
    const headers = new Headers(response.headers);
    headers.set('access-control-allow-origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
  const respondJson = (body: unknown, status: number): Response =>
    withCors(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  const respondError = (status: number, body: ErrorBodyPayload): Response =>
    withCors(createErrorEnvelopeResponse(status, body));

  const fail = (failure: SubmissionStoreFailure): Response =>
    failure === 'network' || failure === 'drop-response'
      ? HttpResponse.error()
      : respondError(failure.status, failure.body);

  return {
    getItems: () => items,
    getLastCreateRequest: () => lastCreateRequest,
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    handlers: [
      // jsdom sends a CORS preflight for the XHR upload's custom headers
      // (`Authorization`, `Idempotency-Key`); answer it like the real API.
      http.options(
        `${baseUrl}/activities/:activityId/submissions`,
        () =>
          new HttpResponse(null, {
            status: 204,
            headers: {
              'access-control-allow-origin': '*',
              'access-control-allow-methods': 'POST, GET, OPTIONS',
              'access-control-allow-headers':
                'authorization, idempotency-key, accept, content-type',
            },
          }),
      ),
      http.post(
        `${baseUrl}/activities/:activityId/submissions`,
        async ({ params, request }) => {
          const failure = pending.create;
          pending.create = undefined;
          if (failure === 'network') {
            return HttpResponse.error();
          }
          if (failure !== undefined && failure !== 'drop-response') {
            return respondError(failure.status, failure.body);
          }

          const idempotencyKey = request.headers.get('Idempotency-Key');
          const authorization = request.headers.get('Authorization');
          lastCreateRequest = {
            idempotencyKey,
            authorization,
            accessTokenUsed:
              authorization?.startsWith('Bearer ') && authorization.length > 7
                ? authorization.slice(7)
                : null,
          };

          const activityNotFound = () =>
            respondError(404, {
              code: 'NOT_FOUND',
              message: 'Activity not found.',
              correlationId: 'req-submissions-create-404',
            });

          if (!activity || params.activityId !== activity.id) {
            return activityNotFound();
          }
          if (activity.state !== 'PUBLISHED') {
            return activityNotFound();
          }
          if (role !== 'STUDENT') {
            return respondError(403, {
              code: 'FORBIDDEN',
              message: 'Only students can submit activities.',
              correlationId: 'req-submissions-create-403',
            });
          }

          const key = idempotencyKey?.trim() ?? '';
          if (key.length < 1 || key.length > 255) {
            return respondError(400, {
              code: 'BAD_REQUEST',
              message: 'Missing or invalid Idempotency-Key.',
              details: [
                {
                  field: 'idempotencyKey',
                  messages: ['Idempotency-Key is required.'],
                },
              ],
              correlationId: 'req-submissions-create-400-key',
            });
          }

          const existing = items.find(
            (item) => item.activityId === activity.id,
          );
          if (existing) {
            if (existing.idempotencyKey === key) {
              // Idempotent replay: the stored submission, nothing new stored.
              return respondJson(existing, 200);
            }
            return respondError(409, {
              code: 'CONFLICT',
              message: 'Already submitted with another idempotency key.',
              details: [
                {
                  field: 'idempotencyKey',
                  messages: [
                    'Already submitted with a different idempotency key.',
                  ],
                },
              ],
              correlationId: 'req-submissions-create-409-key',
            });
          }

          if (activity.format !== 'FILE') {
            return respondError(409, {
              code: 'CONFLICT',
              message: 'Not a file activity.',
              details: [
                { field: 'format', messages: ['Not a file activity.'] },
              ],
              correlationId: 'req-submissions-create-409-format',
            });
          }

          if (activity.opensAt && now < activity.opensAt) {
            return respondError(409, {
              code: 'CONFLICT',
              message: 'Submission window not open yet.',
              details: [
                {
                  field: 'opensAt',
                  messages: ['Submission window not open yet.'],
                },
              ],
              correlationId: 'req-submissions-create-409-window',
            });
          }
          const isLate = now > activity.dueAt;
          if (isLate && !activity.allowLate) {
            return respondError(409, {
              code: 'CONFLICT',
              message: 'Submission window closed.',
              details: [
                {
                  field: 'dueAt',
                  messages: ['Submission window closed.'],
                },
              ],
              correlationId: 'req-submissions-create-409-closed',
            });
          }

          const files = await readMultipartFiles(request);
          if (files === null || files.length < 1 || files.length > 5) {
            return respondError(400, {
              code: 'BAD_REQUEST',
              message: 'Between 1 and 5 files are required.',
              correlationId: 'req-submissions-create-400-count',
            });
          }
          const validatedFiles: { file: File; contentType: string }[] = [];
          for (const [index, file] of files.entries()) {
            if (file.size > fileSizeLimitBytes) {
              return respondError(413, {
                code: 'VALIDATION_FAILED',
                message: 'A file exceeds the size limit.',
                details: [
                  {
                    field: `files.${index}`,
                    messages: ['A file exceeds the size limit.'],
                  },
                ],
                correlationId: 'req-submissions-create-413',
              });
            }
            const contentType = await sniffSubmissionContentType(file);
            if (contentType === null) {
              return respondError(400, {
                code: 'VALIDATION_FAILED',
                message: 'Disallowed file content.',
                details: [
                  {
                    field: `files.${index}`,
                    messages: ['Disallowed content type.'],
                  },
                ],
                correlationId: 'req-submissions-create-400-type',
              });
            }
            validatedFiles.push({ file, contentType });
          }

          const stored: SubmissionStoreItem = {
            id: globalThis.crypto.randomUUID(),
            activityId: activity.id,
            submittedAt: now,
            isLate,
            status: 'submitted',
            files: validatedFiles.map(({ file, contentType }, index) => ({
              id: globalThis.crypto.randomUUID(),
              originalName: file.name
                .replace(/[\\/:*?"<>|]/g, '_')
                .split('')
                .map((character) => (character < ' ' ? '_' : character))
                .join(''),
              contentType,
              sizeBytes: file.size,
              position: index,
            })),
            idempotencyKey: key,
          };
          items.push(stored);

          if (failure === 'drop-response') {
            // The server stored the submission but the response was lost.
            return HttpResponse.error();
          }
          return respondJson(stored, 201);
        },
      ),
      http.get(
        `${baseUrl}/activities/:activityId/submissions/me`,
        ({ params }) => {
          const failure = pending.readOwn;
          pending.readOwn = undefined;
          if (failure !== undefined) {
            return fail(failure);
          }

          if (!activity || params.activityId !== activity.id) {
            return respondError(404, {
              code: 'NOT_FOUND',
              message: 'Activity not found.',
              correlationId: 'req-submissions-me-404-activity',
            });
          }
          if (activity.state !== 'PUBLISHED') {
            return respondError(404, {
              code: 'NOT_FOUND',
              message: 'Activity not found.',
              correlationId: 'req-submissions-me-404-draft',
            });
          }
          if (role !== 'STUDENT') {
            return respondError(403, {
              code: 'FORBIDDEN',
              message: 'Only students can read their own submission.',
              correlationId: 'req-submissions-me-403',
            });
          }

          const found = items.find(
            (item) => item.activityId === params.activityId,
          );
          if (!found) {
            return respondError(404, {
              code: 'NOT_FOUND',
              message: 'Submission not found.',
              correlationId: 'req-submissions-me-404-submission',
            });
          }

          const downloadExpiresAt = new Date(
            new Date(now).getTime() + 5 * 60 * 1000,
          ).toISOString();
          return respondJson(
            {
              id: found.id,
              activityId: found.activityId,
              submittedAt: found.submittedAt,
              isLate: found.isLate,
              status: found.status,
              files: found.files.map((file) => ({
                ...file,
                downloadUrl: `https://storage.example.invalid/signed/${file.id}`,
                downloadUrlExpiresAt: downloadExpiresAt,
              })),
            },
            200,
          );
        },
      ),
    ],
  };
}

export type TeacherActivityPayload =
  components['schemas']['TeacherActivityResponseDto'];
export type StudentActivityPayload =
  components['schemas']['StudentActivityResponseDto'];
export type ActivitySummaryPayload =
  components['schemas']['ActivitySummaryDto'];
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

export interface NotificationStoreItem {
  readonly id: string;
  readonly kind:
    | 'activity_published'
    | 'grade_posted'
    | 'announcement'
    | 'mention'
    | 'activity_forum_reply';
  readonly resourceId: string;
  readonly classroomId: string;
  readonly studentId: string | null;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export type NotificationStoreOp = 'list' | 'read' | 'readAll';
export type NotificationStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response';

export interface NotificationsStoreOptions {
  readonly baseUrl?: string;
  readonly initialItems?: readonly NotificationStoreItem[];
  readonly readTimestamp?: string;
}

export interface NotificationsStore {
  readonly handlers: readonly HttpHandler[];
  getItems: () => readonly NotificationStoreItem[];
  pushItem: (item: NotificationStoreItem) => void;
  removeByClassroom: (classroomId: string) => void;
  failNext: (
    op: NotificationStoreOp,
    failure: NotificationStoreFailure,
  ) => void;
}

/**
 * Stateful contract-faithful MSW store for in-app notifications
 * (`NotificationsController_list`, `NotificationsController_read`,
 * `NotificationsController_readAll`).
 */
export function createNotificationsStore(
  options: NotificationsStoreOptions = {},
): NotificationsStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const readTimestamp = options.readTimestamp ?? '2026-11-18T14:00:00.000Z';
  let items: NotificationStoreItem[] = [...(options.initialItems ?? [])];
  const pending: Partial<
    Record<NotificationStoreOp, NotificationStoreFailure>
  > = {};

  const fail = (failure: NotificationStoreFailure): Response => {
    if (failure === 'network' || failure === 'drop-response') {
      return HttpResponse.error();
    }
    return createErrorEnvelopeResponse(failure.status, failure.body);
  };

  return {
    getItems: () => items,
    pushItem: (item) => {
      items = [item, ...items.filter((existing) => existing.id !== item.id)];
    },
    removeByClassroom: (classroomId) => {
      items = items.filter((item) => item.classroomId !== classroomId);
    },
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    handlers: [
      http.get(`${baseUrl}/notifications`, ({ request }) => {
        const failure = pending.list;
        pending.list = undefined;
        if (failure !== undefined) {
          return fail(failure);
        }

        const url = new URL(request.url);
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const pageSize = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)),
        );
        const ordered = [...items].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        );
        const start = (page - 1) * pageSize;
        return HttpResponse.json({
          items: ordered.slice(start, start + pageSize),
          page,
          pageSize,
          total: ordered.length,
        });
      }),
      http.patch(`${baseUrl}/notifications/read-all`, () => {
        const failure = pending.readAll;
        pending.readAll = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }

        let updated = 0;
        items = items.map((item) => {
          if (item.readAt !== null) {
            return item;
          }
          updated += 1;
          return { ...item, readAt: readTimestamp };
        });

        return failure === 'drop-response'
          ? HttpResponse.error()
          : HttpResponse.json({ updated });
      }),
      http.patch(`${baseUrl}/notifications/:id/read`, ({ params }) => {
        const failure = pending.read;
        pending.read = undefined;
        if (failure !== undefined && failure !== 'drop-response') {
          return fail(failure);
        }

        const index = items.findIndex((item) => item.id === params.id);
        if (index === -1) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Notification not found.',
            correlationId: 'req-notifications-read-404',
          });
        }

        const existing = items[index];
        const next: NotificationStoreItem =
          existing.readAt !== null
            ? existing
            : { ...existing, readAt: readTimestamp };
        items = items.map((item, idx) => (idx === index ? next : item));

        return failure === 'drop-response'
          ? HttpResponse.error()
          : HttpResponse.json(next);
      }),
    ],
  };
}

export interface GradingStoreFile {
  readonly id: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly position: number;
  readonly downloadUrl?: string;
  readonly downloadUrlExpiresAt?: string;
}

export interface GradingStoreGrade {
  readonly id: string;
  readonly graderId: string;
  readonly score: number;
  readonly feedback: string;
  readonly pointsAwarded: number;
  readonly pointTransactionId: string | null;
  readonly version: number;
  readonly gradedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GradingStoreSubmission {
  readonly id: string;
  readonly classroomId: string;
  readonly activityId: string;
  readonly activityTitle: string;
  readonly activityType: 'TP' | 'EXAM';
  readonly activityFormat?: 'FILE' | 'MULTIPLE_CHOICE';
  readonly maxScore?: number;
  readonly weightMultiplier?: number;
  readonly studentId: string;
  readonly studentDisplayName: string;
  readonly submittedAt: string;
  readonly isLate: boolean;
  readonly studentActive?: boolean;
  readonly files: readonly GradingStoreFile[];
  readonly grade: GradingStoreGrade | null;
}

export type GradingStoreOp =
  'queue' | 'detail' | 'getGrade' | 'grade' | 'regrade';

export type GradingStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response' | 'malformed-2xx';

export interface ClassroomGradingStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId: string;
  readonly graderId?: string;
  readonly initialSubmissions?: readonly GradingStoreSubmission[];
  readonly allowedRoles?: readonly string[];
  readonly role?: string;
}

export interface ClassroomGradingStore {
  readonly handlers: readonly HttpHandler[];
  getSubmissions: () => readonly GradingStoreSubmission[];
  setRole: (role: string) => void;
  setGradeExternally: (submissionId: string, grade: GradingStoreGrade) => void;
  removeSubmission: (submissionId: string) => void;
  failNext: (op: GradingStoreOp, failure: GradingStoreFailure) => void;
  getCounts: () => Record<GradingStoreOp, number>;
}

/**
 * Stateful contract-faithful MSW store for teacher grading (`HU-ACT-004`,
 * backend D18): `GET /classrooms/:id/submissions`, `GET /submissions/:id`, and
 * `GET`/`POST`/`PATCH /submissions/:id/grade`.
 */
export function createClassroomGradingStore(
  options: ClassroomGradingStoreOptions,
): ClassroomGradingStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const graderId = options.graderId ?? '00000000-0000-4000-8000-000000000001';
  let currentRole = options.role ?? 'TEACHER';
  const staffRoles = new Set(
    options.allowedRoles ?? ['SCHOOL_OWNER', 'ADMIN', 'TEACHER'],
  );

  let submissions: GradingStoreSubmission[] = [
    ...(options.initialSubmissions ?? []),
  ];
  let linkGeneration = 0;
  let gradeSequence = 100;
  const pending: Partial<Record<GradingStoreOp, GradingStoreFailure>> = {};
  const counts: Record<GradingStoreOp, number> = {
    queue: 0,
    detail: 0,
    getGrade: 0,
    grade: 0,
    regrade: 0,
  };

  const computeServerPoints = (score: number, weightMultiplier = 1): number =>
    Math.max(0, Math.round(score * weightMultiplier));

  const consumeFailure = (
    op: GradingStoreOp,
  ): GradingStoreFailure | undefined => {
    const failure = pending[op];
    pending[op] = undefined;
    return failure;
  };

  const respondFailure = (failure: GradingStoreFailure): Response => {
    if (failure === 'network' || failure === 'drop-response') {
      return HttpResponse.error();
    }
    if (failure === 'malformed-2xx') {
      return HttpResponse.json({ unexpected: true }, { status: 200 });
    }
    return createErrorEnvelopeResponse(failure.status, failure.body);
  };

  return {
    getSubmissions: () => submissions,
    setRole: (role) => {
      currentRole = role;
    },
    setGradeExternally: (submissionId, grade) => {
      submissions = submissions.map((item) =>
        item.id === submissionId ? { ...item, grade } : item,
      );
    },
    removeSubmission: (submissionId) => {
      submissions = submissions.filter((item) => item.id !== submissionId);
    },
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    getCounts: () => ({ ...counts }),
    handlers: [
      http.get(
        `${baseUrl}/classrooms/:id/submissions`,
        ({ params, request }) => {
          counts.queue += 1;
          const failure = consumeFailure('queue');
          if (failure !== undefined) {
            return respondFailure(failure);
          }

          const requestedClassroomId = String(params.id ?? '');
          if (requestedClassroomId !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-grading-queue-404',
            });
          }

          if (!staffRoles.has(currentRole)) {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Staff role required.',
              correlationId: 'req-grading-queue-403',
            });
          }

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
          );
          const activityId = url.searchParams.get('activityId') ?? '';
          const state = url.searchParams.get('state') ?? '';
          const sort = url.searchParams.get('sort') ?? 'submittedAt';

          let filtered = submissions.filter(
            (item) =>
              item.classroomId === requestedClassroomId &&
              item.studentActive !== false,
          );
          if (activityId) {
            filtered = filtered.filter(
              (item) => item.activityId === activityId,
            );
          }
          if (state === 'submitted') {
            filtered = filtered.filter((item) => item.grade === null);
          } else if (state === 'graded') {
            filtered = filtered.filter((item) => item.grade !== null);
          }

          const sorted = [...filtered].sort((a, b) => {
            if (sort === '-submittedAt') {
              const diff =
                Date.parse(b.submittedAt) - Date.parse(a.submittedAt);
              return diff !== 0 ? diff : a.id.localeCompare(b.id);
            }
            if (sort === 'gradedAt' || sort === '-gradedAt') {
              const aGraded = a.grade ? Date.parse(a.grade.gradedAt) : null;
              const bGraded = b.grade ? Date.parse(b.grade.gradedAt) : null;
              if (aGraded === null && bGraded === null) {
                return a.id.localeCompare(b.id);
              }
              if (aGraded === null) return 1;
              if (bGraded === null) return -1;
              const diff =
                sort === '-gradedAt' ? bGraded - aGraded : aGraded - bGraded;
              return diff !== 0 ? diff : a.id.localeCompare(b.id);
            }
            const diff = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
            return diff !== 0 ? diff : a.id.localeCompare(b.id);
          });

          const start = (page - 1) * pageSize;
          const items = sorted.slice(start, start + pageSize).map((item) => ({
            id: item.id,
            activityId: item.activityId,
            activityTitle: item.activityTitle,
            activityType: item.activityType,
            studentId: item.studentId,
            studentDisplayName: item.studentDisplayName,
            submittedAt: item.submittedAt,
            isLate: item.isLate,
            status: item.grade ? ('graded' as const) : ('submitted' as const),
            fileCount: item.files.length,
            grade: item.grade
              ? {
                  id: item.grade.id,
                  graderId: item.grade.graderId,
                  score: item.grade.score,
                  feedback: item.grade.feedback,
                  pointsAwarded: item.grade.pointsAwarded,
                  version: item.grade.version,
                  gradedAt: item.grade.gradedAt,
                }
              : null,
          }));

          return HttpResponse.json({
            items,
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.get(`${baseUrl}/submissions/:submissionId`, ({ params }) => {
        counts.detail += 1;
        const failure = consumeFailure('detail');
        if (failure !== undefined) {
          return respondFailure(failure);
        }

        const submission = submissions.find(
          (item) =>
            item.id === params.submissionId &&
            item.classroomId === options.classroomId,
        );
        if (!submission || !staffRoles.has(currentRole)) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Submission not found.',
            correlationId: 'req-submission-detail-404',
          });
        }

        linkGeneration += 1;
        return HttpResponse.json(
          {
            id: submission.id,
            activityId: submission.activityId,
            submittedAt: submission.submittedAt,
            isLate: submission.isLate,
            status: submission.grade ? 'graded' : 'submitted',
            files: submission.files.map((file) => ({
              id: file.id,
              originalName: file.originalName,
              contentType: file.contentType,
              sizeBytes: file.sizeBytes,
              position: file.position,
              downloadUrl:
                file.downloadUrl ??
                `https://storage.example.invalid/signed/${submission.id}/${file.id}?sig=v${linkGeneration}`,
              downloadUrlExpiresAt:
                file.downloadUrlExpiresAt ?? '2026-11-19T18:00:00.000Z',
            })),
          },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }),
      http.get(`${baseUrl}/submissions/:submissionId/grade`, ({ params }) => {
        counts.getGrade += 1;
        const failure = consumeFailure('getGrade');
        if (failure !== undefined) {
          return respondFailure(failure);
        }

        const submission = submissions.find(
          (item) =>
            item.id === params.submissionId &&
            item.classroomId === options.classroomId,
        );
        if (!submission || !submission.grade) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Grade not found.',
            correlationId: 'req-grade-get-404',
          });
        }
        return HttpResponse.json({
          ...submission.grade,
          submissionId: submission.id,
          activityId: submission.activityId,
          studentId: submission.studentId,
        });
      }),
      http.post(
        `${baseUrl}/submissions/:submissionId/grade`,
        async ({ params, request }) => {
          counts.grade += 1;
          const failure = consumeFailure('grade');
          if (
            failure !== undefined &&
            failure !== 'drop-response' &&
            failure !== 'malformed-2xx'
          ) {
            return respondFailure(failure);
          }

          if (!staffRoles.has(currentRole)) {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Staff role required.',
              correlationId: 'req-grade-post-403',
            });
          }

          const submission = submissions.find(
            (item) =>
              item.id === params.submissionId &&
              item.classroomId === options.classroomId,
          );
          if (!submission) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Submission not found.',
              correlationId: 'req-grade-post-404',
            });
          }
          if (submission.activityFormat === 'MULTIPLE_CHOICE') {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message: 'Only file submissions can be graded manually.',
              details: [
                {
                  field: 'activity',
                  messages: ['Only file submissions can be graded manually'],
                },
              ],
              correlationId: 'req-grade-post-409-activity',
            });
          }
          if (submission.grade !== null || submission.studentActive === false) {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message: 'Submission cannot be graded.',
              details: [
                {
                  field: 'submission',
                  messages: ['Submission already graded or student inactive'],
                },
              ],
              correlationId: 'req-grade-post-409-submission',
            });
          }

          const body = (await request.json()) as {
            score?: unknown;
            feedback?: unknown;
          };
          const maxScore = submission.maxScore ?? 100;
          if (
            typeof body.score !== 'number' ||
            !Number.isInteger(body.score) ||
            body.score < 0 ||
            body.score > 100 ||
            body.score > maxScore
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid score.',
              details: [
                {
                  field: 'score',
                  messages: [
                    `Score must be an integer between 0 and ${maxScore}`,
                  ],
                },
              ],
              correlationId: 'req-grade-post-400-score',
            });
          }
          if (
            typeof body.feedback !== 'string' ||
            body.feedback.trim().length === 0 ||
            /[\p{Cc}\p{Zl}\p{Zp}]/u.test(body.feedback)
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid feedback.',
              details: [
                {
                  field: 'feedback',
                  messages: ['Feedback must be visible single-line text'],
                },
              ],
              correlationId: 'req-grade-post-400-feedback',
            });
          }

          gradeSequence += 1;
          const now = '2026-11-18T16:30:00.000Z';
          const nextGrade: GradingStoreGrade = {
            id: `00000000-0000-4000-8000-00000000${String(gradeSequence).padStart(4, '0')}`,
            graderId,
            score: body.score,
            feedback: body.feedback.trim(),
            pointsAwarded: computeServerPoints(
              body.score,
              submission.weightMultiplier ?? 1,
            ),
            pointTransactionId: `00000000-0000-4000-8000-10000000${String(gradeSequence).padStart(4, '0')}`,
            version: 1,
            gradedAt: now,
            createdAt: now,
            updatedAt: now,
          };

          submissions = submissions.map((item) =>
            item.id === submission.id ? { ...item, grade: nextGrade } : item,
          );

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }
          if (failure === 'malformed-2xx') {
            return HttpResponse.json({ broken: true }, { status: 201 });
          }

          return HttpResponse.json(
            {
              ...nextGrade,
              submissionId: submission.id,
              activityId: submission.activityId,
              studentId: submission.studentId,
            },
            { status: 201 },
          );
        },
      ),
      http.patch(
        `${baseUrl}/submissions/:submissionId/grade`,
        async ({ params, request }) => {
          counts.regrade += 1;
          const failure = consumeFailure('regrade');
          if (
            failure !== undefined &&
            failure !== 'drop-response' &&
            failure !== 'malformed-2xx'
          ) {
            return respondFailure(failure);
          }

          if (!staffRoles.has(currentRole)) {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Staff role required.',
              correlationId: 'req-grade-patch-403',
            });
          }

          const submission = submissions.find(
            (item) =>
              item.id === params.submissionId &&
              item.classroomId === options.classroomId,
          );
          if (!submission || !submission.grade) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Grade not found.',
              correlationId: 'req-grade-patch-404',
            });
          }
          if (submission.studentActive === false) {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message: 'Student is no longer active.',
              details: [
                {
                  field: 'submission',
                  messages: ['Student is no longer active in classroom'],
                },
              ],
              correlationId: 'req-grade-patch-409-submission',
            });
          }

          const body = (await request.json()) as {
            score?: unknown;
            feedback?: unknown;
            version?: unknown;
          };

          if (body.version !== submission.grade.version) {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message: 'Grade version mismatch.',
              details: [
                {
                  field: 'version',
                  messages: ['Grade was modified by another request'],
                },
              ],
              correlationId: 'req-grade-patch-409-version',
            });
          }

          const maxScore = submission.maxScore ?? 100;
          if (
            typeof body.score !== 'number' ||
            !Number.isInteger(body.score) ||
            body.score < 0 ||
            body.score > 100 ||
            (body.score !== submission.grade.score && body.score > maxScore)
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid score.',
              details: [
                {
                  field: 'score',
                  messages: [
                    `Score must be an integer between 0 and ${maxScore}`,
                  ],
                },
              ],
              correlationId: 'req-grade-patch-400-score',
            });
          }
          if (
            typeof body.feedback !== 'string' ||
            body.feedback.trim().length === 0 ||
            /[\p{Cc}\p{Zl}\p{Zp}]/u.test(body.feedback)
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid feedback.',
              details: [
                {
                  field: 'feedback',
                  messages: ['Feedback must be visible single-line text'],
                },
              ],
              correlationId: 'req-grade-patch-400-feedback',
            });
          }

          const trimmedFeedback = body.feedback.trim();
          const unchanged =
            body.score === submission.grade.score &&
            trimmedFeedback === submission.grade.feedback;

          const now = '2026-11-18T17:15:00.000Z';
          const nextGrade: GradingStoreGrade = unchanged
            ? submission.grade
            : {
                ...submission.grade,
                score: body.score,
                feedback: trimmedFeedback,
                pointsAwarded: computeServerPoints(
                  body.score,
                  submission.weightMultiplier ?? 1,
                ),
                version: submission.grade.version + 1,
                gradedAt: now,
                updatedAt: now,
              };

          submissions = submissions.map((item) =>
            item.id === submission.id ? { ...item, grade: nextGrade } : item,
          );

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }
          if (failure === 'malformed-2xx') {
            return HttpResponse.json({ broken: true }, { status: 200 });
          }

          return HttpResponse.json({
            ...nextGrade,
            submissionId: submission.id,
            activityId: submission.activityId,
            studentId: submission.studentId,
          });
        },
      ),
    ],
  };
}

export type ShopStoreItemKind =
  'CLASSROOM_ITEM' | 'AVATAR_ACCESSORY' | 'DESK_UPGRADE' | 'PET_ACCESSORY';

export interface ShopStoreCatalogItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly kind: ShopStoreItemKind;
  readonly price: number;
  readonly isImplemented: boolean;
  readonly ownedByStudent?: boolean;
  readonly ownedByClassroom?: boolean;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;
}

export interface ShopStorePurchase {
  readonly id: string;
  readonly classroomId: string;
  readonly studentId: string;
  readonly shopItemId: string;
  readonly shopItemCode: string;
  readonly shopItemName: string;
  readonly shopItemKind: ShopStoreItemKind;
  readonly pointTransactionId: string;
  readonly pricePaid: number;
  readonly createdAt: string;
}

export type ShopStoreOp = 'items' | 'purchases' | 'purchase' | 'wallet';

export type ShopStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response' | 'malformed-2xx';

export interface ClassroomShopStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId: string;
  readonly studentId?: string;
  readonly role?: string;
  readonly initialBalance?: number;
  readonly initialItems?: readonly ShopStoreCatalogItem[];
  readonly initialPurchases?: readonly ShopStorePurchase[];
  readonly purchaseDelayMs?: number;
}

export interface ClassroomShopStore {
  readonly handlers: readonly HttpHandler[];
  getBalance: () => number;
  setBalance: (balance: number) => void;
  setRole: (role: string) => void;
  removeItem: (shopItemId: string) => void;
  markOwnedExternally: (shopItemId: string) => void;
  failNext: (op: ShopStoreOp, failure: ShopStoreFailure) => void;
  getCounts: () => Record<ShopStoreOp, number>;
  getReceivedIdempotencyKeys: () => readonly string[];
}

/**
 * Stateful contract-faithful MSW store for classroom shop (`HU-GAM-003`,
 * backend `#34`) plus synchronized `GET /classrooms/:id/points` wallet view.
 */
export function createClassroomShopStore(
  options: ClassroomShopStoreOptions,
): ClassroomShopStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const studentId = options.studentId ?? '00000000-0000-4000-8000-000000007001';
  let currentRole = options.role ?? 'STUDENT';
  let balance = options.initialBalance ?? 250;
  let items: ShopStoreCatalogItem[] = [...(options.initialItems ?? [])];
  let purchases: ShopStorePurchase[] = [...(options.initialPurchases ?? [])];
  let purchaseSeq = 100;

  const idempotencyRecords = new Map<
    string,
    {
      readonly shopItemId: string;
      readonly purchase: ShopStorePurchase;
      readonly classroomItem: {
        readonly id: string;
        readonly classroomId: string;
        readonly shopItemId: string;
        readonly purchaseId: string;
        readonly state: 'ACTIVE';
        readonly createdAt: string;
      } | null;
      readonly balanceAfter: number;
    }
  >();

  const pending: Partial<Record<ShopStoreOp, ShopStoreFailure>> = {};
  const counts: Record<ShopStoreOp, number> = {
    items: 0,
    purchases: 0,
    purchase: 0,
    wallet: 0,
  };
  const receivedKeys: string[] = [];

  const consumeFailure = (op: ShopStoreOp): ShopStoreFailure | undefined => {
    const failure = pending[op];
    pending[op] = undefined;
    return failure;
  };

  const respondFailure = (failure: ShopStoreFailure): Response => {
    if (failure === 'network' || failure === 'drop-response') {
      return HttpResponse.error();
    }
    if (failure === 'malformed-2xx') {
      return HttpResponse.json({ broken: true }, { status: 200 });
    }
    return createErrorEnvelopeResponse(failure.status, failure.body);
  };

  const toCatalogDto = (item: ShopStoreCatalogItem) => {
    const ownedByStudent = Boolean(item.ownedByStudent);
    const ownedByClassroom = Boolean(item.ownedByClassroom);
    const isPurchasable =
      item.isImplemented &&
      !ownedByStudent &&
      !(item.kind === 'CLASSROOM_ITEM' && ownedByClassroom);
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      kind: item.kind,
      price: item.price,
      isImplemented: item.isImplemented,
      isPurchasable,
      ownedByStudent,
      ownedByClassroom,
      metadata: item.metadata ?? {},
      createdAt: item.createdAt,
    };
  };

  return {
    getBalance: () => balance,
    setBalance: (next) => {
      balance = Math.max(0, next);
    },
    setRole: (role) => {
      currentRole = role;
    },
    removeItem: (shopItemId) => {
      items = items.filter((item) => item.id !== shopItemId);
    },
    markOwnedExternally: (shopItemId) => {
      items = items.map((item) =>
        item.id === shopItemId
          ? {
              ...item,
              ownedByStudent: true,
              ownedByClassroom:
                item.kind === 'CLASSROOM_ITEM' ? true : item.ownedByClassroom,
            }
          : item,
      );
    },
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    getCounts: () => ({ ...counts }),
    getReceivedIdempotencyKeys: () => [...receivedKeys],
    handlers: [
      http.get(`${baseUrl}/classrooms/:id/points`, ({ params }) => {
        counts.wallet += 1;
        const failure = consumeFailure('wallet');
        if (failure !== undefined) {
          return respondFailure(failure);
        }
        if (String(params.id ?? '') !== options.classroomId) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Classroom not found.',
            correlationId: 'req-shop-wallet-404',
          });
        }
        if (currentRole !== 'STUDENT') {
          return createErrorEnvelopeResponse(403, {
            code: 'FORBIDDEN',
            message: 'Student role required.',
            correlationId: 'req-shop-wallet-403',
          });
        }
        return HttpResponse.json({
          classroomId: options.classroomId,
          studentId,
          balance,
          items: purchases.map((p) => ({
            id: p.pointTransactionId,
            entryKind: 'DEBIT',
            amount: -p.pricePaid,
            sourceType: 'SHOP_PURCHASE',
            sourceId: p.id,
            reason: `Compra en tienda: ${p.shopItemName}`,
            actorId: studentId,
            createdAt: p.createdAt,
          })),
          page: 1,
          pageSize: 20,
          total: purchases.length,
        });
      }),
      http.get(
        `${baseUrl}/classrooms/:id/shop/items`,
        ({ params, request }) => {
          counts.items += 1;
          const failure = consumeFailure('items');
          if (failure !== undefined) {
            return respondFailure(failure);
          }
          if (String(params.id ?? '') !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-shop-items-404',
            });
          }
          if (currentRole !== 'STUDENT') {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Student role required.',
              correlationId: 'req-shop-items-403',
            });
          }

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
          );
          const kind = url.searchParams.get('kind') ?? '';
          const sort = url.searchParams.get('sort') ?? 'createdAt';
          const allowedSorts = new Set([
            'createdAt',
            '-createdAt',
            'defaultPrice',
            '-defaultPrice',
            'name',
            '-name',
          ]);
          if (!allowedSorts.has(sort)) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid sort parameter.',
              details: [{ field: 'sort', messages: ['Invalid sort field'] }],
              correlationId: 'req-shop-items-400',
            });
          }

          let filtered = [...items];
          if (kind) {
            filtered = filtered.filter((item) => item.kind === kind);
          }

          const sorted = filtered.sort((a, b) => {
            if (sort === 'defaultPrice') {
              return a.price - b.price || a.id.localeCompare(b.id);
            }
            if (sort === '-defaultPrice') {
              return b.price - a.price || a.id.localeCompare(b.id);
            }
            if (sort === 'name') {
              return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
            }
            if (sort === '-name') {
              return b.name.localeCompare(a.name) || a.id.localeCompare(b.id);
            }
            if (sort === '-createdAt') {
              return (
                Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                a.id.localeCompare(b.id)
              );
            }
            return (
              Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
              a.id.localeCompare(b.id)
            );
          });

          const start = (page - 1) * pageSize;
          return HttpResponse.json({
            items: sorted.slice(start, start + pageSize).map(toCatalogDto),
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.get(
        `${baseUrl}/classrooms/:id/shop/purchases`,
        ({ params, request }) => {
          counts.purchases += 1;
          const failure = consumeFailure('purchases');
          if (failure !== undefined) {
            return respondFailure(failure);
          }
          if (String(params.id ?? '') !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-shop-purchases-404',
            });
          }
          if (currentRole !== 'STUDENT') {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Student role required.',
              correlationId: 'req-shop-purchases-403',
            });
          }

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
          );
          const sorted = [...purchases].sort(
            (a, b) =>
              Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
              a.id.localeCompare(b.id),
          );
          const start = (page - 1) * pageSize;
          return HttpResponse.json({
            items: sorted.slice(start, start + pageSize),
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.post(
        `${baseUrl}/classrooms/:id/shop/purchase`,
        async ({ params, request }) => {
          counts.purchase += 1;
          if (options.purchaseDelayMs) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.purchaseDelayMs),
            );
          }

          const key = request.headers.get('Idempotency-Key')?.trim() ?? '';
          if (key) {
            receivedKeys.push(key);
          }

          const failure = consumeFailure('purchase');
          if (
            failure !== undefined &&
            failure !== 'drop-response' &&
            failure !== 'malformed-2xx'
          ) {
            return respondFailure(failure);
          }

          if (String(params.id ?? '') !== options.classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-shop-purchase-404',
            });
          }
          if (currentRole !== 'STUDENT') {
            return createErrorEnvelopeResponse(403, {
              code: 'FORBIDDEN',
              message: 'Student role required.',
              correlationId: 'req-shop-purchase-403',
            });
          }
          if (!key || key.length > 128) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Idempotency-Key header is required.',
              details: [
                {
                  field: 'idempotency-key',
                  messages: ['Idempotency-Key header is required'],
                },
              ],
              correlationId: 'req-shop-purchase-400-key',
            });
          }

          const body = (await request.json()) as Record<string, unknown>;
          const extraKeys = Object.keys(body).filter((k) => k !== 'shopItemId');
          if (
            extraKeys.length > 0 ||
            typeof body.shopItemId !== 'string' ||
            body.shopItemId.trim().length === 0
          ) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'Invalid purchase payload.',
              details: [
                { field: 'shopItemId', messages: ['Invalid shopItemId'] },
              ],
              correlationId: 'req-shop-purchase-400-body',
            });
          }

          const shopItemId = body.shopItemId;
          const existingRecord = idempotencyRecords.get(key);
          if (existingRecord) {
            if (existingRecord.shopItemId !== shopItemId) {
              return createErrorEnvelopeResponse(409, {
                code: 'CONFLICT',
                message: 'Conflict.',
                correlationId: 'req-shop-purchase-409-key-mismatch',
              });
            }
            return HttpResponse.json(
              {
                purchase: existingRecord.purchase,
                classroomItem: existingRecord.classroomItem,
                balance,
                replayed: true,
              },
              { status: 200 },
            );
          }

          const item = items.find((entry) => entry.id === shopItemId);
          if (!item) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Item not found.',
              correlationId: 'req-shop-purchase-404-item',
            });
          }

          if (
            !item.isImplemented ||
            item.ownedByStudent ||
            (item.kind === 'CLASSROOM_ITEM' && item.ownedByClassroom) ||
            balance < item.price
          ) {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message: 'Conflict.',
              correlationId: 'req-shop-purchase-409',
            });
          }

          purchaseSeq += 1;
          const now = '2026-11-19T02:30:00.000Z';
          const purchaseId = `00000000-0000-4000-8000-20000000${String(purchaseSeq).padStart(4, '0')}`;
          const txId = `00000000-0000-4000-8000-30000000${String(purchaseSeq).padStart(4, '0')}`;

          balance -= item.price;
          items = items.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  ownedByStudent: true,
                  ownedByClassroom:
                    entry.kind === 'CLASSROOM_ITEM'
                      ? true
                      : entry.ownedByClassroom,
                }
              : entry,
          );

          const purchase: ShopStorePurchase = {
            id: purchaseId,
            classroomId: options.classroomId,
            studentId,
            shopItemId: item.id,
            shopItemCode: item.code,
            shopItemName: item.name,
            shopItemKind: item.kind,
            pointTransactionId: txId,
            pricePaid: item.price,
            createdAt: now,
          };
          purchases = [purchase, ...purchases];

          const classroomItem =
            item.kind === 'CLASSROOM_ITEM'
              ? {
                  id: `00000000-0000-4000-8000-40000000${String(purchaseSeq).padStart(4, '0')}`,
                  classroomId: options.classroomId,
                  shopItemId: item.id,
                  purchaseId,
                  state: 'ACTIVE' as const,
                  createdAt: now,
                }
              : null;

          idempotencyRecords.set(key, {
            shopItemId,
            purchase,
            classroomItem,
            balanceAfter: balance,
          });

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }
          if (failure === 'malformed-2xx') {
            return HttpResponse.json({ broken: true }, { status: 201 });
          }

          return HttpResponse.json(
            {
              purchase,
              classroomItem,
              balance,
              replayed: false,
            },
            { status: 201 },
          );
        },
      ),
    ],
  };
}

export const defaultHandlers: readonly HttpHandler[] = [
  createHealthHandler(),
  http.get(`${TEST_API_BASE_URL}/notifications`, () =>
    HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 }),
  ),
];

export type ReportCardItemPayload = components['schemas']['ReportCardItemDto'];
export type DailyMetricPayload = components['schemas']['DailyMetricDto'];
export type StudentMetricSummaryPayload =
  components['schemas']['StudentMetricSummaryDto'];

export interface CreateGradesHandlerOptions {
  readonly baseUrl?: string;
  readonly status?: number;
  readonly error?: ErrorBodyPayload;
  readonly response?: Record<string, unknown>;
  readonly onRequest?: (request: Request) => void | Promise<void>;
}

/** Synthetic `ErrorBody` matching the status, so failure tests stay valid. */
function syntheticGradesErrorBody(status: number): ErrorBodyPayload {
  if (status === 400) {
    return {
      code: 'BAD_REQUEST',
      message: 'Invalid pagination parameters.',
      correlationId: 'corr-grades-400',
    };
  }
  if (status === 401) {
    return {
      code: 'UNAUTHENTICATED',
      message: 'Missing or invalid session.',
      correlationId: 'corr-grades-401',
    };
  }
  if (status === 403) {
    return {
      code: 'FORBIDDEN',
      message:
        'Caller does not have the role this resource requires in this classroom.',
      correlationId: 'corr-grades-403',
    };
  }
  if (status === 404) {
    return {
      code: 'NOT_FOUND',
      message: 'Classroom not found.',
      correlationId: 'corr-grades-404',
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'Grades request failed.',
    correlationId: `corr-grades-${status}`,
  };
}

function readGradesPagination(url: URL): {
  page: number;
  pageSize: number;
  start: number;
} {
  const rawPage = url.searchParams.get('page');
  const rawPageSize = url.searchParams.get('pageSize');
  const parsedPage = rawPage === null ? 1 : Number(rawPage);
  const parsedPageSize = rawPageSize === null ? 20 : Number(rawPageSize);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const pageSize =
    Number.isInteger(parsedPageSize) && parsedPageSize >= 1
      ? Math.min(100, parsedPageSize)
      : 20;
  return { page, pageSize, start: (page - 1) * pageSize };
}

const REPORT_CARD_ITEMS: readonly ReportCardItemPayload[] = [
  {
    activityId: '00000000-0000-4000-8000-000000000601',
    activityTitle: 'Fracciones: guía de ejercicios',
    activityType: 'TP',
    maxScore: 100,
    score: 82,
    feedback: 'Muy buen trabajo. Repasá la simplificación de fracciones.',
    pointsAwarded: 41,
    isLate: false,
    submittedAt: '2026-11-10T12:00:00.000Z',
    gradedAt: '2026-11-12T15:30:00.000Z',
  },
  {
    activityId: '00000000-0000-4000-8000-000000000602',
    activityTitle: 'Examen de geometría',
    activityType: 'EXAM',
    maxScore: 100,
    score: 60,
    feedback: 'Entregado fuera de término. Repasá triángulos y perímetros.',
    pointsAwarded: 30,
    isLate: true,
    submittedAt: '2026-11-15T10:00:00.000Z',
    gradedAt: '2026-11-16T09:15:00.000Z',
  },
  {
    activityId: '00000000-0000-4000-8000-000000000603',
    activityTitle: 'Práctica de porcentajes',
    activityType: 'TP',
    maxScore: 50,
    score: 45,
    feedback: 'Excelente práctica.',
    pointsAwarded: 22,
    isLate: false,
    submittedAt: '2026-11-18T18:45:00.000Z',
    gradedAt: '2026-11-19T11:05:00.000Z',
  },
];

const DAILY_METRICS: readonly DailyMetricPayload[] = [
  {
    day: '2026-11-18',
    connectedSeconds: 4500,
    submissionCount: 1,
    messageCount: 3,
  },
  {
    day: '2026-11-17',
    connectedSeconds: 900,
    submissionCount: 0,
    messageCount: 0,
  },
  {
    day: '2026-11-16',
    connectedSeconds: 7200,
    submissionCount: 2,
    messageCount: 5,
  },
];

const STUDENT_METRIC_SUMMARIES: readonly StudentMetricSummaryPayload[] = [
  {
    studentId: '00000000-0000-4000-8000-000000000611',
    displayName: 'Ana Sánchez',
    connectedSeconds: 36_000,
    submissionCount: 12,
    messageCount: 27,
    gradedCount: 10,
    ungradedCount: 2,
  },
  {
    studentId: '00000000-0000-4000-8000-000000000612',
    displayName: 'Bruno Díaz',
    connectedSeconds: 5400,
    submissionCount: 3,
    messageCount: 0,
    gradedCount: 1,
    ungradedCount: 2,
  },
  {
    studentId: '00000000-0000-4000-8000-000000000613',
    displayName: 'Carolina Pérez',
    connectedSeconds: 12_960,
    submissionCount: 8,
    messageCount: 12,
    gradedCount: 8,
    ungradedCount: 0,
  },
];

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/me/report-card`
 * (`StudentMetricsController_reportCard`): the student's graded activities,
 * paginated and latest grading first. Works before the backend lands.
 */
export function createStudentReportCardHandler(
  classroomId: string,
  options: CreateGradesHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.get(
    `${baseUrl}/classrooms/${classroomId}/me/report-card`,
    async ({ request }) => {
      await options.onRequest?.(request);

      const status = options.status ?? 200;
      if (status >= 400) {
        return createErrorEnvelopeResponse(
          status,
          options.error ?? syntheticGradesErrorBody(status),
        );
      }

      const { page, pageSize, start } = readGradesPagination(
        new URL(request.url),
      );
      const payload = {
        items: REPORT_CARD_ITEMS.slice(start, start + pageSize),
        page,
        pageSize,
        total: REPORT_CARD_ITEMS.length,
        ...options.response,
      };
      return HttpResponse.json(payload, { status });
    },
  );
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/me/activity-metrics`
 * (`StudentMetricsController_myDailyMetrics`): the caller's own raw daily
 * metric rows, latest day first.
 */
export function createOwnDailyMetricsHandler(
  classroomId: string,
  options: CreateGradesHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.get(
    `${baseUrl}/classrooms/${classroomId}/me/activity-metrics`,
    async ({ request }) => {
      await options.onRequest?.(request);

      const status = options.status ?? 200;
      if (status >= 400) {
        return createErrorEnvelopeResponse(
          status,
          options.error ?? syntheticGradesErrorBody(status),
        );
      }

      const { page, pageSize, start } = readGradesPagination(
        new URL(request.url),
      );
      const payload = {
        items: DAILY_METRICS.slice(start, start + pageSize),
        page,
        pageSize,
        total: DAILY_METRICS.length,
        ...options.response,
      };
      return HttpResponse.json(payload, { status });
    },
  );
}

/**
 * Contract-faithful MSW handler for `GET /classrooms/{id}/activity-metrics`
 * (`ClassroomMetricsController_classroomMetrics`): raw per-student totals for
 * teaching staff, display name ascending.
 */
export function createClassroomMetricsHandler(
  classroomId: string,
  options: CreateGradesHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.get(
    `${baseUrl}/classrooms/${classroomId}/activity-metrics`,
    async ({ request }) => {
      await options.onRequest?.(request);

      const status = options.status ?? 200;
      if (status >= 400) {
        return createErrorEnvelopeResponse(
          status,
          options.error ?? syntheticGradesErrorBody(status),
        );
      }

      const { page, pageSize, start } = readGradesPagination(
        new URL(request.url),
      );
      const payload = {
        items: STUDENT_METRIC_SUMMARIES.slice(start, start + pageSize),
        page,
        pageSize,
        total: STUDENT_METRIC_SUMMARIES.length,
        ...options.response,
      };
      return HttpResponse.json(payload, { status });
    },
  );
}

export interface StreakBadgePayloadItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
  readonly unlockedAt: string | null;
}

export interface OwnStreakAndBadgesPayload {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastQualifiedDate: string | null;
  readonly badges: readonly StreakBadgePayloadItem[];
}

export interface CreateOwnStreakAndBadgesHandlerOptions {
  readonly baseUrl?: string;
  readonly payload?: OwnStreakAndBadgesPayload;
  readonly error?: MswErrorResponseSpec | 'network';
}

export const DEFAULT_STREAK_AND_BADGES_PAYLOAD: OwnStreakAndBadgesPayload = {
  currentStreak: 0,
  bestStreak: 0,
  lastQualifiedDate: null,
  badges: [],
};

/**
 * Contract-faithful MSW handler for `GET /users/me/streak-and-badges` (`HU-GAM-002`).
 */
export function createOwnStreakAndBadgesHandler(
  options: CreateOwnStreakAndBadgesHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const payload = options.payload ?? DEFAULT_STREAK_AND_BADGES_PAYLOAD;
  return http.get(`${baseUrl}/users/me/streak-and-badges`, () => {
    if (options.error === 'network') {
      return HttpResponse.error();
    }
    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }
    return HttpResponse.json(payload);
  });
}

export type BotStoreOp = 'status' | 'ask';

export interface BotStoreCitation {
  readonly materialId: string;
  readonly filename: string;
  readonly excerpt?: string | null;
}

export interface ClassroomBotStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId?: string;
  readonly initialAvailable?: boolean;
  readonly initialReason?:
    'exam_in_progress' | 'no_materials' | 'disabled' | null;
  readonly initialMessage?: string | null;
  readonly onAsk?: (question: string) =>
    | {
        readonly answer: string;
        readonly outcome?: 'answered' | 'out_of_scope' | 'guided_only';
        readonly citations?: readonly BotStoreCitation[];
      }
    | Promise<{
        readonly answer: string;
        readonly outcome?: 'answered' | 'out_of_scope' | 'guided_only';
        readonly citations?: readonly BotStoreCitation[];
      }>;
}

export interface ClassroomBotStore {
  readonly handlers: readonly HttpHandler[];
  setExamLocked(locked: boolean, message?: string | null): void;
  failNext(op: BotStoreOp, failure: MswErrorResponseSpec | 'network'): void;
}

/**
 * Stateful, contract-faithful MSW store for `HU-BOT-002` (`GET /bot/status`,
 * `POST /bot/messages`).
 */
export function createClassroomBotStore(
  options: ClassroomBotStoreOptions = {},
): ClassroomBotStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const classroomId =
    options.classroomId ?? '00000000-0000-4000-8000-000000000010';
  let available = options.initialAvailable ?? true;
  let reason: 'exam_in_progress' | 'no_materials' | 'disabled' | null =
    options.initialReason ?? null;
  let message: string | null = options.initialMessage ?? null;
  let seq = 1;
  const pending: Partial<Record<BotStoreOp, MswErrorResponseSpec | 'network'>> =
    {};

  const fail = (failure: MswErrorResponseSpec | 'network'): Response =>
    failure === 'network'
      ? HttpResponse.error()
      : createErrorEnvelopeResponse(failure.status, failure.body);

  return {
    setExamLocked(locked, nextMessage) {
      available = !locked;
      reason = locked ? 'exam_in_progress' : null;
      message = locked
        ? (nextMessage ??
          'El asistente está pausado porque tenés un examen en curso.')
        : null;
    },
    failNext(op, failure) {
      pending[op] = failure;
    },
    handlers: [
      http.get(`${baseUrl}/classrooms/:id/bot/status`, ({ params }) => {
        const failure = pending.status;
        pending.status = undefined;
        if (failure) {
          return fail(failure);
        }
        if (options.classroomId && params.id !== classroomId) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Classroom not found.',
            correlationId: 'req-bot-status-404',
          });
        }
        return HttpResponse.json({
          available,
          reason,
          message,
        });
      }),
      http.post(
        `${baseUrl}/classrooms/:id/bot/messages`,
        async ({ params, request }) => {
          const failure = pending.ask;
          pending.ask = undefined;
          if (failure) {
            return fail(failure);
          }
          if (options.classroomId && params.id !== classroomId) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Classroom not found.',
              correlationId: 'req-bot-ask-404',
            });
          }
          if (!available && reason === 'exam_in_progress') {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message:
                message ??
                'El asistente está pausado porque tenés un examen en curso.',
              correlationId: 'req-bot-exam-409',
            });
          }
          const body = (await request.json().catch(() => null)) as {
            question?: unknown;
          } | null;
          const question =
            typeof body?.question === 'string' ? body.question.trim() : '';
          if (!question) {
            return createErrorEnvelopeResponse(400, {
              code: 'VALIDATION_FAILED',
              message: 'question is required.',
              correlationId: 'req-bot-ask-400',
            });
          }
          const custom = options.onAsk ? await options.onAsk(question) : null;
          if (!available && reason === 'exam_in_progress') {
            return createErrorEnvelopeResponse(409, {
              code: 'CONFLICT',
              message:
                message ??
                'El asistente está pausado porque tenés un examen en curso.',
              correlationId: 'req-bot-exam-inflight-409',
            });
          }
          const id = `bot-msg-${seq}`;
          seq += 1;
          return HttpResponse.json({
            id,
            answer:
              custom?.answer ??
              'Revisá la definición de fracciones equivalentes en el apunte de la unidad.',
            outcome: custom?.outcome ?? 'answered',
            citations: custom?.citations ?? [
              {
                materialId: '00000000-0000-4000-8000-000000001001',
                filename: 'guia-unidad-1.pdf',
                excerpt:
                  'Dos fracciones son equivalentes cuando representan la misma parte.',
              },
            ],
            createdAt: '2026-11-19T02:25:00.000Z',
          });
        },
      ),
    ],
  };
}

export interface ForumStorePost {
  readonly id: string;
  readonly threadId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface ForumStoreThread {
  readonly id: string;
  readonly classroomId: string;
  readonly activityId: string;
  readonly authorId: string;
  readonly createdAt: string;
  readonly posts: readonly ForumStorePost[];
}

export interface ForumStoreMember {
  readonly id: string;
  readonly userId: string;
  readonly displayName: string;
  readonly role: 'TEACHER' | 'STUDENT';
}

export type ForumStoreOp =
  'listThreads' | 'createThread' | 'listPosts' | 'createPost' | 'members';

export type ForumStoreFailure =
  MswErrorResponseSpec | 'network' | 'drop-response' | 'malformed-2xx';

export interface ActivityForumStoreOptions {
  readonly baseUrl?: string;
  readonly classroomId: string;
  readonly activityId: string;
  readonly currentUserId?: string;
  readonly role?: 'TEACHER' | 'STUDENT' | 'PARENT';
  readonly adultMode?: boolean;
  readonly members?: readonly ForumStoreMember[];
  readonly initialThreads?: readonly ForumStoreThread[];
  readonly writeDelayMs?: number;
}

export interface ActivityForumStore {
  readonly handlers: readonly HttpHandler[];
  getThreads: () => readonly ForumStoreThread[];
  setRole: (role: 'TEACHER' | 'STUDENT' | 'PARENT') => void;
  setCurrentUserId: (userId: string) => void;
  failNext: (op: ForumStoreOp, failure: ForumStoreFailure) => void;
  getCounts: () => Record<ForumStoreOp, number>;
}

/**
 * Stateful contract-faithful MSW store for per-activity query forum
 * (`HU-COM-003`, backend `#39`) plus directory lookup (`GET /members`).
 */
export function createActivityForumStore(
  options: ActivityForumStoreOptions,
): ActivityForumStore {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  let currentUserId =
    options.currentUserId ?? '00000000-0000-4000-8000-000000007001';
  let currentRole = options.role ?? 'STUDENT';
  const adultMode = options.adultMode ?? false;
  let threads: ForumStoreThread[] = [...(options.initialThreads ?? [])];
  const members: ForumStoreMember[] = [...(options.members ?? [])];
  let seq = 100;

  const pending: Partial<Record<ForumStoreOp, ForumStoreFailure>> = {};
  const counts: Record<ForumStoreOp, number> = {
    listThreads: 0,
    createThread: 0,
    listPosts: 0,
    createPost: 0,
    members: 0,
  };

  const consumeFailure = (op: ForumStoreOp): ForumStoreFailure | undefined => {
    const failure = pending[op];
    pending[op] = undefined;
    return failure;
  };

  const respondFailure = (failure: ForumStoreFailure): Response => {
    if (failure === 'network' || failure === 'drop-response') {
      return HttpResponse.error();
    }
    if (failure === 'malformed-2xx') {
      return HttpResponse.json({ broken: true }, { status: 200 });
    }
    return createErrorEnvelopeResponse(failure.status, failure.body);
  };

  const checkAccess = (
    classroomId: string,
    activityId: string,
  ): Response | null => {
    if (
      classroomId !== options.classroomId ||
      activityId !== options.activityId
    ) {
      return createErrorEnvelopeResponse(404, {
        code: 'NOT_FOUND',
        message: 'Activity not found.',
        correlationId: 'req-forum-404',
      });
    }
    if (currentRole === 'PARENT') {
      if (adultMode) {
        return createErrorEnvelopeResponse(404, {
          code: 'NOT_FOUND',
          message: 'Activity not found.',
          correlationId: 'req-forum-parent-404',
        });
      }
      return createErrorEnvelopeResponse(403, {
        code: 'FORBIDDEN',
        message: 'Parents cannot access the activity forum.',
        correlationId: 'req-forum-parent-403',
      });
    }
    return null;
  };

  const validateForumBody = (
    raw: unknown,
  ): { ok: true; body: string } | { ok: false; response: Response } => {
    if (typeof raw !== 'string') {
      return {
        ok: false,
        response: createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Invalid body.',
          details: [{ field: 'body', messages: ['Body must be a string'] }],
          correlationId: 'req-forum-400',
        }),
      };
    }
    if (
      [...raw].some((char) => {
        const code = char.charCodeAt(0);
        return (
          (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
          (code >= 0x7f && code <= 0x9f)
        );
      })
    ) {
      return {
        ok: false,
        response: createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Invalid control characters.',
          details: [
            { field: 'body', messages: ['Disallowed control characters'] },
          ],
          correlationId: 'req-forum-400-ctrl',
        }),
      };
    }
    const trimmed = raw.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) {
      return {
        ok: false,
        response: createErrorEnvelopeResponse(400, {
          code: 'VALIDATION_FAILED',
          message: 'Invalid length.',
          details: [
            { field: 'body', messages: ['Length must be between 1 and 2000'] },
          ],
          correlationId: 'req-forum-400-len',
        }),
      };
    }
    return { ok: true, body: trimmed };
  };

  return {
    getThreads: () => threads,
    setRole: (role) => {
      currentRole = role;
    },
    setCurrentUserId: (userId) => {
      currentUserId = userId;
    },
    failNext: (op, failure) => {
      pending[op] = failure;
    },
    getCounts: () => ({ ...counts }),
    handlers: [
      http.get(`${baseUrl}/classrooms/:id/members`, ({ params }) => {
        counts.members += 1;
        const failure = consumeFailure('members');
        if (failure !== undefined) {
          return respondFailure(failure);
        }
        if (String(params.id ?? '') !== options.classroomId) {
          return createErrorEnvelopeResponse(404, {
            code: 'NOT_FOUND',
            message: 'Classroom not found.',
            correlationId: 'req-forum-members-404',
          });
        }
        if (currentRole === 'PARENT') {
          return createErrorEnvelopeResponse(403, {
            code: 'FORBIDDEN',
            message: 'Forbidden.',
            correlationId: 'req-forum-members-403',
          });
        }
        return HttpResponse.json({
          items: members,
          page: 1,
          pageSize: 100,
          total: members.length,
        });
      }),
      http.get(
        `${baseUrl}/classrooms/:id/activities/:activityId/forum/threads`,
        ({ params, request }) => {
          counts.listThreads += 1;
          const failure = consumeFailure('listThreads');
          if (failure !== undefined) {
            return respondFailure(failure);
          }

          const denied = checkAccess(
            String(params.id ?? ''),
            String(params.activityId ?? ''),
          );
          if (denied) return denied;

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
          );
          const sort = url.searchParams.get('sort') ?? '-createdAt';

          const sorted = [...threads].sort((a, b) => {
            const diff =
              sort === 'createdAt'
                ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
                : Date.parse(b.createdAt) - Date.parse(a.createdAt);
            return diff !== 0 ? diff : a.id.localeCompare(b.id);
          });

          const start = (page - 1) * pageSize;
          const items = sorted.slice(start, start + pageSize).map((t) => ({
            id: t.id,
            activityId: t.activityId,
            authorId: t.authorId,
            firstPostBody: t.posts[0]?.body ?? '',
            replyCount: Math.max(0, t.posts.length - 1),
            createdAt: t.createdAt,
          }));

          return HttpResponse.json({
            items,
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.post(
        `${baseUrl}/classrooms/:id/activities/:activityId/forum/threads`,
        async ({ params, request }) => {
          counts.createThread += 1;
          if (options.writeDelayMs) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.writeDelayMs),
            );
          }
          const failure = consumeFailure('createThread');
          if (
            failure !== undefined &&
            failure !== 'drop-response' &&
            failure !== 'malformed-2xx'
          ) {
            return respondFailure(failure);
          }

          const denied = checkAccess(
            String(params.id ?? ''),
            String(params.activityId ?? ''),
          );
          if (denied) return denied;

          const payload = (await request.json()) as { body?: unknown };
          const validated = validateForumBody(payload.body);
          if (!validated.ok) return validated.response;

          seq += 1;
          const now = new Date(
            Date.parse('2026-11-19T03:00:00.000Z') + seq * 1000,
          ).toISOString();
          const threadId = `00000000-0000-4000-8000-40000000${String(seq).padStart(4, '0')}`;
          const postId = `00000000-0000-4000-8000-50000000${String(seq).padStart(4, '0')}`;
          const post: ForumStorePost = {
            id: postId,
            threadId,
            authorId: currentUserId,
            body: validated.body,
            createdAt: now,
          };
          const created: ForumStoreThread = {
            id: threadId,
            classroomId: options.classroomId,
            activityId: options.activityId,
            authorId: currentUserId,
            createdAt: now,
            posts: [post],
          };
          threads = [created, ...threads];

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }
          if (failure === 'malformed-2xx') {
            return HttpResponse.json({ broken: true }, { status: 201 });
          }

          return HttpResponse.json(
            {
              id: created.id,
              activityId: created.activityId,
              authorId: created.authorId,
              posts: created.posts,
              createdAt: created.createdAt,
            },
            { status: 201 },
          );
        },
      ),
      http.get(
        `${baseUrl}/classrooms/:id/activities/:activityId/forum/threads/:threadId/posts`,
        ({ params, request }) => {
          counts.listPosts += 1;
          const failure = consumeFailure('listPosts');
          if (failure !== undefined) {
            return respondFailure(failure);
          }

          const denied = checkAccess(
            String(params.id ?? ''),
            String(params.activityId ?? ''),
          );
          if (denied) return denied;

          const thread = threads.find((t) => t.id === params.threadId);
          if (!thread) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Thread not found.',
              correlationId: 'req-forum-thread-404',
            });
          }

          const url = new URL(request.url);
          const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
          const pageSize = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('pageSize') ?? '20')),
          );
          const sort = url.searchParams.get('sort') ?? 'createdAt';

          const sorted = [...thread.posts].sort((a, b) => {
            const diff =
              sort === '-createdAt'
                ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
                : Date.parse(a.createdAt) - Date.parse(b.createdAt);
            return diff !== 0 ? diff : a.id.localeCompare(b.id);
          });

          const start = (page - 1) * pageSize;
          return HttpResponse.json({
            items: sorted.slice(start, start + pageSize),
            page,
            pageSize,
            total: sorted.length,
          });
        },
      ),
      http.post(
        `${baseUrl}/classrooms/:id/activities/:activityId/forum/threads/:threadId/posts`,
        async ({ params, request }) => {
          counts.createPost += 1;
          if (options.writeDelayMs) {
            await new Promise((resolve) =>
              setTimeout(resolve, options.writeDelayMs),
            );
          }
          const failure = consumeFailure('createPost');
          if (
            failure !== undefined &&
            failure !== 'drop-response' &&
            failure !== 'malformed-2xx'
          ) {
            return respondFailure(failure);
          }

          const denied = checkAccess(
            String(params.id ?? ''),
            String(params.activityId ?? ''),
          );
          if (denied) return denied;

          const thread = threads.find((t) => t.id === params.threadId);
          if (!thread) {
            return createErrorEnvelopeResponse(404, {
              code: 'NOT_FOUND',
              message: 'Thread not found.',
              correlationId: 'req-forum-thread-404',
            });
          }

          const payload = (await request.json()) as { body?: unknown };
          const validated = validateForumBody(payload.body);
          if (!validated.ok) return validated.response;

          seq += 1;
          const now = new Date(
            Date.parse('2026-11-19T03:00:00.000Z') + seq * 1000,
          ).toISOString();
          const post: ForumStorePost = {
            id: `00000000-0000-4000-8000-50000000${String(seq).padStart(4, '0')}`,
            threadId: thread.id,
            authorId: currentUserId,
            body: validated.body,
            createdAt: now,
          };
          threads = threads.map((t) =>
            t.id === thread.id ? { ...t, posts: [...t.posts, post] } : t,
          );

          if (failure === 'drop-response') {
            return HttpResponse.error();
          }
          if (failure === 'malformed-2xx') {
            return HttpResponse.json({ broken: true }, { status: 201 });
          }

          return HttpResponse.json(post, { status: 201 });
        },
      ),
    ],
  };
}

export interface DailyReviewPayloadItem {
  readonly kind:
    'pending_activity' | 'recent_grade' | 'announcement' | 'teacher_review';
  readonly title: string;
  readonly detail: string | null;
  readonly classroomName: string | null;
  readonly dueAt: string | null;
}

export interface DailyReviewPayloadSection {
  readonly kind: 'pending' | 'news';
  readonly items: readonly DailyReviewPayloadItem[];
}

export interface DailyReviewPayloadQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly options: readonly string[];
  readonly materialTitle: string | null;
}

export type DailyReviewPayload =
  | { readonly status: 'not_due' }
  | {
      readonly status: 'due';
      readonly audience: 'STUDENT' | 'TEACHER';
      readonly contentKind: 'generated' | 'structured';
      readonly summary: string | null;
      readonly sections: readonly DailyReviewPayloadSection[];
      readonly dailyQuestion: DailyReviewPayloadQuestion | null;
    };

export interface CreateDailyReviewHandlerOptions {
  readonly baseUrl?: string;
  readonly payload?: DailyReviewPayload;
  /** Models the persistent once-per-day delivery record: first call delivers, later calls answer `not_due`. */
  readonly deliverOnce?: boolean;
  readonly error?: MswErrorResponseSpec | 'network';
}

/**
 * Contract-faithful MSW handler for `GET /users/me/daily-review`
 * (`HU-BOT-003`). Eligibility is decided here, as the server would: parents,
 * reloads, and concurrent tabs receive `not_due` unless the payload says
 * otherwise.
 */
export function createDailyReviewHandler(
  options: CreateDailyReviewHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  const payload = options.payload ?? { status: 'not_due' as const };
  let delivered = false;
  return http.get(`${baseUrl}/users/me/daily-review`, () => {
    if (options.error === 'network') {
      return HttpResponse.error();
    }
    if (options.error) {
      return createErrorEnvelopeResponse(
        options.error.status,
        options.error.body,
      );
    }
    if (options.deliverOnce === true && delivered) {
      return HttpResponse.json({ status: 'not_due' });
    }
    delivered = true;
    return HttpResponse.json(payload);
  });
}

export interface DailyQuestionAnswerResultPayload {
  readonly correct: boolean;
  readonly feedback: string | null;
  readonly streak: {
    readonly currentStreak: number;
    readonly bestStreak: number;
    readonly lastQualifiedDate: string | null;
  } | null;
}

export interface CreateDailyQuestionAnswerHandlerOptions {
  readonly baseUrl?: string;
  readonly result?: DailyQuestionAnswerResultPayload;
  readonly onAnswer?: (body: { questionId: string; answer: string }) => void;
  readonly error?: MswErrorResponseSpec | 'network';
}

/**
 * Contract-faithful MSW handler for
 * `POST /users/me/daily-review/daily-question` (`HU-BOT-003`). The result and
 * the streak credit are decided here, as the server would.
 */
export function createDailyQuestionAnswerHandler(
  options: CreateDailyQuestionAnswerHandlerOptions = {},
): HttpHandler {
  const baseUrl = options.baseUrl ?? TEST_API_BASE_URL;
  return http.post(
    `${baseUrl}/users/me/daily-review/daily-question`,
    async ({ request }) => {
      if (options.error === 'network') {
        return HttpResponse.error();
      }
      if (options.error) {
        return createErrorEnvelopeResponse(
          options.error.status,
          options.error.body,
        );
      }
      const body = (await request.json()) as {
        questionId: string;
        answer: string;
      };
      options.onAnswer?.(body);
      return HttpResponse.json(
        options.result ?? { correct: false, feedback: null, streak: null },
      );
    },
  );
}
