# Session lifecycle integration

Frontend [#18](https://github.com/Agustin742/integratec-final-front/issues/18) consumes the authentication contract published by backend `develop`, commit `419240443c6de648ca31f1eb892cff6fb84a3205`. Login screens, route guards and realtime rejoin belong to separate stories.

## Backend contract

| Operation            | Request                                 | Successful response                                                       |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `POST /auth/login`   | Email and password                      | `200`: accessToken, refreshToken, tokenType `Bearer`, expiresIn (seconds) |
| `POST /auth/refresh` | JSON refreshToken; no Bearer            | `200`: replacement token pair                                             |
| `POST /auth/logout`  | Access token as Bearer; no refresh body | `204`: session revoked                                                    |
| `GET /users/me`      | Access token as Bearer                  | `200`: OwnProfileDto                                                      |

Backend dependencies [#18](https://github.com/Agustin742/integratec-final-back/issues/18) and [#20](https://github.com/Agustin742/integratec-final-back/issues/20) are closed. Backend `main` is not the current integration contract. Types are generated, never copied by hand:

```sh
pnpm api:sync --branch 419240443c6de648ca31f1eb892cff6fb84a3205
```

The sync also downloads the Colyseus runtime room-state class. This session-only change commits REST types and shared payload contracts, not that runtime class: it requires the `@colyseus/schema` dependency planned with the Colyseus client. The downloaded room-state artifact is kept locally under ignored `odd/contracts/`; no generated content was hand-edited.

Refresh rotates both credentials. The session retains its original expiry. The published contract allows recently rotated refresh credentials within `REFRESH_REUSE_GRACE` (default 30 seconds); reuse beyond this window revokes the session. Invalid refresh credentials return the same generic `401`, with no distinct reuse error. Frontend renewal must still be single-flight.

## T2 service integration

T2 supplies the framework-independent core; T3 adds React/Query cleanup integration
and safe redirects below. No Zustand store or realtime connection exists yet;
screens, guards and realtime rejoin remain outside this feature. See
[session rules](../rules/authentication-and-session.md),
[state ownership](../rules/state-management.md),
[API contracts](../rules/api-contracts.md) and
[quality requirements](../rules/quality-and-testing.md).

Create one service per application lifetime, outside rendering. Construction reads
validated tab storage but makes no network requests. `initialize()` verifies the
current identity with typed `GET /users/me`; concurrent initialization calls share
the same work. Only the `authenticated` snapshot contains a user. Render no
protected content for any other status, including `unable-to-verify`.

```ts
import { requestApi } from '../src/api/client';
import { createSession } from '../src/session/controller';

const { controller, client } = createSession();
const unsubscribe = controller.subscribe(() => {
  const snapshot = controller.getSnapshot();
  // Let the application render the explicit status, never stored identity.
  void snapshot;
});
const unregisterCleanup = controller.registerCleanup(() => {
  // Consumer owner: synchronously clear private state and release subscriptions.
});
await controller.initialize();
// After authentication, a typed protected request:
const profile = await requestApi(() => client.GET('/users/me'));
void profile;
// Application teardown owns these registrations:
unsubscribe();
unregisterCleanup();
```

`getSnapshot` and `subscribe` are stable methods used by the React
`useSyncExternalStore` integration. `login(LoginRequestDto)` returns
`{ ok, cleanupFailed }`; `logout()` returns `{ serverConfirmed, cleanupFailed }`.
The application must distinguish failed login from an uncertain session via the
snapshot. Cancellation is expected, not an invalid-credentials message.
`getCleanupFailure()` reports the last transition's safe cleanup/storage-removal
failure flag, including automatic invalidation. It never exposes caught errors.
Each registration returns its own unregister function, even when callbacks are
identical. Cleanup callbacks must be synchronous; their owners release any async
resources without delaying local removal. One throwing owner does not skip others.

## React ownership and safe redirects (T3)

`src/main.tsx` constructs one `SessionService` outside rendering and passes it to
`SessionProvider` inside the existing `ApiQueryProvider`. The public App/showcase
is not gated. Provider effects register cleanup, invoke core single-flight
`initialize()`, and release private owners on replacement/unmount before
unregistering. Replacement children are withheld until the old service's Query
and Mutation caches have been cleared; no cache cleanup happens during render.
StrictMode does not duplicate the pending identity request. Its cleanup probe also
releases private owners, so release callbacks must be idempotent. Unmount detaches
integration and clears private data, not an implicit server logout. The service
remains application-owned; its pending identity initialization is shared on remount.

- `useSessionService()` exposes the existing controller and typed client;
  `useSessionSnapshot()` subscribes without starting network work.
- `AuthenticatedContent` is opt-in: only `authenticated` renders children. Callers
  supply accessible `fallback` content for initializing, unauthenticated and
  unable-to-verify states, including appropriate status/recovery semantics. It
  adds no strings, styling, route navigation or authorization guarantee.
- The provider uses the actual context QueryClient: transitions synchronously
  cancel queries and clear both Query and Mutation caches, without awaiting
  cancellation. Non-abortable server mutations cannot be undone by clearing a
  browser cache. Clearing MutationCache does not cancel arbitrary mutation callbacks,
  including an async `onSuccess` already executing. Consumer owners must capture
  session/account ownership and recheck it after every await, before writing Query
  data or private state. No production mutation owner/framework is introduced here.
- `useSessionCleanup(release)` registers a synchronous private-state/subscription
  release callback in an effect. Keep its identity stable where practical. Future
  Zustand, realtime and scene owners register their own callbacks and unregister
  on teardown; non-React owners use `controller.registerCleanup` directly. No
  hypothetical consumer is installed. Core catches exceptions and reports them
  through `getCleanupFailure()` and operation results; consumers must handle that
  safe flag, not assume cleanup succeeded. `controller.releasePrivateState()`
  invokes these callbacks without changing credentials/identity; the provider uses
  it for replacement/unmount while registrations still belong to the old service.
- `safeSessionRedirect(unknown)` accepts exactly `/`; everything else falls back
  to `/`. There is no caller-controlled fallback or URL normalization. External,
  protocol-relative, backslash/encoded, query/hash and unapproved paths are not
  accepted. Expanding the allowlist belongs to a future approved route story.

## Credentials and recovery

- A validated pair, expiry hint and nonsecret tab-owner metadata live under
  `integratec.session` in `sessionStorage`. Identity is never persisted. No cookies
  or `localStorage` are used; fetch requests explicitly omit browser credentials
  and reject redirects. Browser storage must match the current tab's random nonce
  before `/users/me` or any Bearer use. The nonce is appended to `window.name`
  (preserving unrelated name text); no credential is put there. A normal
  `window.open('/', '_blank')` child has no matching name and discards cloned
  credentials before requests. Missing/mismatched metadata is discarded; unavailable
  ownership fails closed as `unable-to-verify`, including login. Same-tab reload
  retains the nonce. Cross-origin navigation resetting the name requires login.
  This metadata is a continuity discriminator, never backend authentication.
- Injected memory storage has no implicit window dependency. Tests may supply
  `tabOwner: () => ownerId` to model tabs deterministically; adapters without it
  remain isolated caller-owned memory storage, not proof of browser ownership.
- The protected client's middleware injects Bearer access credentials. Public
  `/auth/*` endpoints receive none (logout is the authenticated exception).
  Off-origin request overrides are rejected before fetch. Use controller methods
  for authentication rather than treating the protected client as an auth service.
- A separate private typed auth client sends the refresh credential only in the
  body of `POST /auth/refresh`. Successful renewal validates and rotates both
  credentials before any replay. `POST /auth/logout` sends only Bearer access and
  must return the contracted `204` to be confirmed.
- Stored expiry is only an early-renewal hint, never proof of authentication. No
  JWT decoding, refresh timers or background retry loops exist. The server's
  `/users/me` response establishes identity, and server `401` remains authoritative.
- Renewal is single-flight within an epoch. A credential revision also handles
  delayed old-token `401`s without another renewal. Each request gets at most one
  renewal and one GET/HEAD replay; writes are never replayed, even with an arbitrary
  idempotency header. A `401` remaining after recovery clears both credentials.
  `403` does not trigger renewal.
- Network/5xx renewal failures hide identity as `unable-to-verify`. If a protected
  `401` was observed, both credentials are removed and private owners are released,
  even when that `401` joins a refresh first started by expiry. Only expiry-only
  uncertainty without an observed `401` retains credentials for explicit later
  initialization. Definitive renewal rejection clears credentials; malformed
  successful token payloads cannot authenticate. Invalid profiles never become snapshots.
- Logout removes local identity, credentials and private consumer state before
  awaiting the server. Unconfirmed logout must not be presented as server revocation.
  Unavailable storage fails closed and removal failures are reported, not hidden.
- Epochs and abort signals isolate account changes, login, refresh, logout and
  protected responses. Middleware buffers response bodies before its final epoch
  check so a slow body from the previous account cannot escape as parsed data.
  This client is for bounded REST payloads, not streaming endpoints.

## Verification and remaining work

Synthetic controlled-fetch tests cover S2–S5, S7–S8, S10 and S12 through the public
factory/controller/client boundary, including concurrent/delayed `401`, expiry,
unsafe writes, malformed storage/DTOs, uncertain failures, cleanup exceptions and
late account responses. They do not establish live backend authorization or CSP.
Node 22.23.4 is required; run the focused checks from the repository root:

```sh
pnpm exec vitest run src/session
pnpm typecheck
pnpm exec eslint src/session
pnpm exec prettier --check src/session docs/session-lifecycle.md
```

T3 controlled React/service tests cover S6/S9: StrictMode pending initialization,
subscription ownership, unresolved-content withholding, synchronous query abort and
Query/Mutation removal, late-result isolation, account replacement, cleanup release
and failures, service replacement/unmount, and exact redirect matching. S14 remains
excluded. T4/parent still own full-suite/build checks, independent verification and
applicable browser/manual checks for S13. No screen, controls or layout were added;
caller-provided fallback accessibility remains the caller's responsibility.

The original parent Chromium 156/mock-API probe passed 5/6 scenarios and failed
opener cloning; its ignored report/script remain unchanged. Correction tests model
opener-copy rejection, same-owner reload, unavailable ownership and cache isolation;
the corrected real-browser reproduction is still parent-owned and unverified here.

**S11 limitation requiring a product/browser-policy decision:** browsers may restore
both `sessionStorage` and `window.name` on tab recovery or duplication. A copied
storage/name pair is indistinguishable from a reload to this mechanism. Therefore
this correction addresses ordinary opener cloning but does not establish the
mandatory login-on-every-new/recovered-tab rule. That rule remains open, not waived.
Do not claim all duplicate/restore behavior is solved; no broadcast infrastructure
or implicit requirement exception was added. Manual-human checks, live role/foreign
resource authorization, deployment CSP and browser restore behavior remain
unverified. No live backend was contacted.

## Open question for the future pull request

Alejo explicitly deferred the unresolved recovery/duplication policy while asking
that the remaining implementation and verification be finished. S11 remains open;
this is neither an approved exception nor a claim that issue #18 is complete.

Ask the team when preparing the separately authorized pull request:

> Should recovering a closed tab or using the browser's Duplicate Tab action keep
> the session, or must both require a new login? The implementation rejects
> ordinary fresh/opener tabs and preserves same-tab reloads, but cannot distinguish
> a reload from recovery that restores both storage and continuity metadata.

Until the team resolves this question, retain the existing requirement and disclose
this limitation in the PR. This local note does not authorize publishing or a merge.
