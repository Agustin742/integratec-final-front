import {
  requestApi,
  requestApiVoid,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { ActivityListQueryParams } from '@/api/query-keys';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../classroom-service';
import {
  activityDetailDtoSchema,
  paginatedActivityListSchema,
  teacherActivityResponseSchema,
  type ActivityDetailDto,
  type CreateActivityDto,
  type PaginatedActivityListDto,
  type TeacherActivityResponseDto,
  type UpdateActivityDto,
  type UpdateActivityPayload,
} from './activity-schema';
import { activityMessages } from './messages';

export { isAbortError };

export interface ActivityServiceOptions {
  readonly signal?: AbortSignal;
}

type ActivityWriteOptions = ClassroomServiceOptions;

const uncertainWriteErrors = new WeakSet<ApiError>();

/**
 * Type guard narrowing an `ActivityDetailDto` to the staff-only
 * `TeacherActivityResponseDto` (which carries `createdById` and `isCorrect`).
 */
export function isTeacherActivityDetail(
  activity: ActivityDetailDto,
): activity is TeacherActivityResponseDto {
  return 'createdById' in activity;
}

/**
 * Returns `true` when an activity write failed with an outcome-uncertain result
 * (`5xx`, transport/network failure, or malformed `2xx` payload), meaning the
 * caller must reconcile against the server before offering a retry
 * (`rules/error-handling-and-feedback.md`).
 */
export function isUncertainActivityWriteError(error: unknown): boolean {
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

/** Alias preserving caller imports from `activity-service`. */
export const isUncertainWriteError = isUncertainActivityWriteError;

function markUncertain(error: ApiError): ApiError {
  uncertainWriteErrors.add(error);
  return error;
}

interface ActivityWriteErrorMessages {
  readonly forbidden: string;
  readonly notFound: string;
  readonly conflict?: string;
  readonly badRequest?: string;
}

function translateActivityWriteError(
  baseError: ApiError,
  messages: ActivityWriteErrorMessages,
): ApiError {
  // Endpoints without form fields (such as `POST .../publish`) map any 400 —
  // including backend `400 VALIDATION_FAILED` with `details` — to their
  // endpoint-specific `badRequest` explanation before generic form validation.
  if (baseError.status === 400 && messages.badRequest !== undefined) {
    return new ApiError({
      kind: 'bad-request',
      status: baseError.status,
      code: baseError.code,
      userMessage: messages.badRequest,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'validation') {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: activityMessages.write.validation,
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
      userMessage: messages.forbidden,
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
      userMessage: messages.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.status === 409 && messages.conflict !== undefined) {
    return new ApiError({
      kind: 'conflict',
      status: baseError.status,
      code: baseError.code,
      userMessage: messages.conflict,
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
        userMessage: activityMessages.write.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

async function executeActivityWrite(
  execute: () => Promise<OpenApiFetchResult<TeacherActivityResponseDto>>,
  messages: ActivityWriteErrorMessages,
): Promise<TeacherActivityResponseDto> {
  let result: OpenApiFetchResult<TeacherActivityResponseDto>;

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
        userMessage: activityMessages.write.uncertain,
        details: networkError.details,
        fieldErrors: {},
        correlationId: networkError.correlationId,
        cause,
      }),
    );
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateActivityWriteError(
      mapApiError(result.error, result.response),
      messages,
    );
  }

  const parsed = teacherActivityResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: activityMessages.write.uncertain,
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}

/**
 * Lists classroom activities (`GET /classrooms/{id}/activities`) and validates
 * the response payload with a jitless Zod schema. Students always receive
 * published activities only, decided by the server.
 */
export async function listClassroomActivities(
  client: TypedApiClient,
  classroomId: string,
  params: ActivityListQueryParams = {},
  options: ActivityServiceOptions = {},
): Promise<PaginatedActivityListDto> {
  const query: {
    page?: number;
    pageSize?: number;
    sort?: 'dueAt' | 'createdAt' | '-dueAt' | '-createdAt';
    state?: 'DRAFT' | 'PUBLISHED';
  } = {
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
  };
  if (params.state === 'DRAFT' || params.state === 'PUBLISHED') {
    query.state = params.state;
  }

  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.GET('/classrooms/{id}/activities', {
        params: {
          path: { id: classroomId },
          query,
        },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      if (error.kind === 'forbidden' || error.status === 403) {
        throw new ApiError({
          kind: 'forbidden',
          status: error.status,
          code: error.code,
          userMessage: activityMessages.forbiddenDescription,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
      if (error.kind === 'not-found' || error.status === 404) {
        throw new ApiError({
          kind: 'not-found',
          status: error.status,
          code: error.code,
          userMessage: activityMessages.notFoundDescription,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
    }
    throw error;
  }

  const parsed = paginatedActivityListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: activityMessages.errorDescription,
    });
  }
  return parsed.data;
}

/**
 * Fetches one classroom activity detail (`GET /classrooms/{id}/activities/{activityId}`).
 * The response shape is role-dependent: staff receive `TeacherActivityResponseDto`
 * (including `createdById` and `isCorrect`), while students receive
 * `StudentActivityResponseDto` (never including `createdById` or `isCorrect`).
 */
export async function getClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  options: ActivityServiceOptions = {},
): Promise<ActivityDetailDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.GET('/classrooms/{id}/activities/{activityId}', {
        params: {
          path: { id: classroomId, activityId },
        },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      if (error.kind === 'forbidden' || error.status === 403) {
        throw new ApiError({
          kind: 'forbidden',
          status: error.status,
          code: error.code,
          userMessage: activityMessages.detail.forbiddenDescription,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
      if (error.kind === 'not-found' || error.status === 404) {
        throw new ApiError({
          kind: 'not-found',
          status: error.status,
          code: error.code,
          userMessage: activityMessages.detail.notFoundDescription,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
    }
    throw error;
  }

  const parsed = activityDetailDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: activityMessages.errorDescription,
    });
  }
  return parsed.data;
}

/**
 * Creates a draft activity (`POST /classrooms/{id}/activities`), separating
 * confirmed rejections (`400`/`403`/`404`) from outcome-uncertain failures.
 */
export function createClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  body: CreateActivityDto,
  options: ActivityWriteOptions = {},
): Promise<TeacherActivityResponseDto> {
  return executeActivityWrite(
    () =>
      client.POST('/classrooms/{id}/activities', {
        params: { path: { id: classroomId } },
        body,
        signal: options.signal,
      }),
    {
      forbidden: activityMessages.write.forbidden,
      notFound: activityMessages.write.notFound,
    },
  );
}

/**
 * Updates an activity (`PATCH /classrooms/{id}/activities/{activityId}`),
 * separating confirmed rejections from outcome-uncertain failures. A `409`
 * means the questions can no longer change because a submission exists.
 */
export function updateClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  body: UpdateActivityPayload,
  options: ActivityWriteOptions = {},
): Promise<TeacherActivityResponseDto> {
  return executeActivityWrite(
    () =>
      client.PATCH('/classrooms/{id}/activities/{activityId}', {
        params: { path: { id: classroomId, activityId } },
        body: body as UpdateActivityDto,
        signal: options.signal,
      }),
    {
      forbidden: activityMessages.write.forbidden,
      notFound: activityMessages.write.notFound,
      conflict: activityMessages.write.updateQuestionsLocked,
    },
  );
}

/**
 * Publishes a draft activity (`POST .../activities/{activityId}/publish`).
 * `400` means the activity is not publishable (past `dueAt` or invalid
 * questions) and `409` that it is already published.
 */
export function publishClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  options: ActivityWriteOptions = {},
): Promise<TeacherActivityResponseDto> {
  return executeActivityWrite(
    () =>
      client.POST('/classrooms/{id}/activities/{activityId}/publish', {
        params: { path: { id: classroomId, activityId } },
        signal: options.signal,
      }),
    {
      forbidden: activityMessages.write.forbidden,
      notFound: activityMessages.write.notFound,
      badRequest: activityMessages.write.publishNotPublishable,
      conflict: activityMessages.write.publishAlreadyPublished,
    },
  );
}

/**
 * Deactivates an activity (`DELETE /classrooms/{id}/activities/{activityId}`).
 * A `409` means the activity has submissions and cannot be deleted; the
 * refusal is explained instead of pretending the deletion is available.
 */
export async function deactivateClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  options: ActivityWriteOptions = {},
): Promise<void> {
  try {
    await requestApiVoid(() =>
      client.DELETE('/classrooms/{id}/activities/{activityId}', {
        params: { path: { id: classroomId, activityId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw translateActivityWriteError(error, {
        forbidden: activityMessages.write.forbidden,
        notFound: activityMessages.write.notFound,
        conflict: activityMessages.write.deactivateHasSubmissions,
      });
    }
    throw markUncertain(
      new ApiError({
        kind: 'network',
        status: null,
        code: null,
        userMessage: activityMessages.write.deactivateUnexpected,
        cause: error,
      }),
    );
  }
}
