# AI Usage Declaration

Course declaration of AI use in the development process (see [course requirements](../rules/project-requirements.md)). The policy contributors follow is in [Responsible AI usage](../rules/ai-usage.md). This document records actual experience; it MUST NOT contain invented cases.

> Status: partial evidence recorded. Sections marked _Pending_ still require team input and human review.

## Tools used

| Tool                                   | Tasks supported                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code                            | Drafting and reviewing project documentation and rules in this repository                                                                                                                       |
| el Gentleman in Pi                     | Approved #26 panel entry catalog, test-first implementation, automated checks and independent agent verification; #42 student file submission slice (idempotent service, panel, MSW store, E2E) |
| _Pending: to be completed by the team_ | _Pending: to be completed by the team_                                                                                                                                                          |

## Successful case

- **Context:** _Pending: to be completed by the team_
- **What the tool produced:** _Pending: to be completed by the team_
- **Why it helped:** _Pending: to be completed by the team_

## Case that required correction

- **Context:** _Pending: to be completed by the team_
- **What was wrong:** _Pending: to be completed by the team_
- **How it was detected:** _Pending: to be completed by the team_
- **How it was resolved:** _Pending: to be completed by the team_

## Human verification

- **Review of AI output before inclusion:** _Pending: to be completed by the team_
- **Tests or checks run:** _Pending: to be completed by the team_
- **Contributor able to explain the result:** _Pending: to be completed by the team_

## Classroom registry evidence (#26)

