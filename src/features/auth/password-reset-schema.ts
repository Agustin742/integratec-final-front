import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import {
  createNormalizedEmailSchema,
  isWithinUtf8ByteLimit,
} from './login-schema';
import { authMessages } from './messages';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './register-schema';

// Ensure Zod v4 runs in jitless mode so schema validation never attempts
// `new Function()` under strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export const RESET_TOKEN_MAX_LENGTH = 512;

export type PasswordResetRequestDto =
  components['schemas']['PasswordResetRequestDto'];
export type PasswordResetRequestedResponseDto =
  components['schemas']['PasswordResetRequestedResponseDto'];
export type PasswordResetConfirmRequestDto =
  components['schemas']['PasswordResetConfirmRequestDto'];

export const passwordResetRequestFormSchema: z.ZodType<
  PasswordResetRequestDto,
  { email: string }
> = z.object({
  email: createNormalizedEmailSchema({
    required: authMessages.passwordReset.request.validation.emailRequired,
    invalid: authMessages.passwordReset.request.validation.emailInvalid,
    tooLong: authMessages.passwordReset.request.validation.emailTooLong,
  }),
});

export type PasswordResetRequestFormInput = z.input<
  typeof passwordResetRequestFormSchema
>;
export type PasswordResetRequestFormOutput = z.output<
  typeof passwordResetRequestFormSchema
>;

export const passwordResetRequestedResponseSchema: z.ZodType<PasswordResetRequestedResponseDto> =
  z.object({
    message: z.string().min(1),
  });

// Passwords are never trimmed so intentional leading/trailing spaces remain valid.
const newPasswordFieldSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    authMessages.passwordReset.confirm.validation.passwordMin,
  )
  .max(
    PASSWORD_MAX_LENGTH,
    authMessages.passwordReset.confirm.validation.passwordMax,
  )
  .refine(isWithinUtf8ByteLimit, {
    message: authMessages.passwordReset.confirm.validation.passwordMaxBytes,
  });

export const passwordResetConfirmFormSchema = z.object({
  newPassword: newPasswordFieldSchema,
});

export type PasswordResetConfirmFormInput = z.input<
  typeof passwordResetConfirmFormSchema
>;
export type PasswordResetConfirmFormOutput = z.output<
  typeof passwordResetConfirmFormSchema
>;

export const resetTokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(RESET_TOKEN_MAX_LENGTH);

export const passwordResetConfirmRequestSchema: z.ZodType<PasswordResetConfirmRequestDto> =
  z.object({
    token: resetTokenSchema,
    newPassword: newPasswordFieldSchema,
  });
