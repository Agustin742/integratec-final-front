import type { Client } from 'openapi-fetch';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  botAnswerDtoSchema,
  botStatusDtoSchema,
  type AskStudyGuideBotInput,
  type BotAnswerDto,
  type BotStatusDto,
} from './bot-schema';
import { botMessages } from './messages';

export interface BotServiceOptions {
  readonly signal?: AbortSignal;
}

export type BotErrorCategory =
  | 'exam_locked'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'unexpected';

export class BotServiceError extends Error {
  readonly category: BotErrorCategory;
  readonly apiError: ApiError | null;

  constructor(
    category: BotErrorCategory,
    message: string,
    apiError: ApiError | null = null,
  ) {
    super(message);
    this.name = 'BotServiceError';
    this.category = category;
    this.apiError = apiError;
  }
}

/**
 * Provisional OpenAPI path shape for `HU-BOT-002` until
 * `Agustin742/integratec-final-back#41` lands in `src/api/schema.generated.ts`.
 */
interface StudyGuideBotPaths {
  '/classrooms/{id}/bot/status': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': BotStatusDto } };
      };
    };
  };
  '/classrooms/{id}/bot/messages': {
    post: {
      parameters: { path: { id: string } };
      requestBody: { content: { 'application/json': AskStudyGuideBotInput } };
      responses: {
        200: { content: { 'application/json': BotAnswerDto } };
      };
    };
  };
}

function asStudyGuideBotClient(
  client: TypedApiClient,
): Client<StudyGuideBotPaths> {
  return client as unknown as Client<StudyGuideBotPaths>;
}

function classifyBotError(error: unknown): BotServiceError {
  if (!(error instanceof ApiError)) {
    return new BotServiceError(
      'unexpected',
      botMessages.errors.unexpectedDescription,
    );
  }

  if (error.status === 409 || error.status === 423) {
    return new BotServiceError(
      'exam_locked',
      error.userMessage.trim().length > 0
        ? error.userMessage
        : botMessages.examLockedDefault,
      error,
    );
  }

  if (error.status === 429 || error.kind === 'rate-limited') {
    return new BotServiceError(
      'rate_limited',
      botMessages.errors.rateLimitedDescription,
      error,
    );
  }

  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return new BotServiceError(
      'provider_unavailable',
      botMessages.errors.providerUnavailableDescription,
      error,
    );
  }

  if (error.kind === 'forbidden' || error.status === 403) {
    return new BotServiceError(
      'forbidden',
      botMessages.errors.forbiddenDescription,
      error,
    );
  }

  if (error.kind === 'not-found' || error.status === 404) {
    return new BotServiceError(
      'not_found',
      botMessages.errors.notFoundDescription,
      error,
    );
  }

  if (error.kind === 'validation' || error.status === 400) {
    return new BotServiceError('validation', error.userMessage, error);
  }

  if (error.kind === 'network') {
    return new BotServiceError(
      'network',
      botMessages.errors.networkDescription,
      error,
    );
  }

  return new BotServiceError(
    'unexpected',
    botMessages.errors.unexpectedDescription,
    error,
  );
}

/**
 * Fetches server-decided Study Guide Bot availability and exam-lockout state
 * (`HU-BOT-002`). Never uses client clocks or local exam state.
 */
export async function fetchClassroomBotStatus(
  client: TypedApiClient,
  classroomId: string,
  options: BotServiceOptions = {},
): Promise<BotStatusDto> {
  const botClient = asStudyGuideBotClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      botClient.GET('/classrooms/{id}/bot/status', {
        params: { path: { id: classroomId } },
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
    throw classifyBotError(error);
  }

  const parsed = botStatusDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BotServiceError(
      'unexpected',
      botMessages.errors.unexpectedDescription,
    );
  }
  return parsed.data;
}

/**
 * Sends a student question to the Study Guide Bot (`HU-BOT-002`).
 * Distinguishes exam lockout, rate limit, and provider outage failures.
 */
export async function askStudyGuideBot(
  client: TypedApiClient,
  classroomId: string,
  input: AskStudyGuideBotInput,
  options: BotServiceOptions = {},
): Promise<BotAnswerDto> {
  const botClient = asStudyGuideBotClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      botClient.POST('/classrooms/{id}/bot/messages', {
        params: { path: { id: classroomId } },
        body: { question: input.question },
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
    throw classifyBotError(error);
  }

  const parsed = botAnswerDtoSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BotServiceError(
      'unexpected',
      botMessages.errors.unexpectedDescription,
    );
  }
  return parsed.data;
}
