import { z } from 'zod';
import { ACTIVITY_LIMITS } from '../activity-schema';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

/**
 * PROVISIONAL contract for `HU-ACT-003` part 2/2 (student multiple-choice exam
 * answering) until `Agustin742/integratec-final-back#47` lands in
 * `src/api/schema.generated.ts`; see `docs/exam-answering.md`. The published
 * contract only types the multipart file submission
 * (`POST /activities/{activityId}/submissions`), so these DTOs model the JSON
 * exam-answering operations the backend will publish:
 *
 * - `POST /activities/{activityId}/exam-answers` with an `Idempotency-Key`
 *   header, body `{ answers: [{ questionId, selectedOptionIds }] }`;
 * - `GET /activities/{activityId}/exam-answers/me` for reconciliation and
 *   answer retention after a recoverable failure.
 *
 * The server computes the automatic grade and returns it in the response. The
 * result carries the server-confirmed score only: correct options are never
 * part of any student-facing response (`RN-06`), and the browser never sends a
 * computed score (`rules/activities-and-grading.md`). When `pnpm api:sync`
 * regenerates the schema, `exam-service.ts` is the only place to adjust.
 */
export interface ExamAnswerInputDto {
  readonly questionId: string;
  /**
   * Contract questions allow 2–6 options and exactly one correct answer today,
   * so the answering UI renders one selection per question; the array shape
   * keeps the payload forward-compatible without assuming an open decision.
   */
  readonly selectedOptionIds: string[];
}

export interface ExamAnswerSubmissionRequestDto {
  readonly answers: ExamAnswerInputDto[];
}

export interface ExamAnswerSubmissionResponseDto {
  readonly id: string;
  readonly activityId: string;
  /** Server clock, ISO 8601 UTC. */
  readonly submittedAt: string;
  readonly isLate: boolean;
  /** Auto-graded on submission by the server evaluator. */
  readonly status: 'graded';
  /** Server-computed score; never calculated client-side. */
  readonly score: number;
  readonly maxScore: number;
}

export interface OwnExamAttemptDto {
  readonly id: string;
  readonly activityId: string;
  readonly submittedAt: string;
  readonly isLate: boolean;
  readonly status: 'graded';
  readonly score: number;
  readonly maxScore: number;
  /** Answers retained by the server so a recoverable failure can restore them. */
  readonly answers: ExamAnswerInputDto[];
}

const examAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionIds: z
    .array(z.string().uuid())
    .min(1)
    .max(ACTIVITY_LIMITS.options.max),
});

export const examAnswerSubmissionRequestSchema: z.ZodType<ExamAnswerSubmissionRequestDto> =
  z.object({
    answers: z
      .array(examAnswerInputSchema)
      .min(1)
      .max(ACTIVITY_LIMITS.questions.max),
  });

const examAnswerSubmissionResponseObject = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  submittedAt: z.string().datetime({ offset: true }),
  isLate: z.boolean(),
  status: z.literal('graded'),
  score: z.number(),
  maxScore: z.number(),
});

export const examAnswerSubmissionResponseSchema: z.ZodType<ExamAnswerSubmissionResponseDto> =
  examAnswerSubmissionResponseObject;

export const ownExamAttemptSchema: z.ZodType<OwnExamAttemptDto> =
  examAnswerSubmissionResponseObject.extend({
    answers: z.array(examAnswerInputSchema),
  });
