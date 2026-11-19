import type { Client } from 'openapi-fetch';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import {
  dailyQuestionAnswerResultSchema,
  dailyReviewResponseSchema,
  type AnswerDailyReviewQuestionInput,
  type DailyQuestionAnswerResultDto,
  type DailyReviewResponseDto,
} from './daily-review-schema';
import { dailyReviewMessages } from './messages';

export interface DailyReviewServiceOptions {
  readonly signal?: AbortSignal;
}

export type DailyReviewErrorCategory =
  'already_answered' | 'network' | 'unexpected';

export class DailyReviewServiceError extends Error {
  readonly category: DailyReviewErrorCategory;
  readonly apiError: ApiError | null;

  constructor(
    category: DailyReviewErrorCategory,
    message: string,
    apiError: ApiError | null = null,
  ) {
    super(message);
    this.name = 'DailyReviewServiceError';
    this.category = category;
    this.apiError = apiError;
  }
}

/**
 * Provisional OpenAPI path shape for `HU-BOT-003` until
 * `Agustin742/integratec-final-back#42` lands in `src/api/schema.generated.ts`.
 */
interface DailyReviewPaths {
  '/users/me/daily-review': {
    get: {
      responses: {
        200: { content: { 'application/json': DailyReviewResponseDto } };
      };
    };
  };
  '/users/me/daily-review/daily-question': {
    post: {
      requestBody: {
        content: { 'application/json': AnswerDailyReviewQuestionInput };
      };
      responses: {
        200: { content: { 'application/json': DailyQuestionAnswerResultDto } };
      };
    };
  };
}

function asDailyReviewClient(client: TypedApiClient): Client<DailyReviewPaths> {
  return client as unknown as Client<DailyReviewPaths>;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    error.name === 'AbortError'
  );
}

function classifyDailyReviewError(error: unknown): DailyReviewServiceError {
  if (error instanceof ApiError) {
    // The server credits at most one daily question per local day; a repeat
    // answer is a contract rejection, not a client decision.
    if (error.status === 409) {
      return new DailyReviewServiceError(
        'already_answered',
        error.userMessage,
        error,
      );
    }
    if (error.kind === 'network') {
      return new DailyReviewServiceError(
        'network',
        dailyReviewMessages.errors.network,
        error,
      );
    }
  }
  return new DailyReviewServiceError(
    'unexpected',
    dailyReviewMessages.errors.unexpected,
    error instanceof ApiError ? error : null,
  );
}

/**
 * Fetches the server-decided daily review state for the authenticated user
 * (`HU-BOT-003`). The server decides eligibility, once-per-day delivery, and
 * the fallback content kind; the browser clock and timezone are never used.
 */
export async function fetchDailyReview(
  client: TypedApiClient,
  options: DailyReviewServiceOptions = {},
): Promise<DailyReviewResponseDto> {
  const reviewClient = asDailyReviewClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      reviewClient.GET('/users/me/daily-review', { signal: options.signal }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw classifyDailyReviewError(error);
  }

  const parsed = dailyReviewResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError({
      kind: 'unexpected',
      status: null,
      code: null,
      userMessage: dailyReviewMessages.errors.unexpected,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * Sends the student's daily review answer and returns the server-validated
 * result with the server-confirmed streak update (`HU-BOT-003`). The client
 * never computes or credits the streak.
 */
export async function answerDailyReviewQuestion(
  client: TypedApiClient,
  input: AnswerDailyReviewQuestionInput,
  options: DailyReviewServiceOptions = {},
): Promise<DailyQuestionAnswerResultDto> {
  const reviewClient = asDailyReviewClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      reviewClient.POST('/users/me/daily-review/daily-question', {
        body: { questionId: input.questionId, answer: input.answer },
        signal: options.signal,
      }),
    );
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw classifyDailyReviewError(error);
  }

  const parsed = dailyQuestionAnswerResultSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DailyReviewServiceError(
      'unexpected',
      dailyReviewMessages.errors.unexpected,
    );
  }
  return parsed.data;
}
