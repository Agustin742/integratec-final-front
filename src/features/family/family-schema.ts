import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { familyMessages } from './messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const PARENT_LINK_MESSAGE_MAX_LENGTH = 2000;

export type FamilyLinkDto = components['schemas']['FamilyLinkDto'];
export type FamilyLinksResponseDto =
  components['schemas']['FamilyLinksResponseDto'];
export type StaffFamilyThreadDto =
  components['schemas']['StaffFamilyThreadDto'];
export type StaffFamilyThreadsResponseDto =
  components['schemas']['StaffFamilyThreadsResponseDto'];
export type ReportCardItemDto = components['schemas']['ReportCardItemDto'];
export type ParentLinkMessageDto =
  components['schemas']['ParentLinkMessageDto'];
export type ParentLinkMessageAuthorRole = ParentLinkMessageDto['authorRole'];
export type ParentLinkMessagesResponseDto =
  components['schemas']['ParentLinkMessagesResponseDto'];
export type CreateParentLinkMessageDto =
  components['schemas']['CreateParentLinkMessageDto'];

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

export const staffFamilyThreadSchema: z.ZodType<StaffFamilyThreadDto> =
  z.object({
    id: z.string().uuid(),
    classroomId: z.string().uuid(),
    classroomName: nonBlankText,
    parentId: z.string().uuid(),
    parentDisplayName: nonBlankText,
    childId: z.string().uuid(),
    childDisplayName: nonBlankText,
    lastMessageBody: z.string().nullable(),
    lastMessageAt: isoInstant.nullable(),
    lastMessageAuthorRole: z.enum(['PARENT', 'STAFF']).nullable(),
  });

export const staffFamilyThreadsResponseSchema: z.ZodType<StaffFamilyThreadsResponseDto> =
  z.object({
    items: z.array(staffFamilyThreadSchema),
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

export const parentLinkMessageSchema: z.ZodType<ParentLinkMessageDto> =
  z.object({
    id: z.string().uuid(),
    parentLinkId: z.string().uuid(),
    authorId: z.string().uuid(),
    authorDisplayName: nonBlankText,
    authorRole: z.enum(['PARENT', 'STAFF']),
    body: nonBlankText,
    createdAt: isoInstant,
  });

export const parentLinkMessagesResponseSchema: z.ZodType<ParentLinkMessagesResponseDto> =
  z.object({
    link: familyLinkSchema,
    items: z.array(parentLinkMessageSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: nonNegativeInteger,
  });

export const sendParentLinkMessageFormSchema = z.object({
  body: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: familyMessages.messaging.composer.validation.required,
    })
    .refine((value) => value.length <= PARENT_LINK_MESSAGE_MAX_LENGTH, {
      message: familyMessages.messaging.composer.validation.tooLong,
    }),
});

export type SendParentLinkMessageFormInput = z.input<
  typeof sendParentLinkMessageFormSchema
>;
export type SendParentLinkMessageFormOutput = z.output<
  typeof sendParentLinkMessageFormSchema
>;
