# Tracker — Alejo

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
