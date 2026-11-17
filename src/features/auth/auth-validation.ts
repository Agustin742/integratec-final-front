import { z } from 'zod';

// Keep schema construction compatible with the strict Content-Security-Policy.
z.config({ jitless: true });

export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_MAX_UTF8_BYTES = 72;

const utf8Encoder = new TextEncoder();

/** Checks the raw password without trimming or otherwise normalizing it. */
export function isWithinUtf8ByteLimit(value: string): boolean {
  return utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_UTF8_BYTES;
}

/** Matches the backend auth DTO's trimmed, lowercased email normalization. */
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
