export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Generates a fresh UUID v4 idempotency key for mutations that the backend contract
 * marks as idempotent. Generate once per user-initiated operation and reuse the same
 * key across bounded retries of that operation.
 */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Returns a headers record containing `Idempotency-Key` set to `key` (or a newly
 * generated UUID when omitted), preserving any caller-supplied headers.
 */
export function withIdempotencyKey(
  headers: Readonly<Record<string, string>> = {},
  key: string = createIdempotencyKey(),
): Record<string, string> {
  const normalizedKey = key.trim();
  if (normalizedKey === '') {
    throw new Error('Idempotency-Key must be a non-empty string.');
  }
  return {
    ...headers,
    [IDEMPOTENCY_HEADER]: normalizedKey,
  };
}
