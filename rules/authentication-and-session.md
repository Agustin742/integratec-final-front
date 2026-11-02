# Authentication and Session Lifecycle

The frontend must represent session state consistently without acting as the security authority. Baseline authorization requirements remain in [Security](./security.md).

## Session states

- The application **MUST** distinguish session initialization, authenticated access, unauthenticated access, and inability to verify a session.
- Protected content **MUST NOT** flash while initial session validity is unresolved.
- A network failure **MUST NOT** automatically be treated as invalid credentials or successful logout.
- The session mechanism follows the backend decision D1 (short-lived access token plus a rotated refresh token; a revoked session yields `401`) and the frontend decision FD1, both recorded in the [technical justification](../docs/technical-justification.md#architecture-decisions).
- Redirect destinations **MUST** be constrained to approved application locations rather than trust arbitrary supplied URLs.

## Token storage and transport

- Both the access token and the refresh token **MUST** be stored in `sessionStorage` (FD1). They **MUST NOT** be stored in `localStorage`, cookies, or any other persistent storage.
- The access token **MUST** be sent as an `Authorization: Bearer` header; the refresh token **MUST** be sent only to the refresh endpoint. Because no cookies carry credentials, API calls need no CSRF token.
- Each new tab or window requires login and the session ends when the tab closes; the interface **MUST NOT** assume a session survives either.
- Tokens are readable by any script running in the page, so these mitigations are mandatory:
  - The application **MUST** be served with a strict Content-Security-Policy: no inline scripts, no `unsafe-eval`, and allowlisted sources only.
  - The application **MUST NOT** render unsanitized HTML, and **MUST NOT** use `dangerouslySetInnerHTML` with user content ([Security](./security.md#input-transport-and-failures)).
  - Third-party scripts **MUST NOT** be added beyond those the team approves.
  - Both tokens **MUST** be cleared on logout and on any `401` that remains after a failed refresh.
- Renewal uses the short access-token lifetime and refresh rotation defined by D1; token lifetimes are backend configuration.

## Expiration and logout

- Invalid authentication **MUST** lead to the agreed unauthenticated flow. Insufficient permission **MUST NOT** cause an endless login loop.
- If renewal exists, it **MUST** have bounded recovery and **MUST NOT** replay non-idempotent operations without an explicit safe contract.
- Logout **MUST** remove protected frontend content, private cached data, and authenticated subscriptions.
- If server-side logout cannot be confirmed, feedback **MUST NOT** claim that the server session was invalidated.
- Account changes and late responses **MUST NOT** expose the previous user's data; see [State management](./state-management.md).

## Verification

Check initial loading, expired credentials, forbidden resources, offline behavior, logout, and account switching. Backend authorization **MUST** also be verified directly as required by [Security](./security.md#verification-and-ownership).
