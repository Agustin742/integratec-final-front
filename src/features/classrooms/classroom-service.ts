import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { ClassroomListQueryParams } from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import {
  classroomDetailResponseSchema,
  paginatedClassroomListSchema,
  type ClassroomDetailResponseDto,
  type CreateClassroomDto,
  type PaginatedClassroomListDto,
  type UpdateClassroomPayload,
} from './classroom-schema';
import { classroomMessages } from './messages';

export interface ClassroomServiceOptions {
  readonly signal?: AbortSignal;
}

const uncertainWriteErrors = new WeakSet<ApiError>();

const isAbortError = (cause: unknown): boolean =>
  (cause instanceof Error || cause instanceof DOMException) &&
  cause.name === 'AbortError';

/**
 * Returns `true` when a classroom write failed with an outcome-uncertain result
 * (`5xx`, transport/network failure, or malformed `2xx` payload), meaning the
 * caller must reconcile against the server before offering a retry.
 */
export function isUncertainWriteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainWriteErrors.add(error);
  return error;
}

function translateClassroomWriteError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation') {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.form.errors.validationFailed,
      details: baseError.details,
      fieldErrors: baseError.fieldErrors,
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.form.errors.forbidden,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'not-found' || baseError.status === 404) {
    return new ApiError({
      kind: 'not-found',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.form.errors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (
    baseError.kind === 'network' ||
    (baseError.status !== null && baseError.status >= 500) ||
    baseError.code === 'INTERNAL_ERROR' ||
    baseError.code === 'SERVICE_UNAVAILABLE'
  ) {
    return markUncertain(
      new ApiError({
        kind: baseError.kind,
        status: baseError.status,
        code: baseError.code,
        userMessage: classroomMessages.form.errors.uncertainWrite,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

async function executeClassroomWrite(
  execute: () => Promise<OpenApiFetchResult<ClassroomDetailResponseDto>>,
): Promise<ClassroomDetailResponseDto> {
  let result: OpenApiFetchResult<ClassroomDetailResponseDto>;

  try {
    result = await execute();
  } catch (cause) {
    if (isAbortError(cause)) {
      throw cause;
    }
    const networkError = mapNetworkError(cause);
    throw markUncertain(
      new ApiError({
        kind: 'network',
        status: networkError.status,
        code: networkError.code,
        userMessage: classroomMessages.form.errors.uncertainWrite,
        details: networkError.details,
        fieldErrors: {},
        correlationId: networkError.correlationId,
        cause,
      }),
    );
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateClassroomWriteError(
      mapApiError(result.error, result.response),
    );
  }

  const parsed = classroomDetailResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: classroomMessages.form.errors.uncertainWrite,
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}

/**
 * Fetches paginated classrooms accessible to the authenticated user via
 * `GET /me/classrooms` and validates server ownership invariants.
 */
export async function listAccessibleClassrooms(
  client: TypedApiClient,
  params: ClassroomListQueryParams = {},
  options: ClassroomServiceOptions = {},
): Promise<PaginatedClassroomListDto> {
  const payload: unknown = await requestApi(() =>
    client.GET('/me/classrooms', {
      params: {
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          sort: params.sort ?? '-createdAt',
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedClassroomListSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: classroomMessages.list.errorDescription,
    });
  }

  return parsed.data;
}

/**
 * Creates a classroom via `POST /classrooms`, separating confirmed rejections
 * (`400`/`403`/`404`) from outcome-uncertain failures (`5xx`/network/malformed `201`).
 */
export function createClassroom(
  client: TypedApiClient,
  body: CreateClassroomDto,
  options: ClassroomServiceOptions = {},
): Promise<ClassroomDetailResponseDto> {
  return executeClassroomWrite(() =>
    client.POST('/classrooms', {
      body,
      signal: options.signal,
    }),
  );
}

/**
 * Updates classroom configuration via `PATCH /classrooms/{id}`, separating confirmed
 * rejections (`400`/`403`/`404`) from outcome-uncertain failures.
 */
export function updateClassroom(
  client: TypedApiClient,
  classroomId: string,
  body: UpdateClassroomPayload,
  options: ClassroomServiceOptions = {},
): Promise<ClassroomDetailResponseDto> {
  // Generated `UpdateClassroomDto['subject']` emits `Record<string, never> | null`
  // due to Swagger `nullable: true`; adapt narrowly at the integration boundary.
  const requestBody = body as components['schemas']['UpdateClassroomDto'];
  return executeClassroomWrite(() =>
    client.PATCH('/classrooms/{id}', {
      params: { path: { id: classroomId } },
      body: requestBody,
      signal: options.signal,
    }),
  );
}
