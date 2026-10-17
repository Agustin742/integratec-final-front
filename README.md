# Frontend repository

This repository currently contains frontend documentation only; it does not yet include an application package or configured tests.

## Promotion flow

Changes are promoted by pull request from `develop` to `test`, then from `test` to `main`. CI runs for pull requests targeting `test` or `main` and pushes to `develop`, and rejects pull requests that do not use the expected source branch.

## CI

The `checks` workflow job uses Node.js 22 and Corepack/pnpm once both `package.json` and `pnpm-lock.yaml` are present. A package without its lockfile fails clearly. When no test script is configured, CI reports that no tests were run in a GitHub notice and the job summary.

## Cross-repository contracts

Ownership and implementation of any contracts shared with the backend across repositories have not yet been decided. No shared architecture is defined here.
