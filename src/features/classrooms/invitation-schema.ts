import { z } from 'zod';
import type { components, operations } from '@/api/schema.generated';
import { classroomMessages } from './messages';

// Keep Zod v4 compatible with the strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const JOIN_CODE_MAX_USES_MIN = 1;
export const JOIN_CODE_MAX_USES_MAX = 1000;
export const JOIN_CODE_EXPIRES_MIN_SECONDS = 60;
export const JOIN_CODE_EXPIRES_MAX_SECONDS = 2_592_000;
export const INVITATION_EMAIL_MAX_LENGTH = 320;

const FORBIDDEN_CONTROL_CHARACTERS = /[\p{Cc}\p{Zl}\p{Zp}]/u;

export const invitationKindSchema = z.enum(['EMAIL', 'JOIN_CODE']);
export const invitationRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
]);
export const emailInvitationRoleSchema = z.enum(['STUDENT', 'PARENT']);
export const invitationStateSchema = z.enum([
  'PENDING',
  'USED',
  'REVOKED',
  'EXPIRED',
]);
export const parentLinkStateSchema = z.enum(['ACTIVE', 'INACTIVE']);

export type InvitationKind = z.infer<typeof invitationKindSchema>;
export type InvitationRole = z.infer<typeof invitationRoleSchema>;
export type EmailInvitationRole = z.infer<typeof emailInvitationRoleSchema>;
export type InvitationState = z.infer<typeof invitationStateSchema>;
export type ParentLinkState = z.infer<typeof parentLinkStateSchema>;

export type CreateClassroomInvitationDto =
  components['schemas']['CreateClassroomInvitationDto'];
export type CreateJoinCodeDto = components['schemas']['CreateJoinCodeDto'];
export type RevokeInvitationResponseDto =
  components['schemas']['RevokeInvitationResponseDto'];
export type RevokeJoinCodeResponseDto =
  operations['ClassroomsController_revokeJoinCode']['responses'][200]['content']['application/json'];
export type ClassroomParentLinkDto =
  components['schemas']['ClassroomParentLinkDto'];
export type ClassroomParentLinksResponseDto =
  components['schemas']['ClassroomParentLinksResponseDto'];

/**
 * Narrow adaptation for `ClassroomInvitationResponseDto` (`schema.generated.ts`
 * emits `targetEmail?: Record<string, never> | null`, `maxUses?: Record<string, never> | null`,
 * `childId?: Record<string, never> | null`, and `childDisplayName?: Record<string, never> | null`
 * from Swagger `nullable: true`).
 */
export type ClassroomInvitationDto = Omit<
  components['schemas']['ClassroomInvitationResponseDto'],
  'targetEmail' | 'maxUses' | 'childId' | 'childDisplayName'
> & {
  readonly targetEmail: string | null;
  readonly maxUses: number | null;
  readonly childId: string | null;
  readonly childDisplayName: string | null;
};

/**
 * Narrow adaptation for `CreatedClassroomInvitationResponseDto`.
 */
export type CreatedClassroomInvitationDto = Omit<
  components['schemas']['CreatedClassroomInvitationResponseDto'],
  'targetEmail' | 'maxUses' | 'childId' | 'childDisplayName'
> & {
  readonly targetEmail: string | null;
  readonly maxUses: number | null;
  readonly childId: string | null;
  readonly childDisplayName: string | null;
};

export interface PaginatedClassroomInvitationsDto {
  readonly items: ClassroomInvitationDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * Narrow adaptation for `JoinCodeResponseDto`.
 */
export type JoinCodeDto = Omit<
  components['schemas']['JoinCodeResponseDto'],
  'maxUses'
> & {
  readonly maxUses: number | null;
};

export const joinCodeExpiresPresetSchema = z.enum([
  'default',
  '1h',
  '24h',
  '7d',
  '30d',
]);

export type JoinCodeExpiresPreset = z.infer<typeof joinCodeExpiresPresetSchema>;

export const JOIN_CODE_EXPIRES_PRESET_SECONDS: Readonly<
  Record<JoinCodeExpiresPreset, number | undefined>
> = {
  default: undefined,
  '1h': 3_600,
  '24h': 86_400,
  '7d': 604_800,
  '30d': 2_592_000,
};

export const sendInvitationFormSchema = z
  .object({
    email: z
      .string()
      .superRefine((raw, ctx) => {
        if (FORBIDDEN_CONTROL_CHARACTERS.test(raw)) {
          ctx.addIssue({
            code: 'custom',
            message:
              classroomMessages.invitations.email.validation.emailControlChars,
          });
          return;
        }
        const trimmed = raw.trim();
        if (trimmed.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message:
              classroomMessages.invitations.email.validation.emailRequired,
          });
          return;
        }
        if (trimmed.length > INVITATION_EMAIL_MAX_LENGTH) {
          ctx.addIssue({
            code: 'custom',
            message:
              classroomMessages.invitations.email.validation.emailTooLong,
          });
          return;
        }
        const emailCheck = z.email().safeParse(trimmed);
        if (!emailCheck.success) {
          ctx.addIssue({
            code: 'custom',
            message:
              classroomMessages.invitations.email.validation.emailInvalid,
          });
        }
      })
      .transform((raw) => raw.trim()),
    role: emailInvitationRoleSchema,
    childId: z.string().transform((raw) => raw.trim()),
  })
  .superRefine((values, ctx) => {
    if (values.role === 'PARENT' && values.childId.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['childId'],
        message: classroomMessages.invitations.email.validation.childRequired,
      });
    }
  });

