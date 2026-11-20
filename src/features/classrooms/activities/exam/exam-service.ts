import { requestApi, type TypedApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';
import { examMessages } from './exam-messages';
import {
  examSubmissionSchema,
  type ExamAnswerInputDto,
  type ExamSubmissionDto,
} from './exam-schema';

const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
/** Backend error detail names (`SubmissionsService`). */
const IDEMPOTENCY_KEY_FIELD = 'Idempotency-Key';

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
    if (answer.optionId.length < 1) {
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
 * Translates contract `400`/`403`/`404`/`409`/`413` submission failures into
 * exam copy. Branches on the status, the machine-readable code and the detail
 * field, never on the server message text. Every `409` carries the single
 * `activity` detail field (window not open, window closed, duplicate with
 * another key, wrong format), so the reason is not machine-readable and the
 * copy names the possible causes; the panel reconciles with the server to
 * tell a duplicate apart.
 */
function translateExamAnswerError(base: ApiError): ApiError {
  const fields = base.details.map((detail) => detail.field);

  if (base.status === 413) {
    return withUserMessage(base, examMessages.serverErrors.tooLarge);
  }
  if (base.status === 403) {
    return withUserMessage(base, examMessages.serverErrors.forbidden);
  }
  if (base.status === 404) {
    return withUserMessage(base, examMessages.serverErrors.notFound);
  }
  if (base.status === 409) {
    return withUserMessage(base, examMessages.serverErrors.conflict);
  }
  if (base.status === 400 || base.code === 'BAD_REQUEST') {
    if (fields.includes(IDEMPOTENCY_KEY_FIELD)) {
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
 * (`POST /activities/{activityId}/submissions`, multipart with one JSON
 * `answers` field) with one idempotency key per attempt. The browser never
 * sends a computed score; the server grades the attempt and the response
 * carries the server-confirmed `autoScore` (`rules/activities-and-grading.md`).
 */
export async function submitExamAnswers(
  client: TypedApiClient,
  activityId: string,
  answers: readonly ExamAnswerInputDto[],
  options: SubmitExamAnswersOptions,
): Promise<ExamSubmissionDto> {
  validateExamAnswersInput(answers, options.idempotencyKey);
  if (options.signal?.aborted) {
    throw new DOMException('Exam answer submission aborted', 'AbortError');
  }
  const formData = new FormData();
  formData.append(
    'answers',
    JSON.stringify(
      answers.map(({ questionId, optionId }) => ({ questionId, optionId })),
    ),
  );
  try {
    const raw: unknown = await requestApi(() =>
      client.POST('/activities/{activityId}/submissions', {
        params: {
          path: { activityId },
          header: { 'Idempotency-Key': options.idempotencyKey.trim() },
        },
        // openapi-fetch leaves `Content-Type` unset for `FormData` so the
        // browser adds the multipart boundary.
        body: formData as unknown as { files: string[]; answers?: string },
        bodySerializer: (body) => body as unknown as FormData,
        signal: options.signal,
      }),
    );
    const parsed = examSubmissionSchema.safeParse(raw);
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
 * Reads the calling student's own exam submission with the retained answers
 * and the server-computed `autoScore`
 * (`GET /activities/{activityId}/submissions/me`). Used to reconcile an
 * uncertain submission outcome and to show the stored result. Returns `null`
 * when nothing was submitted yet; the response is not cacheable per the
 * contract.
 */
export async function readOwnExamAttempt(
  client: TypedApiClient,
  activityId: string,
  options: ReadOwnExamAttemptOptions = {},
): Promise<ExamSubmissionDto | null> {
  let raw: unknown;
  try {
    raw = await requestApi(() =>
      client.GET('/activities/{activityId}/submissions/me', {
        params: { path: { activityId } },
        signal: options.signal,
      }),
    );
  } catch (error) {
    // "Submission not found" and "Activity not found" share one generic
    // `404` envelope (same code, same message, no details), so they cannot be
    // told apart here. The activity detail query that mounts the panel owns
    // activity existence, so a `404` means "no submission yet". `403` and
    // every other failure stay errors.
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
  const parsed = examSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    throw unexpectedFailure(200);
  }
  return parsed.data;
}
