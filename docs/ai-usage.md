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

## Student activity inbox review fixes (#41, PR #96)

- **Human scope decision:** The contributor authorized targeted code-review fixes for PR #96 covering terminal `403`/`404` cache cleanup, live SSE context revocation on `ActivityDetailPage`, capability-gated tabs, `TeacherActivityResponseDto` (`createdById`) schema preservation, MSW `PARENT` list parity, accessibility/copy hygiene, and regression tests; no backend contract or new product features were added.
- **Assistance and correction:** AI-assisted review and edits replaced active-query `removeQueries` calls (which could trigger repeated `403`/`404` refetches while mounted) with inactive-page cleanup plus ref-guarded `classroomDetailQueryKey` invalidation and unmount eviction, mounted `useClassroomContextEvents` on `ActivityDetailPage`, gated `document.title` against terminal errors/revocation, switched `<Tabs>` to controlled `effectiveTab` with `participate_activities` gating, modeled `activityDetailDtoSchema` as a jitless teacher/student union preserving `createdById`, and strengthened RTL/MSW tests (including `404` request-count bounds, `503` stale-data preservation, SSE demotion fallback, and outgoing panel `<Link>` navigation).
- **Verification boundary:** Local verification runs lint, typecheck, targeted Vitest suites (`53/53`), production build, `security:check`, focused Playwright E2E (`e2e/activities-inbox.spec.ts`, `2/2` desktop and mobile), Prettier, `check_docs.py`, and `git diff --check` against synthetic MSW responses. Full Ubuntu CI regression checks run on push; team review and human merge approval remain human responsibilities.

## Data handling

Secrets, credentials, and real personal data are not submitted to AI tools, per [Responsible AI usage](../rules/ai-usage.md#data-handling).
