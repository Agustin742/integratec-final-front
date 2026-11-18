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

const submissionBaseFields = {
  id: z.string().uuid(),
  activityId: z.string().uuid(),
  /** Server clock, ISO 8601 UTC. */
  submittedAt: z.string().datetime({ offset: true }),
  isLate: z.boolean(),
  status: z.enum(['submitted', 'graded']),
};

export const submissionResponseDtoSchema: z.ZodType<SubmissionResponseDto> =
  z.object({
    ...submissionBaseFields,
    files: z.array(submissionFileSchema),
  });

export const submissionDownloadDtoSchema: z.ZodType<SubmissionDownloadResponseDto> =
  z.object({
    ...submissionBaseFields,
    files: z.array(
      submissionFileSchema.extend({
        /** Short-lived signed URL. Never logged, shared, or persisted. */
        downloadUrl: z.string().min(1),
        /** ISO 8601 UTC instant after which `downloadUrl` stops working. */
        downloadUrlExpiresAt: z.string().datetime({ offset: true }),
      }),
    ),
  });
