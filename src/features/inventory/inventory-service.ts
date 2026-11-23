import {
  requestApi,
  type OpenApiFetchResult,
  type TypedApiClient,
} from '@/api/client';
import { ApiError, mapApiError, mapNetworkError } from '@/api/errors';
import { isAbortError } from '../classrooms/classroom-service';
import { inventoryMessages } from './inventory-messages';
import {
  equipmentStateDtoSchema,
  type EquipmentStateDto,
  type EquippedSlotName,
} from './inventory-schema';

export { isAbortError };

export interface InventoryServiceOptions {
  readonly signal?: AbortSignal;
}

const uncertainEquipmentWriteErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when an equipment write failed with an outcome-uncertain
 * result (`5xx`, network/transport error, or malformed `2xx` payload), meaning
 * the UI should reconcile with authoritative server state (`rules/avatars-and-customization.md`).
 */
export function isUncertainEquipmentError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainEquipmentWriteErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainEquipmentWriteErrors.add(error);
  return error;
}

function translateEquipmentError(
  baseError: ApiError,
  context: 'read' | 'write',
): ApiError {
  if (baseError.kind === 'validation' || baseError.status === 400) {
    return new ApiError({
      kind: 'validation',
      status: baseError.status,
      code: baseError.code,
      userMessage: inventoryMessages.errors.validation,
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
      userMessage: inventoryMessages.errors.sessionExpired,
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
      userMessage:
        context === 'read'
          ? inventoryMessages.errors.loadForbidden
          : inventoryMessages.errors.notOwned,
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
      userMessage: inventoryMessages.errors.notFound,
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
      userMessage: inventoryMessages.errors.conflict,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (baseError.kind === 'rate-limited' || baseError.status === 429) {
    return new ApiError({
      kind: 'rate-limited',
      status: baseError.status,
      code: baseError.code,
      userMessage: inventoryMessages.errors.rateLimited,
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
        userMessage: inventoryMessages.errors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

/**
 * `GET /classrooms/{id}/me/equipment` (`EquipmentController_getEquipment`).
 * Returns the authenticated student's current equipment state for the classroom.
 */
export async function getEquipment(
  client: TypedApiClient,
  classroomId: string,
  options: InventoryServiceOptions = {},
): Promise<EquipmentStateDto> {
  let data: unknown;
  try {
    data = await requestApi(() =>
      client.GET('/classrooms/{id}/me/equipment', {
        params: { path: { id: classroomId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw translateEquipmentError(error, 'read');
    }
    throw translateEquipmentError(mapNetworkError(error), 'read');
  }

  const parsed = equipmentStateDtoSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: inventoryMessages.errors.invalidResponse,
      details: [],
      fieldErrors: {},
      correlationId: null,
    });
  }

  return parsed.data;
}

export interface SetEquipmentSlotInput {
  readonly slot: EquippedSlotName;
  readonly shopItemId: string | null;
}

/**
 * `PUT /classrooms/{id}/me/equipment/{slot}` (`EquipmentController_setSlot`).
 * Equips or unequips a slot. `shopItemId: null` unequips. Returns the full
 * updated equipment state. Throws a translated `ApiError` on failure.
 */
export async function setEquipmentSlot(
  client: TypedApiClient,
  classroomId: string,
  input: SetEquipmentSlotInput,
  options: InventoryServiceOptions = {},
): Promise<EquipmentStateDto> {
  let result: OpenApiFetchResult<unknown>;

  try {
    result = await client.PUT('/classrooms/{id}/me/equipment/{slot}', {
      params: {
        path: { id: classroomId, slot: input.slot },
      },
      body: { shopItemId: input.shopItemId },
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw translateEquipmentError(mapNetworkError(error), 'write');
  }

  if (result.error !== undefined || !result.response.ok) {
    const baseError = mapApiError(result.error, result.response);
    throw translateEquipmentError(baseError, 'write');
  }

  const parsed = equipmentStateDtoSchema.safeParse(result.data);
  if (!parsed.success) {
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: result.response.status,
        code: null,
        userMessage: inventoryMessages.errors.invalidResponse,
        details: [],
        fieldErrors: {},
        correlationId:
          result.response.headers?.get('x-request-id')?.trim() ?? null,
      }),
    );
  }

  return parsed.data;
}
