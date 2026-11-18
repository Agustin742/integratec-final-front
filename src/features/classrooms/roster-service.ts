import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { ClassroomRosterQueryParams } from '@/api/query-keys';
import {
  isAbortError,
  isUncertainWriteError,
  type ClassroomServiceOptions,
} from './classroom-service';
import { classroomMessages } from './messages';
import {
  ROSTER_SEARCH_MAX_LENGTH,
  paginatedClassroomRosterSchema,
  type PaginatedClassroomRosterDto,
} from './roster-schema';

export { isAbortError, isUncertainWriteError };

function translateRemovalError(error: ApiError): ApiError {
  if (error.kind === 'forbidden' || error.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: error.status,
      code: error.code,
      userMessage: classroomMessages.roster.removeForbidden,
      details: error.details,
      fieldErrors: {},
      correlationId: error.correlationId,
      cause: error,
    });
  }

  if (error.kind === 'not-found' || error.status === 404) {
    return new ApiError({
      kind: 'not-found',
      status: error.status,
      code: error.code,
      userMessage: classroomMessages.roster.removeNotFound,
      details: error.details,
      fieldErrors: {},
      correlationId: error.correlationId,
      cause: error,
    });
  }

  if (
    isUncertainWriteError(error) ||
    error.code === 'INTERNAL_ERROR' ||
    error.code === 'SERVICE_UNAVAILABLE'
  ) {
    return new ApiError({
      kind: error.kind,
      status: error.status,
      code: error.code,
      userMessage: classroomMessages.roster.removeUncertain,
      details: error.details,
      fieldErrors: {},
      correlationId: error.correlationId,
      cause: error,
    });
  }

  return new ApiError({
    kind: error.kind,
    status: error.status,
    code: error.code,
    userMessage: classroomMessages.roster.removeUnexpected,
    details: error.details,
    fieldErrors: {},
    correlationId: error.correlationId,
    cause: error,
  });
}

/**
 * Fetches paginated students for one classroom (`GET /classrooms/{id}/roster`)
 * and validates the payload shape with a jitless Zod schema.
 */
export async function listClassroomRoster(
  client: TypedApiClient,
  classroomId: string,
  params: ClassroomRosterQueryParams = {},
  options: ClassroomServiceOptions = {},
): Promise<PaginatedClassroomRosterDto> {
  const trimmedSearch = params.q?.trim().slice(0, ROSTER_SEARCH_MAX_LENGTH);
  const query: {
    page: number;
    pageSize: number;
    state?: 'ACTIVE' | 'INACTIVE';
    q?: string;
  } = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  };
  if (params.state === 'ACTIVE' || params.state === 'INACTIVE') {
    query.state = params.state;
  }
  if (trimmedSearch !== undefined && trimmedSearch.length > 0) {
    query.q = trimmedSearch;
  }

  const payload: unknown = await requestApi(() =>
    client.GET('/classrooms/{id}/roster', {
      params: {
        path: { id: classroomId },
        query,
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedClassroomRosterSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: classroomMessages.roster.errorDescription,
    });
  }

  return parsed.data;
}

/**
 * Logically removes a student's membership (`DELETE /classrooms/{id}/students/{studentId}`)
 * preserving academic history on the server. Note that `studentUserId` is
 * `RosterStudentDto.userId`, not `membershipId`.
 */
export async function removeClassroomStudent(
  client: TypedApiClient,
  classroomId: string,
  studentUserId: string,
  options: ClassroomServiceOptions = {},
): Promise<void> {
  try {
    await requestApiVoid(() =>
      client.DELETE('/classrooms/{id}/students/{studentId}', {
        params: {
          path: { id: classroomId, studentId: studentUserId },
        },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw translateRemovalError(error);
    }
    throw new ApiError({
      kind: 'network',
      status: null,
      code: null,
      userMessage: classroomMessages.roster.removeUncertain,
      cause: error,
    });
  }
}
