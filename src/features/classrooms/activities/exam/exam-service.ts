import type { Client } from 'openapi-fetch';
import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { examMessages } from './exam-messages';
import {
  examAnswerSubmissionResponseSchema,
  ownExamAttemptSchema,
  type ExamAnswerInputDto,
  type ExamAnswerSubmissionRequestDto,
  type ExamAnswerSubmissionResponseDto,
  type OwnExamAttemptDto,
} from './exam-schema';

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

/**
 * Provisional OpenAPI path shapes for `HU-ACT-003` part 2/2 until
 * `Agustin742/integratec-final-back#47` lands in `src/api/schema.generated.ts`
 * (same pattern as the streak service for `HU-GAM-002`); see
 * `docs/exam-answering.md`.
 */
interface ExamAnswerPaths {
  '/activities/{activityId}/exam-answers': {
    post: {
      parameters: {
        path: { activityId: string };
      };
      requestBody: {
        content: {
          'application/json': ExamAnswerSubmissionRequestDto;
        };
      };
      responses: {
        201: {
          content: {
            'application/json': ExamAnswerSubmissionResponseDto;
          };
        };
      };
    };
  };
  '/activities/{activityId}/exam-answers/me': {
    get: {
      parameters: {
        path: { activityId: string };
      };
      responses: {
        200: {
          content: {
            'application/json': OwnExamAttemptDto;
          };
        };
      };
    };
  };
}

function asExamClient(client: TypedApiClient): Client<ExamAnswerPaths> {
  return client as unknown as Client<ExamAnswerPaths>;
}

export interface SubmitExamAnswersOptions {
  /**
   * Client-generated key (1-255 characters, a UUID is recommended). Reused
   * across retries of the same attempt so the server reconciles instead of
   * duplicating the attempt.
   */
  readonly idempotencyKey: string;
  readonly signal?: AbortSignal;
}

export interface ReadOwnExamAttemptOptions {
  readonly signal?: AbortSignal;
}

/**
 * Returns `true` when an exam-answering attempt failed with an
 * outcome-uncertain result (transport/network failure or `5xx`), meaning the
 * UI must reconcile the outcome with the server before offering a
 * resubmission. A timeout is never proof that the attempt failed
 * (`rules/activities-and-grading.md`).
 */
export function isUncertainExamAnswerError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.kind === 'network' || (error.status !== null && error.status >= 500))
  );
}

function validationFailure(userMessage: string): ApiError {
  return new ApiError({
    kind: 'validation',
    status: null,
    code: null,
    userMessage,
    fieldErrors: {},
  });
}

function unexpectedFailure(status: number | null): ApiError {
  return new ApiError({
    kind: 'unexpected',
    status,
    code: null,
    userMessage: examMessages.serverErrors.unexpected,
    fieldErrors: {},
  });
}

function validateExamAnswersInput(
  answers: readonly ExamAnswerInputDto[],
  idempotencyKey: string,
): void {
  const key = idempotencyKey.trim();
  if (key.length < 1 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw validationFailure(examMessages.validation.idempotencyKey);
  }
  if (answers.length < 1) {
    throw validationFailure(examMessages.validation.answers);
  }
  const seenQuestionIds = new Set<string>();
  for (const answer of answers) {
    if (seenQuestionIds.has(answer.questionId)) {
      throw validationFailure(examMessages.validation.duplicateQuestion);
    }
    seenQuestionIds.add(answer.questionId);
    if (answer.selectedOptionIds.length < 1) {
      throw validationFailure(examMessages.validation.answerShape);
    }
  }
}

function withUserMessage(base: ApiError, userMessage: string): ApiError {
  return new ApiError({
    kind: base.kind,
    status: base.status,
    code: base.code,
    userMessage,
    details: base.details,
    fieldErrors: {},
    correlationId: base.correlationId,
  });
}

/**
 * Translates contract `409`/`400`/`403`/`404` exam-answering failures into
 * feature copy. Branches on the machine-readable code and the detail field,
 * never on the server message text.
 */
function translateExamAnswerError(base: ApiError): ApiError {
  const fields = base.details.map((detail) => detail.field);

  if (base.status === 403) {
    return withUserMessage(base, examMessages.serverErrors.forbidden);
  }
  if (base.status === 404) {
    return withUserMessage(base, examMessages.serverErrors.notFound);
  }
  if (base.status === 409) {
    if (fields.includes('idempotencyKey')) {
      return withUserMessage(base, examMessages.serverErrors.duplicate);
    }
    if (fields.includes('opensAt')) {
      return withUserMessage(base, examMessages.serverErrors.windowNotOpen);
    }
    if (fields.includes('format')) {
      return withUserMessage(base, examMessages.serverErrors.notExamActivity);
    }
    return withUserMessage(base, examMessages.serverErrors.windowClosed);
  }
  if (base.status === 400 || base.code === 'BAD_REQUEST') {
    if (fields.includes('idempotencyKey')) {
      return withUserMessage(base, examMessages.validation.idempotencyKey);
    }
    return withUserMessage(base, examMessages.validation.answers);
  }
  if (isUncertainExamAnswerError(base)) {
    return withUserMessage(base, examMessages.serverErrors.uncertain);
  }
  return base;
}

/**
 * Submits the student's multiple-choice answers
 * (`POST /activities/{activityId}/exam-answers`, provisional path documented
 * in `docs/exam-answering.md`) with one idempotency key per attempt. The
 * browser never sends a computed score; the server grades the attempt and the
 * response carries the server-confirmed result
 * (`rules/activities-and-grading.md`).
 */
export async function submitExamAnswers(
  client: TypedApiClient,
  activityId: string,
  answers: readonly ExamAnswerInputDto[],
  options: SubmitExamAnswersOptions,
): Promise<ExamAnswerSubmissionResponseDto> {
  validateExamAnswersInput(answers, options.idempotencyKey);
  if (options.signal?.aborted) {
    throw new DOMException('Exam answer submission aborted', 'AbortError');
  }
  const examClient = asExamClient(client);
  try {
    const raw: unknown = await requestApi(() =>
      examClient.POST('/activities/{activityId}/exam-answers', {
        params: { path: { activityId } },
        body: { answers: [...answers] },
        headers: { 'Idempotency-Key': options.idempotencyKey.trim() },
        signal: options.signal,
      }),
    );
    const parsed = examAnswerSubmissionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw unexpectedFailure(201);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw translateExamAnswerError(error);
    }
    throw error;
  }
}

/**
 * Reads the calling student's own exam attempt with the retained answers and
 * the server-computed result
 * (`GET /activities/{activityId}/exam-answers/me`, provisional path). Used
 * to reconcile an uncertain submission outcome and to restore selected
 * answers after a recoverable failure. Returns `null` when no attempt exists
 * yet; the response is not cacheable per the contract.
 */
export async function readOwnExamAttempt(
  client: TypedApiClient,
  activityId: string,
  options: ReadOwnExamAttemptOptions = {},
): Promise<OwnExamAttemptDto | null> {
  const examClient = asExamClient(client);
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      examClient.GET('/activities/{activityId}/exam-answers/me', {
        params: { path: { activityId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    // No attempt yet is a normal state, not a failure; the activity detail
    // query owns activity existence, so any `404` maps to "no attempt".
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
  const parsed = ownExamAttemptSchema.safeParse(raw);
  if (!parsed.success) {
    throw unexpectedFailure(200);
  }
  return parsed.data;
}
