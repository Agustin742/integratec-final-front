const APPROVED_DESTINATIONS: ReadonlySet<string> = new Set([
  '/',
  '/invitations/accept',
]);

const INVITATION_ACCEPT_PATH = '/invitations/accept';
const INVITATION_ACCEPT_PREFIX = `${INVITATION_ACCEPT_PATH}?`;
const INVITATION_TOKEN_MAX_LENGTH = 128;
const DISALLOWED_WHITESPACE_OR_CONTROL = /[\s\p{Cc}\u2028\u2029]/u;

function isSafeInvitationAcceptDestination(destination: string): boolean {
  if (!destination.startsWith(INVITATION_ACCEPT_PREFIX)) {
    return false;
  }
  if (
    destination.includes('#') ||
    destination.includes('//') ||
    destination.includes('\\') ||
    DISALLOWED_WHITESPACE_OR_CONTROL.test(destination)
  ) {
    return false;
  }
  const query = destination.slice(INVITATION_ACCEPT_PREFIX.length);
  const params = new URLSearchParams(query);
  const keys = Array.from(params.keys());
  const values = params.getAll('token');
  if (keys.length !== 1 || keys[0] !== 'token' || values.length !== 1) {
    return false;
  }
  const token = values[0];
  if (
    token.length < 1 ||
    token.length > INVITATION_TOKEN_MAX_LENGTH ||
    DISALLOWED_WHITESPACE_OR_CONTROL.test(token)
  ) {
    return false;
  }
  return (
    destination ===
    `${INVITATION_ACCEPT_PREFIX}${new URLSearchParams({ token }).toString()}`
  );
}

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
  if (typeof destination !== 'string') {
    return '/';
  }
  if (approved.has(destination)) {
    return destination;
  }
  if (
    approved.has(INVITATION_ACCEPT_PATH) &&
    isSafeInvitationAcceptDestination(destination)
  ) {
    return destination;
  }
  return '/';
}
