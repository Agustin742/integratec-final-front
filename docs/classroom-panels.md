# Classroom panel integration

The classroom workspace mounts the reusable panel provider with backend A's
`availablePanels`, **not action authorization**. The default production catalog
registers nine panel entries with centralized titles: `activities` renders
`ActivitiesPanel` ([`#41`](https://github.com/Agustin742/integratec-final-front/issues/41)
activity inbox and detail navigation unified with
[`#39`](https://github.com/Agustin742/integratec-final-front/issues/39)
teacher editor, multiple-choice builder, one-way publish flow, and deactivation — see the [activities feature doc](./classroom-activities.md)),
`material` renders `MaterialPanel` ([`#40`](https://github.com/Agustin742/integratec-final-front/issues/40)),
`grades` renders `ClassroomGradesPanel` ([`#44`](https://github.com/Agustin742/integratec-final-front/issues/44)
teacher grading queue, submission viewer, and grading/regrading workflow for `publish_content`-authorized staff, while showing the honest pending state to students and parents — see the [grading feature doc](./classroom-grading.md)),
`notices` renders `NoticeBoardPanel` ([`#49`](https://github.com/Agustin742/integratec-final-front/issues/49)),
`shop` renders `ShopPanel` ([`#48`](https://github.com/Agustin742/integratec-final-front/issues/48)
student classroom shop catalog, idempotent purchase confirmation, and purchase history — see the [classroom shop doc](./classroom-shop.md)),
`grades` renders `GradesPanel` ([`#46`](https://github.com/Agustin742/integratec-final-front/issues/46),
see the [grades guide](./ui-grades.md)) and
`members` renders `ClassroomMembersPanel`
([`HU-AUL-003`](https://github.com/Agustin742/integratec-final-front/issues/33)
`ClassroomRosterPanel` and capability-gated [`HU-AUL-002`](https://github.com/Agustin742/integratec-final-front/issues/32)
`ClassroomInvitationsPanel` for `invite_members`-authorized email invitations and one-time classroom join codes), and
`bot` renders `StudyGuideBotPanel` ([#54](https://github.com/Agustin742/integratec-final-front/issues/54)), while the remaining
two entries display the shared, honest “Funcionalidad pendiente” state until
their respective stories land.

## Approved scope reconciliation

For #26, the human approved minimum panel entries using the current server
contract on 2026-11-16. The issue's original “required capability” wording is
implemented as server-confirmed **panel availability**, not a fabricated mapping
to action capabilities. Actions still require their own server checks. This
frontend decision does not change the backend permission matrix or remotely edit
the issue; team acceptance of the reconciled criterion remains part of PR review.

| Registered key | Title                                                  |
| -------------- | ------------------------------------------------------ |
| `activities`   | Actividades (`ActivitiesPanel`, `#41` + `#39`)         |
| `material`     | Material (`MaterialPanel`, `#40`)                      |
| `grades`       | Calificaciones (`ClassroomGradesPanel`, `#44` + `#46`) |
| `chat`         | Chat                                                   |
| `notices`      | Avisos (`NoticeBoardPanel`, `#49`)                     |
| `shop`         | Tienda (`ShopPanel`, `#48`)                            |
| `bot`          | Asistente de estudio (`StudyGuideBotPanel`, `#54`)     |
| `members`      | Integrantes (`ClassroomMembersPanel`, `#33` + `#32`)   |
| `settings`     | Configuración                                          |

`pet` is reserved and never emitted by the current backend contract. It remains
unregistered and inaccessible even if a malformed response lists it. Unknown
keys are also denied. No menu, 2D layout, 3D objects or business actions are added.

## Caller contract

Classroom routes use `classroomPanelCatalog` by default. To integrate a finished
feature later, supply descriptors through `ClassroomWorkspace`'s optional `panels`
prop (which replaces, rather than merges with, the default catalog). Keys derive
from the generated `ClassroomPanelKey` enum. An explicit empty array denies all.
Nested consumers call `useClassroomPanels` from
`src/features/classrooms/panels/classroom-panels.tsx`. The workspace supplies
current user/classroom scope, server availability, description and heading focus
fallback. Its Outlet still receives the complete classroom context, plus the
one-shot URL-intent claim and close callbacks. If invalidation removes the heading,
focus returns to the labeled, stable workspace container outside private content.

For a standalone host, import `ClassroomPanelsProvider` and its public types:

- Supply the current `userId`, `classroomId`, and registry descriptors (`key`,
  `title`, `component`). Keys must be stable and unique; duplicate keys deny opening.
- Supply `availability` only from confirmed server visibility for that context:
  `{ confirmed: true, keys }`. Missing, unconfirmed, or empty input denies all.
  Invalidate with `{ confirmed: false }` as soon as context becomes uncertain.
- Supply a meaningful centralized es-AR `description` and descriptor titles.
  `fallbackFocus()` must resolve a current, connected, focusable workspace target
  (for example, a heading with `tabIndex={-1}`), not a removed trigger.
- Consumers call `openPanel(key, invoker?, onClose?)`. The optional close callback
  lets the nested route replace its URL when the dialog leaves. The call returns
  whether opening was accepted; DOM controls pass their initiating HTMLElement. Non-DOM intents omit
  it and use the workspace fallback. Denied calls do not move focus.
- URL consumers additionally supply a navigation ownership token. Departed URL-owned
  panels are released without closing unrelated manually opened panels.
- `canOpenPanel(key)` derives visibility from the same registry/availability check;
  it does not grant action authorization.

The provider owns local open state and the incumbent Radix Dialog host. Loss of
availability or registry membership immediately removes the active subtree and
clears its intent. Reallowing never reopens it. User/classroom changes remount the
scope, disposing drafts and invalidating callbacks retained from that old scope.
No pending intents are queued. Close/Escape restores a usable invoker, otherwise
the caller's fallback. Caller changes should use normal immutable React props.

## Boundary and verification

Backend [A (#88)](https://github.com/Agustin742/integratec-final-back/pull/88)
provides GET-only `ClassroomContextResponseDto.availablePanels`. The workspace
passes only that field to its host; absent/non-array/non-string entries deny all.
An empty list or an available but unregistered key also denies opening. A failed
context refresh unmounts the host. Restoring availability never restores a draft.

The protected `/classrooms/:classroomId/panels/:panelKey` URL uses this same
controller and default entry catalog. Denied keys share a
not-found presentation. Close replaces the nested URL with the workspace URL;
revocation and scope changes discard the intent and draft without reopening.

Student file submission (`#42`, `HU-ACT-003` part 1/2) fills the `Entrega` tab
of `ActivityDetailPage` via the `ActivityDetailRoute` wrapper
(`submission/activity-detail-route.tsx`). The panel
(`SubmissionPanel`) reads only `GET /activities/{activityId}/submissions/me`
(non-cacheable: `staleTime 0`, `gcTime 0`, user+classroom+activity-scoped
query key) and renders the server-confirmed submission — status, files, late
badge — with the short-lived signed `downloadUrl` opened as a link and never
logged, persisted, or composed client-side. A `404` renders the upload form:
native multiple file input with inline contract pre-checks (1–5 files,
pdf/png/jpg/jpeg/docx, ≤ 10 MB each, selection preserved), an
aria-announced progress bar with expected cancellation, synchronous
duplicate-click guards, and window pre-checks (not open yet / closed without
late allowance) that disable the submit with the reason for display only — the
server clock remains the authority. Uploads go through the XHR-based
`submitActivityFiles` with one client-generated `Idempotency-Key` per attempt
reused across retries; uncertain outcomes (network, `5xx`) are reconciled
through read-own before any resubmission offer. `MULTIPLE_CHOICE` activities
keep the pending note (part 2/2 out of scope), and teacher review stays
`HU-ACT-004`.

Product components beyond the unified `activities` panel (`#41` inbox + `#39` teacher editor, [doc](./classroom-activities.md)), the staff `members` roster (`#33`), capability-gated invitations/join-code tab (`#32`), study `material` manager (`#40` + `#53` `HU-BOT-001` Study Guide Bot material toggle), `notices` announcement board (`#49`), Study Guide Bot conversation (`bot` panel, `#54` `HU-BOT-002`), and 2D/3D consumers remain separate stories; this infrastructure does not implement their contents. Note for `#53` (`HU-BOT-001`): because backend `Agustin742/integratec-final-back#40` is still open, `MaterialPanel` consumes a provisional `configure_bot`-gated contract (`GET /classrooms/:id/bot/materials` and `PUT /classrooms/:id/bot/materials/:materialId` returning `{ materialId, classroomId, botEnabled, indexingStatus, indexingError, updatedAt }`) backed by stateful MSW handlers and Zod validation until `back#40` lands in `src/api/schema.generated.ts`; toggling requires server confirmation before changing state, and students/parents never see or fetch bot configuration. Note for `#54` (`HU-BOT-002`): because `Agustin742/integratec-final-back#41` is still open, `StudyGuideBotPanel` consumes a provisional contract (`GET /classrooms/:id/bot/status` and `POST /classrooms/:id/bot/messages` returning `{ id, answer, outcome, citations, createdAt }`) backed by stateful MSW handlers (`createClassroomBotStore`) until `back#41` lands in `src/api/schema.generated.ts`; `PARENT` accounts are denied without querying bot status, server `409`/`423` exam lockout blocks both initial and in-flight queries, and model output is rendered strictly as plain text. Note for `#41` (human-approved scope reconciliation on `2026-11-18`): because backend `Agustin742/integratec-final-back#29` is still open, `ActivitySummaryDto` and `StudentActivityResponseDto` do not yet expose a server-derived student work status (`Pending`/`Submitted`/`Graded`/`Overdue`) or `canSubmit` flag, so `ActivitiesPanel` and `ActivityDetailPage` render only server-confirmed metadata and deadlines in the school `timeZone` without deriving overdue state from the browser clock (`rules/activities-and-grading.md`, `rules/data-and-time.md`), deferring student status/overdue/`canSubmit` UI until `back#29` lands. Backend
[B (#93)](https://github.com/Agustin742/integratec-final-back/pull/93) is consumed by
one workspace-owned authenticated fetch stream. Connection, invalidation hints
(including the initial hint), and EOF reset the shared context query and reload
complete REST authority. Observed hints immediately remove private panel contents
and drafts while confirmation is pending; later confirmation never reopens them.
This is not guaranteed globally immediate delivery. See the [stream lifecycle and
contract provenance](./classroom-workspace.md#context-invalidation-b).
Never infer availability from `myRole` or action capabilities; panel reads and
mutations still require their own server checks. See [security rules](../rules/security.md).
Rendered tests exercise all nine default entries through nested URLs with empty
action capabilities, controller opening, close/URL replacement, revocation,
classroom isolation and reserved/unknown/malformed availability denial. Existing
injected-descriptor regressions retain draft, account and SSE cleanup coverage.
Browser tests exercise the actual protected route, keyboard containment/Escape,
focus return, denied keys and viewport/zoom overflow with synthetic API responses.
The classroom host bounds dialog height by its containing block percentage,
not viewport units, so Close remains reachable at 200% mobile CSS zoom. The shared
dialog primitive and permission controller logic are unchanged.
These checks are not live-backend authorization or distributed SSE proof.

## UI evidence

The public-route browser check captures the pending entry at
[1280px](./assets/classroom-panels/entry-1280.png) and
[360px](./assets/classroom-panels/entry-360.png), the `#33` staff roster panel at
[1280px](./assets/classrooms/roster-1280.png) and
[360px](./assets/classrooms/roster-360.png), the `#32` invitations and join-code tab (`e2e/classroom-invitations.spec.ts`) at
[1280px](./assets/classrooms/invitations-1280.png) and
[360px](./assets/classrooms/invitations-360.png), the `#40` study material
manager (`MaterialPanel`, `e2e/study-materials.spec.ts`) at
[1280px](./assets/classrooms/study-materials-1280.png) and
[360px](./assets/classrooms/study-materials-360.png), the `#53` Study Guide Bot
material toggle (`MaterialBotToggleSlot`, `e2e/study-materials.spec.ts`) at
[1280px](./assets/classrooms/bot-materials-1280.png) and
[360px](./assets/classrooms/bot-materials-360.png), and the `#41`
student activity inbox (`ActivitiesPanel`, `e2e/activities-inbox.spec.ts`) at
[1280px](./assets/classrooms/activities-inbox-1280.png) and
[360px](./assets/classrooms/activities-inbox-360.png), the `#42` student
file submission tab (`SubmissionPanel`, `e2e/activity-submission.spec.ts`) at
[1280px](./assets/classrooms/activity-submission-1280.png) and
[360px](./assets/classrooms/activity-submission-360.png), and the `#49`
announcements notice board (`NoticeBoardPanel`, `e2e/announcements.spec.ts`) at
[1280px](./assets/classrooms/announcements-1280.png) and
[360px](./assets/classrooms/announcements-360.png), and the `#54` Study Guide Bot
conversation (`StudyGuideBotPanel`, `e2e/study-guide-bot.spec.ts`) at
[1280px](./assets/classrooms/study-guide-bot-1280.png) and
[360px](./assets/classrooms/study-guide-bot-360.png). Pending entries show
pending functionality rather than fabricated data; verification results and
synthetic boundaries are recorded in the contributor trackers and `e2e/` specs.
Accessible Classic 2D panel navigation backed by the same `ClassroomPanelsProvider`
contract and `availablePanels` server list is documented in
[classroom workspace #34](./classroom-workspace.md#classic-2d-mode-switch-34).
