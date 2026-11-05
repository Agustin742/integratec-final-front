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
pnpm dev
```

On nvm-windows, use `nvm install 22.23.4` and `nvm use 22.23.4` instead. Open the local URL printed by Vite. See [development setup](docs/development.md) for commands, layout, configuration, and verification boundaries.

| Command             | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm dev`          | Start the local development server                                     |
| `pnpm test`         | Run Vitest component checks once (no watch mode)                       |
| `pnpm e2e`          | Run Playwright smoke against preview after building                    |
| `pnpm lint`         | Check TypeScript, React hooks, and JSX accessibility rules             |
| `pnpm format:check` | Check formatting of the application, its configuration, and setup docs |
| `pnpm typecheck`    | Check types with TypeScript strict mode                                |
| `pnpm build`        | Check types, then generate static output in `dist/`                    |
| `pnpm preview`      | Serve the production build locally, not a production server            |

## Development rules

Read the [project rules](rules/README.md) before contributing. They cover GitHub Projects coordination, Git collaboration, English Conventional Commits and code, architecture, state and API contracts, session handling, accessible UI and forms, data/time conventions, configuration, operations, quality, security, AI usage, and art direction. The visual target and the rendering technology (Three.js with React Three Fiber) are agreed. The [course requirements](rules/project-requirements.md) preserve the academic requirements and evaluation criteria extracted from the temporary course brief; section 10 of [the project document](master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the proposed product.

The product rules develop the expected behavior for classrooms/roles, activities and grading, communication, the AI briefing, movement, avatars, and realtime presence. Their acceptance checklists describe future implementation evidence, not working features; open domain decisions are explicitly separated from established requirements.

## Promotion flow

Work branches enter `develop` through reviewed pull requests. Changes are promoted by pull request from `develop` to `test`, then from `test` to `main`. See [Git workflow](rules/git-workflow.md) for commit and merge conventions. CI runs for pull requests targeting `develop`, `test`, or `main` and pushes to `develop`. Work branches may target `develop`; only `develop` may target `test`, and only `test` may target `main`.

## CI

The `checks` job runs Python standard-library CI regressions and checks tracked Markdown documents for internal inline link paths and ATX (`#`) heading anchors. External URLs are ignored (no network requests); inline code and fenced examples are not links. This limited checker covers the current documentation syntax, not reference-style links, HTML anchors, or all Markdown dialects. It does not enforce document whitespace or final newlines.

CI fetches full history and runs `git diff --check` on proposed changes: PR base SHA to the checked-out merge result, or push `before` SHA to HEAD. An initial push uses the empty tree. Only added/changed lines are checked, preserving unchanged existing whitespace. CI also validates the workflow using actionlint **1.7.7**, installed into the runner's temporary directory using Go.

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

The job uses Node.js 22 and Corepack/pnpm when both `package.json` and `pnpm-lock.yaml` are present. A package without its lockfile fails clearly. When no package or test script is configured, CI reports that no application tests were run in a GitHub notice and the job summary; CI-tooling regressions still run.

## Cross-repository contracts

REST contracts come from the OpenAPI document generated by the backend (decision D4): the frontend generates its TypeScript types from it into `src/api/` and uses `openapi-fetch` (FD2). See the [architecture decisions](docs/technical-justification.md#architecture-decisions). The backend commits `openapi.json` and its realtime type artifacts; the planned `pnpm api:sync` script pulls them from the backend repository and regenerates committed types in `src/api/` and `src/realtime/` (FD7), so the build does not need a running backend. The 3D scene follows a conservative performance budget (FD8). Contract synchronization is not implemented by the bootstrap; these integration boundaries remain reserved for later work.
