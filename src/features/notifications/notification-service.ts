import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import type { NotificationListQueryParams } from '@/api/query-keys';
import { notificationMessages } from './messages';
import {
  dedupeAndSortNotifications,
  notificationDtoSchema,
  notificationsReadResultSchema,
  paginatedNotificationListSchema,
  type NotificationDto,
  type NotificationsReadResultDto,
  type PaginatedNotificationListDto,
} from './notification-schema';

export interface NotificationServiceOptions {
  readonly signal?: AbortSignal;
}

const uncertainNotificationErrors = new WeakSet<ApiError>();

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === 'AbortError'
  );
}

/**
 * Returns `true` when a read-state mutation failed with an outcome-uncertain
 * result (`5xx`, transport/network failure, or malformed `200`).
 */
export function isUncertainNotificationError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainNotificationErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainNotificationErrors.add(error);
  return error;
}

function translateReadError(baseError: ApiError): ApiError {
  if (baseError.kind === 'not-found' || baseError.status === 404) {
    return new ApiError({
      kind: 'not-found',
      status: baseError.status,
      code: baseError.code,
      userMessage: notificationMessages.notFoundDescription,
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
        userMessage: notificationMessages.actionUncertainDescription,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

/**
 * Lists notifications for the authenticated user (`GET /notifications`).
 */
export async function listNotifications(
  client: TypedApiClient,
  params: NotificationListQueryParams = {},
  options: NotificationServiceOptions = {},
): Promise<PaginatedNotificationListDto> {
  const raw = await requestApi(() =>
    client.GET('/notifications', {
      params: {
        query: {
          page: params.page,
          pageSize: params.pageSize,
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedNotificationListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 200,
      code: null,
      userMessage: notificationMessages.errorDescription,
    });
  }

  return {
    ...parsed.data,
    items: dedupeAndSortNotifications(parsed.data.items),
  };
}

/**
 * Marks one accessible notification as read (`PATCH /notifications/{id}/read`).
 */
export async function markNotificationRead(
  client: TypedApiClient,
  notificationId: string,
  options: NotificationServiceOptions = {},
): Promise<NotificationDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.PATCH('/notifications/{id}/read', {
        params: { path: { id: notificationId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateReadError(mapApiError(error));
  }

  const parsed = notificationDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: 200,
        code: null,
        userMessage: notificationMessages.actionUncertainDescription,
      }),
    );
  }
  return parsed.data;
}

/**
 * Marks all currently accessible notifications as read (`PATCH /notifications/read-all`).
 */
export async function markAllNotificationsRead(
  client: TypedApiClient,
  options: NotificationServiceOptions = {},
): Promise<NotificationsReadResultDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.PATCH('/notifications/read-all', {
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateReadError(mapApiError(error));
  }

  const parsed = notificationsReadResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: 200,
        code: null,
        userMessage: notificationMessages.actionUncertainDescription,
      }),
    );
  }
  return parsed.data;
}
