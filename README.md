# Frontend repository

This repository currently contains frontend documentation only; it does not yet include an application package or configured tests.

## Development rules

Read the [project rules](rules/README.md) before contributing. They cover Git collaboration, English Conventional Commits, English code, quality, security, AI usage, and art direction. The [course requirements](rules/project-requirements.md) preserve the academic requirements and evaluation criteria extracted from the temporary course brief; section 10 of [the project document](master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the proposed product.

## Promotion flow

Work branches enter `develop` through reviewed pull requests. Changes are promoted by pull request from `develop` to `test`, then from `test` to `main`. See [Git workflow](rules/git-workflow.md) for commit and merge conventions. The current workflow does not run on pull requests targeting `develop`; applicable local checks must be reported before merge. CI runs for pull requests targeting `test` or `main` and pushes to `develop`, and rejects pull requests that do not use the expected source branch.

## CI

The `checks` workflow job uses Node.js 22 and Corepack/pnpm once both `package.json` and `pnpm-lock.yaml` are present. A package without its lockfile fails clearly. When no test script is configured, CI reports that no tests were run in a GitHub notice and the job summary.

## Cross-repository contracts

Ownership and implementation of any contracts shared with the backend across repositories have not yet been decided. No shared architecture is defined here.
