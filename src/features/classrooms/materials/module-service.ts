import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import {
  materialModuleDtoSchema,
  materialModuleListSchema,
  type MaterialModuleDto,
  type MaterialModuleListDto,
} from './module-schema';
import { materialMessages } from './messages';

export interface ModuleServiceOptions {
  readonly signal?: AbortSignal;
}

function invalidResponse(): ApiError {
  return mapApiError(undefined, new Response(null, { status: 502 }));
}

function parseList(payload: unknown): MaterialModuleListDto {
  const parsed = materialModuleListSchema.safeParse(payload);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

function parseModule(payload: unknown): MaterialModuleDto {
  const parsed = materialModuleDtoSchema.safeParse(payload);
  if (!parsed.success) throw invalidResponse();
  return parsed.data;
}

/** Reads the ordered modules of a classroom with their file counts. */
export async function listMaterialModules(
  client: TypedApiClient,
  classroomId: string,
  options: ModuleServiceOptions = {},
): Promise<MaterialModuleListDto> {
  const payload = await requestApi(() =>
    client.GET('/classrooms/{id}/material-modules', {
      params: { path: { id: classroomId } },
      signal: options.signal,
    }),
  );
  return parseList(payload);
}

/** Appends a module; a 409 means the per-classroom cap was reached. */
export async function createMaterialModule(
  client: TypedApiClient,
  classroomId: string,
  body: { readonly name: string; readonly description?: string },
  options: ModuleServiceOptions = {},
): Promise<MaterialModuleDto> {
  try {
    const payload = await requestApi(() =>
      client.POST('/classrooms/{id}/material-modules', {
        params: { path: { id: classroomId } },
        body,
        signal: options.signal,
      }),
    );
    return parseModule(payload);
  } catch (error) {
    if (error instanceof ApiError && error.kind === 'conflict') {
      throw new ApiError({
        kind: 'conflict',
        status: error.status,
        code: error.code,
        userMessage: materialMessages.modules.capReachedMessage,
        details: error.details,
        fieldErrors: {},
        correlationId: error.correlationId,
      });
    }
    throw error;
  }
}

/** Renames a module and/or edits its description (`null` clears it). */
export async function updateMaterialModule(
  client: TypedApiClient,
  classroomId: string,
  moduleId: string,
  body: { readonly name?: string; readonly description?: string | null },
  options: ModuleServiceOptions = {},
): Promise<MaterialModuleDto> {
  const payload = await requestApi(() =>
    client.PATCH('/classrooms/{id}/material-modules/{moduleId}', {
      params: { path: { id: classroomId, moduleId } },
      body,
      signal: options.signal,
    }),
  );
  return parseModule(payload);
}

/** Rewrites the order; `moduleIds` must be exactly the active set. */
export async function reorderMaterialModules(
  client: TypedApiClient,
  classroomId: string,
  moduleIds: readonly string[],
  options: ModuleServiceOptions = {},
): Promise<MaterialModuleListDto> {
  const payload = await requestApi(() =>
    client.PUT('/classrooms/{id}/material-modules/order', {
      params: { path: { id: classroomId } },
      body: { moduleIds: [...moduleIds] },
      signal: options.signal,
    }),
  );
  return parseList(payload);
}

/** Soft-deletes a module; its files go back to unassigned. */
export async function removeMaterialModule(
  client: TypedApiClient,
  classroomId: string,
  moduleId: string,
  options: ModuleServiceOptions = {},
): Promise<void> {
  await requestApiVoid(() =>
    client.DELETE('/classrooms/{id}/material-modules/{moduleId}', {
      params: { path: { id: classroomId, moduleId } },
      signal: options.signal,
    }),
  );
}