- **Human scope decision:** On 2026-11-16, the contributor approved minimum panel entries using server `availablePanels`, with honest pending business content and reserved `pet` exclusion. See the [scope reconciliation](./classroom-panels.md#approved-scope-reconciliation).
- **Useful assistance:** Failing tests exposed the empty default registry before implementation; the new default entries preserve the existing server visibility and focus controller rather than duplicating permissions.
- **Correction:** An artifact preview initially served the wrong checkout. Explicit preview cwd and pinned Node/pnpm exposed the actual remaining mobile 200% zoom failure; a local classroom-dialog height override fixed it without changing shared permission logic.
- **Observed checks:** Parent full suite 477/477 and independent focused 55/55 passed before the height-only correction; desktop/mobile zoom checks then passed 2/2. Final check results and historical failures are recorded in the contributor tracker. Mock API checks are not live-backend proof.
- **Human responsibility:** The scope decision is approved; code explanation, team review, PR approval and merge remain human responsibilities. Agent verification is not human approval.

## Classroom join review corrections (#31)

- **Human scope decision:** The contributor authorized corrections to invitation recovery after session loss, misleading network-outcome copy, and explicit rejection tests; no onboarding redesign or backend contract change.
- **Assistance and correction:** Pi helped reproduce the lost approved return target after URL scrubbing and replace a false no-account-change guarantee with uncertain-outcome feedback. Initial tests observed the wrong login return and the old rollback claim for both join endpoints before source edits.
- **Evidence boundary:** Tests use existing session middleware/controller and MSW/public API calls. They check rejection privacy and current-account confirmation, not live-backend enrollment. Final automated results belong in the contributor tracker; team review and human acceptance remain pending.

## Profile preview refinement (#29, PR #82)

- **Human scope decision:** The contributor approved a bounded refinement of the existing 2D preview, correction of the unsupported skin-tone claim and explicit mock-vs-integration evidence. No 3D renderer, avatar contract or persistence behavior is added.
- **Assistance and correction:** el Gentleman in Pi compared the PR screenshots and SVG with the agreed art direction. The initial oval head and heavy outlines were replaced with an original rounded-cube human silhouette, soft shading and distinct existing hair/clothing choices.
- **Fixture correction:** After global verification exposed readiness races, the contributor authorized a test-only extension. A deferred redirect regression first failed because initial route initialization was mistaken for destination readiness. The fixtures now wait for the requested route's idle navigation state and for the classroom request to exist before resolving it. A browser fixture also measures its physical background-click target after modal activation rather than relying on a stale off-screen position. Original UI/focus/pointer assertions and configured timeouts remain unchanged; the final checks passed 623/623 unit tests and 72/72 browser scenarios.
- **Verification boundary:** Rendering is checked visually on desktop/mobile; automated checks and their observed results are recorded in the contributor tracker. Mock reload evidence does not prove real backend or cross-device persistence. Team review of the refined result remains a human responsibility.

## Student report card and teacher tracking panel (#46)

- **Human scope decision:** The contributor chose card #46 (HU-ACT-005) as parallel work while other teammates hold #42, required a separate worktree branched from an updated `develop`, and asked to respect the issue scope at 100%: student report card (grades, feedback, points per activity, own metrics, wallet slot) and the teacher per-student tracking panel, no 3D work.
- **Useful assistance:** AI located the published backend contract for back #36 on the open backend PR #105 branch and synced the generated types (FD9 mock-first flow), mapped the repo conventions (scoped query keys, Zod boundary schemas, MSW handler factories, panel catalog, es-AR message modules), and implemented the panel branching on the server-resolved role exactly as the backend panel model grants it (`view_metrics` availability for students, parents and staff).
- **Correction:** The first full check run failed before any app code ran: the fresh worktree lacks the gitignored `.env` public config, so `vite build` rejected with `ConfigValidationError`, and Playwright's preview webServer could not run the machine's native pnpm binary as a Node script. Both were detected from the explicit error output and resolved with explicit synthetic public env vars and the repo-pinned toolchain, no product change. Three test sites assumed the old `grades` pending placeholder and were updated to the real panel, and one E2E assertion matched exact text inside a label-bearing span and was corrected.
- **Verification boundary:** Lint, typecheck, build, security:check, format:check, docs and CI script checks pass; focused unit `21/21` and focused E2E `28/28` pass; full-suite deviations (`865/869` vitest, `115/116` E2E) were reproduced on a pristine `origin/develop` worktree on this machine or pass in isolation, so they are disclosed as pre-existing environment flakiness, not claimed as caused or fixed by this work. MSW mocks are not integration proof; the backend counterpart (back #36, PR #105) is not merged yet. Team review, push and PR remain human responsibilities.

## Teacher activity editor evidence (#39)

- **Human scope decision:** On 2026-11-18, the contributor directed [issue #39](https://github.com/Agustin742/integratec-final-front/issues/39) (`HU-ACT-001` part 1/2): implement the issue scope and objective completely on `feat/39-teacher-activity-editor`, branched from an up-to-date `develop` (`c50d62b`) with zero carried commits, using the MCP tooling where needed and keeping the design quality. Field limits and point weights follow the generated contract DTOs rather than assumed values; acceptance still requires team review before push/PR.
- **Useful assistance:** el Gentleman in Pi produced the four implementation commits — contract-derived Zod schemas, typed services, scoped query keys and MSW handlers (`e517705`), the activities panel with role/capability gating and logical-deactivation UX (`360ab38`), the editor with the accessible multiple-choice builder and one-way publish flow (`eb62a6d`), and the Playwright “teacher publishes an exam” spec plus documentation captures (`439c483`). The doc-facing spec captures the 1280px/360px evidence screenshots committed under `docs/assets/activities/`.
- **Corrections:** The exploration MCP call failed twice with provider `invalid_request`; exploration was done inline by the parent instead of fabricating exploration results. A stray debug `console.error` left by the editor worker was caught and removed in the E2E commit (`439c483`). Two vitest cases failed only under full parallel load (loading-state timing); they were re-run in isolation, confirmed flaky, and disclosed rather than silently “fixed”. A formatting deviation introduced in the documentation-capture spec step was caught by `prettier --check` and corrected before the final suite run.
- **Observed checks:** Full local suite on Node `22.23.4`: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm security:check` and `git diff --check origin/develop..HEAD --` pass; `pnpm test` 754/756 with the two load-flaky cases passing in isolation (failing names recorded in the tracker); `pnpm format:check` fails only on a pre-existing checkout-wide CRLF artifact (this Windows checkout materializes HEAD-identical tracked files with CRLF; branch files pass Prettier once normalized, and no mass normalization was performed); the full Playwright suite passed 86/86 desktop+mobile scenarios; Python CI checks passed 9/10 locally with the one failure being a Windows newline artifact in the test's own temp bash fixture (the suite runs in Ubuntu CI), and `check_docs.py` passed 68 files. Results with every failed/unavailable check are recorded in the contributor tracker.
- **Human responsibility:** The scope direction and branch/contract decisions are the contributor's; code explanation, team review, PR approval and merge remain human responsibilities. Mock and showcase evidence is not live-backend proof.

## Student activity inbox review fixes (#41, PR #96)

- **Human scope decision:** The contributor authorized targeted code-review fixes for PR #96 covering terminal `403`/`404` cache cleanup, live SSE context revocation on `ActivityDetailPage`, capability-gated tabs, `TeacherActivityResponseDto` (`createdById`) schema preservation, MSW `PARENT` list parity, accessibility/copy hygiene, and regression tests; no backend contract or new product features were added.
- **Assistance and correction:** AI-assisted review and edits replaced active-query `removeQueries` calls (which could trigger repeated `403`/`404` refetches while mounted) with inactive-page cleanup plus ref-guarded `classroomDetailQueryKey` invalidation and unmount eviction, mounted `useClassroomContextEvents` on `ActivityDetailPage`, gated `document.title` against terminal errors/revocation, switched `<Tabs>` to controlled `effectiveTab` with `participate_activities` gating, modeled `activityDetailDtoSchema` as a jitless teacher/student union preserving `createdById`, and strengthened RTL/MSW tests (including `404` request-count bounds, `503` stale-data preservation, SSE demotion fallback, and outgoing panel `<Link>` navigation).
- **Verification boundary:** Local verification runs lint, typecheck, targeted Vitest suites (`53/53`), production build, `security:check`, focused Playwright E2E (`e2e/activities-inbox.spec.ts`, `2/2` desktop and mobile), Prettier, `check_docs.py`, and `git diff --check` against synthetic MSW responses. Full Ubuntu CI regression checks run on push; team review and human merge approval remain human responsibilities.

## Teacher activity editor unification and review fixes (#39 + #41, PR #97)

- **Human scope decision:** After `#41` (`PR #96`) merged into `develop`, the reviewer authorized merging `origin/develop` into `feat/39-teacher-activity-editor`, unifying onto a single `ActivitiesPanel` (removing duplicate `ClassroomActivitiesPanel`), consolidating activity `es-AR` copy into `src/features/classrooms/activities/messages.ts`, restoring `changelogs/tracker-mati.md`, and applying all code-review audit fixes without changing the backend contract.
- **Assistance and correction:** AI-assisted review caught and fixed seven concrete defects: (1) split `WeakSet` preventing malformed `2xx` write errors from triggering server reconciliation (`isUncertainWriteError` now aliases `isUncertainActivityWriteError`), (2) `publishClassroomActivity` routing backend `400 VALIDATION_FAILED` with `details` to generic form validation instead of `publishNotPublishable`, (3) `EditEditorForm` unconditionally sending `questions` on `PATCH` (now omitted when unchanged so metadata edits on submitted MCQ activities avoid `409`), (4) payload schema bounds aligned with backend `ACTIVITY_LIMITS` (integer `0–100` `maxScore`, `0.5–3` weight, `1–50` questions, `2–6` options, strict ISO-offset instants, string length caps), (5) render-crash protection for `lingeringOpensAt` and safe `resolveSchoolTimeZone` fallback, (6) FD11 IANA timezone display via `formatActivityDeadline`, and (7) `PublishActivityDialog` reconciliation on `403`/`404`/`409`/uncertain failures plus multiline `<textarea>` description, edit-load retry/`404` reconciliation, `size="icon"` (`44×44px`) builder buttons, and responsive student E2E assertions.
- **Verification boundary:** Local verification runs lint, typecheck, targeted Vitest suites (`140/140`), production build, `security:check`, `assets:check`, Prettier, `check_docs.py`, Playwright E2E (`8/8` across `teacher-activity-editor.spec.ts` and `activities-inbox.spec.ts`, desktop `1280px` and mobile `360px`, with refreshed screenshots visually inspected), and `git diff --check` against synthetic MSW/route fixtures. Full Ubuntu CI regression runs on push; human review and merge approval remain required.

## Classroom shop catalog and idempotent purchase flow (#48)

- **Human scope decision:** The contributor selected [issue #48](https://github.com/Agustin742/integratec-final-front/issues/48) (`HU-GAM-003`) to close the student gamification loop in parallel with `#42`, `#44`, and `#46`, isolated under `src/features/shop/` and wired into `classroomPanelCatalog` key `'shop'` without modifying backend behavior.
- **Useful assistance and corrections:** AI-assisted triangulation against `schema.generated.ts` and `backend/apps/api/src/shop/` surfaced three contract constraints before coding: `sort=defaultPrice` (not `price`), required `Idempotency-Key` HTTP header with strict `{ shopItemId }` body, and `AllExceptionsFilter` stripping `409 CONFLICT` sub-details so `PurchaseConfirmDialog` reconciles catalog and wallet via `invalidateStudentWallet` before explaining insufficient balance vs already-owned conflicts. A closure bug in the initial reconciliation draft (reading stale `wallet.wallet.balance` instead of `queryClient.getQueryState`) was caught during inline code review and fixed before running tests.
- **Verification boundary:** Local verification runs lint, typecheck, targeted Vitest suites, production build, `security:check`, `assets:check`, Prettier, `check_docs.py`, Playwright E2E (`e2e/classroom-shop.spec.ts` desktop `1280px` and mobile `360px` with visually inspected captures), and `git diff --check` against synthetic MSW/route fixtures. Full Ubuntu CI regression runs on push; human review and merge approval remain required.

## Teacher grading queue, submission viewer and grading form (#44)

- **Human scope decision:** The contributor selected [issue #44](https://github.com/Agustin742/integratec-final-front/issues/44) (`HU-ACT-004`) to complete the teacher grading half of the MVP academic loop in parallel with `#42` and `#46`, keeping the module isolated under `src/features/classrooms/grading/` and following the generated OpenAPI contract and backend D18 rules without modifying backend behavior.
- **Useful assistance and corrections:** AI-assisted triangulation cross-checked `frontend/src/api/schema.generated.ts` against `backend/docs/grading.md` and `grades.service.ts` before coding, surfacing three contract-critical constraints: `@VisibleText` rejects newlines/control characters in `feedback`, `PATCH /submissions/{submissionId}/grade` uses the field name `version` with `409 CONFLICT` `details[0].field` (`version` / `submission` / `activity`), and `GET /submissions/{submissionId}` emits `no-store` short-lived signed download URLs. React 19 ESLint checks (`react-hooks/set-state-in-effect` and `react-hooks/refs`) caught synchronous state/ref updates during the initial typecheck/lint pass, which were refactored to derived state and effect-only ref tracking.
- **Verification boundary:** Local verification runs lint, typecheck, targeted Vitest suites, production build, `security:check`, Prettier, `check_docs.py`, Playwright E2E (`e2e/teacher-grading.spec.ts` desktop `1280px` and mobile `360px` with visual screenshot inspection), and `git diff --check` against synthetic MSW/route fixtures. Full Ubuntu CI regression runs on push; human review and merge approval remain required.

## Study Guide Bot conversation (#54)

- **Human scope decision:** The contributor selected [issue #54](https://github.com/Agustin742/integratec-final-front/issues/54) (`HU-BOT-002`) and approved replacing `entry('bot')` in `classroomPanelCatalog` with `StudyGuideBotPanel` using a provisional `GET /bot/status` and `POST /bot/messages` contract until `Agustin742/integratec-final-back#41` lands in `src/api/schema.generated.ts`.
- **Assistance and correction:** AI-assisted implementation built the jitless Zod schemas, `BotServiceError` classifier (`exam_locked`, `rate_limited`, `provider_unavailable`, `forbidden`), `${userId}:${classroomId}`-isolated conversation state, in-flight `AbortController` + exam-lockout discard, and unit/RTL/`axe-core`/Playwright tests; Vitest caught `context.classroom.myRole` vs `context.myRole` on `ClassroomContext` during the initial `PARENT` test run.
- **Verification boundary:** Local verification ran lint, typecheck, `bot-service.test.ts` + `study-guide-bot-panel.test.tsx` + `classroom-workspace-panels.test.tsx`, production build, `security:check`, Prettier, focused Playwright `e2e/study-guide-bot.spec.ts` (desktop `1280px` and mobile `360px` with screenshot inspection), and `git diff --check` against synthetic MSW/route fixtures. Full Ubuntu CI regression runs on push; human review and merge approval remain required.

## Study Guide Bot material toggle (#53)

- **Human scope decision:** The contributor selected [issue #53](https://github.com/Agustin742/integratec-final-front/issues/53) (`HU-BOT-001`) and approved implementing a provisional `configure_bot`-gated contract in `MaterialPanel` (`renderItemSlot`) until `Agustin742/integratec-final-back#40` lands in `src/api/schema.generated.ts`, keeping `schema.generated.ts` untouched.
- **Assistance and correction:** AI-assisted implementation and blind RDD audit (`risk`, `resilience`) surfaced and fixed overlapping `GET /bot/materials` cache overwrites (`cancelQueries` around `PUT`), unbounded `4000ms` polling on `403`/`404` errors, focus loss on `disabled` switches (`aria-disabled` + `44x44px` touch target + high-contrast OFF track/thumb), and misleading hint copy on unconfirmed/failed states.
- **Verification boundary:** Local verification ran lint, typecheck, `material-bot-service.test.ts` + `material-bot-toggle.test.tsx`, production build, `security:check`, Prettier, focused Playwright `e2e/study-materials.spec.ts` (desktop `1280px` and mobile `360px` with screenshot inspection), and `git diff --check` against synthetic MSW/route fixtures. Full Ubuntu CI checks and Node 22 Vitest/E2E runs execute on push; human review and merge approval remain required.

## Data handling

Secrets, credentials, and real personal data are not submitted to AI tools, per [Responsible AI usage](../rules/ai-usage.md#data-handling).
