# Tracker — Alejo

## 2026-11-05 — Extend frontend CI (#13)

- **Status:** in-progress
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/`, README.
- **Change:** Implement [issue #13](https://github.com/Agustin742/integratec-final-front/issues/13): preserve existing CI gates, add conditional application checks, pnpm cache and execution summary.
- **Reason:** Make frontend quality commands mandatory when configured, with explicit skipped-check reporting. AI assistance: el Gentleman/Pi implementation and independent verification.
- **Next step:** Observe regression RED/GREEN and verify application tooling, actionlint and documentation. No deployment or branch-protection changes.

## 2026-11-04 — Set up frontend test infrastructure (#12)

- **Status:** completed (local implementation and independent verification)
- **Area / files:** `package.json`, testing configuration/utilities, Playwright smoke test, README and development documentation.
- **Change:** Implemented authorized [issue #12](https://github.com/Agustin742/integratec-final-front/issues/12) infrastructure through a bounded writer: Vitest/jsdom/RTL/jest-dom, render and axe helpers, Playwright preview smoke and test documentation. No product source or CI workflow changes.
- **Reason:** Enable repeatable unit/component and end-to-end checks for future stories. AI assistance: el Gentleman/Pi orchestration with bounded implementation and independent verification.
- **Verification:** Independent fresh-copy frozen install (353 packages, zero reused), Vitest 2/2, lint, formatting, typecheck, build, Playwright desktop/mobile 2/2, documentation links (50 files) and Python CI regressions 5/5 passed on Node 22.23.4/pnpm 10.34.9. Invalid remote URL rejected with the expected diagnostic. Original bytes/status/index preserved; production bundle excludes test tools. Parent seam test 2/2, typecheck and whitespace passed. Initial formatting errors and Playwright's global-pnpm mismatch were corrected; initial lint timed out at 30 seconds, and an explicitly authorized rerun passed in 7 seconds. Initial missing-helper RED was import-level, not assertion-level. Interactive/async states are N/A for the unchanged placeholder; remote deployment, backend integration and full accessibility audit are not claimed.
- **Review / commit:** Local work unit `60db6bddaef88303f38e7d0b745e731d2290b1f0` on `chore/12-testing-infrastructure`, 266 authored changed lines excluding lockfile, based on merged develop `e26d3c9`. Committed-range native assessment reports medium native risk and reviewDue false (under_budget); item-5 escalation's independent verification passed. No native review approval claimed. Tracker evidence and the preceding board-cleanup record accompany the implementation in a separate documentation commit for the same delivery; existing history is preserved.
- **Delivery:** completed (publication) — Alejo authorized push/PR; published [PR #63](https://github.com/Agustin742/integratec-final-front/pull/63) into `develop`. The initial push failed because the shared `test` branch blocks the `test/` prefix; the feature branch was renamed to `chore/12-testing-infrastructure` without changing commits or shared branches. This tracker accompanies the same PR. No merge or deployment performed.
- **Next step:** Confirm GitHub checks and obtain teammate review; merge remains subject to approval and applicable checks.

## 2026-11-04 — Reconcile Project items and analyze testing infrastructure (#12)

- **Status:** completed
- **Area / files:** frontend GitHub Project, issue #12, `changelogs/tracker-alejo.md`.
- **Change:** Confirmed [PR #62](https://github.com/Agustin742/integratec-final-front/pull/62) merged, set #11 and Design School Uniforms for Female and Male Avatars to Done, and removed Trial task-scoped rule loading for Alejo from the Project as requested. Analyzed [#12](https://github.com/Agustin742/integratec-final-front/issues/12) without implementing it.
- **Reason:** Reconcile Alejo's completed work and establish the next issue's exact boundaries.
- **Verification:** Project readback returned both requested Done items and no trial item. Read-only exploration confirmed no test script yet; #12 introduces Vitest/Testing Library and Playwright infrastructure, not feature tests, backend integration, CI redesign, or an MSW transport decision. A deployed URL must be configurable/documented; an actual deployment is not required by #12. No application behavior changed or application tests run.
- **Next step:** Analysis accepted by Alejo; implementation and verification are recorded above. Publication remains pending authorization.

## 2026-11-04 — Bootstrap frontend application (#11)

- **Status:** completed (local implementation and functional verification; issue remains open).
- **Area / files:** application tooling, `src/`, `README.md`, `docs/development.md`.
- **Change:** Implement [issue #11](https://github.com/Agustin742/integratec-final-front/issues/11) on `feat/11-bootstrap-frontend` from updated `develop`: React/Vite/strict TypeScript placeholder, pinned Node 22.23.4/pnpm 10.34.9, lockfile, quality scripts, and setup docs. Assigned to AlejoElPaisano and marked In progress in the Project; [team start notice](https://github.com/Agustin742/integratec-final-front/issues/11#issuecomment-6644424425).
- **Reason:** Provide the runnable frontend base without taking on F02/F03/F04/F10. AI assistance: el Gentleman/Pi implementation and an independent verifier; human review remains required.
- **Verification:** Root and isolated clean-copy frozen install, lint, formatting, typecheck, and build passed on Node 22. Strict-null fixture rejected by typecheck/build (TS2322, exit 2), leaving prior output unchanged; any/hooks/img-alt lint probes rejected (exit 1), and restored checks passed. Existing Python CI tests passed 5/5. Desktop/mobile/200% CSS zoom and production preview passed; semantic placeholder has no controls or async states. See [setup evidence and limitations](../docs/development.md#bootstrap-verification-evidence), including ESLint 9 peer-compatibility maintenance, absent application tests, unavailable actionlint, and the closed browser tab preventing a later console query.
- **Review / commit:** Implementation committed locally as `bbd76bb`. Native RDD `review-f18a26eba435bed8` approved the committed candidate through risk, readability, and reliability lenses; exact approved acknowledgement completed. No corrections required.
- **Next step:** Obtain authorization for push/PR and a teammate's review before merge. No push, PR, merge, deployment, or issue completion is claimed. Existing modules were preserved under ignored `odd/preexisting-node_modules/`; unrelated local artifacts remain uncommitted.
## 2026-11-04 — Clarify PR #60 asset documentation

- **Status:** completed
- **Area / files:** `docs/art/student-uniforms.md`, `changelogs/tracker-alejo.md`.
- **Change:** Clarify that the documented asset structure describes this delivery rather than approved project-wide decisions, and align the repository hygiene description with existing ignore patterns.
- **Reason:** Address [PR #60 review feedback](https://github.com/Agustin742/integratec-final-front/pull/60#issuecomment-6635107254) without changing assets, ignore rules, or open team decisions.
- **Verification:** Documentation checks passed across 48 tracked Markdown files; `git diff --check` passed. Readback confirmed both review points are addressed without changing assets, `.gitignore`, or authoritative open decisions. Native assessment reported passive risk and no review due. Application tests and RED/GREEN do not apply to this wording-only change.
- **Delivery:** User authorized committing and pushing this correction to `feat/avatar-uniform-assets` for PR #60.
- **Next step:** Reviewer confirmation on PR #60 after delivery; merge remains subject to approval and applicable checks.

## 2026-11-02 — Deliver male and female modular avatar and school uniform 3D assets

- **Status:** completed
- **Area / files:** `public/models/avatars/male/`, `public/models/avatars/female/`, `assets/blender/avatars/student-uniforms/`, `docs/art/student-uniforms.md`, `.gitignore`, `rules/git-workflow.md`, `AGENTS.md`.
- **Change:** Add the 24 verified male (`34`-joint rig) and female (`41`-joint rig) modular avatar `.glb` assets (bodies, hairstyles, casual tops, accessories, and primary `coat-tie.glb` / secondary `polo-sweater.glb` school uniforms), the 4 editable school uniform `.blend` files (`uniform.blend`), and their technical/verification documentation in `docs/art/student-uniforms.md`. Keep local agent plans and temporary Blender renders/scripts gitignored under `odd/`, and record the ~400-line single-functionality PR guideline in `rules/git-workflow.md`.
- **Reason:** Deliver the male and female character, clothing, school uniform, and accessory 3D assets and their verification documentation in a clean branch off `develop`, aligned with `rules/quality-and-testing.md` and `rules/documentation-and-decisions.md`.
- **Verification:** `python -B scripts/ci/check_docs.py` passed across all 48 tracked Markdown files, `5/5` CI regression tests (`scripts/ci/test_checks.py`) passed, Blender visual lineup inspection verified the exported `.glb` assets, and `git diff --check origin/develop` exited 0.
- **Next step:** Update PR #60 into `develop`.

## 2026-10-22 — Develop source-grounded functional rules

- **Status:** completed
- **Area / files:** seven domain rule documents under `rules/`, `rules/README.md`, `master-document.md`, `odd/tasks/domain-rules.md`.
- **Change:** Develop deep behavior contracts for rooms, productivity, communication, AI, interaction, avatars, and realtime presence.
- **Reason:** Expand agreed product commitments without choosing a rendering engine or inventing unresolved domain decisions.
- **Verification:** Seven rules (914 lines) received writer self-review and parent readback. Per-unit link checks passed; one initial accented-anchor error in Unit A was corrected before delivery. The parent seam check passed all 5 existing CI-tooling tests and links/anchors across 37 Markdown files; tracked/new-file whitespace passed and art direction is unchanged. Runtime, RED/GREEN, typecheck, and differential checks are not applicable to passive documentation. Native assessments, including committed slices, were unavailable because the provider requires an explicit declaration for pre-existing untracked files; no review started or approval claimed.
- **Commits:** `67104c9` (movement/avatars), `aa28d67` (AI/realtime), `44707e8` (rooms/tasks/communication), `52e013c` (integration), followed by closure bookkeeping on `docs/domain-rules`.
- **Next step:** Human review of the rules and explicit resolution of open product decisions before their implementation. No push, PR, or merge performed; prior general-rule changes remain uncommitted separately.

## 2026-10-22 — Define general development and coordination rules

- **Status:** completed
- **Area / files:** `rules/`, `README.md`, `master-document.md`.
- **Change:** Add 14 general coordination, architecture, integration, UX, and operational rules; update the index and Git coordination reference. Preserve the agreed art direction while clarifying that the rendering engine remains undecided.
- **Reason:** Establish reusable team constraints without inventing board configuration, session mechanisms, or engine-specific decisions.
- **Verification:** Five existing CI-tooling regression tests passed; links/anchors passed across 29 Markdown files including all untracked rules; tracked and new-file whitespace checks passed. Confirmed no diff in `rules/art-direction.md`. Application runtime tests and RED/GREEN are not applicable to passive documentation. Reading GitHub Projects failed because the current CLI token lacks `read:project`; no permissions or remote settings were changed. Native assessment was unassessable because it requires explicit untracked scope; no native review started. An initial assessment invocation through the batching tool was rejected before execution; the direct assessment returned that unavailable result.
- **Commit follow-up:** The user requested committing the previously separate general-rule changes. Readback confirmed the 14 rule documents and their index/workflow references; all 5 CI-tooling tests, links across 37 documents, and tracked/new-file whitespace checks passed again before staging.
- **Next step:** Team review of the new policies and mapping to actual Project fields when read access is available. Commit locally as a separate general-rule unit; no push is authorized.

## 2026-10-22 — Preserve literal Markdown in CI summaries

- **Status:** completed
- **Area / files:** `.github/workflows/ci.yml`, `scripts/ci/test_checks.py`.
- **Change:** Correct two shell quoting warnings without changing the notices or job summaries; pin their literal output in regression fixtures.
- **Reason:** GitHub run 39814978244 failed with ShellCheck SC2016; local Windows actionlint did not include ShellCheck.
- **Evidence:** Repository commit `67dc20c` contains the workflow correction and regression tests. This bookkeeping update does not assert a new test run or a successful remote GitHub run.
- **Next step:** Check the applicable GitHub run when remote verification is authorized; the local code correction is committed.

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