export type SendInvitationFormInput = z.input<typeof sendInvitationFormSchema>;
export type SendInvitationFormOutput = z.output<
  typeof sendInvitationFormSchema
>;

/** Maps validated email-invitation form values into `CreateClassroomInvitationDto`. */
export function toCreateClassroomInvitationPayload(
  values: SendInvitationFormOutput,
  options: { readonly adultMode?: boolean } = {},
): CreateClassroomInvitationDto {
  const effectiveRole: EmailInvitationRole = options.adultMode
    ? 'STUDENT'
    : values.role;
  if (effectiveRole === 'PARENT') {
    return {
      email: values.email,
      role: 'PARENT',
      childId: values.childId,
    };
  }
  return {
    email: values.email,
    role: 'STUDENT',
  };
}

export const generateJoinCodeFormSchema = z.object({
  maxUses: z
    .string()
    .transform((raw) => raw.trim())
    .superRefine((trimmed, ctx) => {
      if (trimmed === '') {
        return;
      }
      if (!/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: 'custom',
          message:
            classroomMessages.invitations.joinCode.validation.maxUsesInvalid,
        });
        return;
      }
      const parsed = Number(trimmed);
      if (
        !Number.isInteger(parsed) ||
        parsed < JOIN_CODE_MAX_USES_MIN ||
        parsed > JOIN_CODE_MAX_USES_MAX
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            classroomMessages.invitations.joinCode.validation.maxUsesInvalid,
        });
      }
    })
    .transform((trimmed) => (trimmed === '' ? undefined : Number(trimmed))),
  expiresPreset: joinCodeExpiresPresetSchema,
});

export type GenerateJoinCodeFormInput = z.input<
  typeof generateJoinCodeFormSchema
>;
export type GenerateJoinCodeFormOutput = z.output<
  typeof generateJoinCodeFormSchema
>;

/** Maps validated join-code form values into `CreateJoinCodeDto`. */
export function toCreateJoinCodePayload(
  values: GenerateJoinCodeFormOutput,
): CreateJoinCodeDto {
  const expiresInSeconds =
    JOIN_CODE_EXPIRES_PRESET_SECONDS[values.expiresPreset];
  return {
    ...(values.maxUses !== undefined ? { maxUses: values.maxUses } : {}),
    ...(expiresInSeconds !== undefined &&
    expiresInSeconds >= JOIN_CODE_EXPIRES_MIN_SECONDS &&
    expiresInSeconds <= JOIN_CODE_EXPIRES_MAX_SECONDS
      ? { expiresInSeconds }
      : {}),
  };
}

const optionalNullableString = z
  .string()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const optionalNullableMaxUses = z
  .number()
  .int()
  .min(1)
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const classroomInvitationFields = {
  id: z.string().min(1),
  kind: invitationKindSchema,
  targetEmail: optionalNullableString,
  role: invitationRoleSchema,
  childId: optionalNullableString,
  childDisplayName: optionalNullableString,
  maxUses: optionalNullableMaxUses,
  useCount: z.number().int().min(0),
  state: invitationStateSchema,
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
};

export const classroomInvitationSchema: z.ZodType<
  ClassroomInvitationDto,
  unknown
> = z.object(classroomInvitationFields);

export const createdClassroomInvitationSchema: z.ZodType<
  CreatedClassroomInvitationDto,
  unknown
> = z.object({
  ...classroomInvitationFields,
  token: z.string().min(1),
});

export const paginatedClassroomInvitationsSchema: z.ZodType<
  PaginatedClassroomInvitationsDto,
  unknown
> = z.object({
  items: z.array(classroomInvitationSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
});

export const revokeInvitationResponseSchema: z.ZodType<RevokeInvitationResponseDto> =
  z.object({
    id: z.string().min(1),
    state: invitationStateSchema,
  });

export const joinCodeResponseSchema: z.ZodType<JoinCodeDto, unknown> = z.object(
  {
    id: z.string().min(1),
    code: z.string().min(1),
    role: invitationRoleSchema,
    maxUses: optionalNullableMaxUses,
    useCount: z.number().int().min(0),
    state: invitationStateSchema,
    expiresAt: z.string().min(1),
    createdAt: z.string().min(1),
  },
);

export const revokeJoinCodeResponseSchema: z.ZodType<RevokeJoinCodeResponseDto> =
  z.object({
    success: z.boolean().optional(),
    message: z.string().optional(),
  });

export const classroomParentLinkSchema: z.ZodType<ClassroomParentLinkDto> =
  z.object({
    id: z.string().min(1),
    parentId: z.string().min(1),
    parentDisplayName: z.string().min(1),
    childId: z.string().min(1),
    childDisplayName: z.string().min(1),
    state: parentLinkStateSchema,
    createdAt: z.string().min(1),
  });

export const classroomParentLinksResponseSchema: z.ZodType<ClassroomParentLinksResponseDto> =
  z.object({
    items: z.array(classroomParentLinkSchema),
  });
