# Frontend repository

This repository currently contains frontend documentation and CI tooling only; it does not yet include an application package or application tests.

## Development rules

Read the [project rules](rules/README.md) before contributing. They cover GitHub Projects coordination, Git collaboration, English Conventional Commits and code, architecture, state and API contracts, session handling, accessible UI and forms, data/time conventions, configuration, operations, quality, security, AI usage, and art direction. The visual target is agreed; the rendering engine remains undecided. The [course requirements](rules/project-requirements.md) preserve the academic requirements and evaluation criteria extracted from the temporary course brief; section 10 of [the project document](master-document.md#10-cumplimiento-del-enunciado-integrartec-2026) maps them to the proposed product.

The product rules develop the expected behavior for rooms/permissions, tasks, communication/meetings, the AI briefing, movement, avatars, and realtime presence. Their acceptance checklists describe future implementation evidence, not working features; open domain decisions are explicitly separated from established requirements.

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

The job uses Node.js 22 and Corepack/pnpm once both `package.json` and `pnpm-lock.yaml` are present. A package without its lockfile fails clearly. When no package or test script is configured, CI reports that no application tests were run in a GitHub notice and the job summary; CI-tooling regressions still run.

## Cross-repository contracts

Ownership and implementation of any contracts shared with the backend across repositories have not yet been decided. No shared architecture is defined here.
