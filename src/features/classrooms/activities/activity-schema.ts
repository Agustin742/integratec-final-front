import { z } from 'zod';
import type { components } from '@/api/schema.generated';

z.config({ jitless: true });

export type ActivitySummaryDto = components['schemas']['ActivitySummaryDto'];
export type StudentActivityResponseDto =
  components['schemas']['StudentActivityResponseDto'];
export type TeacherActivityResponseDto =
  components['schemas']['TeacherActivityResponseDto'];
export type ActivityDetailDto =
  StudentActivityResponseDto | TeacherActivityResponseDto;
export type ActivityType = ActivitySummaryDto['type'];
export type ActivityFormat = ActivitySummaryDto['format'];
export type ActivityState = ActivitySummaryDto['state'];

const baseActivityFields = {
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  type: z.enum(['TP', 'EXAM']),
  format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
  state: z.enum(['DRAFT', 'PUBLISHED']),
  title: z.string().min(1),
  description: z.string(),
  opensAt: z.string().datetime({ offset: true }).nullable(),
  dueAt: z.string().datetime({ offset: true }),
  allowLate: z.boolean(),
  maxScore: z.number(),
  weightMultiplier: z.number(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  timeZone: z.string().min(1),
  questionCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
};

export const activitySummaryDtoSchema: z.ZodType<ActivitySummaryDto> =
  z.object(baseActivityFields);

export interface PaginatedActivityListDto {
  readonly items: ActivitySummaryDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export const paginatedActivityListSchema: z.ZodType<PaginatedActivityListDto> =
  z.object({
    items: z.array(activitySummaryDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  });

const studentOptionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  label: z.string(),
});

const teacherOptionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  label: z.string(),
  isCorrect: z.boolean(),
});

const studentQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  prompt: z.string(),
  options: z.array(studentOptionSchema),
});

const teacherQuestionSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().nonnegative(),
  prompt: z.string(),
  options: z.array(teacherOptionSchema),
});

export const activityDetailDtoSchema: z.ZodType<ActivityDetailDto> = z.object({
  ...baseActivityFields,
  questions: z.union([
    z.array(teacherQuestionSchema),
    z.array(studentQuestionSchema),
  ]),
});
