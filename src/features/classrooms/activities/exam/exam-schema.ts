import { z } from 'zod';
import type { components } from '@/api/schema.generated';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

/**
 * Student multiple-choice exam answering (`HU-ACT-003` part 2/2) goes through
 * the same submissions endpoints as file submissions (back #47):
 *
 * - `POST /activities/{activityId}/submissions` (multipart) with an
 *   `Idempotency-Key` header and an `answers` field holding a JSON-encoded
 *   array of `{ questionId, optionId }` pairs;
 * - `GET /activities/{activityId}/submissions/me` for reconciliation and for
 *   showing the stored result.
 *
 * The server grades the answers and returns `autoScore` (`0..maxScore`; the
 * `maxScore` lives on the activity detail, not on the submission). Correct
 * options are never part of any student-facing response (`RN-06`), and the
 * browser never sends or computes a score (`rules/activities-and-grading.md`).
 */
export type ExamSubmissionAnswerDto =
  components['schemas']['SubmissionAnswerResponseDto'];

/** One chosen option per question, as sent in the `answers` multipart field. */
export type ExamAnswerInputDto = Pick<
  ExamSubmissionAnswerDto,
  'questionId' | 'optionId'
>;

/**
 * A stored multiple-choice submission as the `POST` response and
 * `GET .../submissions/me` return it (file fields are not read here).
 * `autoScore` is non-null for this format; the generated type is nullable
 * because file submissions have none.
 */
export type ExamSubmissionDto = Omit<
  components['schemas']['SubmissionResponseDto'],
  'autoScore' | 'files'
> & { readonly autoScore: number };

const examSubmissionObject = z.object({
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  submittedAt: z.string().datetime({ offset: true }),
  isLate: z.boolean(),
  /** Server-computed; never calculated client-side. */
  autoScore: z.number().int().nonnegative(),
  status: z.enum(['submitted', 'graded']),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      optionId: z.string().uuid(),
      position: z.number().int().nonnegative(),
    }),
  ),
});

/** Parses both the `POST` response and `GET .../submissions/me`. */
export const examSubmissionSchema: z.ZodType<ExamSubmissionDto> =
  examSubmissionObject;
