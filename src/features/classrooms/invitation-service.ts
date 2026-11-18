import { z } from 'zod';
import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { ClassroomInvitationsQueryParams } from '@/api/query-keys';
import {
  isAbortError,
  isUncertainWriteError as isBaseUncertainWriteError,
  type ClassroomServiceOptions,
} from './classroom-service';
import {
  createdClassroomInvitationSchema,
  joinCodeResponseSchema,
  paginatedClassroomInvitationsSchema,
  revokeInvitationResponseSchema,
  revokeJoinCodeResponseSchema,
  type ClassroomInvitationDto,
  type CreateClassroomInvitationDto,
  type CreateJoinCodeDto,
  type CreatedClassroomInvitationDto,
  type JoinCodeDto,
  type PaginatedClassroomInvitationsDto,
  type RevokeInvitationResponseDto,
  type RevokeJoinCodeResponseDto,
} from './invitation-schema';
import { classroomMessages } from './messages';

export { isAbortError };
export type { ClassroomInvitationDto };

const uncertainInvitationWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when an invitation or join-code write failed with an
 * outcome-uncertain result (`5xx`, transport/network failure, or malformed
 * `2xx` payload), meaning the caller must reconcile against the server.
 */
export function isUncertainWriteError(error: unknown): boolean {
  if (error instanceof ApiError && uncertainInvitationWriteErrors.has(error)) {
    return true;
  }
  return isBaseUncertainWriteError(error);
}

function markUncertain(error: ApiError): ApiError {
  uncertainInvitationWriteErrors.add(error);
  return error;
}

async function executeValidatedWrite<TOutput>(
  execute: () => Promise<OpenApiFetchResult<unknown>>,
  schema: z.ZodType<TOutput, unknown>,
  translateError: (baseError: ApiError) => ApiError,
  uncertainMessage: string,
): Promise<TOutput> {
  let result: OpenApiFetchResult<unknown>;

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
        userMessage: uncertainMessage,
        details: networkError.details,
        fieldErrors: {},
        correlationId: networkError.correlationId,
        cause,
      }),
    );
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateError(mapApiError(result.error, result.response));
  }

  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: uncertainMessage,
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}

function translateCreateInvitationError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: baseError.kind === 'validation' ? 'validation' : 'bad-request',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.invitations.email.errors.validationFailed,
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
      userMessage: classroomMessages.invitations.email.errors.forbidden,
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
      userMessage: classroomMessages.invitations.email.errors.notFound,
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
        userMessage: classroomMessages.invitations.email.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return new ApiError({
    kind: baseError.kind,
    status: baseError.status,
    code: baseError.code,
    userMessage: classroomMessages.invitations.email.errors.unexpected,
    details: baseError.details,
    fieldErrors: {},
    correlationId: baseError.correlationId,
  });
}

function translateRevokeInvitationError(baseError: ApiError): ApiError {
  if (
    baseError.kind === 'bad-request' ||
    baseError.kind === 'validation' ||
    baseError.status === 400
  ) {
    return new ApiError({
      kind: 'bad-request',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.invitations.list.revokeBadRequest,
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
      userMessage: classroomMessages.invitations.list.revokeForbidden,
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
      userMessage: classroomMessages.invitations.list.revokeNotFound,
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
        userMessage: classroomMessages.invitations.list.revokeUncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return new ApiError({
    kind: baseError.kind,
    status: baseError.status,
    code: baseError.code,
    userMessage: classroomMessages.invitations.list.revokeUnexpected,
    details: baseError.details,
    fieldErrors: {},
    correlationId: baseError.correlationId,
  });
}

function translateGenerateJoinCodeError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: baseError.kind === 'validation' ? 'validation' : 'bad-request',
      status: baseError.status,
      code: baseError.code,
      userMessage:
        classroomMessages.invitations.joinCode.errors.validationFailed,
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
      userMessage: classroomMessages.invitations.joinCode.errors.forbidden,
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
      userMessage:
        classroomMessages.invitations.joinCode.errors.notFoundGenerate,
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
        userMessage: classroomMessages.invitations.joinCode.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return new ApiError({
    kind: baseError.kind,
    status: baseError.status,
    code: baseError.code,
    userMessage: classroomMessages.invitations.joinCode.errors.unexpected,
    details: baseError.details,
    fieldErrors: {},
    correlationId: baseError.correlationId,
  });
}

function translateRevokeJoinCodeError(baseError: ApiError): ApiError {
  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: classroomMessages.invitations.joinCode.errors.forbidden,
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
      userMessage: classroomMessages.invitations.joinCode.errors.notFoundRevoke,
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
        userMessage: classroomMessages.invitations.joinCode.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return new ApiError({
    kind: baseError.kind,
    status: baseError.status,
    code: baseError.code,
    userMessage: classroomMessages.invitations.joinCode.errors.unexpected,
    details: baseError.details,
    fieldErrors: {},
    correlationId: baseError.correlationId,
  });
}

/**
 * Fetches paginated invitations for one classroom (`GET /classrooms/{id}/invitations`)
 * and validates the payload shape with a jitless Zod schema.
 */
export async function listClassroomInvitations(
  client: TypedApiClient,
  classroomId: string,
  params: ClassroomInvitationsQueryParams = {},
  options: ClassroomServiceOptions = {},
): Promise<PaginatedClassroomInvitationsDto> {
  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/invitations', {
      params: {
        path: { id: classroomId },
        query: {
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          status: params.status ?? 'PENDING',
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedClassroomInvitationsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: classroomMessages.invitations.list.errorDescription,
    });
  }

  return parsed.data;
}

/**
 * Issues a single-use `STUDENT` email invitation (`POST /classrooms/{id}/invitations`),
 * returning the one-time raw token on `201`. Never reveals account existence.
 */
export function createClassroomInvitation(
  client: TypedApiClient,
  classroomId: string,
  email: string,
  options: ClassroomServiceOptions = {},
): Promise<CreatedClassroomInvitationDto> {
  const body: CreateClassroomInvitationDto = {
    email,
    role: 'STUDENT',
  };

  return executeValidatedWrite(
    () =>
      client.POST('/classrooms/{id}/invitations', {
        params: { path: { id: classroomId } },
        body,
        signal: options.signal,
      }),
    createdClassroomInvitationSchema,
    translateCreateInvitationError,
    classroomMessages.invitations.email.errors.uncertain,
  );
}

/**
 * Revokes an active pending invitation (`DELETE /classrooms/{id}/invitations/{invitationId}`).
 */
export function revokeClassroomInvitation(
  client: TypedApiClient,
  classroomId: string,
  invitationId: string,
  options: ClassroomServiceOptions = {},
): Promise<RevokeInvitationResponseDto> {
  return executeValidatedWrite(
    () =>
      client.DELETE('/classrooms/{id}/invitations/{invitationId}', {
        params: { path: { id: classroomId, invitationId } },
        signal: options.signal,
      }),
    revokeInvitationResponseSchema,
    translateRevokeInvitationError,
    classroomMessages.invitations.list.revokeUncertain,
  );
}

/**
 * Generates or regenerates the classroom's student join code (`POST /classrooms/{id}/join-code`).
 * The raw code is returned only once; any prior active code is revoked on the server.
 */
export function generateClassroomJoinCode(
  client: TypedApiClient,
  classroomId: string,
  body: CreateJoinCodeDto = {},
  options: ClassroomServiceOptions = {},
): Promise<JoinCodeDto> {
  return executeValidatedWrite(
    () =>
      client.POST('/classrooms/{id}/join-code', {
        params: { path: { id: classroomId } },
        body,
        signal: options.signal,
      }),
    joinCodeResponseSchema,
    translateGenerateJoinCodeError,
    classroomMessages.invitations.joinCode.errors.uncertain,
  );
}

/**
 * Revokes the current active join code for a classroom (`DELETE /classrooms/{id}/join-code`).
 */
export function revokeClassroomJoinCode(
  client: TypedApiClient,
  classroomId: string,
  options: ClassroomServiceOptions = {},
): Promise<RevokeJoinCodeResponseDto> {
  return executeValidatedWrite(
    () =>
      client.DELETE('/classrooms/{id}/join-code', {
        params: { path: { id: classroomId } },
        signal: options.signal,
      }),
    revokeJoinCodeResponseSchema,
    translateRevokeJoinCodeError,
    classroomMessages.invitations.joinCode.errors.uncertain,
  );
}
