import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type {
  ClassroomDirectoryQueryParams,
  ForumListQueryParams,
} from '@/api/query-keys';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../../classroom-service';
import { forumMessages } from './forum-messages';
import {
  forumPostDtoSchema,
  forumThreadDetailDtoSchema,
  paginatedClassroomDirectorySchema,
  paginatedForumPostsSchema,
  paginatedForumThreadsSchema,
  type ForumPostDto,
  type ForumThreadDetailDto,
  type PaginatedClassroomDirectoryDto,
  type PaginatedForumPostsDto,
  type PaginatedForumThreadsDto,
} from './forum-schema';

export { isAbortError };

export type ForumServiceOptions = ClassroomServiceOptions;

const uncertainForumWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a forum write failed with an outcome-uncertain result
 * (`5xx`, transport/network error, or malformed `2xx` payload), meaning the
 * caller must preserve the draft and reconcile threads/posts against the
 * server before offering a retry (`rules/communication-and-notifications.md`).
 */
export function isUncertainForumWriteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainForumWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainForumWriteErrors.add(error);
  return error;
}

function translateForumWriteError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: forumMessages.errors.validation,
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
      userMessage: forumMessages.errors.sessionExpired,
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
      userMessage: forumMessages.errors.forbidden,
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
      userMessage: forumMessages.errors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.status === 429 || baseError.kind === 'rate-limited') {
    return new ApiError({
      kind: 'rate-limited',
      status: baseError.status,
      code: baseError.code,
      userMessage: forumMessages.errors.rateLimited,
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
        userMessage: forumMessages.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

async function executeForumWrite<T>(
  run: () => Promise<OpenApiFetchResult<unknown>>,
  parse: (data: unknown) => T | null,
): Promise<T> {
  let result: OpenApiFetchResult<unknown>;
  try {
    result = await run();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateForumWriteError(mapNetworkError(error));
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateForumWriteError(mapApiError(result.error, result.response));
  }

  const parsed = parse(result.data);
  if (parsed === null) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: forumMessages.errors.uncertain,
        details: [],
        fieldErrors: {},
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed;
}

/**
 * `GET /classrooms/{id}/activities/{activityId}/forum/threads`
 * (`ActivityForumController_listThreads`).
 */
export async function listActivityForumThreads(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  params: ForumListQueryParams = {},
  options: ForumServiceOptions = {},
): Promise<PaginatedForumThreadsDto> {
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/activities/{activityId}/forum/threads', {
      params: {
        path: { id: classroomId, activityId },
        query: {
          ...(params.page !== undefined ? { page: params.page } : {}),
          ...(params.pageSize !== undefined
            ? { pageSize: params.pageSize }
            : {}),
          ...(params.sort !== undefined ? { sort: params.sort } : {}),
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedForumThreadsSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: forumMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `POST /classrooms/{id}/activities/{activityId}/forum/threads`
 * (`ActivityForumController_createThread`).
 */
export async function createActivityForumThread(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  body: string,
  options: ForumServiceOptions = {},
): Promise<ForumThreadDetailDto> {
  return executeForumWrite(
    () =>
      client.POST('/classrooms/{id}/activities/{activityId}/forum/threads', {
        params: { path: { id: classroomId, activityId } },
        body: { body },
        signal: options.signal,
      }),
    (data) => {
      const parsed = forumThreadDetailDtoSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
  );
}

/**
 * `GET /classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts`
 * (`ActivityForumController_listPosts`).
 */
export async function listActivityForumPosts(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  threadId: string,
  params: ForumListQueryParams = {},
  options: ForumServiceOptions = {},
): Promise<PaginatedForumPostsDto> {
  const data = await requestApi(() =>
    client.GET(
      '/classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts',
      {
        params: {
          path: { id: classroomId, activityId, threadId },
          query: {
            ...(params.page !== undefined ? { page: params.page } : {}),
            ...(params.pageSize !== undefined
              ? { pageSize: params.pageSize }
              : {}),
            ...(params.sort !== undefined ? { sort: params.sort } : {}),
          },
        },
        signal: options.signal,
      },
    ),
  );

  const parsed = paginatedForumPostsSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: forumMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `POST /classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts`
 * (`ActivityForumController_createPost`).
 */
export async function createActivityForumPost(
  client: TypedApiClient,
  classroomId: string,
  activityId: string,
  threadId: string,
  body: string,
  options: ForumServiceOptions = {},
): Promise<ForumPostDto> {
  return executeForumWrite(
    () =>
      client.POST(
        '/classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts',
        {
          params: { path: { id: classroomId, activityId, threadId } },
          body: { body },
          signal: options.signal,
        },
      ),
    (data) => {
      const parsed = forumPostDtoSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
  );
}

/**
 * `GET /classrooms/{id}/members` (`ClassroomDirectoryController_list`).
 * Optional directory lookup to display member names and role badges without
 * falling back to guesses when absent or unauthorized.
 */
export async function listClassroomDirectoryMembers(
  client: TypedApiClient,
  classroomId: string,
  params: ClassroomDirectoryQueryParams = {},
  options: ForumServiceOptions = {},
): Promise<PaginatedClassroomDirectoryDto> {
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/members', {
      params: {
        path: { id: classroomId },
        query: {
          ...(params.page !== undefined ? { page: params.page } : {}),
          ...(params.pageSize !== undefined
            ? { pageSize: params.pageSize }
            : {}),
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedClassroomDirectorySchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: forumMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}
