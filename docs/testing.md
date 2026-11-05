# Frontend testing

Run component checks with `pnpm test` and a read-only production-preview smoke with `pnpm e2e`. Use the [declared Node 22/pnpm toolchain](development.md#toolchain); no backend or credentials are needed.

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

- Vitest merges the existing Vite configuration, retaining the React plugin. Its jsdom suite includes only `src/**/*.test.{ts,tsx}`; Playwright discovers tests separately in `e2e/`.
- `src/test/setup.ts` imports jest-dom's Vitest matchers and registers RTL cleanup explicitly because Vitest globals are disabled. Import `test`, `expect`, and timer utilities from `vitest`.
- `src/test/render.tsx` accepts RTL render options and renders in StrictMode. No providers are needed today; add real providers incrementally with F07/F10, not hypothetical wrappers.
- Prefer role/name queries and observable outcomes. `src/app/App.test.tsx` is the sample, not feature coverage.
- `expectAccessible(container)` awaits typed axe-core results and throws rule IDs and affected HTML for violations. The negative helper regression checks an unnamed button. jsdom cannot check layout or contrast; only `color-contrast` is disabled. A clean result is not a full accessibility audit: check keyboard/focus, contrast, and applicable states in a browser when features introduce them.

Use real timers by default, and always for axe. For timer-dependent behavior, opt into `vi.useFakeTimers()` in the smallest test scope, advance pending work inside React `act`, then flush pending timers and restore `vi.useRealTimers()` in teardown (including failure paths). Restore real timers before calling the accessibility helper; fake timers can stall axe. Do not add artificial loading/focus scenarios to the static placeholder.

## Browser smoke and optional deployed target

Build first: Playwright starts `pnpm preview` on `http://127.0.0.1:4173`, refuses to reuse another server, and stops its managed preview afterward. Desktop Chrome and mobile-emulated Chromium projects check title, `es-AR`, main/heading roles, and horizontal overflow. Mobile emulation is not a physical-device test. Results are ignored under `e2e/test-results/`; no screenshots or WebGL pixel assertions are generated.

To check an already deployed frontend instead:

```sh
PLAYWRIGHT_BROWSERS_PATH=0 PLAYWRIGHT_BASE_URL=https://frontend.example.invalid/ pnpm e2e
```

Replace the reserved example with an authorized public frontend URL. `PLAYWRIGHT_BASE_URL` is optional, public, test-process-only configuration (never injected into the application); restart the test command after changes, no application rebuild needed for a remote target. It must be an absolute HTTP(S) URL without credentials; empty/invalid values fail clearly. Set HTTPS for production. An explicit URL skips the local web server. The smoke navigates relative to that URL and remains read-only: never add production data mutations. No deployment or remote verification is claimed here.

## Contract mocks and delivery boundaries

Follow [API contract policy](../rules/api-contracts.md): identify the authoritative contract/version and owner before deriving mocks; include relevant failure cases as well as success. Use synthetic data. Passing mocks are not backend integration proof. Transport setup (including MSW dependency/handlers) waits for F07's typed client; no mock transport is selected by this infrastructure.

Feature tests belong to their stories. The placeholder has no controls, forms, API calls, loading, validation, or error states; focus flows and those states are not applicable now. This harness does not prove backend integration, deployment, visual regression, or WebGL rendering. Disclose failing, skipped, and unavailable checks per [quality requirements](../rules/quality-and-testing.md).

## Tool references

- [Vitest: merge the Vite config](https://vitest.dev/config/)
- [RTL cleanup and render options](https://testing-library.com/docs/react-testing-library/api/)
- [jest-dom Vitest setup](https://github.com/testing-library/jest-dom#with-vitest)
- [axe API](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) and [jsdom limitations](https://github.com/dequelabs/axe-core#supported-browsers)
- [Playwright webServer and baseURL](https://playwright.dev/docs/test-webserver)
