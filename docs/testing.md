# Frontend testing

Run component checks with `pnpm test` and a read-only browser smoke with `pnpm e2e`, which builds the showcase bundle before starting Playwright. Use the [declared Node 22/pnpm toolchain](development.md#toolchain); no backend or credentials are needed.

## Quick path

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
# First use only: download Chromium into ignored node_modules, not a global cache.
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=0 pnpm e2e
```

The environment-assignment syntax above uses Bash (including Git Bash on Windows). Keep `PLAYWRIGHT_BROWSERS_PATH=0` for both installation and execution. On CI, install the browser only in an explicitly enabled E2E job; this delivery does not change workflows or install OS dependencies. Existing CI discovers `pnpm test`, which runs once without watch mode. There is no coverage threshold.

## Component tests and helpers

- Vitest merges the existing Vite configuration, retaining the React plugin. Its suite includes only `src/**/*.test.{ts,tsx}` and defaults to jsdom; Playwright discovers tests separately in `e2e/`.
- `src/config/eslint-security.test.ts` overrides the environment to Node for ESLint's filesystem/config-loading API. Both unsafe HTML rejection and safe JSX rendering exercise the real discovered `eslint.config.js`, without mocking security rules or increasing test timeouts. Run it with `pnpm exec vitest run src/config/eslint-security.test.ts`.
- `src/test/setup.ts` imports jest-dom's Vitest matchers and registers RTL cleanup explicitly because Vitest globals are disabled. Import `test`, `expect`, and timer utilities from `vitest`.
- `src/test/render.tsx` accepts RTL render options plus an optional `queryClient` and wraps the tree in StrictMode and `ApiQueryProvider` (`createAppQueryClient()` by default, preserving the provider across `rerender` calls). Add future providers incrementally (such as routing in F10), not hypothetical wrappers.
- Prefer role/name queries and observable outcomes. `src/app/App.test.tsx` is the sample, not feature coverage.
- `expectAccessible(container)` awaits typed axe-core results and throws rule IDs and affected HTML for violations. The negative helper regression checks an unnamed button. jsdom cannot check layout or contrast; only `color-contrast` is disabled. A clean result is not a full accessibility audit: check keyboard/focus, contrast, and applicable states in a browser when features introduce them.

Use real timers by default, and always for axe. For timer-dependent behavior, opt into `vi.useFakeTimers()` in the smallest test scope, advance pending work inside React `act`, then flush pending timers and restore `vi.useRealTimers()` in teardown (including failure paths). Restore real timers before calling the accessibility helper; fake timers can stall axe. Do not add artificial loading/focus scenarios to the static placeholder.

## Session lifecycle checks

Run `pnpm exec vitest run src/session/provider.test.tsx src/session/redirect.test.ts`
for the React/service boundary: synthetic controlled fetch and injected memory
storage, real QueryClient cancellation/cache clearing, private release callbacks,
StrictMode and unmount ownership, unresolved/protected rendering and malicious
redirect inputs. Core coverage remains in `src/session/controller.test.ts` and
`src/session/middleware.test.ts`. `src/session/storage.test.ts` models distinct tab
owners with copied storage, same-owner reload, missing/unavailable ownership and
ordinary opener name mismatch. Recovery regressions distinguish expiry-only
uncertainty from an observed protected `401`, including one joining an expiry-started
refresh. Authenticated A-to-B provider replacement tests inspect what B renders,
populated Query/Mutation caches, a real query cancellation signal and late-result
fencing; see [session evidence and limits](session-lifecycle.md#verification-and-remaining-work).

These checks do not prove live backend authorization, server logout integration,
CSP enforcement or manual tab-close/reopen/new-tab behavior. `sessionStorage`
survives reload and may be restored by browser session recovery; an opener can
seed a new tab with a copy. The browser discriminator pairs a nonsecret `window.name`
nonce with storage metadata and rejects ordinary opener copies before protected
requests. Restoring or duplicating both values may be indistinguishable from reload:
this is an accepted browser boundary, not a universal no-recovery guarantee. See
[the approved decision](session-lifecycle.md#accepted-browser-continuity-boundary).
Fresh/opener tabs require login; same-tab F5/reload preserves continuity.
The original Chromium 156/mock-API failure (5/6, opener failed) is recorded
separately from the corrected 6/6 result. Against correction `e63a7aa`, the full
suite passed 228/228, existing desktop/mobile Playwright passed 16/16, and lint,
typecheck, production build and configured formatting passed. The one independent
blocker-only recheck passed 8/8; see the linked session evidence for its scope.
These historical results are not checks of subsequent review corrections.
Focused regressions exercise public request cancellation across logout and caller
abort (including read replay), exact `AbortError` preservation, non-retry
classification and genuine network failures. Standalone storage tests block the
global `Function` constructor, validate invalid/valid stored values and restore
global changes; initialization recovery verifies rotated credentials after a
transient profile `503`. Run them together with
`pnpm exec vitest run src/api/client.test.ts src/api/query-client.test.tsx src/session`.
No new browser/manual verification is claimed. MutationCache clearing is not
cancellation of already-running async callbacks: consumers must fence completion
writes against session ownership after awaits. No hypothetical mutation framework,
new screen or focus/layout interaction is introduced by this correction.

## Browser smoke and optional deployed target

`pnpm e2e` runs `pnpm build:e2e` — the `showcase` Vite build mode, which includes the component showcase — and then Playwright, which starts `pnpm preview` on `http://127.0.0.1:4173`, refuses to reuse another server, and stops its managed preview afterward. A plain `pnpm build` produces the production bundle: it resolves the showcase flag to `false` and emits no showcase chunk. Desktop Chrome and mobile-emulated Chromium projects check title, `es-AR`, banner and main roles, horizontal overflow, and the showcase interaction scenarios including reduced motion. Mobile emulation is not a physical-device test. Results are ignored under `e2e/test-results/`; no screenshots or WebGL pixel assertions are generated.

To check an already deployed frontend instead:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 PLAYWRIGHT_BASE_URL=https://frontend.example.invalid/ pnpm e2e
```

Replace the reserved example with an authorized public frontend URL. `PLAYWRIGHT_BASE_URL` is optional, public, test-process-only configuration (never injected into the application); restart the test command after changes, no application rebuild needed for a remote target. It must be an absolute HTTP(S) URL without credentials; empty/invalid values fail clearly. Set HTTPS for production. An explicit URL skips the local web server. The smoke navigates relative to that URL and remains read-only: never add production data mutations. No deployment or remote verification is claimed here.

## Contract mocks and delivery boundaries

Follow [API contract policy](../rules/api-contracts.md): identify the authoritative contract/version and owner before deriving mocks; include relevant failure cases as well as success. Use synthetic data. Passing mocks are not backend integration proof.

[F07 typed API client](../src/api/client.ts) selects **Mock Service Worker (`msw`, dev/test only per FD9)** as the contract-mocking transport under `src/test/msw/`:

- `src/test/msw/handlers.ts` builds handlers and `ErrorEnvelope` responses (`createErrorEnvelopeResponse`, `createHealthHandler`) directly from the generated OpenAPI types in `src/api/schema.generated.ts`.
- `src/test/msw/server.ts` exports `mswServer` (`setupServer(...defaultHandlers)`) for Vitest suites (`mswServer.listen({ onUnhandledFrame: 'error' })`).
- Frontend stories build MSW handlers against the backend's published DTOs and OpenAPI entries (including `501` stubs published before backend implementation per D9/FD9) so UI work can proceed without waiting for backend merges. MSW must never be imported by production application code or shipped in `dist/`.

Feature tests belong to their stories. The placeholder has no controls, forms, API calls, loading, validation, or error states; focus flows and those states are not applicable now. This harness does not prove backend integration, deployment, visual regression, or WebGL rendering. Disclose failing, skipped, and unavailable checks per [quality requirements](../rules/quality-and-testing.md).

## Tool references

- [Vitest: merge the Vite config](https://vitest.dev/config/)
- [RTL cleanup and render options](https://testing-library.com/docs/react-testing-library/api/)
- [jest-dom Vitest setup](https://github.com/testing-library/jest-dom#with-vitest)
- [axe API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) and [jsdom limitations](https://github.com/dequelabs/axe-core#supported-browsers)
- [Playwright webServer and baseURL](https://playwright.dev/docs/test-webserver)
