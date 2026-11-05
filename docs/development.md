# Frontend development

[Issue #11](https://github.com/Agustin742/integratec-final-front/issues/11) provides the minimal runnable frontend base. Follow the [README quick start](../README.md#local-development) first.

## Toolchain

- Node 22.23.4 is pinned in `.nvmrc`; `engines.node` allows that version and newer Node 22 patches, not Node 24.
- pnpm 10.34.9 is pinned in `packageManager` and selected by Corepack. Corepack 0.34.6 is the verification toolchain version. If Corepack is missing, install that version with `npm install --global corepack@0.34.6`, then run `corepack enable`.
- `.npmrc` enables strict engine checks. Use the declared Node version before installing; do not bypass engine validation.
- Commit `pnpm-lock.yaml` with dependency changes. A clean checkout uses `pnpm install --frozen-lockfile`.
- Vite 8 and its React plugin support Node 22.12 or newer; this application chooses the newer pinned Node patch. TypeScript stays on 5.9 because typescript-eslint 8's declared range excludes TypeScript 7.
- Known maintenance limitation: ESLint 9.39.5 is registry-deprecated as unsupported. The required jsx-a11y 6.10.2 plugin declares compatibility only through ESLint 9, so this bootstrap does not force an unsupported ESLint 10 peer combination. Revisit the lint toolchain when a compatible supported combination is available.

## Source layout

| Path                                  | Responsibility                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/main.tsx`                        | Validate public configuration and mount React with StrictMode and `ApiQueryProvider` |
| `src/config/public-config.ts`         | Typed, Zod-validated `VITE_` public configuration boundary                           |
| `src/app/App.tsx`                     | Minimal semantic placeholder, without routing or feature behavior                    |
| `src/app/messages.ts`                 | Centralized Spanish (Argentina) placeholder strings                                  |
| `src/api/schema.generated.ts`         | Generated REST OpenAPI TypeScript definitions (`pnpm api:sync`)                      |
| `src/api/client.ts`                   | Typed `openapi-fetch` client and `requestApi` helper                                 |
| `src/api/errors.ts`                   | Backend `ErrorEnvelope` and network error mapper (`ApiError`)                        |
| `src/api/messages.ts`                 | Centralized `es-AR` user-facing API error messages                                   |
| `src/api/idempotency.ts`              | `Idempotency-Key` UUID helper for idempotent mutations                               |
| `src/api/query-keys.ts`               | User-, classroom-, and child-scoped TanStack Query key factory                       |
| `src/api/query-client.tsx`            | TanStack Query client defaults (`MAX_QUERY_RETRIES = 2`) and `ApiQueryProvider`      |
| `src/realtime/contracts.generated.ts` | Generated shared realtime payload contracts (`pnpm api:sync`)                        |
| `src/test/msw/`                       | Contract-faithful Mock Service Worker (MSW) handlers and server for tests (FD9)      |
| `scripts/api-sync/sync-contracts.mjs` | Contract synchronization resolver and generator (`pnpm api:sync`)                    |
| `vite.config.ts`                      | Build/dev configuration validation plugin and React integration                      |

Add feature UI, integration, and tests together when their issues start. Do not pre-create hypothetical feature scaffolding. Follow [frontend conventions](../rules/frontend-conventions.md) and [architecture boundaries](../rules/architecture.md).

## Configuration and commands

Public build-time configuration ([issue #15](https://github.com/Agustin742/integratec-final-front/issues/15)) is read exclusively through [`src/config/public-config.ts`](../src/config/public-config.ts) (`VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_REALTIME_URL`). Copy [`.env.example`](../.env.example) to `.env` for local development; keep real `.env` files out of Git and never place secrets in `VITE_` variables. Missing or invalid values fail fast during `pnpm dev`, `pnpm build`, and application startup without silently falling back to a production service. ESLint forbids direct `import.meta.env` reads outside `src/config/`. See [README public configuration](../README.md#public-configuration) and [environment rules](../rules/configuration-and-environments.md).

The [README command table](../README.md#local-development) matches `package.json`. Vite alone transpiles TypeScript without checking types, so `pnpm build` explicitly runs the same `tsc --noEmit` check as `pnpm typecheck` before bundling. A strict type error must stop the build before Vite emits output.

`pnpm api:sync` ([issue #16](https://github.com/Agustin742/integratec-final-front/issues/16)) fetches the backend's committed `apps/api/openapi.json` and realtime contract artifacts from `Agustin742/integratec-final-back` (`develop` by default, or a local checkout via `--backend-dir <path>` / `BACKEND_CHECKOUT_DIR`) and regenerates committed TypeScript files in `src/api/schema.generated.ts` and `src/realtime/contracts.generated.ts` (plus `src/realtime/room-state.generated.ts` once backend Colyseus room-state codegen is published). Prettier and ESLint ignore `src/api/*.generated.ts` and `src/realtime/*.generated.ts` so generated contracts are never hand-edited or reformatted, while `pnpm typecheck` and `pnpm build` validate them offline without a running backend.

## Verification boundaries

Before delivery, run a frozen install and every listed quality command on Node 22. Start `pnpm dev` and inspect the placeholder at desktop and mobile widths, including zoom. After `pnpm build`, inspect `pnpm preview` as well. Verify that an intentionally invalid strict TypeScript fixture fails both typecheck and build in isolated state, not committed source.

The placeholder has no controls, network requests, forms, or asynchronous states. Keyboard focus interactions, loading, validation, and error flows are therefore not introduced here; they must be checked when those behaviors are implemented. Check the document language and heading semantics now.

[F02 testing infrastructure](testing.md) provides `pnpm test` (Vitest/Testing Library with jsdom) and `pnpm e2e` (Playwright against production preview). Follow that guide for the project-local Chromium install, helpers, optional remote URL, fake timers, and contract-mocking policy. Lint, strict typecheck, and formatting include both runner configs and browser tests. Existing Python CI-tooling tests remain applicable. [F03 frontend CI](ci.md) now runs separate lint, formatting, typecheck, non-watch test and build steps after a frozen install on Node 22, with explicit skip notices and a result summary. Playwright remains optional and local, not a CI gate.

## Bootstrap verification evidence

The following records the original #11 bootstrap, before F02 added the test harness; statements about absent application tests are historical.

Verified locally on Node 22.23.4 and pnpm 10.34.9, including a separate verifier's isolated clean copy:

- Frozen install, lint, format check, typecheck, and build passed. The existing Python CI-tooling suite passed all 5 tests.
- An isolated strict-null fixture failed typecheck and build with TS2322 (exit 2), without changing existing build output. Removing it restored both checks.
- Isolated explicit-any, invalid-hook, and missing-image-alt fixtures each failed lint (exit 1); removing them restored lint and formatting checks.
- Development rendering passed at 1440px and mobile-emulated 390px widths, including 200% CSS zoom without horizontal overflow. Production preview also rendered the expected placeholder. The accessibility snapshot showed a main landmark and one level-1 heading.
- Application tests are not configured (F02). Interactive focus and asynchronous states do not apply to this static placeholder. A later console query was unavailable after the browser tab closed; no clean-console claim is made. actionlint was unavailable locally; the workflow was not changed.

Styling (F04), routing (F10), 3D rendering, API synchronization, and product screens are outside this delivery. This base does not prove backend integration, deployment, or completion of those issues. See [quality requirements](../rules/quality-and-testing.md) for completion reporting.
