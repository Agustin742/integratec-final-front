# Tracker — Alejo

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
