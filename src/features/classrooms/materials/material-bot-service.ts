import type { Client } from 'openapi-fetch';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError, mapApiError } from '@/api/errors';
import {
  botAllowedMaterialDtoSchema,
  botAllowedMaterialListSchema,
  type BotAllowedMaterialDto,
  type BotAllowedMaterialListDto,
  type SetBotMaterialEnabledInput,
} from './material-bot-schema';
import { materialMessages } from './messages';

export interface BotMaterialServiceOptions {
  readonly signal?: AbortSignal;
}

/**
 * Provisional OpenAPI path shape for `HU-BOT-001` until
 * `Agustin742/integratec-final-back#40` lands in `src/api/schema.generated.ts`.
 */
interface BotMaterialsPaths {
  '/classrooms/{id}/bot/materials': {
    get: {
      parameters: {
        path: { id: string };
      };
      responses: {
        200: {
          content: {
            'application/json': BotAllowedMaterialListDto;
          };
        };
      };
    };
  };
  '/classrooms/{id}/bot/materials/{materialId}': {
    put: {
      parameters: {
        path: { id: string; materialId: string };
      };
      requestBody: {
        content: {
          'application/json': SetBotMaterialEnabledInput;
        };
      };
      responses: {
        200: {
          content: {
            'application/json': BotAllowedMaterialDto;
          };
        };
      };
    };
  };
}

function asBotClient(client: TypedApiClient): Client<BotMaterialsPaths> {
  return client as unknown as Client<BotMaterialsPaths>;
}

const uncertainBotMaterialErrors = new WeakSet<ApiError>();

/**
 * Returns `true` when a bot-material toggle failed with an outcome-uncertain
 * result (`5xx`, transport/network failure, or malformed `200`).
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

/**
 * Fetches the confirmed Study Guide Bot material configuration and indexing
 * state for a classroom (`HU-BOT-001`). Call only for staff with
 * `configure_bot`.
 */
export async function listClassroomBotMaterials(
  client: TypedApiClient,
  classroomId: string,
  options: BotMaterialServiceOptions = {},
): Promise<BotAllowedMaterialListDto> {
  const botClient = asBotClient(client);
  const raw = await requestApi(() =>
    botClient.GET('/classrooms/{id}/bot/materials', {
      params: { path: { id: classroomId } },
      signal: options.signal,
    }),
  );

  const parsed = botAllowedMaterialListSchema.safeParse(raw);
  if (!parsed.success) {
    throw mapApiError(
      {
        code: 'INVALID_RESPONSE',
        message: 'Unexpected bot material list response shape.',
      },
      new Response(null, { status: 500 }),
    );
  }
  return parsed.data;
}

/**
 * Enables or disables a classroom study material for the Study Guide Bot
 * (`HU-BOT-001`). Returns the server-confirmed configuration and indexing
 * state; never mutates state client-side before confirmation.
 */
export async function setClassroomBotMaterialEnabled(
  client: TypedApiClient,
  classroomId: string,
  materialId: string,
  input: SetBotMaterialEnabledInput,
  options: BotMaterialServiceOptions = {},
): Promise<BotAllowedMaterialDto> {
  const botClient = asBotClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      botClient.PUT('/classrooms/{id}/bot/materials/{materialId}', {
        params: { path: { id: classroomId, materialId } },
        body: { enabled: input.enabled },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (
      (error instanceof Error || error instanceof DOMException) &&
      error.name === 'AbortError'
    ) {
      throw error;
    }
    if (error instanceof ApiError) {
      throw translateBotToggleError(error);
    }
    throw error;
  }

  const parsed = botAllowedMaterialDtoSchema.safeParse(raw);
  if (!parsed.success) {
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
