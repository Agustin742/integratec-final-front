import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { tokenPairSchema } from '@/session/storage';
import { authMessages } from './messages';
import {
  createNormalizedEmailSchema,
  isWithinUtf8ByteLimit,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth-validation';

export {
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_UTF8_BYTES,
} from './auth-validation';

// Ensure Zod v4 runs in jitless mode so schema validation never attempts
// `new Function()` under strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const SCHOOL_NAME_MAX_LENGTH = 150;

export const REGISTRATION_CHOICES = [
  'INDEPENDENT_TEACHER',
  'SCHOOL',
  'INVITEE',
] as const;

export type RegistrationChoice = (typeof REGISTRATION_CHOICES)[number];
export type RegisterRequestDto = components['schemas']['RegisterRequestDto'];
export type RegisterResponseDto = components['schemas']['RegisterResponseDto'];
export type SchoolSummaryDto = components['schemas']['SchoolSummaryDto'];
export type RegistrationPath = RegisterRequestDto['path'];

export const registrationChoiceSchema = z.enum(REGISTRATION_CHOICES, {
  error: authMessages.validation.pathRequired,
});

export const registerFormSchema = z
  .object({
    path: registrationChoiceSchema,
    displayName: z
      .string()
      .trim()
      .min(1, authMessages.validation.displayNameRequired)
      .max(DISPLAY_NAME_MAX_LENGTH, authMessages.validation.displayNameTooLong),
    email: createNormalizedEmailSchema({
      required: authMessages.validation.emailRequired,
      invalid: authMessages.validation.emailInvalid,
      tooLong: authMessages.validation.emailTooLong,
    }),
    // Passwords are never trimmed so intentional leading/trailing spaces remain valid.
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, authMessages.validation.passwordMin)
      .max(PASSWORD_MAX_LENGTH, authMessages.validation.passwordMax)
      .refine(isWithinUtf8ByteLimit, {
        message: authMessages.validation.passwordMaxBytes,
      }),
    schoolName: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.path === 'SCHOOL') {
      const trimmedSchoolName = data.schoolName.trim();
      if (trimmedSchoolName.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['schoolName'],
          message: authMessages.validation.schoolNameRequired,
        });
      } else if (trimmedSchoolName.length > SCHOOL_NAME_MAX_LENGTH) {
        ctx.addIssue({
          code: 'custom',
          path: ['schoolName'],
          message: authMessages.validation.schoolNameTooLong,
        });
      }
    }
  });

export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormOutput = z.output<typeof registerFormSchema>;

/**
 * Maps validated registration form values into `RegisterRequestDto`,
 * omitting `schoolName` when registering as an independent teacher or invitee.
 */
export function toRegisterRequestDto(
  values: RegisterFormOutput,
): RegisterRequestDto {
  if (values.path === 'SCHOOL') {
    return {
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      path: 'SCHOOL',
      schoolName: values.schoolName.trim(),
    };
  }

  if (values.path === 'INVITEE') {
    return {
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      path: 'INVITEE',
    };
  }

  return {
    email: values.email,
    password: values.password,
    displayName: values.displayName,
    path: 'INDEPENDENT_TEACHER',
  };
}

const schoolSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  timeZone: z.string().min(1),
});

export const registerResponseSchema: z.ZodType<RegisterResponseDto> = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    displayName: z.string().min(1),
    path: z.enum(['INDEPENDENT_TEACHER', 'SCHOOL', 'INVITEE']),
    school: schoolSummarySchema.optional(),
    createdAt: z.string().min(1),
    session: tokenPairSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.path === 'SCHOOL' && value.school === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['school'],
        message: authMessages.errors.invalidResponse,
      });
    }
  });
