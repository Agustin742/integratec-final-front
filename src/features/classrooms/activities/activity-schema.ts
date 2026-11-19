import { z } from 'zod';
import type { components, operations } from '@/api/schema.generated';
import { activityMessages } from './messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

/** Limits shared with backend `ACTIVITY_LIMITS` (`activities.dto.ts`). */
export const ACTIVITY_LIMITS = {
  titleMax: 120,
  descriptionMax: 5000,
  maxScore: { min: 0, max: 100 },
  weight: { min: 0.5, max: 3, decimals: 2, default: 1 },
  questions: { min: 1, max: 50 },
  options: { min: 2, max: 6 },
  promptMax: 1000,
  labelMax: 500,
} as const;

export const ACTIVITY_TYPES = ['TP', 'EXAM'] as const;
export const ACTIVITY_FORMATS = ['FILE', 'MULTIPLE_CHOICE'] as const;
export const ACTIVITY_STATES = ['DRAFT', 'PUBLISHED'] as const;

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
export type CreateActivityDto = components['schemas']['CreateActivityDto'];
export type UpdateActivityDto = components['schemas']['UpdateActivityDto'];
export type QuestionInputDto = components['schemas']['QuestionInputDto'];
export type PaginatedClassroomActivitiesDto =
  operations['ActivitiesController_list']['responses'][200]['content']['application/json'];

export interface PaginatedActivityListDto {
  readonly items: ActivitySummaryDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * Payload actually sent through `PATCH /classrooms/{id}/activities/{activityId}`.
 * The generated `UpdateActivityDto` marks `description`, `allowLate` and
 * `weightMultiplier` as required (they carry server-side defaults in the
 * contract), while the server applies those defaults when the fields are
 * absent; this boundary type keeps the omission explicit instead of faking
 * values client-side.
 */
export type UpdateActivityPayload = Omit<
  UpdateActivityDto,
  'description' | 'allowLate' | 'weightMultiplier'
> & {
  readonly description?: string;
  readonly allowLate?: boolean;
  readonly weightMultiplier?: number;
};

const FORBIDDEN_CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/** Instant strings (`opensAt`/`dueAt`) must be ISO 8601 with an explicit UTC offset. */
const instantSchema = z.string().datetime({
  offset: true,
  message: activityMessages.validation.instantInvalid,
});

export const activityTitleSchema = z
  .string()
  .superRefine((raw, ctx) => {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.titleRequired,
      });
      return;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.titleRequired,
      });
      return;
    }
    if (trimmed.length > ACTIVITY_LIMITS.titleMax) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.titleTooLong,
      });
    }
  })
  .transform((raw) => raw.trim());

export const activityDescriptionSchema = z
  .string()
  .max(
    ACTIVITY_LIMITS.descriptionMax,
    activityMessages.validation.descriptionTooLong,
  );

const questionPromptSchema = z
  .string()
  .superRefine((raw, ctx) => {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.questionPromptRequired,
      });
      return;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.questionPromptRequired,
      });
      return;
    }
    if (trimmed.length > ACTIVITY_LIMITS.promptMax) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.questionPromptTooLong,
      });
    }
  })
  .transform((raw) => raw.trim());

const optionLabelSchema = z
  .string()
  .superRefine((raw, ctx) => {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.optionLabelRequired,
      });
      return;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.optionLabelRequired,
      });
      return;
    }
    if (trimmed.length > ACTIVITY_LIMITS.labelMax) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.optionLabelTooLong,
      });
    }
  })
  .transform((raw) => raw.trim());

/**
 * Contract rule: 2–6 options per question, and "Exactly one option per question
 * must be correct" (`QuestionInputDto` in `schema.generated.ts`).
 */
export const questionInputSchema: z.ZodType<QuestionInputDto> = z.object({
  prompt: questionPromptSchema,
  options: z
    .array(
      z.object({
        label: optionLabelSchema,
        isCorrect: z.boolean(),
      }),
    )
    .min(ACTIVITY_LIMITS.options.min, activityMessages.validation.optionsMin)
    .max(ACTIVITY_LIMITS.options.max, activityMessages.validation.optionsMax)
    .superRefine((options, ctx) => {
      const correctCount = options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: activityMessages.validation.exactlyOneCorrectOption,
        });
      }
    }),
});

const maxScoreSchema = z
  .number()
  .refine(
    (raw) =>
      Number.isFinite(raw) &&
      Number.isInteger(raw) &&
      raw >= ACTIVITY_LIMITS.maxScore.min &&
      raw <= ACTIVITY_LIMITS.maxScore.max,
    {
      message: activityMessages.validation.maxScoreRange,
    },
  );

const weightMultiplierSchema = z
  .number()
  .refine(
    (raw) =>
      Number.isFinite(raw) &&
      raw >= ACTIVITY_LIMITS.weight.min &&
      raw <= ACTIVITY_LIMITS.weight.max,
    {
      message: activityMessages.validation.weightMultiplierRange,
    },
  )
  .refine((raw) => Math.abs(Math.round(raw * 100) - raw * 100) < 1e-9, {
    message: activityMessages.validation.weightMultiplierDecimals,
  });

export type CreateActivityPayloadInput = {
  readonly type: ActivityType;
  readonly format: ActivityFormat;
  readonly title: string;
  readonly description?: string;
  readonly opensAt?: string;
  readonly dueAt: string;
  readonly allowLate?: boolean;
  readonly maxScore: number;
  readonly weightMultiplier?: number;
  readonly questions?: readonly QuestionInputDto[];
};

/**
 * Client-side usability validation for `CreateActivityDto`, mirroring the
 * contract invariants from `src/api/schema.generated.ts` and backend
 * `activities.dto.ts`:
 * - `opensAt` is EXAM-only and strictly before `dueAt` (`null` is rejected
 *   server-side, so the payload keeps it absent rather than `null`);
 * - `maxScore` is an integer in `0..100`;
 * - `weightMultiplier` is in `0.5..3` with at most two decimal places;
 * - `questions` (`1..50`, each with `2..6` options and exactly one correct) are
 *   required for `MULTIPLE_CHOICE` and forbidden for `FILE`.
 * The server remains authoritative over every bound.
 */
export const createActivityPayloadSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    format: z.enum(ACTIVITY_FORMATS),
    title: activityTitleSchema,
    description: activityDescriptionSchema.default(''),
    opensAt: instantSchema.optional(),
    dueAt: instantSchema,
    allowLate: z.boolean().default(false),
    maxScore: maxScoreSchema,
    weightMultiplier: weightMultiplierSchema.default(
      ACTIVITY_LIMITS.weight.default,
    ),
    questions: z.array(questionInputSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'TP' && value.opensAt !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.opensAtOnlyForExams,
        path: ['opensAt'],
      });
    }
    if (
      value.opensAt !== undefined &&
      Date.parse(value.opensAt) >= Date.parse(value.dueAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.opensAtBeforeDueAt,
        path: ['opensAt'],
      });
    }
    if (value.format === 'MULTIPLE_CHOICE') {
      if (
        value.questions === undefined ||
        value.questions.length < ACTIVITY_LIMITS.questions.min
      ) {
        ctx.addIssue({
          code: 'custom',
          message: activityMessages.validation.questionsRequired,
          path: ['questions'],
        });
      } else if (value.questions.length > ACTIVITY_LIMITS.questions.max) {
        ctx.addIssue({
          code: 'custom',
          message: activityMessages.validation.questionsTooMany,
          path: ['questions'],
        });
      }
    }
    if (value.format === 'FILE' && value.questions !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.questionsForbiddenForFile,
        path: ['questions'],
      });
    }
  });

export const createActivityDtoSchema = createActivityPayloadSchema;

export type CreateActivityPayload = z.output<
  typeof createActivityPayloadSchema
>;

/** Maps validated payload output into the generated `CreateActivityDto`. */
export function toCreateActivityDto(
  values: CreateActivityPayload,
): CreateActivityDto {
  const dto: CreateActivityDto = {
    type: values.type,
    format: values.format,
    title: values.title,
    description: values.description,
    dueAt: values.dueAt,
    allowLate: values.allowLate,
    maxScore: values.maxScore,
    weightMultiplier: values.weightMultiplier,
  };
  if (values.opensAt !== undefined) {
    dto.opensAt = values.opensAt;
  }
  if (values.questions !== undefined) {
    dto.questions = [...values.questions];
  }
  return dto;
}

