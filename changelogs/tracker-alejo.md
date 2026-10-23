# Tracker — Alejo

## 2026-10-22 — Develop source-grounded functional rules

- **Status:** in-progress
- **Area / files:** seven domain rule documents under `rules/`, `rules/README.md`, `master-document.md`, `odd/tasks/domain-rules.md`.
- **Change:** Develop deep behavior contracts for rooms, productivity, communication, AI, interaction, avatars, and realtime presence.
- **Reason:** Expand agreed product commitments without choosing a rendering engine or inventing unresolved domain decisions.
- **Verification:** Seven rules (914 lines) received writer self-review and parent readback. Per-unit link checks passed; one initial accented-anchor error in Unit A was corrected before delivery. The parent seam check passed all 5 existing CI-tooling tests and links/anchors across 37 Markdown files; tracked/new-file whitespace passed and art direction is unchanged. Runtime, RED/GREEN, typecheck, and differential checks are not applicable to passive documentation. Native assessments, including committed slices, were unavailable because the provider requires an explicit declaration for pre-existing untracked files; no review started or approval claimed.
- **Next step:** Finish recording local slice identities and closure. No push, PR, or merge is authorized; prior general-rule changes remain separate.

## 2026-10-22 — Preserve literal Markdown in CI summaries

- **Status:** in-progress
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/test_checks.py`.
- **Change:** Correct two shell quoting warnings without changing the notices or job summaries.
- **Reason:** GitHub run 39814978244 failed with ShellCheck SC2016; local Windows actionlint did not include ShellCheck.
- **Next step:** Pin the exact existing notice/summary output, correct the quoting, and verify the targeted fix before publishing.

## 2026-10-22 — Check work pull requests and documentation

- **Status:** completed
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/`, `README.md`, `rules/git-workflow.md`.
- **Change:** Add develop pull-request checks, local Markdown link/anchor validation, proposed-diff whitespace checks, CLI regression fixtures, and actionlint pinned to 1.7.7 in CI.
- **Reason:** Check work before integration without weakening promotion restrictions, rewriting existing whitespace, or introducing an application stack.
- **Verification:** Observed RED for the develop guard/trigger and missing checker, then GREEN; correction RED reproduced overbroad whitespace/final-newline rejection, then GREEN. Focused and full unittest discovery passed (four methods); all 15 tracked Markdown files passed. Target-base diff and working-tree whitespace checks passed; new-file checks emitted only CRLF conversion warnings (exit 1: differences). Ephemeral differential against 15f5ff6 preserved eight promotion cases exactly and intentionally changed develop feature acceptance; package/install/test steps remained unchanged, with exact notice/summary and stubbed command-invocation checks passing. Real diff fixtures preserved unchanged whitespace and rejected added whitespace; PR/push/initial-push base selection passed. S1–S5 self-review completed. Fixture cleanup and Windows path/newline issues encountered during verification were corrected; no fixtures or caches remain.
- **Additional verification:** Independent verification found no in-scope code blockers and passed all four regression tests, the 15-document link check, and tracked diff whitespace checks. The authorized temporary actionlint 1.7.7 Windows ZIP was checked against its official SHA-256 manifest; workflow validation exited 0. An initial incorrect archive URL returned HTTP 404 before execution; the release asset listing identified the correct ZIP. All temporary validator files were removed.
- **Next step:** Commit and push this CI work to `docs/project-development-rules` as explicitly authorized, then observe the existing pull request and its GitHub Actions run. At the time of this entry, GitHub execution and branch protections remain unverified; no GitHub settings changes are included.

## 2026-10-22 — Standardize English document filenames

- **Status:** completed
- **Area / files:** `rules/`, `master-document.md`.
- **Change:** Rename the art direction file and translate planned document paths, updating their references.
- **Reason:** Keep filenames in English consistently with the project conventions.
- **Verification:** 32 local links/anchors passed; old Spanish document paths are absent from active documentation; art direction SHA-256 is unchanged; the master document differs only in filename translations; `git diff --check` passed. Application tests do not apply to documentation-only renames.
- **Next step:** None for this change. No commits made.

## 2026-10-22 — Preserve course requirements without the PDF

- **Status:** completed
- **Area / files:** `rules/`, `README.md`.
- **Change:** Extract the academic requirements into a self-contained rule and replace links to the temporary PDF.
- **Reason:** The PDF is reading material only; the user will remove it from the repository.
- **Verification:** Nine Markdown documents and 32 local links/anchors checked successfully with PDF links explicitly forbidden; R1–R8 and required sections present; `git diff --check` passed. Application tests do not apply to this documentation-only correction.
- **Next step:** The user may remove the temporary PDF; documentation does not depend on it. No PDF deletion or commits performed.

## 2026-10-22 — Establish development rules

- **Status:** completed
- **Area / files:** `rules/`, `README.md`.
- **Change:** Document Git workflow, quality, security, and AI usage conventions; require English Conventional Commits and English code.
- **Reason:** Establish shared development expectations aligned with the course requirements.
- **Verification:** Checked six documents and 28 local links/anchors; `git diff --check` passed. Application tests are not applicable (documentation only, no package). Native review assessment was unavailable because untracked files require explicit scope selection; no review started.
- **Next step:** Agree on when to enforce the documented policy in GitHub settings and CI. The initial PDF retention assumption was superseded by the correction recorded above; no GitHub settings, workflow changes, or commits were made.
