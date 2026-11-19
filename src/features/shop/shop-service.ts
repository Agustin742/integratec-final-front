import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import type {
  ShopItemsQueryParams,
  ShopPurchasesQueryParams,
} from '@/api/query-keys';
import {
  isAbortError,
  type ClassroomServiceOptions,
} from '../classrooms/classroom-service';
import { shopMessages } from './messages';
import {
  paginatedShopItemsSchema,
  paginatedShopPurchasesSchema,
  purchaseResponseDtoSchema,
  type PaginatedShopItemsDto,
  type PaginatedShopPurchasesDto,
  type PurchaseResponseDto,
} from './shop-schema';

export { isAbortError };

export type ShopServiceOptions = ClassroomServiceOptions;

const uncertainShopWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a shop purchase write failed with an outcome-uncertain
 * result (`5xx`, transport/network error, or malformed `2xx` payload), meaning
 * the caller MUST preserve the `Idempotency-Key` and reconcile against the
 * server before offering a retry (`rules/points-and-shop.md`).
 */
export function isUncertainShopWriteError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainShopWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainShopWriteErrors.add(error);
  return error;
}

/**
 * Generates an opaque per-attempt `Idempotency-Key` (`1..128` chars) held only
 * in React memory (never persisted to storage).
 */
export function createPurchaseIdempotencyKey(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function translatePurchaseWriteError(baseError: ApiError): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: shopMessages.errors.validation,
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
      userMessage: shopMessages.errors.sessionExpired,
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
      userMessage: shopMessages.errors.forbidden,
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
      userMessage: shopMessages.errors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.status === 409) {
    return new ApiError({
      kind: 'conflict',
      status: baseError.status,
      code: baseError.code,
      userMessage: shopMessages.errors.conflictGeneric,
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
      userMessage: shopMessages.errors.rateLimited,
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
        userMessage: shopMessages.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

/**
 * `GET /classrooms/{id}/shop/items` (`ShopController_listItems`).
 * Enrolled active students only; returns paginated active catalog items with
 * server-resolved price, ownership, and purchasability.
 */
export async function listShopItems(
  client: TypedApiClient,
  classroomId: string,
  params: ShopItemsQueryParams = {},
  options: ShopServiceOptions = {},
): Promise<PaginatedShopItemsDto> {
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/shop/items', {
      params: {
        path: { id: classroomId },
        query: {
          ...(params.page !== undefined ? { page: params.page } : {}),
          ...(params.pageSize !== undefined
            ? { pageSize: params.pageSize }
            : {}),
          ...(params.sort !== undefined ? { sort: params.sort } : {}),
          ...(params.kind !== undefined ? { kind: params.kind } : {}),
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedShopItemsSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: shopMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

/**
 * `GET /classrooms/{id}/shop/purchases` (`ShopController_listPurchases`).
 * Enrolled active students only; returns authenticated student's confirmed
 * purchases in the classroom.
 */
export async function listShopPurchases(
  client: TypedApiClient,
  classroomId: string,
  params: ShopPurchasesQueryParams = {},
  options: ShopServiceOptions = {},
): Promise<PaginatedShopPurchasesDto> {
  const data = await requestApi(() =>
    client.GET('/classrooms/{id}/shop/purchases', {
      params: {
        path: { id: classroomId },
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

  const parsed = paginatedShopPurchasesSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: shopMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

export interface PurchaseShopItemInput {
  readonly shopItemId: string;
  readonly idempotencyKey: string;
}

/**
 * `POST /classrooms/{id}/shop/purchase` (`ShopController_purchase`).
 * Sends ONLY `{ shopItemId }` in the request body and passes the per-attempt
 * `Idempotency-Key` header. Accepts both `201 Created` (fresh purchase) and
 * `200 OK` (idempotent replay, `replayed: true`).
 */
export async function purchaseShopItem(
  client: TypedApiClient,
  classroomId: string,
  input: PurchaseShopItemInput,
  options: ShopServiceOptions = {},
): Promise<PurchaseResponseDto> {
  const trimmedKey = input.idempotencyKey.trim();
  let result: OpenApiFetchResult<unknown>;

  try {
    result = await client.POST('/classrooms/{id}/shop/purchase', {
      params: {
        path: { id: classroomId },
        header: { 'Idempotency-Key': trimmedKey },
      },
      body: {
        shopItemId: input.shopItemId,
      },
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translatePurchaseWriteError(mapNetworkError(error));
  }

  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    throw translatePurchaseWriteError(baseError);
  }

  const parsed = purchaseResponseDtoSchema.safeParse(result.data);
  if (!parsed.success) {
    const headerCorrelationId =
      result.response.headers?.get('x-request-id')?.trim() || null;
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: shopMessages.errors.uncertain,
        details: [],
        fieldErrors: {},
        correlationId: headerCorrelationId,
      }),
    );
  }

  return parsed.data;
}
