import { z } from 'zod';
import type { components, operations } from '@/api/schema.generated';
import { classroomMessages } from '../messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type TeacherActivityResponseDto =
  components['schemas']['TeacherActivityResponseDto'];
export type StudentActivityResponseDto =
  components['schemas']['StudentActivityResponseDto'];
export type ActivitySummaryDto = components['schemas']['ActivitySummaryDto'];
export type CreateActivityDto = components['schemas']['CreateActivityDto'];
export type UpdateActivityDto = components['schemas']['UpdateActivityDto'];
export type QuestionInputDto = components['schemas']['QuestionInputDto'];
export type PaginatedClassroomActivitiesDto =
  operations['ActivitiesController_list']['responses'][200]['content']['application/json'];

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

/** Instant strings (`opensAt`/`dueAt`) are ISO 8601 with offset, stored as UTC. */
const instantSchema = z
  .string()
  .refine((raw) => !Number.isNaN(Date.parse(raw)), {
    message: classroomMessages.activities.validation.instantInvalid,
  });

const activityTitleSchema = z
  .string()
  .superRefine((raw, ctx) => {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.titleRequired,
      });
      return;
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.titleRequired,
      });
    }
  })
  .transform((raw) => raw.trim());

export { activityTitleSchema };

const questionPromptSchema = z
  .string()
  .superRefine((raw, ctx) => {
    if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.questionPromptRequired,
      });
      return;
    }
    if (raw.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.questionPromptRequired,
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
        message: classroomMessages.activities.validation.optionLabelRequired,
      });
      return;
    }
    if (raw.trim().length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.optionLabelRequired,
      });
    }
  })
  .transform((raw) => raw.trim());

/**
 * Contract rule: "Exactly one option per question must be correct"
 * (`QuestionInputDto` in `schema.generated.ts`), validated per question.
 */
const questionInputSchema: z.ZodType<QuestionInputDto> = z.object({
  prompt: questionPromptSchema,
  options: z
    .array(
      z.object({
        label: optionLabelSchema,
        isCorrect: z.boolean(),
      }),
    )
    .superRefine((options, ctx) => {
      const correctCount = options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: 'custom',
          message:
            classroomMessages.activities.validation.exactlyOneCorrectOption,
        });
      }
    }),
});

export { questionInputSchema };

const positiveScoreSchema = z
  .number()
  .refine((raw) => Number.isFinite(raw), {
    message: classroomMessages.activities.validation.maxScorePositive,
  })
  .refine((raw) => raw > 0, {
    message: classroomMessages.activities.validation.maxScorePositive,
  });

const weightMultiplierSchema = z
  .number()
  .refine((raw) => Number.isFinite(raw) && raw > 0, {
    message: classroomMessages.activities.validation.weightMultiplierPositive,
  })
  .refine((raw) => Math.round(raw * 100) / 100 === raw, {
    message: classroomMessages.activities.validation.weightMultiplierDecimals,
  });

export type CreateActivityPayloadInput = {
  readonly type: 'TP' | 'EXAM';
  readonly format: 'FILE' | 'MULTIPLE_CHOICE';
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
 * contract invariants from `src/api/schema.generated.ts`:
 * - `opensAt` is EXAM-only and strictly before `dueAt` (`null` is rejected
 *   server-side, so the payload keeps it absent rather than `null`);
 * - `questions` are required for `MULTIPLE_CHOICE` and forbidden for `FILE`;
 * - `weightMultiplier` admits at most two decimals.
 * The server remains authoritative over every bound.
 */
export const createActivityPayloadSchema = z
  .object({
    type: z.enum(['TP', 'EXAM']),
    format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
    title: activityTitleSchema,
    description: z.string().default(''),
    opensAt: instantSchema.optional(),
    dueAt: instantSchema,
    allowLate: z.boolean().default(false),
    maxScore: positiveScoreSchema,
    weightMultiplier: weightMultiplierSchema.default(1),
    questions: z.array(questionInputSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'TP' && value.opensAt !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.opensAtOnlyForExams,
        path: ['opensAt'],
      });
    }
    if (
      value.opensAt !== undefined &&
      Date.parse(value.opensAt) >= Date.parse(value.dueAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.opensAtBeforeDueAt,
        path: ['opensAt'],
      });
    }
    if (
      value.format === 'MULTIPLE_CHOICE' &&
      (value.questions === undefined || value.questions.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.questionsRequired,
        path: ['questions'],
      });
    }
    if (value.format === 'FILE' && value.questions !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          classroomMessages.activities.validation.questionsForbiddenForFile,
        path: ['questions'],
      });
    }
  });

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
 * Client-side usability validation for `UpdateActivityDto`. The format is
 * immutable after creation, so it is not part of the payload. `questions`
 * replace all questions and options and are only valid until the first
 * submission exists (then the server answers `409`).
 */