export type UpdateActivityPayloadInput = {
  readonly title?: string;
  readonly description?: string;
  readonly opensAt?: string;
  readonly dueAt?: string;
  readonly allowLate?: boolean;
  readonly maxScore?: number;
  readonly weightMultiplier?: number;
  readonly questions?: readonly QuestionInputDto[];
};

/**
 * Client-side usability validation for `UpdateActivityDto`. The type and format
 * are immutable after creation, so they are not part of the payload. `questions`
 * replace all questions and options and are only valid until the first
 * submission exists (then the server answers `409`).
 */
export const updateActivityPayloadSchema = z
  .object({
    title: activityTitleSchema.optional(),
    description: activityDescriptionSchema.optional(),
    opensAt: instantSchema.optional(),
    dueAt: instantSchema.optional(),
    allowLate: z.boolean().optional(),
    maxScore: maxScoreSchema.optional(),
    weightMultiplier: weightMultiplierSchema.optional(),
    questions: z
      .array(questionInputSchema)
      .min(
        ACTIVITY_LIMITS.questions.min,
        activityMessages.validation.questionsRequired,
      )
      .max(
        ACTIVITY_LIMITS.questions.max,
        activityMessages.validation.questionsTooMany,
      )
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.opensAt !== undefined &&
      value.dueAt !== undefined &&
      Date.parse(value.opensAt) >= Date.parse(value.dueAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: activityMessages.validation.opensAtBeforeDueAt,
        path: ['opensAt'],
      });
    }
  });

export const updateActivityDtoSchema = updateActivityPayloadSchema;

export type UpdateActivityValidatedPayload = z.output<
  typeof updateActivityPayloadSchema
>;

/** Maps validated payload output into the generated `UpdateActivityDto`. */
export function toUpdateActivityDto(
  values: UpdateActivityValidatedPayload,
): UpdateActivityPayload {
  return {
    ...(values.title !== undefined ? { title: values.title } : {}),
    ...(values.description !== undefined
      ? { description: values.description }
      : {}),
    ...(values.opensAt !== undefined ? { opensAt: values.opensAt } : {}),
    ...(values.dueAt !== undefined ? { dueAt: values.dueAt } : {}),
    ...(values.allowLate !== undefined ? { allowLate: values.allowLate } : {}),
    ...(values.maxScore !== undefined ? { maxScore: values.maxScore } : {}),
    ...(values.weightMultiplier !== undefined
      ? { weightMultiplier: values.weightMultiplier }
      : {}),
    ...(values.questions !== undefined
      ? { questions: [...values.questions] }
      : {}),
  };
}

const baseActivityFields = {
  id: z.string().uuid(),
  classroomId: z.string().uuid(),
  type: z.enum(ACTIVITY_TYPES),
  format: z.enum(ACTIVITY_FORMATS),
  state: z.enum(ACTIVITY_STATES),
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

export const paginatedActivityListSchema: z.ZodType<PaginatedActivityListDto> =
  z.object({
    items: z.array(activitySummaryDtoSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  });

export const paginatedActivitiesDtoSchema = paginatedActivityListSchema;

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

/** Teacher view of one activity: preserves `createdById` and `isCorrect`. */
export const teacherActivityDetailDtoSchema: z.ZodType<TeacherActivityResponseDto> =
  z.object({
    ...baseActivityFields,
    createdById: z.string().uuid(),
    questions: z.array(teacherQuestionSchema),
  });

export const teacherActivityResponseSchema = teacherActivityDetailDtoSchema;

/** Student view of one activity: never includes `createdById` or `isCorrect`. */
export const studentActivityDetailDtoSchema: z.ZodType<StudentActivityResponseDto> =
  z.object({
    ...baseActivityFields,
    questions: z.array(studentQuestionSchema),
  });

export const studentActivityResponseSchema = studentActivityDetailDtoSchema;

export const activityDetailDtoSchema: z.ZodType<ActivityDetailDto> = z.union([
  teacherActivityDetailDtoSchema,
  studentActivityDetailDtoSchema,
]);
