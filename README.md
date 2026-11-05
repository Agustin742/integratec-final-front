# Frontend repository

A single React + TypeScript application built with Vite, using Node 22 and pnpm (FD6). The current UI is a minimal bootstrap placeholder, not a feature screen. Component and browser test infrastructure is available; see the [testing guide](docs/testing.md).

## Local development

Use Node **22.23.4** (see `.nvmrc`) and Corepack **0.34.6** or a compatible version. The package manager is pinned to pnpm **10.34.9** in `package.json`.

```sh
# With nvm installed, activate the repository's Node version:
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

On nvm-windows, use `nvm install 22.23.4` and `nvm use 22.23.4` instead. Copy `.env.example` to `.env` before starting `pnpm dev` or running `pnpm build`. Open the local URL printed by Vite. See [development setup](docs/development.md) for commands, layout, configuration, and verification boundaries.

| Command             | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `pnpm api:sync`     | Pull committed REST and realtime contracts from the backend repository    |
| `pnpm dev`          | Start the local development server                                        |
| `pnpm test`         | Run Vitest component checks once (no watch mode)                          |
| `pnpm build:e2e`    | Build the showcase bundle the browser suite runs against                  |
| `pnpm e2e`          | Build the showcase bundle, then run Playwright smoke against preview      |
| `pnpm lint`         | Check TypeScript, React hooks, and JSX accessibility rules                |
| `pnpm format:check` | Check formatting of the application, its configuration, and documentation |
| `pnpm typecheck`    | Check types with TypeScript strict mode                                   |
| `pnpm build`        | Check types, then generate static output in `dist/`                       |
| `pnpm preview`      | Serve the production build locally, not a production server               |

## Public configuration

The application reads build-time public configuration through one typed, Zod-validated module ([`src/config/public-config.ts`](src/config/public-config.ts)). Both Vite (`pnpm dev` and `pnpm build`) and the browser entrypoint ([`src/main.tsx`](src/main.tsx)) validate the configuration and fail fast with a `ConfigValidationError` naming every missing or invalid variable. Feature code must call `getPublicConfig()` rather than reading `import.meta.env` directly; ESLint enforces this boundary. See [Configuration and environments](rules/configuration-and-environments.md) and [Security](rules/security.md).

Copy [`.env.example`](.env.example) to `.env` for local development. Real `.env` and `.env.*` files are git-ignored; `.env.example` is tracked with safe placeholders only. All `VITE_` variables are statically embedded into the public client bundle at build time, so **secrets, private keys, or credentials must never be placed in frontend configuration**, and **changing any variable requires a rebuild (or restarting the Vite dev server)**.

| Variable            | Required / format                                                                                 | Purpose                                 | Classification | Rebuild / restart |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------- | ----------------- |
| `VITE_APP_ENV`      | Required; `development`, `test`, or `production` (no default fallback)                            | Target environment name                 | Public         | Yes               |
| `VITE_API_BASE_URL` | Required; absolute `http(s)` URL without credentials, query, hash, or trailing `/` (`https` prod) | Base URL of the backend NestJS REST API | Public         | Yes               |
| `VITE_REALTIME_URL` | Required; absolute `ws(s)` URL without credentials, query, hash, or trailing `/` (`wss` prod)     | Base URL of the Colyseus WebSocket room | Public         | Yes               |

Explicit endpoint examples by environment:

- **Local (`VITE_APP_ENV=development`):** `VITE_API_BASE_URL=http://localhost:3000`, `VITE_REALTIME_URL=ws://localhost:2567`
- **Test (`VITE_APP_ENV=test`):** `VITE_API_BASE_URL=https://api.test.example.invalid`, `VITE_REALTIME_URL=wss://realtime.test.example.invalid`
- **Production (`VITE_APP_ENV=production`):** `VITE_API_BASE_URL=https://api.example.invalid`, `VITE_REALTIME_URL=wss://realtime.example.invalid` (`https://` and `wss://` are mandatory in `production`)

## Development rules

