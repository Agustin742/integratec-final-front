# Tracker — Mati

## 2026-11-05 — Implement `pnpm api:sync` to pull committed REST and realtime contract artifacts (#16)

- **Status:** in-progress (local implementation, verification, and PR publication ready; issue #16 completion awaits teammate PR review and merge into `develop`)
- **Area / files:** `package.json`, `pnpm-lock.yaml`, `scripts/api-sync/sync-contracts.mjs`, `scripts/api-sync/sync-contracts.d.mts`, `src/api/sync-contracts.test.ts`, `src/api/schema.generated.ts`, `src/realtime/contracts.generated.ts`, `eslint.config.js`, `.prettierignore`, `README.md`, `docs/development.md`, `docs/architecture.md`, `changelogs/tracker-mati.md`
- **Change:** Implemented [issue #16](https://github.com/Agustin742/integratec-final-front/issues/16) in three reviewable work units on `feat/16-api-sync`:
  1. Added `openapi-typescript` (`7.13.0`) and `scripts/api-sync/sync-contracts.mjs` with configurable constants (`DEFAULT_BACKEND_REPO`, `DEFAULT_BACKEND_BRANCH`, `BACKEND_ARTIFACT_PATHS`, `FRONTEND_OUTPUT_PATHS`), `--backend-dir <path>` local checkout support, OpenAPI 3.x validation, graceful notice when optional realtime room-state artifacts are not yet published, and 12 unit tests in `src/api/sync-contracts.test.ts`.
  2. Wired `pnpm api:sync`, generated and committed `src/api/schema.generated.ts` and `src/realtime/contracts.generated.ts` from `Agustin742/integratec-final-back` (`develop`), removed `.gitkeep` placeholders, and ignored `*.generated.ts` in ESLint and Prettier.
  3. Documented `pnpm api:sync`, configurable constants, and CLI flags in `README.md`, `docs/development.md`, and `docs/architecture.md`.
- **Reason:** Synchronize the backend's committed OpenAPI specification and realtime contracts into deterministic, committed frontend TypeScript definitions (FD7) so builds and typechecks never require network access or a running backend.
- **Verification:** On Node `22.23.4` and pnpm `10.34.9`: two consecutive runs of `pnpm api:sync` produced zero git diff; `pnpm test` (4 files, 40 tests passed), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (offline with committed generated contracts), and `pnpm e2e` passed; `git diff --check` passed.
- **Next step:** Publish the PR from `feat/16-api-sync` into `develop`, verify GitHub Actions checks, and await teammate review and merge to complete #16.

## 2026-11-05 — Add validated public configuration boundary and `.env.example` (#15)

- **Status:** completed (merged into `develop` via [PR #65](https://github.com/Agustin742/integratec-final-front/pull/65), commit `923f63f`)
- **Area / files:** `package.json`, `pnpm-lock.yaml`, `src/config/public-config.ts`, `src/config/public-config.test.ts`, `src/main.tsx`, `vite.config.ts`, `eslint.config.js`, `.github/workflows/ci.yml`, `.env.example`, `README.md`, `docs/development.md`, `docs/ci.md`, `changelogs/tracker-mati.md`
- **Change:** Implemented [issue #15](https://github.com/Agustin742/integratec-final-front/issues/15) in three reviewable work units on `feat/15-public-config`:
  1. Added `src/config/public-config.ts` with Zod schema validation (`VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_REALTIME_URL`), `ConfigValidationError` naming every missing/invalid variable without echoing raw values, and 26 unit tests in `src/config/public-config.test.ts` (including `.env.example` variable parity).
  2. Wired build/dev fail-fast validation in `vite.config.ts`, runtime startup validation in `src/main.tsx`, an ESLint `no-restricted-syntax` boundary forbidding direct `import.meta.env` reads outside `src/config/`, and safe test placeholders in `.github/workflows/ci.yml`.
  3. Added `.env.example` with explicit local/test/production endpoint guidance and documented the public configuration contract in `README.md`, `docs/development.md`, and `docs/ci.md`.
- **Reason:** Read build-time public configuration through one typed, validated boundary and fail clearly when required variables are missing or invalid, without falling back silently to a production service.
- **Verification:** On Node `22.23.4` and pnpm `10.34.9`: `pnpm test` (3 files, 28 tests passed), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (with test placeholders), and `pnpm e2e` (Playwright desktop and mobile 2/2 passed) succeeded; unconfigured `pnpm build` failed fast with exit code 1 and `ConfigValidationError` naming `VITE_APP_ENV`, `VITE_API_BASE_URL`, and `VITE_REALTIME_URL`; `dist/assets/` bundle scan confirmed only the three public `VITE_` values and no secrets; `git diff --check` passed. Local `python3` (`C:\Python314\python.exe` missing) and `actionlint` 1.7.7 are unavailable on this Windows workstation and run in the Ubuntu GitHub Actions `checks` job.
- **Next step:** Completed and merged in [PR #65](https://github.com/Agustin742/integratec-final-front/pull/65); unblocks downstream configuration and contract consumers.
