import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type { ChatHistoryQueryParams } from '@/api/query-keys';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../classroom-service';
import { chatMessages } from './chat-messages';
import {
  chatMessageDtoSchema,
  paginatedChatHistorySchema,
  type ChatMessageDto,
  type PaginatedChatHistoryDto,
} from './chat-schema';

export { isAbortError };

export type ChatServiceOptions = ClassroomServiceOptions;

const uncertainChatWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a chat write (send or moderation hide) failed with an
 * outcome-uncertain result (`5xx`, transport/network error, malformed `2xx`
 * payload, or a non-`204` hide response), meaning the caller must preserve the
 * draft and reconcile the history against the server before offering a retry
 * (`rules/error-handling-and-feedback.md`).
 * Definite rejections (`400`, `401`, `403`, `404`, `429`) return `false`.
 */
export function isUncertainChatWriteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainChatWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainChatWriteErrors.add(error);
  return error;
}

function translateChatWriteError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: chatMessages.errors.validation,
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
      userMessage: chatMessages.errors.sessionExpired,
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
      userMessage: chatMessages.errors.forbidden,
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
      userMessage: chatMessages.errors.notFound,
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
      userMessage: chatMessages.errors.rateLimited,
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
        userMessage: chatMessages.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

async function executeChatWrite<T>(
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
    throw translateChatWriteError(mapNetworkError(error));
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateChatWriteError(mapApiError(result.error, result.response));
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
        userMessage: chatMessages.errors.uncertain,
        details: [],
        fieldErrors: {},
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed;
}

/**
 * `GET /classrooms/{id}/messages` (`ChatController_list`).
 * Contract-fixed order: latest first (`createdAt DESC`, `id DESC`). Students
 * receive only visible rows; staff keep hidden rows with their moderation
 * audit. `total` counts the caller's visible rows across all pages.
 */
export async function listClassroomChatHistory(
  client: TypedApiClient,
  classroomId: string,
  params: ChatHistoryQueryParams = {},
  options: ChatServiceOptions = {},
): Promise<PaginatedChatHistoryDto> {
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/messages', {
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

  const parsed = paginatedChatHistorySchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: chatMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `POST /classrooms/{id}/messages` (`ChatController_send`).
 * Only `body` is sent; the server assigns the author, creation instant and
 * resolved mentions, and commits them atomically. A `429` means the rolling
 * send limit was hit (definite rejection, not an uncertain write).
 */
export async function sendClassroomChatMessage(
  client: TypedApiClient,
  classroomId: string,
  body: string,
  options: ChatServiceOptions = {},
): Promise<ChatMessageDto> {
  return executeChatWrite(
    () =>
      client.POST('/classrooms/{id}/messages', {
        params: { path: { id: classroomId } },
        body: { body },
        signal: options.signal,
      }),
    (data) => {
      const parsed = chatMessageDtoSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
  );
}

/**
 * `DELETE /classrooms/{id}/messages/{messageId}` (`ChatController_hide`).
 * Staff-only logical moderation: the server records the `hiddenAt`/`hiddenById`
 * audit pair atomically and never deletes the row; repeating the moderation
 * stays idempotent (`204` without overwriting the original audit).
 */
export async function hideClassroomChatMessage(
  client: TypedApiClient,
  classroomId: string,
  messageId: string,
  options: ChatServiceOptions = {},
): Promise<void> {
  let result: OpenApiFetchResult<unknown>;
  try {
    result = await client.DELETE('/classrooms/{id}/messages/{messageId}', {
      params: { path: { id: classroomId, messageId } },
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateChatWriteError(mapNetworkError(error));
  }

  if (result.error !== undefined || !result.response.ok) {
    throw translateChatWriteError(mapApiError(result.error, result.response));
  }

  if (result.response.status !== 204) {
    // The contract promises `204 No Content`; any other 2xx means the
    // moderation outcome cannot be confirmed from this response.
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: chatMessages.errors.uncertain,
        details: [],
        fieldErrors: {},
        correlationId: headerCorrelationId,
      }),
    );
  }
}
