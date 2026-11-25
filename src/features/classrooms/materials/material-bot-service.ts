import { requestApi, requestApiVoid, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import {
  botAllowedMaterialDtoSchema,
  botAllowedMaterialPageSchema,
  type BotAllowedMaterialDto,
  type BotAllowedMaterialListDto,
} from './material-bot-schema';
import { materialMessages } from './messages';

export interface BotMaterialServiceOptions {
  readonly signal?: AbortSignal;
}

/** The server's maximum page size. */
const LIST_PAGE_SIZE = 100;

const uncertainBotMaterialErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a bot-material toggle failed with an outcome-uncertain
 * result (`5xx`, transport/network failure, or malformed success body).
 */
export function isUncertainBotMaterialError(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }
  if (uncertainBotMaterialErrors.has(error)) {
    return true;
  }
  return (
    error.kind === 'network' || (error.status !== null && error.status >= 500)
  );
}

function markUncertain(error: ApiError): ApiError {
  uncertainBotMaterialErrors.add(error);
  return error;
}

function translateBotToggleError(baseError: ApiError): ApiError {
  if (baseError.kind === 'forbidden' || baseError.status === 403) {
    return new ApiError({
      kind: 'forbidden',
      status: baseError.status,
      code: baseError.code,
      userMessage: materialMessages.list.bot.toggleErrors.forbidden,
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
      userMessage: materialMessages.list.bot.toggleErrors.notFound,
      details: baseError.details,
      fieldErrors: {},
      correlationId: baseError.correlationId,
    });
  }

  if (
    baseError.kind === 'network' ||
    (baseError.status !== null && baseError.status >= 500)
  ) {
    return markUncertain(
      new ApiError({
        kind: baseError.kind,
        status: baseError.status,
        code: baseError.code,
        userMessage: materialMessages.list.bot.toggleErrors.uncertain,
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
    userMessage: materialMessages.list.bot.toggleErrors.unexpected,
    details: baseError.details,
    fieldErrors: baseError.fieldErrors,
    correlationId: baseError.correlationId,
  });
}

function toToggleError(error: unknown): unknown {
  return error instanceof ApiError ? translateBotToggleError(error) : error;
}

/**
 * Fetches every material allowed for the Study Guide Bot with its indexing
 * state (`HU-BOT-001`), reading all pages. Call only for staff with
 * `configure_bot`.
 */
export async function listClassroomBotMaterials(
  client: TypedApiClient,
  classroomId: string,
  options: BotMaterialServiceOptions = {},
): Promise<BotAllowedMaterialListDto> {
  // Keyed by material so a row shifting between pages is not listed twice.
  const items = new Map<string, BotAllowedMaterialDto>();
  for (let page = 1; ; page += 1) {
    const raw = await requestApi(() =>
      client.GET('/classrooms/{id}/bot/materials', {
        params: {
          path: { id: classroomId },
          // Oldest first: rows allowed meanwhile land on the last page.
          query: { page, pageSize: LIST_PAGE_SIZE, sort: 'createdAt' },
        },
        signal: options.signal,
      }),
    );

    const parsed = botAllowedMaterialPageSchema.safeParse(raw);
    if (!parsed.success) {
      throw mapApiError(
        {
          code: 'INVALID_RESPONSE',
          message: 'Unexpected bot material list response shape.',
        },
        new Response(null, { status: 500 }),
      );
    }
    for (const entry of parsed.data.items) {
      items.set(entry.materialId, entry);
    }
    if (
      parsed.data.items.length === 0 ||
      page * LIST_PAGE_SIZE >= parsed.data.total
    ) {
      return { items: [...items.values()] };
    }
  }
}

/**
 * Allows a study material for the Study Guide Bot, or re-indexes an already
 * allowed one. Indexing is synchronous and can take many seconds; a `FAILED`
 * `indexState` is a successful response that can be retried.
 */
export async function enableClassroomBotMaterial(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  options: BotMaterialServiceOptions = {},
): Promise<BotAllowedMaterialDto> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.POST('/classrooms/{id}/bot/materials', {
        params: { path: { id: classroomId } },
        body: { materialId },
        signal: options.signal,
      }),
    );
  } catch (error) {
    throw toToggleError(error);
  }

  const parsed = botAllowedMaterialDtoSchema.safeParse(raw);
  if (
    !parsed.success ||
    parsed.data.classroomId !== classroomId ||
    parsed.data.materialId !== materialId
  ) {
    throw markUncertain(
      new ApiError({
        kind: 'unexpected',
        status: null,
        code: 'INTERNAL_ERROR',
        userMessage: materialMessages.list.bot.toggleErrors.uncertain,
        details: [],
        fieldErrors: {},
      }),
    );
  }
  return parsed.data;
}

/**
 * Removes a study material from the Study Guide Bot. A `503` means the material
 * is already excluded and only the index cleanup is pending.
 */
export async function disableClassroomBotMaterial(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  options: BotMaterialServiceOptions = {},
): Promise<void> {
  try {
    await requestApiVoid(() =>
      client.DELETE('/classrooms/{id}/bot/materials/{materialId}', {
        params: { path: { id: classroomId, materialId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 503 &&
      error.code === 'SERVICE_UNAVAILABLE'
    ) {
      throw markUncertain(
        new ApiError({
          kind: error.kind,
          status: error.status,
          code: error.code,
          userMessage: materialMessages.list.bot.toggleErrors.cleanupPending,
          correlationId: error.correlationId,
        }),
      );
    }
    throw toToggleError(error);
  }
}
