const APPROVED_DESTINATIONS: ReadonlySet<string> = new Set(['/']);

/** Exact matching rejects URL syntax/encoding; route stories own expansion. */
export function safeSessionRedirect(destination: unknown): string {
  return typeof destination === 'string' &&
    APPROVED_DESTINATIONS.has(destination)
    ? destination
    : '/';
}
