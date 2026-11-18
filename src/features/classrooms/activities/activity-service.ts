import {
  requestApi,
  requestApiVoid,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { ClassroomActivitiesQueryParams } from '@/api/query-keys';
import { classroomMessages } from '../messages';
import {
  isAbortError,
  isUncertainWriteError,
  type ClassroomServiceOptions,
} from '../classroom-service';
import {
  paginatedClassroomActivitiesSchema,
  studentActivityResponseSchema,
  teacherActivityResponseSchema,
  type CreateActivityDto,
  type PaginatedClassroomActivitiesDto,
  type StudentActivityResponseDto,
  type TeacherActivityResponseDto,
  type UpdateActivityDto,
  type UpdateActivityPayload,
} from './activity-schema';

export { isAbortError, isUncertainWriteError };

export type ClassroomActivityView =
  | { readonly kind: 'teacher'; readonly activity: TeacherActivityResponseDto }
  | { readonly kind: 'student'; readonly activity: StudentActivityResponseDto };

type ActivityWriteOptions = ClassroomServiceOptions;

const uncertainWriteErrors = new WeakSet<ApiError>();

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
  if (baseError.kind === 'validation') {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.activities.write.validation,
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
        userMessage: classroomMessages.activities.write.uncertain,
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
        userMessage: classroomMessages.activities.write.uncertain,
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
        userMessage: classroomMessages.activities.write.uncertain,
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}

/**
 * Fetches paginated activities of one classroom (`GET /classrooms/{id}/activities`)
 * and validates the payload shape with a jitless Zod schema. Students always
 * receive published activities only, decided by the server.
 */
export async function listClassroomActivities(
  client: TypedApiClient,
  classroomId: string,
  params: ClassroomActivitiesQueryParams = {},
  options: ClassroomServiceOptions = {},
): Promise<PaginatedClassroomActivitiesDto> {
  const query: {
    page: number;
    pageSize: number;
    sort: 'dueAt' | 'createdAt' | '-dueAt' | '-createdAt';
    state?: 'DRAFT' | 'PUBLISHED';
  } = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sort: params.sort ?? 'dueAt',
  };
  if (params.state === 'DRAFT' || params.state === 'PUBLISHED') {
    query.state = params.state;
  }

  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/classrooms/{id}/activities', {
        params: { path: { id: classroomId }, query },
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
          userMessage: classroomMessages.activities.list.forbidden,
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
          userMessage: classroomMessages.activities.list.notFound,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
    }
    throw error;
  }

  const parsed = paginatedClassroomActivitiesSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: classroomMessages.activities.list.errorDescription,
    });
  }

  return parsed.data;
}

/**
 * Fetches one activity (`GET /classrooms/{id}/activities/{activityId}`).
 * The response shape is role-dependent: staff receive the teacher view with
 * correct answers, students receive the student view without them
 * (`ActivitiesController_get` in `schema.generated.ts`).
 */
export async function getClassroomActivity(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  options: ClassroomServiceOptions = {},
): Promise<ClassroomActivityView> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
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
          userMessage: classroomMessages.activities.detail.forbidden,
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
          userMessage: classroomMessages.activities.detail.notFound,
          details: error.details,
          fieldErrors: {},
          correlationId: error.correlationId,
        });
      }
    }
    throw error;
  }

  const teacherParsed = teacherActivityResponseSchema.safeParse(payload);
  if (teacherParsed.success) {
    return { kind: 'teacher', activity: teacherParsed.data };
  }

  const studentParsed = studentActivityResponseSchema.safeParse(payload);
  if (studentParsed.success) {
    return { kind: 'student', activity: studentParsed.data };
  }

  throw new ApiError({
    kind: 'unexpected',
    status: 200,
    code: null,
    userMessage: classroomMessages.activities.detail.errorDescription,
  });
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
      forbidden: classroomMessages.activities.write.forbidden,
      notFound: classroomMessages.activities.write.notFound,
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
      forbidden: classroomMessages.activities.write.forbidden,
      notFound: classroomMessages.activities.write.notFound,
      conflict: classroomMessages.activities.write.updateQuestionsLocked,
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
      forbidden: classroomMessages.activities.write.forbidden,
      notFound: classroomMessages.activities.write.notFound,
      badRequest: classroomMessages.activities.write.publishNotPublishable,
      conflict: classroomMessages.activities.write.publishAlreadyPublished,
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
        forbidden: classroomMessages.activities.write.forbidden,
        notFound: classroomMessages.activities.write.notFound,
        conflict: classroomMessages.activities.write.deactivateHasSubmissions,
      });
    }
    throw markUncertain(
      new ApiError({
        kind: 'network',
        status: null,
        code: null,
        userMessage: classroomMessages.activities.write.deactivateUnexpected,
        cause: error,
      }),
    );
  }
}
