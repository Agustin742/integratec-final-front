import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import {
  createNormalizedEmailSchema,
  isWithinUtf8ByteLimit,
  loginFormSchema,
} from './login-schema';
import { authMessages } from './messages';
import {
  passwordResetConfirmFormSchema,
  passwordResetRequestFormSchema,
} from './password-reset-schema';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MAX_UTF8_BYTES,
  PASSWORD_MIN_LENGTH,
  registerFormSchema,
  toRegisterRequestDto,
} from './register-schema';

const registration = {
  path: 'INDEPENDENT_TEACHER',
  displayName: '  Synthetic Teacher  ',
  email: '  Teacher@Example.COM  ',
  password: '  secret12  ',
  schoolName: ' ignored ',
};

// Captured from the clean c706b55 working-tree source before extraction;
// these expressions deliberately do not use the shared helpers/constants.
const priorEmail = z
  .string()
  .trim()
  .min(1, authMessages.validation.emailRequired)
  .max(255, authMessages.validation.emailTooLong)
  .pipe(z.email({ error: authMessages.validation.emailInvalid }))
  .transform((value) => value.toLowerCase());
const priorPassword = z
  .string()
  .min(8, authMessages.validation.passwordMin)
  .max(72, authMessages.validation.passwordMax)
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72, {
    message: authMessages.validation.passwordMaxBytes,
  });
const priorFields = z.object({ email: priorEmail, password: priorPassword });

function outcome(schema: z.ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { data: parsed.data }
    : { issues: parsed.error.issues };
}

describe('shared auth validation compatibility', () => {
  test('preserves public registration constants and helper exports for reset consumers', () => {
    expect([
      EMAIL_MAX_LENGTH,
      PASSWORD_MIN_LENGTH,
      PASSWORD_MAX_LENGTH,
      PASSWORD_MAX_UTF8_BYTES,
    ]).toEqual([255, 8, 72, 72]);
    expect(isWithinUtf8ByteLimit('é'.repeat(36))).toBe(true);
    expect(isWithinUtf8ByteLimit('é'.repeat(37))).toBe(false);
    expect(
      createNormalizedEmailSchema({
        required: 'required',
        invalid: 'invalid',
        tooLong: 'long',
      }).parse(' Teacher@Example.COM '),
    ).toBe('teacher@example.com');
  });

  test('matches prior registration field outcomes over 72 bounded differential cases', () => {
    const emails = [
      registration.email,
      '',
      ' ',
      'invalid',
      `${'a'.repeat(243)}@example.com`,
      `${'a'.repeat(244)}@example.com`,
    ];
    const passwords = [
      '',
      'a'.repeat(7),
      'a'.repeat(8),
      'a'.repeat(72),
      'a'.repeat(73),
      'é'.repeat(36),
      'é'.repeat(37),
      '😀'.repeat(18),
      '😀'.repeat(19),
      '  secret12  ',
      ' '.repeat(8),
      '\ud800'.repeat(24),
    ];
    let comparisons = 0;
    for (const email of emails) {
      for (const password of passwords) {
        const input = { ...registration, email, password };
        const prior = priorFields.safeParse(input);
        const current = registerFormSchema.safeParse(input);
        expect(current.success).toBe(prior.success);
        if (prior.success && current.success) {
          expect(current.data).toEqual({
            ...registration,
            displayName: 'Synthetic Teacher',
            ...prior.data,
          });
          expect(toRegisterRequestDto(current.data)).toEqual({
            path: 'INDEPENDENT_TEACHER',
            displayName: 'Synthetic Teacher',
            ...prior.data,
          });
        } else if (!prior.success && !current.success) {
          expect(current.error.issues).toEqual(prior.error.issues);
        }
        comparisons += 1;
      }
    }
    expect(comparisons).toBe(72);
  });

  test.each([
    ['a'.repeat(7), false],
    ['a'.repeat(8), true],
    ['a'.repeat(72), true],
    ['a'.repeat(73), false],
    ['é'.repeat(36), true],
    ['é'.repeat(37), false],
    ['😀'.repeat(18), true],
    ['😀'.repeat(19), false],
    ['  secret12  ', true],
  ] as const)(
    'keeps registration and reset password bounds identical for %s',
    (password, valid) => {
      expect(
        registerFormSchema.safeParse({ ...registration, password }).success,
      ).toBe(valid);
      const reset = passwordResetConfirmFormSchema.safeParse({
        newPassword: password,
      });
      expect(reset.success).toBe(valid);
      if (reset.success) expect(reset.data.newPassword).toBe(password);
    },
  );

  test('keeps each form-specific email error and normalization unchanged', () => {
    for (const email of [
      registration.email,
      '',
      'invalid',
      `${'a'.repeat(244)}@example.com`,
    ]) {
      const schemas = [
        [registerFormSchema, authMessages.validation],
        [loginFormSchema, authMessages.login.validation],
        [
          passwordResetRequestFormSchema,
          authMessages.passwordReset.request.validation,
        ],
      ] as const;
      for (const [schema, messages] of schemas) {
        const expected = createNormalizedEmailSchema({
          required: messages.emailRequired,
          invalid: messages.emailInvalid,
          tooLong: messages.emailTooLong,
        });
        const actual = schema.safeParse({ ...registration, email });
        const prior = expected.safeParse(email);
        expect(actual.success).toBe(prior.success);
        if (actual.success && prior.success)
          expect(actual.data.email).toBe(prior.data);
        if (!actual.success && !prior.success) {
          expect(actual.error.issues).toEqual(
            prior.error.issues.map((issue) => ({
              ...issue,
              path: ['email', ...issue.path],
            })),
          );
        }
      }
    }
    expect(
      outcome(loginFormSchema, { email: registration.email, password: 'x' }),
    ).toEqual({ data: { email: 'teacher@example.com', password: 'x' } });
  });
});