export const updateActivityPayloadSchema = z
  .object({
    title: activityTitleSchema.optional(),
    description: z.string().optional(),
    opensAt: instantSchema.optional(),
    dueAt: instantSchema.optional(),
    allowLate: z.boolean().optional(),
    maxScore: positiveScoreSchema.optional(),
    weightMultiplier: weightMultiplierSchema.optional(),
    questions: z.array(questionInputSchema).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.opensAt !== undefined &&
      value.dueAt !== undefined &&
      Date.parse(value.opensAt) >= Date.parse(value.dueAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: classroomMessages.activities.validation.opensAtBeforeDueAt,
        path: ['opensAt'],
      });
    }
  });

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

/** Teacher view of one activity: includes `isCorrect` on every option. */
export const teacherActivityResponseSchema: z.ZodType<TeacherActivityResponseDto> =
  z.object({
    id: z.string().min(1),
    classroomId: z.string().min(1),
    type: z.enum(['TP', 'EXAM']),
    format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
    state: z.enum(['DRAFT', 'PUBLISHED']),
    title: z.string().min(1),
    description: z.string(),
    opensAt: z.string().min(1).nullable(),
    dueAt: z.string().min(1),
    allowLate: z.boolean(),
    maxScore: z.number(),
    weightMultiplier: z.number(),
    publishedAt: z.string().min(1).nullable(),
    timeZone: z.string().min(1),
    questionCount: z.number().int().min(0),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    createdById: z.string().min(1),
    questions: z.array(
      z.object({
        id: z.string().min(1),
        position: z.number().int(),
        prompt: z.string().min(1),
        options: z.array(
          z.object({
            id: z.string().min(1),
            position: z.number().int(),
            label: z.string().min(1),
            isCorrect: z.boolean(),
          }),
        ),
      }),
    ),
  });

/** Student view of one activity: never includes `isCorrect`. */
export const studentActivityResponseSchema: z.ZodType<StudentActivityResponseDto> =
  z.object({
    id: z.string().min(1),
    classroomId: z.string().min(1),
    type: z.enum(['TP', 'EXAM']),
    format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
    state: z.enum(['DRAFT', 'PUBLISHED']),
    title: z.string().min(1),
    description: z.string(),
    opensAt: z.string().min(1).nullable(),
    dueAt: z.string().min(1),
    allowLate: z.boolean(),
    maxScore: z.number(),
    weightMultiplier: z.number(),
    publishedAt: z.string().min(1).nullable(),
    timeZone: z.string().min(1),
    questionCount: z.number().int().min(0),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    questions: z.array(
      z.object({
        id: z.string().min(1),
        position: z.number().int(),
        prompt: z.string().min(1),
        options: z.array(
          z.object({
            id: z.string().min(1),
            position: z.number().int(),
            label: z.string().min(1),
          }),
        ),
      }),
    ),
  });

export const activitySummarySchema: z.ZodType<ActivitySummaryDto> = z.object({
  id: z.string().min(1),
  classroomId: z.string().min(1),
  type: z.enum(['TP', 'EXAM']),
  format: z.enum(['FILE', 'MULTIPLE_CHOICE']),
  state: z.enum(['DRAFT', 'PUBLISHED']),
  title: z.string().min(1),
  description: z.string(),
  opensAt: z.string().min(1).nullable(),
  dueAt: z.string().min(1),
  allowLate: z.boolean(),
  maxScore: z.number(),
  weightMultiplier: z.number(),
  publishedAt: z.string().min(1).nullable(),
  timeZone: z.string().min(1),
  questionCount: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const paginatedClassroomActivitiesSchema: z.ZodType<PaginatedClassroomActivitiesDto> =
  z.object({
    items: z.array(activitySummarySchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });
