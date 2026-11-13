const APPROVED_DESTINATIONS: ReadonlySet<string> = new Set(['/']);

/**
 * Exact matching rejects URL syntax/encoding; route stories own expansion.
 *
 * `approved` exists so tests can prove the forwarding path with a destination
 * production does not approve yet. No application code passes it: the
 * production allowlist is the default and stays the single source of truth.
 */
export function safeSessionRedirect(
  destination: unknown,
  approved: ReadonlySet<string> = APPROVED_DESTINATIONS,
): string {
  return typeof destination === 'string' && approved.has(destination)
    ? destination
    : '/';
}
