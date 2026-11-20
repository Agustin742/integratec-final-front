import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

export type SubmissionResponseDto =
  components['schemas']['SubmissionResponseDto'];
export type SubmissionDownloadResponseDto =
  components['schemas']['SubmissionDownloadResponseDto'];
export type SubmissionStatus = SubmissionResponseDto['status'];

const submissionFileSchema = z.object({
  id: z.string().uuid(),
  /** Sanitized display name (no path, no control characters). */
  originalName: z.string().min(1),
  /** Detected from the file bytes, never from the client-declared type. */
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  /** Zero-based order in which the files were sent. */
  position: z.number().int().nonnegative(),
});

const submissionAnswerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
  /** Zero-based order in which the answers were sent. */
  position: z.number().int().nonnegative(),
});

const submissionBaseFields = {
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  /** Server clock, ISO 8601 UTC. */
  submittedAt: z.string().datetime({ offset: true }),
  isLate: z.boolean(),
  /** Server-computed multiple-choice score; `null` for file submissions. */
  autoScore: z.number().int().nonnegative().nullable(),
  status: z.enum(['submitted', 'graded']),
  /** Chosen options of a multiple-choice submission; empty for files. */
  answers: z.array(submissionAnswerSchema),
};

export const submissionResponseDtoSchema: z.ZodType<SubmissionResponseDto> =
  z.object({
    ...submissionBaseFields,
    files: z.array(submissionFileSchema),
  });

const safeHttpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === 'https:' || protocol === 'http:';
    } catch {
      return false;
    }
  }, 'Download URL must use http or https');

export const submissionDownloadDtoSchema: z.ZodType<SubmissionDownloadResponseDto> =
  z.object({
    ...submissionBaseFields,
    files: z.array(
      submissionFileSchema.extend({
        /** Short-lived signed URL. Never logged, shared, or persisted. */
        downloadUrl: safeHttpUrlSchema,
        /** ISO 8601 UTC instant after which `downloadUrl` stops working. */
        downloadUrlExpiresAt: z.string().datetime({ offset: true }),
      }),
    ),
  });
