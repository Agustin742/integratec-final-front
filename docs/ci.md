# Frontend CI

The single `checks` job validates repository tooling and the configured frontend scripts. Start with the [README local commands](../README.md#ci) and [Node 22/pnpm setup](development.md#toolchain); test-runner policy and optional browser checks belong to the [testing guide](testing.md).

## Triggers and existing gates

[The workflow](../.github/workflows/ci.yml) runs on pull requests targeting `develop`, `test`, or `main`, and pushes to `develop`, using `ubuntu-latest`. There is no path filter: a documentation-only PR still runs application checks when `package.json` exists.

| Gate                     | Behavior                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Promotion source         | PRs into `develop` accept work branches; PRs into `test` require `develop`, and those into `main` require `test`.                                                                                                  |
| Python regressions       | Runs standard-library unittest discovery for `scripts/ci/test_*.py` with bytecode writing disabled.                                                                                                                |
| Documentation links      | Checks tracked Markdown inline internal paths and ATX heading anchors. External URLs, inline code and fenced examples are excluded; reference-style links and HTML anchors are not covered.                        |
| Proposed-diff whitespace | Full-history checkout supports `git diff --check`: PR base SHA to checked-out merge result, or push `before` SHA to HEAD; an initial push uses the empty tree. Unchanged historical whitespace is not revalidated. |
| Workflow validation      | Installs actionlint **1.7.7** with Go into the runner's temporary directory and validates `ci.yml`.                                                                                                                |

The link checker makes no network requests and does not enforce document whitespace or final newlines. These gates remain separate from application setup and checks.

## Application setup and independent checks

1. Detect `package.json`. If it exists without `pnpm-lock.yaml`, fail with an explicit lockfile diagnostic.
2. Run `corepack enable` **before** `actions/setup-node@v4`, so pnpm is resolvable for cache setup.
3. Select Node.js **22** and enable pnpm-store caching keyed on `pnpm-lock.yaml`.
4. Install with `pnpm install --frozen-lockfile`.

After a successful install, five separate steps invoke [the check helper](../scripts/ci/run_frontend_check.sh):

| Script         | Local equivalent    | Purpose                                               |
| -------------- | ------------------- | ----------------------------------------------------- |
| `lint`         | `pnpm lint`         | TypeScript, React hooks and JSX accessibility linting |
| `format:check` | `pnpm format:check` | Formatting within the configured file scope           |
| `typecheck`    | `pnpm typecheck`    | Strict TypeScript checking                            |
| `test`         | `pnpm test`         | Non-watch component checks                            |
| `build`        | `pnpm build`        | Typecheck, then production bundle                     |

The `Build frontend` step supplies explicit, non-secret test placeholders (`VITE_APP_ENV=test`, `VITE_API_BASE_URL=https://api.example.invalid`, `VITE_REALTIME_URL=wss://realtime.example.invalid`) to satisfy the build-time public configuration boundary ([issue #15](https://github.com/Agustin742/integratec-final-front/issues/15)), and immediately runs `pnpm security:check` ([issue #21](https://github.com/Agustin742/integratec-final-front/issues/21), [security guide](security.md)) to verify that `dist/index.html` contains no inline scripts and that `dist/customHttp.yml` and root `customHttp.yml` enforce the strict FD1 Content-Security-Policy.

The helper checks each script's presence before running it. A missing script emits a GitHub notice and records `Skipped (script absent)`, not a passing check. A missing `test` script also adds a **Tests not configured** summary with an explicit no-tests-run message.

A configured command's nonzero exit fails its step and the `checks` job. The remaining application checks still run after a successful install, unless the job is cancelled; one failed check does not hide the others. Setup failure does not run application checks.

Without `package.json`, application setup and all five checks are skipped. A notice and **Tests not configured** summary explain that no tests ran; documentation and CI-tooling gates remain active. This no-package path is not a docs-only PR bypass.

## Reading results and diagnosing failures

The **Summarize frontend checks** step uses `if: always()` and writes a five-row **Frontend checks** table. Helper outputs are `Passed`, `Failed`, or `Skipped (script absent)`. A step without a result uses the literal fallback `Skipped (setup failed or no package)`; consult the step log for the actual cause, including cancellation. The table does not replace the job conclusion or preceding gate logs.

| Symptom                                    | Next check                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Promotion rejected                         | Confirm source and target against the [promotion flow](../rules/git-workflow.md#branches-and-promotion).    |
| Broken link or anchor                      | Follow the named destination; include new Markdown explicitly in local checks until staged.                 |
| Whitespace or actionlint failure           | Use the [README diff-base and validator commands](../README.md#ci); inspect the reported line.              |
| Missing lockfile or frozen-install failure | Confirm the declared toolchain and committed lockfile match the package; do not bypass frozen installation. |
| Application check failed                   | Run its local equivalent above on Node 22 and inspect that command's diagnostic.                            |
| Skipped check                              | Distinguish absent script/package from setup failure in the logs; never report a skipped suite as passed.   |

Run commands from the repository root after the [frozen-install quick start](../README.md#local-development). The README retains local Python, documentation, whitespace and actionlint commands, including handling new files and promotion targets. Local success alone does not prove GitHub execution or configured branch protection.

## Observed evidence and boundaries

The original implementation [commit `1901373`](https://github.com/Agustin742/integratec-final-front/commit/190137373c469b56b3c5d20a02fb334e66d3a2c2), published in [draft PR #64](https://github.com/Agustin742/integratec-final-front/pull/64), passed [Ubuntu run 42036290907](https://github.com/Agustin742/integratec-final-front/actions/runs/42036290907) on Node **22.23.4**: all five application checks, Python **8/8**, documentation **50 files**, actionlint **1.7.7**, component tests **2/2**, and build **16 modules**. This evidence applies to that source commit, not automatically to later documentation commits.

The independent Windows verifier passed S1–S3, but S4 was **unavailable** after CRLF/shell and output-capture problems; it did not complete the application suite. The independent Ubuntu execution supplied the missing functional proof, not a retroactive Windows full pass. Review/closure status and follow-up evidence belong in [Alejo's tracker](../changelogs/tracker-alejo.md).

Playwright remains optional and local, not a CI merge gate; this workflow installs no browsers. Deployment and branch-protection configuration are outside this change, and passing CI alone does not establish merge readiness. Follow the [testing guide](testing.md) and [review requirements](../rules/git-workflow.md#pull-requests-and-merges).
