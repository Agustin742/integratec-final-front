import { z } from 'zod';
import { gradingMessages } from './grading-messages';

// Strict CSP compatibility: prevent Zod v4 from compiling validators with `new Function()`.
z.config({ jitless: true });

export const GRADE_LIMITS = {
  minScore: 0,
  maxScore: 100,
  feedbackMinLength: 1,
  feedbackMaxLength: 5000,
} as const;

/**
 * Mirrors backend `@VisibleText` validator (`visible-text.ts`): rejects control
 * characters and Unicode line/paragraph separators (`\n`, `\r`, `\t`, etc.).
 */
export const FORBIDDEN_CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]/u;

const isoInstantWithOffsetSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) && !Number.isNaN(Date.parse(value)),
    { message: 'Invalid ISO-8601 instant' },
  );

const safeHttpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'Download URL must use http or https' },
  );

export const gradingQueueGradeDtoSchema = z.object({
  id: z.string().min(1),
  graderId: z.string().min(1),
  score: z.number().int().min(GRADE_LIMITS.minScore).max(GRADE_LIMITS.maxScore),
  feedback: z.string().min(1),
  pointsAwarded: z.number().int().min(0),
  version: z.number().int().min(1),
  gradedAt: isoInstantWithOffsetSchema,
});

export type GradingQueueGradeDto = z.infer<typeof gradingQueueGradeDtoSchema>;

export const gradingQueueItemDtoSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  activityTitle: z.string().min(1),
  activityType: z.enum(['TP', 'EXAM']),
  studentId: z.string().min(1),
  studentDisplayName: z.string().min(1),
  submittedAt: isoInstantWithOffsetSchema,
  isLate: z.boolean(),
  status: z.enum(['submitted', 'graded']),
  fileCount: z.number().int().min(0),
  grade: gradingQueueGradeDtoSchema.nullable(),
});

export type GradingQueueItemDto = z.infer<typeof gradingQueueItemDtoSchema>;

export const gradingQueueResponseSchema = z.object({
  items: z.array(gradingQueueItemDtoSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export type GradingQueueResponseDto = z.infer<
  typeof gradingQueueResponseSchema
>;

export const submissionFileDownloadDtoSchema = z.object({
  id: z.string().min(1),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  position: z.number().int().min(0),
  downloadUrl: safeHttpUrlSchema,
  downloadUrlExpiresAt: isoInstantWithOffsetSchema,
});

export type SubmissionFileDownloadDto = z.infer<
  typeof submissionFileDownloadDtoSchema
>;

export const submissionDownloadResponseSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  submittedAt: isoInstantWithOffsetSchema,
  isLate: z.boolean(),
  status: z.enum(['submitted', 'graded']),
  files: z.array(submissionFileDownloadDtoSchema),
});

export type SubmissionDownloadResponseDto = z.infer<
  typeof submissionDownloadResponseSchema
>;

export const gradeResponseDtoSchema = z.object({
  id: z.string().min(1),
  submissionId: z.string().min(1),
  activityId: z.string().min(1),
  studentId: z.string().min(1),
  graderId: z.string().min(1),
  score: z.number().int().min(GRADE_LIMITS.minScore).max(GRADE_LIMITS.maxScore),
  feedback: z.string().min(1),
  pointsAwarded: z.number().int().min(0),
  pointTransactionId: z.string().min(1).nullable(),
  version: z.number().int().min(1),
  gradedAt: isoInstantWithOffsetSchema,
  createdAt: isoInstantWithOffsetSchema,
  updatedAt: isoInstantWithOffsetSchema,
});

export type GradeResponseDto = z.infer<typeof gradeResponseDtoSchema>;

export interface GradeSubmissionPayload {
  readonly score: number;
  readonly feedback: string;
}

export interface RegradeSubmissionPayload {
  readonly score: number;
  readonly feedback: string;
  readonly version: number;
}

export interface GradingFormInput {
  score: string;
  feedback: string;
}

export interface GradingFormSchemaOptions {
  readonly maxScore?: number;
  /**
   * Existing confirmed score when regrading. Mirrors backend D18 behavior:
   * feedback-only regrades keep an unchanged score even if `activity.maxScore`
   * was lowered after initial grading.
   */
  readonly initialScore?: number;
}

export function createGradingFormSchema(
  options: GradingFormSchemaOptions = {},
) {
  const { maxScore, initialScore } = options;

  return z.object({
    score: z
      .string()
      .trim()
      .min(1, { message: gradingMessages.validation.scoreRequired })
      .refine((value) => /^-?\d+$/.test(value), {
        message: gradingMessages.validation.scoreInteger,
      })
      .transform((value) => Number.parseInt(value, 10))
      .refine(
        (value) =>
          Number.isInteger(value) &&
          value >= GRADE_LIMITS.minScore &&
          value <= GRADE_LIMITS.maxScore,
        { message: gradingMessages.validation.scoreRange },
      )
      .refine(
        (value) => {
          if (maxScore === undefined) {
            return true;
          }
          if (initialScore !== undefined && value === initialScore) {
            return true;
          }
          return value <= maxScore;
        },
        {
          message: gradingMessages.validation.scoreExceedsActivityMax(
            maxScore ?? GRADE_LIMITS.maxScore,
          ),
        },
      ),
    feedback: z
      .string()
      .refine((value) => !FORBIDDEN_CONTROL_CHARACTERS.test(value), {
        message: gradingMessages.validation.feedbackControlChars,
      })
      .transform((value) => value.trim())
      .refine((value) => value.length >= GRADE_LIMITS.feedbackMinLength, {
        message: gradingMessages.validation.feedbackRequired,
      })
      .refine((value) => value.length <= GRADE_LIMITS.feedbackMaxLength, {
        message: gradingMessages.validation.feedbackMaxLength(
          GRADE_LIMITS.feedbackMaxLength,
        ),
      }),
  });
}

export function formatFileSize(sizeBytes: number): string {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return '0 B';
  }
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  const kb = sizeBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}
