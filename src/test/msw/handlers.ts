import { HttpResponse, http, type HttpHandler } from 'msw';
import type { components, operations } from '../../api/schema.generated';

export type HealthStatusPayload = components['schemas']['HealthStatus'];
export type ErrorBodyPayload = components['schemas']['ErrorBody'];
export type ErrorEnvelopePayload = components['schemas']['ErrorEnvelope'];

export type ClassroomDetailPayload =
  components['schemas']['ClassroomDetailResponseDto'];
export type ClassroomListItemPayload =
  components['schemas']['ClassroomListItemDto'];
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

export const defaultHandlers: readonly HttpHandler[] = [createHealthHandler()];
