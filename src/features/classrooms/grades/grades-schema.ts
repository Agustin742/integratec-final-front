import { z } from 'zod';
import type { components } from '@/api/schema.generated';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type ActivityCardType =
  components['schemas']['ReportCardItemDto']['activityType'];
export type ReportCardItemDto = components['schemas']['ReportCardItemDto'];
export type DailyMetricDto = components['schemas']['DailyMetricDto'];
export type StudentMetricSummaryDto =
  components['schemas']['StudentMetricSummaryDto'];

const nonNegativeInteger = z.number().int().nonnegative();
const isoInstant = z.string().datetime({ offset: true });
const isoCalendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD calendar day.');
const nonBlankText = z.string().refine((value) => value.trim().length > 0, {
  message: 'Value must not be blank.',
});

export const reportCardItemSchema: z.ZodType<ReportCardItemDto> = z
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

export const studentReportCardSchema = z.object({
  items: z.array(reportCardItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});

export const dailyMetricSchema: z.ZodType<DailyMetricDto> = z.object({
  day: isoCalendarDay,
  connectedSeconds: nonNegativeInteger,
  submissionCount: nonNegativeInteger,
  messageCount: nonNegativeInteger,
});

export const ownDailyMetricsSchema = z.object({
  items: z.array(dailyMetricSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});

export const studentMetricSummarySchema: z.ZodType<StudentMetricSummaryDto> =
  z.object({
    studentId: z.string().uuid(),
    displayName: nonBlankText,
    connectedSeconds: nonNegativeInteger,
    submissionCount: nonNegativeInteger,
    messageCount: nonNegativeInteger,
    gradedCount: nonNegativeInteger,
    ungradedCount: nonNegativeInteger,
  });

export const classroomMetricsSchema = z.object({
  items: z.array(studentMetricSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});

export type StudentReportCard = z.infer<typeof studentReportCardSchema>;
export type OwnDailyMetrics = z.infer<typeof ownDailyMetricsSchema>;
export type ClassroomMetrics = z.infer<typeof classroomMetricsSchema>;
