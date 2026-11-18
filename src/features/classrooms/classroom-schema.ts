import { z } from 'zod';
import type { components, operations } from '@/api/schema.generated';
import { classroomMessages } from './messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const CLASSROOM_NAME_MAX_LENGTH = 120;
export const CLASSROOM_SUBJECT_MAX_LENGTH = 200;

const FORBIDDEN_CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const VISIBLE_CHARACTER =
  /[^\p{White_Space}\p{Default_Ignorable_Code_Point}\p{M}\u2800]/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateClassroomDto = components['schemas']['CreateClassroomDto'];
export type ClassroomDetailResponseDto =
  components['schemas']['ClassroomDetailResponseDto'];
export type ClassroomListItemDto =
  components['schemas']['ClassroomListItemDto'];
export type PaginatedClassroomListDto =
  operations['MeClassroomsController_listMyClassrooms']['responses'][200]['content']['application/json'];

/**
 * Narrow adaptation for `UpdateClassroomDto` (`schema.generated.ts` emits
 * `subject?: Record<string, never> | null` from Swagger `nullable: true`).
 */
export type UpdateClassroomPayload = Omit<
  components['schemas']['UpdateClassroomDto'],
  'subject'
> & {
  readonly subject?: string | null;
};

export const classroomFormSchema = z.object({
  name: z
    .string()
    .superRefine((raw, ctx) => {
      if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.nameControlChars,
        });
        return;
      }
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.nameRequired,
        });
        return;
      }
      if (trimmed.length > CLASSROOM_NAME_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.nameTooLong,
        });
        return;
      }
      if (!VISIBLE_CHARACTER.test(trimmed)) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.nameVisibleRequired,
        });
      }
    })
    .transform((raw) => raw.trim()),
  subject: z
    .string()
    .superRefine((raw, ctx) => {
      if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.subjectControlChars,
        });
        return;
      }
      const trimmed = raw.trim();
      if (trimmed.length === 0) {
        return;
      }
      if (trimmed.length > CLASSROOM_SUBJECT_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.subjectTooLong,
        });
        return;
      }
      if (!VISIBLE_CHARACTER.test(trimmed)) {
        ctx.addIssue({
          code: 'custom',
          message: classroomMessages.form.validation.subjectVisibleRequired,
        });
      }
    })
    .transform((raw) => raw.trim()),
  adultMode: z.boolean(),
  schoolId: z
    .string()
    .transform((raw) => raw.trim())
    .refine((value) => value === '' || UUID_PATTERN.test(value), {
      message: classroomMessages.form.validation.schoolIdInvalid,
    }),
});

export type ClassroomFormInput = z.input<typeof classroomFormSchema>;
export type ClassroomFormOutput = z.output<typeof classroomFormSchema>;

/** Maps validated form output into `CreateClassroomDto`. */
export function toCreateClassroomPayload(
  values: ClassroomFormOutput,
): CreateClassroomDto {
  return {
    name: values.name,
    ...(values.subject !== '' ? { subject: values.subject } : {}),
    adultMode: values.adultMode,
    ...(values.schoolId !== '' ? { schoolId: values.schoolId } : {}),
  };
}

/** Maps validated form output into `PATCH /classrooms/{id}` body. */
export function toUpdateClassroomPayload(
  values: ClassroomFormOutput,
): UpdateClassroomPayload {
  return {
    name: values.name,
    subject: values.subject === '' ? null : values.subject,
    adultMode: values.adultMode,
  };
}

const classroomRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
]);

const classroomCapabilitySchema = z.enum([
  'manage_school',
  'configure_classroom',
  'invite_members',
  'publish_content',
  'moderate_chat',
  'configure_bot',
  'view_metrics',
  'participate_activities',
  'chat_classmates',
  'list_directory',
  'message_teacher',
]);

const classroomOwnershipFields = {
  id: z.string().min(1),
  name: z.string().min(1),
  subject: z.string().nullable(),
  schoolId: z.string().min(1).nullable(),
  independentTeacherId: z.string().min(1).nullable(),
  adultMode: z.boolean(),
  chatMuted: z.boolean(),
  collaborationLocked: z.boolean(),
  gamesDisabled: z.boolean(),
  myRole: classroomRoleSchema,
  capabilities: z.array(classroomCapabilitySchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};

function enforceOrganizationXor(
  value: {
    readonly schoolId: string | null;
    readonly independentTeacherId: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  if ((value.schoolId !== null) === (value.independentTeacherId !== null)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Classroom must belong to a school or an independent teacher.',
    });
  }
}

export const classroomListItemSchema: z.ZodType<ClassroomListItemDto> = z
  .object(classroomOwnershipFields)
  .superRefine(enforceOrganizationXor);

export const paginatedClassroomListSchema: z.ZodType<PaginatedClassroomListDto> =
  z.object({
    items: z.array(classroomListItemSchema),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: z.number().int().min(0),
  });

const classroomPetSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  species: z.string().min(1),
  level: z.number().int().min(0),
  experience: z.number().int().min(0),
});

export const classroomDetailResponseSchema: z.ZodType<ClassroomDetailResponseDto> =
  z
    .object({
      ...classroomOwnershipFields,
      deskCount: z.number().int().min(0),
      pet: classroomPetSummarySchema.nullable(),
    })
    .superRefine(enforceOrganizationXor);
