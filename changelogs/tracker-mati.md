# Tracker — Mati

## 2026-11-05 — Add validated public configuration boundary and `.env.example` (#15)

- **Status:** in-progress (local implementation, verification, and PR publication ready; issue #15 completion awaits teammate PR review and merge into `develop`)
- **Area / files:** `package.json`, `pnpm-lock.yaml`, `src/config/public-config.ts`, `src/config/public-config.test.ts`, `src/main.tsx`, `vite.config.ts`, `eslint.config.js`, `.github/workflows/ci.yml`, `.env.example`, `README.md`, `docs/development.md`, `docs/ci.md`, `changelogs/tracker-mati.md`
- **Change:** Implemented [issue #15](https://github.com/Agustin742/integratec-final-front/issues/15) in three reviewable work units on `feat/15-public-config`:
  1. Added `src/config/public-config.ts` with Zod schema validation (`VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_REALTIME_URL`), `ConfigValidationError` naming every missing/invalid variable without echoing raw values, and 26 unit tests in `src/config/public-config.test.ts` (including `.env.example` variable parity).
  2. Wired build/dev fail-fast validation in `vite.config.ts`, runtime startup validation in `src/main.tsx`, an ESLint `no-restricted-syntax` boundary forbidding direct `import.meta.env` reads outside `src/config/`, and safe test placeholders in `.github/workflows/ci.yml`.
  3. Added `.env.example` with explicit local/test/production endpoint guidance and documented the public configuration contract in `README.md`, `docs/development.md`, and `docs/ci.md`.
- **Reason:** Read build-time public configuration through one typed, validated boundary and fail clearly when required variables are missing or invalid, without falling back silently to a production service.
- **Verification:** On Node `22.23.4` and pnpm `10.34.9`: `pnpm test` (3 files, 28 tests passed), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` (with test placeholders), and `pnpm e2e` (Playwright desktop and mobile 2/2 passed) succeeded; unconfigured `pnpm build` failed fast with exit code 1 and `ConfigValidationError` naming `VITE_APP_ENV`, `VITE_API_BASE_URL`, and `VITE_REALTIME_URL`; `dist/assets/` bundle scan confirmed only the three public `VITE_` values and no secrets; `git diff --check` passed. Local `python3` (`C:\Python314\python.exe` missing) and `actionlint` 1.7.7 are unavailable on this Windows workstation and run in the Ubuntu GitHub Actions `checks` job.
- **Next step:** Publish the PR from `feat/15-public-config` into `develop`, verify GitHub Actions checks, and await teammate review and merge to complete #15.
