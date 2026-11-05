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

| Path                  | Responsibility                                                     |
| --------------------- | ------------------------------------------------------------------ |
| `src/main.tsx`        | Mount React with StrictMode                                        |
| `src/app/App.tsx`     | Minimal semantic placeholder, without routing or feature behavior  |
| `src/app/messages.ts` | Centralized Spanish (Argentina) placeholder strings                |
| `src/api/`            | Reserved for generated REST types, not hand-written business logic |
| `src/realtime/`       | Reserved for generated realtime contracts                          |
| `vite.config.ts`      | React integration with Vite                                        |

Add feature UI, integration, and tests together when their issues start. Do not pre-create hypothetical feature scaffolding. Follow [frontend conventions](../rules/frontend-conventions.md) and [architecture boundaries](../rules/architecture.md).

## Configuration and commands

No environment variables, backend endpoints, credentials, or running backend are required by this placeholder. No runtime configuration contract is introduced. Keep real `.env` files out of Git; future public configuration follows [environment rules](../rules/configuration-and-environments.md).

The [README command table](../README.md#local-development) matches `package.json`. Vite alone transpiles TypeScript without checking types, so `pnpm build` explicitly runs the same `tsc --noEmit` check as `pnpm typecheck` before bundling. A strict type error must stop the build before Vite emits output.

Prettier checks only the application, its configuration, and setup docs, not unrelated historical documents or local artifacts. ESLint applies recommended TypeScript, React hook, and JSX accessibility rules. Generated contracts are not present yet.

## Verification boundaries

Before delivery, run a frozen install and every listed quality command on Node 22. Start `pnpm dev` and inspect the placeholder at desktop and mobile widths, including zoom. After `pnpm build`, inspect `pnpm preview` as well. Verify that an intentionally invalid strict TypeScript fixture fails both typecheck and build in isolated state, not committed source.

The placeholder has no controls, network requests, forms, or asynchronous states. Keyboard focus interactions, loading, validation, and error flows are therefore not introduced here; they must be checked when those behaviors are implemented. Check the document language and heading semantics now.

[F02 testing infrastructure](testing.md) provides `pnpm test` (Vitest/Testing Library with jsdom) and `pnpm e2e` (Playwright against production preview). Follow that guide for the project-local Chromium install, helpers, optional remote URL, fake timers, and contract-mocking policy. Lint, strict typecheck, and formatting include both runner configs and browser tests. Existing Python CI-tooling tests remain applicable. CI discovers the non-watch test script; no workflow changes or CI lint/typecheck/build jobs (F03) are introduced.

## Bootstrap verification evidence

The following records the original #11 bootstrap, before F02 added the test harness; statements about absent application tests are historical.

Verified locally on Node 22.23.4 and pnpm 10.34.9, including a separate verifier's isolated clean copy:

- Frozen install, lint, format check, typecheck, and build passed. The existing Python CI-tooling suite passed all 5 tests.
- An isolated strict-null fixture failed typecheck and build with TS2322 (exit 2), without changing existing build output. Removing it restored both checks.
- Isolated explicit-any, invalid-hook, and missing-image-alt fixtures each failed lint (exit 1); removing them restored lint and formatting checks.
- Development rendering passed at 1440px and mobile-emulated 390px widths, including 200% CSS zoom without horizontal overflow. Production preview also rendered the expected placeholder. The accessibility snapshot showed a main landmark and one level-1 heading.
- Application tests are not configured (F02). Interactive focus and asynchronous states do not apply to this static placeholder. A later console query was unavailable after the browser tab closed; no clean-console claim is made. actionlint was unavailable locally; the workflow was not changed.

Styling (F04), routing (F10), 3D rendering, API synchronization, and product screens are outside this delivery. This base does not prove backend integration, deployment, or completion of those issues. See [quality requirements](../rules/quality-and-testing.md) for completion reporting.
