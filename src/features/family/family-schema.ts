import { z } from 'zod';
import type { components } from '@/api/schema.generated';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type FamilyLinkDto = components['schemas']['FamilyLinkDto'];
export type FamilyLinksResponseDto =
  components['schemas']['FamilyLinksResponseDto'];
export type ReportCardItemDto = components['schemas']['ReportCardItemDto'];

/**
 * Runtime shape of `metrics` returned by `GET /me/parent-links/{linkId}/report-card`.
 * Mirrors backend `metrics/metrics.dto.ts#StudentActivitySummaryDto` (whose
 * OpenAPI schema name currently collides with the activities DTO in
 * `schema.generated.ts`).
 */
export interface FamilyMetricsSummaryDto {
  readonly connectedSeconds: number;
  readonly submissionCount: number;
  readonly messageCount: number;
  readonly gradedCount: number;
  readonly ungradedCount: number;
  readonly pendingCount: number;
  readonly averageScorePercent: number | null;
}

export interface FamilyReportCardResponseDto {
  readonly link: FamilyLinkDto;
  readonly items: readonly ReportCardItemDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly metrics: FamilyMetricsSummaryDto;
}

const nonNegativeInteger = z.number().int().nonnegative();
const isoInstant = z.string().datetime({ offset: true });
const nonBlankText = z.string().refine((value) => value.trim().length > 0, {
  message: 'Value must not be blank.',
});

export const familyLinkSchema: z.ZodType<FamilyLinkDto> = z.object({
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  classroomName: nonBlankText,
  classroomSubject: z.string().nullable(),
  schoolId: z.string().uuid().nullable(),
  adultMode: z.boolean(),
  childId: z.string().uuid(),
  childDisplayName: nonBlankText,
  createdAt: isoInstant,
});

export const familyLinksResponseSchema: z.ZodType<FamilyLinksResponseDto> =
  z.object({
    items: z.array(familyLinkSchema),
  });

export const familyReportCardItemSchema: z.ZodType<ReportCardItemDto> = z
  .object({
    activityId: z.string().uuid(),
    activityTitle: nonBlankText,
    activityType: z.enum(['TP', 'EXAM']),
    maxScore: z.number().int().min(0).max(100),
    score: z.number().int().min(0),
    feedback: z.string(),
    pointsAwarded: z.number(),
    isLate: z.boolean(),
    submittedAt: isoInstant,
    gradedAt: isoInstant,
  })
  .refine((item) => item.score <= item.maxScore, {
    message: 'Awarded score must not exceed the activity maxScore.',
    path: ['score'],
  });

export const familyMetricsSummarySchema: z.ZodType<FamilyMetricsSummaryDto> =
  z.object({
    connectedSeconds: nonNegativeInteger,
    submissionCount: nonNegativeInteger,
    messageCount: nonNegativeInteger,
    gradedCount: nonNegativeInteger,
    ungradedCount: nonNegativeInteger,
    pendingCount: nonNegativeInteger,
    averageScorePercent: z.number().min(0).max(100).nullable(),
  });

export const familyReportCardResponseSchema: z.ZodType<FamilyReportCardResponseDto> =
  z.object({
    link: familyLinkSchema,
    items: z.array(familyReportCardItemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: nonNegativeInteger,
    metrics: familyMetricsSummarySchema,
  });
