import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { GradingQueueQueryParams } from '@/api/query-keys';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../classroom-service';
import { gradingMessages } from './grading-messages';
import {
  gradeResponseDtoSchema,
  gradingQueueResponseSchema,
  submissionDownloadResponseSchema,
  type GradeResponseDto,
  type GradeSubmissionPayload,
  type GradingQueueResponseDto,
  type RegradeSubmissionPayload,
  type SubmissionDownloadResponseDto,
} from './grading-schema';

export { isAbortError };

export type GradingServiceOptions = ClassroomServiceOptions;

export type GradingConflictKind =
  'version' | 'submission' | 'activity' | 'generic';

const uncertainGradingWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a grade/regrade write failed with an outcome-uncertain
 * result (`5xx`, transport/network error, or malformed `2xx` payload), meaning
 * the caller must preserve the draft and reconcile against the server before
 * claiming success or retrying (`rules/error-handling-and-feedback.md`).
 */
export function isUncertainGradingWriteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainGradingWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainGradingWriteErrors.add(error);
  return error;
}

/**
 * Classifies backend `409 CONFLICT` responses using `ErrorEnvelope.details`
 * (`field: 'version' | 'submission' | 'activity'`).
 */
export function getGradingConflictKind(
  error: unknown,
): GradingConflictKind | null {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return null;
  }
  const fields = new Set(
    error.details.map((detail) => detail.field.trim().toLowerCase()),
  );
  if (fields.has('version')) {
    return 'version';
  }
  if (fields.has('submission')) {
    return 'submission';
  }
  if (fields.has('activity')) {
    return 'activity';
  }
  return 'generic';
}

function translateGradingWriteError(
  baseError: ApiError,
  mode: 'grade' | 'regrade',
): ApiError {
  if (baseError.kind === 'validation') {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: gradingMessages.errors.validation,
      details: baseError.details,
      fieldErrors: baseError.fieldErrors,
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'unauthenticated' || baseError.status === 401) {
    return new ApiError({
      kind: 'unauthenticated',
      status: baseError.status,
      code: baseError.code,
      userMessage: gradingMessages.errors.sessionExpired,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: gradingMessages.errors.forbidden,
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
      userMessage: gradingMessages.errors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.status === 409) {
    const conflictKind = getGradingConflictKind(baseError) ?? 'generic';
    let userMessage: string = gradingMessages.errors.conflictGeneric;
    if (conflictKind === 'version') {
      userMessage = gradingMessages.errors.conflictVersion;
    } else if (conflictKind === 'submission') {
      userMessage =
        mode === 'grade'
          ? gradingMessages.errors.conflictAlreadyGradedOrInactive
          : gradingMessages.errors.conflictStudentInactive;
    } else if (conflictKind === 'activity') {
      userMessage = gradingMessages.errors.conflictNotGradable;
    }
    return new ApiError({
      kind: 'conflict',
      status: baseError.status,
      code: baseError.code,
      userMessage,
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
        userMessage: gradingMessages.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

async function executeGradingWrite(
  run: () => Promise<OpenApiFetchResult<unknown>>,
  mode: 'grade' | 'regrade',
): Promise<GradeResponseDto> {
  let result: OpenApiFetchResult<unknown>;
  try {
    result = await run();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateGradingWriteError(mapNetworkError(error), mode);
  }

  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    throw translateGradingWriteError(baseError, mode);
  }

  const parsed = gradeResponseDtoSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: gradingMessages.errors.uncertain,
        details: [],
        fieldErrors: {},
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}

/**
 * `GET /classrooms/{id}/submissions` (`ClassroomSubmissionsController_list`).
 * Classroom staff only; paginated grading queue filterable by activity/state.
 */
export async function listClassroomSubmissions(
  client: TypedApiClient,
  classroomId: string,
  params: GradingQueueQueryParams = {},
  options: GradingServiceOptions = {},
): Promise<GradingQueueResponseDto> {
  const trimmedActivityId = params.activityId?.trim();
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/submissions', {
      params: {
        path: { id: classroomId },
        query: {
          ...(params.page !== undefined ? { page: params.page } : {}),
          ...(params.pageSize !== undefined
            ? { pageSize: params.pageSize }
            : {}),
          ...(trimmedActivityId ? { activityId: trimmedActivityId } : {}),
          ...(params.state !== undefined ? { state: params.state } : {}),
          ...(params.sort !== undefined ? { sort: params.sort } : {}),
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = gradingQueueResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: gradingMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `GET /submissions/{submissionId}` (`SubmissionReadController_readById`).
 * Returns submission metadata and short-lived signed file download URLs.
 * Callers MUST NOT persist or cache signed URLs beyond immediate viewing.
 */
export async function getSubmissionDetail(
  client: TypedApiClient,
  submissionId: string,
  options: GradingServiceOptions = {},
): Promise<SubmissionDownloadResponseDto> {
  const data = await requestApi(() =>
    client.GET('/submissions/{submissionId}', {
      params: { path: { submissionId } },
      signal: options.signal,
    }),
  );

  const parsed = submissionDownloadResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: gradingMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `GET /submissions/{submissionId}/grade` (`SubmissionGradesController_getGrade`).
 * Used to refresh the authoritative confirmed grade + optimistic `version`
 * (e.g., on `409` version conflict or uncertain-write reconciliation).
 */
export async function getSubmissionGrade(
  client: TypedApiClient,
  submissionId: string,
  options: GradingServiceOptions = {},
): Promise<GradeResponseDto> {
  const data = await requestApi(() =>
    client.GET('/submissions/{submissionId}/grade', {
      params: { path: { submissionId } },
      signal: options.signal,
    }),
  );

  const parsed = gradeResponseDtoSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: gradingMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `POST /submissions/{submissionId}/grade` (`SubmissionGradesController_grade`).
 */
export async function gradeSubmission(
  client: TypedApiClient,
  submissionId: string,
  payload: GradeSubmissionPayload,
  options: GradingServiceOptions = {},
): Promise<GradeResponseDto> {
  return executeGradingWrite(
    () =>
      client.POST('/submissions/{submissionId}/grade', {
        params: { path: { submissionId } },
        body: {
          score: payload.score,
          feedback: payload.feedback,
        },
        signal: options.signal,
      }),
    'grade',
  );
}

/**
 * `PATCH /submissions/{submissionId}/grade` (`SubmissionGradesController_regrade`).
 */
export async function regradeSubmission(
  client: TypedApiClient,
  submissionId: string,
  payload: RegradeSubmissionPayload,
  options: GradingServiceOptions = {},
): Promise<GradeResponseDto> {
  return executeGradingWrite(
    () =>
      client.PATCH('/submissions/{submissionId}/grade', {
        params: { path: { submissionId } },
        body: {
          score: payload.score,
          feedback: payload.feedback,
          version: payload.version,
        },
        signal: options.signal,
      }),
    'regrade',
  );
}