Read the [project rules](rules/README.md) before contributing. They cover GitHub Projects coordination, Git collaboration, English Conventional Commits and code, architecture, state and API contracts, session handling, accessible UI and forms, data/time conventions, configuration, operations, quality, security, AI usage, and art direction. The visual target and the rendering technology (Three.js with React Three Fiber) are agreed. The [course requirements](rules/project-requirements.md) preserve the academic requirements and evaluation criteria extracted from the temporary course brief; section 10 of [the project document](master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the proposed product.

The product rules develop the expected behavior for classrooms/roles, activities and grading, communication, the AI briefing, movement, avatars, and realtime presence. Their acceptance checklists describe future implementation evidence, not working features; open domain decisions are explicitly separated from established requirements.

## Promotion flow

Work branches enter `develop` through reviewed pull requests. Changes are promoted by pull request from `develop` to `test`, then from `test` to `main`. See [Git workflow](rules/git-workflow.md) for commit and merge conventions. CI runs for pull requests targeting `develop`, `test`, or `main` and pushes to `develop`. Work branches may target `develop`; only `develop` may target `test`, and only `test` may target `main`.

## CI

The `checks` job preserves promotion, Python regression, documentation-link, proposed-diff whitespace and actionlint **1.7.7** gates. With an application present, it installs frozen dependencies on Node **22** and independently runs lint, formatting, types, tests and build. Documentation-only PRs do not bypass these checks; missing scripts are reported as skipped, not passed.

See the [CI guide](docs/ci.md) for triggers, Corepack/cache ordering, skip/failure behavior, summaries, diagnosis and observed evidence. Optional local Playwright checks remain in the [testing guide](docs/testing.md); deployment and branch-protection settings are outside this workflow change.

Run locally from the repository root (Python 3, Git, and Bash required):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts/ci -p 'test_*.py' -v
python3 scripts/ci/check_docs.py
# Compare committed and uncommitted tracked changes with the target branch:
git diff --check "$(git merge-base origin/develop HEAD)" --
# If actionlint 1.7.7 is already available:
actionlint .github/workflows/ci.yml
```

Use the actual target ref (`origin/test` or `origin/main` for promotions) instead of `origin/develop` when appropriate. The diff command includes uncommitted tracked edits; untracked files are not included. For each new file, also run `git diff --no-index --check -- /dev/null path/to/new-file` before staging (`--no-index` exit 1 alone means files differ; whitespace errors include diagnostics). Stage new Markdown files for inclusion in the default tracked-file link check, or pass their paths explicitly to `check_docs.py`. Report unavailable tools honestly; local validation does not prove a GitHub run or branch protection.

## Cross-repository contracts

REST contracts come from the OpenAPI document generated by the backend (decision D4): the frontend generates its TypeScript types from it into `src/api/schema.generated.ts` using `openapi-typescript` and uses `openapi-fetch` (FD2). See the [architecture decisions](docs/technical-justification.md#architecture-decisions). The backend commits `apps/api/openapi.json` and its realtime type artifacts; `pnpm api:sync` ([`scripts/api-sync/sync-contracts.mjs`](scripts/api-sync/sync-contracts.mjs)) pulls them from the backend repository and regenerates committed types in `src/api/` and `src/realtime/` (FD7), so `pnpm build` does not require network access or a running backend.

| Constant / Option        | Default value / path                          | Purpose                                                                    |
| ------------------------ | --------------------------------------------- | -------------------------------------------------------------------------- |
| `DEFAULT_BACKEND_REPO`   | `Agustin742/integratec-final-back`            | Default GitHub repository used when `--backend-dir` is not supplied        |
| `DEFAULT_BACKEND_BRANCH` | `develop`                                     | Default backend branch used when `--branch` is not supplied                |
| `openapi` artifact       | `apps/api/openapi.json`                       | Authoritative REST OpenAPI specification -> `src/api/schema.generated.ts`  |
| `contracts` artifact     | `packages/contracts/src/index.ts`             | Shared contracts payload types -> `src/realtime/contracts.generated.ts`    |
| `realtimeState` artifact | `apps/realtime/src/rooms/schema/generated.ts` | Colyseus `schema-codegen` output -> `src/realtime/room-state.generated.ts` |
| `--backend-dir <path>`   | `BACKEND_CHECKOUT_DIR` (optional local path)  | Read artifacts from a local backend checkout instead of raw GitHub URLs    |
| `--branch <branch>`      | `BACKEND_BRANCH` (defaults to `develop`)      | Override the backend branch when fetching from GitHub                      |
| `--repo <owner/repo>`    | `BACKEND_REPO` (defaults to backend repo)     | Override the backend GitHub repository                                     |

```sh
# Pull committed contracts from Agustin742/integratec-final-back (develop):
pnpm api:sync

# Pull committed contracts from a local backend checkout (works offline):
pnpm api:sync --backend-dir ../integratec-final-back
```

Generated files (`src/api/*.generated.ts` and `src/realtime/*.generated.ts`) carry an explicit `AUTO-GENERATED by pnpm api:sync — DO NOT EDIT MANUALLY` header, are ignored by ESLint and Prettier, and are committed to Git so contract diffs are visible in pull requests. When optional realtime room-state artifacts are not yet published in the backend repository, `pnpm api:sync` logs a clear notice and still succeeds. The 3D scene follows a conservative performance budget (FD8).
