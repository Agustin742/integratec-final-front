import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { authMessages } from './messages';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_UTF8_BYTES } from './register-schema';

// Ensure Zod v4 runs in jitless mode so schema validation never attempts
// `new Function()` under strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type LoginRequestDto = components['schemas']['LoginRequestDto'];

const utf8Encoder = new TextEncoder();

/** Checks whether a raw password fits within bcrypt's 72-byte UTF-8 ceiling. */
export function isWithinUtf8ByteLimit(value: string): boolean {
  return utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_UTF8_BYTES;
}

/**
 * Shared trimmed + lowercased email schema matching backend auth DTO normalization.
 */
export function createNormalizedEmailSchema(messages: {
  readonly required: string;
  readonly invalid: string;
  readonly tooLong: string;
}) {
  return z
    .string()
    .trim()
    .min(1, messages.required)
    .max(EMAIL_MAX_LENGTH, messages.tooLong)
    .pipe(z.email({ error: messages.invalid }))
    .transform((value) => value.toLowerCase());
}

export const loginFormSchema: z.ZodType<
  LoginRequestDto,
  { email: string; password: string }
> = z.object({
  email: createNormalizedEmailSchema({
    required: authMessages.login.validation.emailRequired,
    invalid: authMessages.login.validation.emailInvalid,
    tooLong: authMessages.login.validation.emailTooLong,
  }),
  // Passwords are never trimmed so intentional leading/trailing spaces remain valid.
  password: z
    .string()
    .min(1, authMessages.login.validation.passwordRequired)
    .refine(isWithinUtf8ByteLimit, {
      message: authMessages.login.validation.passwordMaxBytes,
    }),
});

export type LoginFormInput = z.input<typeof loginFormSchema>;
export type LoginFormOutput = z.output<typeof loginFormSchema>;
