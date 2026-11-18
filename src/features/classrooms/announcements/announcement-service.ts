import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import type { AnnouncementListQueryParams } from '@/api/query-keys';
import {
  announcementDtoSchema,
  paginatedAnnouncementListSchema,
  type AnnouncementDto,
  type CreateAnnouncementDto,
  type PaginatedAnnouncementListDto,
  type UpdateAnnouncementDto,
} from './announcement-schema';
import { announcementMessages } from './messages';

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === 'AbortError'
  );
}
export interface AnnouncementServiceOptions {
  readonly signal?: AbortSignal;
}

const uncertainAnnouncementErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when an announcement mutation failed with an outcome-uncertain
 * result (`5xx`, transport/network failure, or malformed `200`/`201`), meaning
 * the UI must reconcile the list against the server before retrying.
 */
export function isUncertainAnnouncementError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainAnnouncementErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainAnnouncementErrors.add(error);
  return error;
}

function translateMutationError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    const detailReason = baseError.details
      .flatMap((detail) => detail.messages)
      .join(' ')
      .trim();
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage:
        detailReason.length > 0
          ? detailReason
          : announcementMessages.form.serverErrors.validationFailed,
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
      userMessage: announcementMessages.form.serverErrors.forbidden,
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
      userMessage: announcementMessages.form.serverErrors.notFound,
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
        userMessage: announcementMessages.form.serverErrors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

function parseOrThrowUncertain<T>(
  schema: {
    safeParse: (
      input: unknown,
    ) => { success: true; data: T } | { success: false };
  },
  raw: unknown,
  status: number,
  message: string,
): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  throw markUncertain(
    new ApiError({
      kind: 'unexpected',
      status,
      code: null,
      userMessage: message,
    }),
  );
}

/**
 * Lists chronological announcements for a classroom (`GET /classrooms/{id}/announcements`).
 */
export async function listClassroomAnnouncements(
  client: TypedApiClient,
  classroomId: string,
  params: AnnouncementListQueryParams = {},
  options: AnnouncementServiceOptions = {},
): Promise<PaginatedAnnouncementListDto> {
  const raw = await requestApi(() =>
    client.GET('/classrooms/{id}/announcements', {
      params: {
        path: { id: classroomId },
        query: {
          page: params.page,
          pageSize: params.pageSize,
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedAnnouncementListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: announcementMessages.errorDescription,
    });
  }
  return parsed.data;
}

/**
 * Publishes a new classroom announcement (`POST /classrooms/{id}/announcements`).
 */
export async function createClassroomAnnouncement(
  client: TypedApiClient,
  classroomId: string,
  input: CreateAnnouncementDto,
  options: AnnouncementServiceOptions = {},
): Promise<AnnouncementDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.POST('/classrooms/{id}/announcements', {
        params: { path: { id: classroomId } },
        body: input,
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateMutationError(mapApiError(error));
  }

  return parseOrThrowUncertain(
    announcementDtoSchema,
    raw,
    201,
    announcementMessages.form.serverErrors.uncertain,
  );
}

/**
 * Updates an existing classroom announcement (`PATCH /classrooms/{id}/announcements/{announcementId}`).
 */
export async function updateClassroomAnnouncement(
  client: TypedApiClient,
  classroomId: string,
  announcementId: string,
  input: UpdateAnnouncementDto,
  options: AnnouncementServiceOptions = {},
): Promise<AnnouncementDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.PATCH('/classrooms/{id}/announcements/{announcementId}', {
        params: { path: { id: classroomId, announcementId } },
        body: input,
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateMutationError(mapApiError(error));
  }

  return parseOrThrowUncertain(
    announcementDtoSchema,
    raw,
    200,
    announcementMessages.form.serverErrors.uncertain,
  );
}

/**
 * Removes an announcement from the classroom notice board (`DELETE /classrooms/{id}/announcements/{announcementId}`).
 */
export async function removeClassroomAnnouncement(
  client: TypedApiClient,
  classroomId: string,
  announcementId: string,
  options: AnnouncementServiceOptions = {},
): Promise<void> {
  try {
    await requestApiVoid(() =>
      client.DELETE('/classrooms/{id}/announcements/{announcementId}', {
        params: { path: { id: classroomId, announcementId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateMutationError(mapApiError(error));
  }
}
