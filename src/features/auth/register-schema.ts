import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { authMessages } from './messages';

// Ensure Zod v4 runs in jitless mode so schema validation never attempts
// `new Function()` under strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const DISPLAY_NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_MAX_UTF8_BYTES = 72;
export const SCHOOL_NAME_MAX_LENGTH = 150;

export const REGISTRATION_CHOICES = [
  'INDEPENDENT_TEACHER',
  'SCHOOL',
  'INVITATION',
] as const;

export type RegistrationChoice = (typeof REGISTRATION_CHOICES)[number];
export type RegisterRequestDto = components['schemas']['RegisterRequestDto'];
export type RegisterResponseDto = components['schemas']['RegisterResponseDto'];
export type SchoolSummaryDto = components['schemas']['SchoolSummaryDto'];
export type RegistrationPath = RegisterRequestDto['path'];

const utf8Encoder = new TextEncoder();

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
    email: z
      .string()
      .trim()
      .min(1, authMessages.validation.emailRequired)
      .max(EMAIL_MAX_LENGTH, authMessages.validation.emailTooLong)
      .pipe(z.email({ error: authMessages.validation.emailInvalid }))
      .transform((value) => value.toLowerCase()),
    // Passwords are never trimmed so intentional leading/trailing spaces remain valid.
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, authMessages.validation.passwordMin)
      .max(PASSWORD_MAX_LENGTH, authMessages.validation.passwordMax)
      .refine(
        (value) =>
          utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_UTF8_BYTES,
        {
          message: authMessages.validation.passwordMaxBytes,
        },
      ),
    schoolName: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.path === 'INVITATION') {
      ctx.addIssue({
        code: 'custom',
        path: ['path'],
        message: authMessages.validation.pathRequired,
      });
      return;
    }

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
 * omitting `schoolName` when registering as an independent teacher.
 */
export function toRegisterRequestDto(
  values: RegisterFormOutput,
): RegisterRequestDto {
  if (values.path === 'INVITATION') {
    throw new Error('Cannot build RegisterRequestDto for INVITATION path.');
  }

  if (values.path === 'SCHOOL') {
    return {
      email: values.email,
      password: values.password,
      displayName: values.displayName,
      path: 'SCHOOL',
      schoolName: values.schoolName.trim(),
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
    path: z.enum(['INDEPENDENT_TEACHER', 'SCHOOL']),
    school: schoolSummarySchema.optional(),
    createdAt: z.string().min(1),
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
