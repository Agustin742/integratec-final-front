import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import type { MaterialListQueryParams } from '@/api/query-keys';
import {
  materialDownloadDtoSchema,
  materialDtoSchema,
  paginatedMaterialListSchema,
  type MaterialDownloadDto,
  type MaterialDto,
  type PaginatedMaterialListDto,
} from './material-schema';
import { materialMessages } from './messages';

export interface MaterialServiceOptions {
  readonly signal?: AbortSignal;
}

export interface UploadMaterialOptions extends MaterialServiceOptions {
  /** Module to file the upload under; omitted means unassigned. */
  readonly moduleId?: string | null;
}

const uncertainMaterialErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a material upload failed with an outcome-uncertain
 * result (`5xx`, transport/network failure, or malformed `201`), meaning the
 * UI must reconcile the list against the server before offering a retry.
 */
export function isUncertainMaterialError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainMaterialErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainMaterialErrors.add(error);
  return error;
}

function translateUploadError(baseError: ApiError): ApiError {
  if (baseError.status === 413) {
    return new ApiError({
      kind: 'validation',
      status: 413,
      code: baseError.code,
      userMessage: materialMessages.upload.serverErrors.tooLarge,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

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
          : materialMessages.upload.serverErrors.validationFailed,
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
      userMessage: materialMessages.upload.serverErrors.forbidden,
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
      userMessage: materialMessages.upload.serverErrors.notFound,
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
        userMessage: materialMessages.upload.serverErrors.uncertain,
        details: baseError.details,
        fieldErrors: {},
        correlationId: baseError.correlationId,
      }),
    );
  }

  return baseError;
}

function translateDownloadError(baseError: ApiError): ApiError {
  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: materialMessages.list.downloadErrors.forbidden,
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
      userMessage: materialMessages.list.downloadErrors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (
    baseError.kind === 'network' ||
    (baseError.status !== null && baseError.status >= 500)
  ) {
    return new ApiError({
      kind: baseError.kind,
      status: baseError.status,
      code: baseError.code,
      userMessage: materialMessages.list.downloadErrors.unavailable,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  return baseError;
}

function translateRemoveError(baseError: ApiError): ApiError {
  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: materialMessages.list.removeErrors.forbidden,
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
      userMessage: materialMessages.list.removeErrors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  return baseError;
}

export async function listClassroomMaterials(
  client: TypedApiClient,
  classroomId: string,
  params: MaterialListQueryParams = {},
  options: MaterialServiceOptions = {},
): Promise<PaginatedMaterialListDto> {
  const payload = await requestApi(() =>
    client.GET('/classrooms/{id}/materials', {
      params: {
        path: { id: classroomId },
        query: {
          page: params.page,
          pageSize: params.pageSize,
          sort: params.sort,
          moduleId: params.moduleId,
        },
      },
      signal: options.signal,
    }),
  );

  const parsed = paginatedMaterialListSchema.safeParse(payload);
  if (!parsed.success) {
    throw mapApiError(undefined, new Response(null, { status: 502 }));
  }
  return parsed.data;
}

export async function uploadClassroomMaterial(
  client: TypedApiClient,
  classroomId: string,
  file: File,
  options: UploadMaterialOptions = {},
): Promise<MaterialDto> {
  const formData = new FormData();
  if (options.moduleId) {
    formData.append('moduleId', options.moduleId);
  }
  formData.append('file', file, file.name);

  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.POST('/classrooms/{id}/materials', {
        params: { path: { id: classroomId } },
        body: formData as unknown as { file: string },
        bodySerializer: (body) => body as unknown as FormData,
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw translateUploadError(error);
    }
    throw error;
  }

  const parsed = materialDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: 502,
        code: null,
        userMessage: materialMessages.upload.serverErrors.uncertain,
        fieldErrors: {},
      }),
    );
  }
  return parsed.data;
}

/**
 * Requests a short-lived signed download URL from the server.
 * Callers MUST NOT log or persist the returned URL (`MaterialDownloadDto.url`).
 */
export async function requestMaterialDownload(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  options: MaterialServiceOptions = {},
): Promise<MaterialDownloadDto> {
  let payload: unknown;
  try {
    payload = await requestApi(() =>
      client.GET('/classrooms/{id}/materials/{materialId}/download', {
        params: { path: { id: classroomId, materialId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw translateDownloadError(error);
    }
    throw error;
  }

  const parsed = materialDownloadDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: 502,
      code: null,
      userMessage: materialMessages.list.downloadErrors.unavailable,
      fieldErrors: {},
    });
  }
  return parsed.data;
}

export async function removeClassroomMaterial(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  options: MaterialServiceOptions = {},
): Promise<void> {
  try {
    await requestApiVoid(() =>
      client.DELETE('/classrooms/{id}/materials/{materialId}', {
        params: { path: { id: classroomId, materialId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw translateRemoveError(error);
    }
    throw error;
  }
}

/**
 * Moves a material into a module, or back to unassigned with `moduleId: null`.
 */
export async function moveClassroomMaterial(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  moduleId: string | null,
  options: MaterialServiceOptions = {},
): Promise<MaterialDto> {
  const payload = await requestApi(() =>
    client.PATCH('/classrooms/{id}/materials/{materialId}', {
      params: { path: { id: classroomId, materialId } },
      body: { moduleId },
      signal: options.signal,
    }),
  );
  const parsed = materialDtoSchema.safeParse(payload);
  if (!parsed.success) {
    throw markUncertain(
      mapApiError(undefined, new Response(null, { status: 502 })),
    );
  }
  return parsed.data;
}
