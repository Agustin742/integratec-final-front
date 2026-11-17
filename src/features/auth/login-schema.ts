import { z } from 'zod';
import type { components } from '@/api/schema.generated';
import { authMessages } from './messages';
import {
  createNormalizedEmailSchema,
  isWithinUtf8ByteLimit,
} from './auth-validation';

// Preserve the existing imports used by password-reset-schema and other consumers.
export {
  createNormalizedEmailSchema,
  isWithinUtf8ByteLimit,
} from './auth-validation';

// Ensure Zod v4 runs in jitless mode so schema validation never attempts
// `new Function()` under strict Content-Security-Policy (FD1).
z.config({ jitless: true });

export type LoginRequestDto = components['schemas']['LoginRequestDto'];

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
