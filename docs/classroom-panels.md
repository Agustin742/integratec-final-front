# Classroom panel integration

The classroom workspace mounts the reusable panel provider with backend A's
`availablePanels`, **not action authorization**. The default production catalog
registers nine panel entries with centralized titles: `activities` renders
`ActivitiesPanel` ([`#41`](https://github.com/Agustin742/integratec-final-front/issues/41)),
`material` renders `MaterialPanel` ([`#40`](https://github.com/Agustin742/integratec-final-front/issues/40))
and `members` renders `ClassroomRosterPanel`
([`HU-AUL-003`](https://github.com/Agustin742/integratec-final-front/issues/33):
staff-only paginated roster, status/prefix filters, linked guardians, and
idempotent logical removal preserving academic history), while the remaining
six entries display the shared, honest “Funcionalidad pendiente” state until
their respective stories land.

## Approved scope reconciliation

For #26, the human approved minimum panel entries using the current server
contract on 2026-11-16. The issue's original “required capability” wording is
implemented as server-confirmed **panel availability**, not a fabricated mapping
to action capabilities. Actions still require their own server checks. This
frontend decision does not change the backend permission matrix or remotely edit
the issue; team acceptance of the reconciled criterion remains part of PR review.

| Registered key | Title                                       |
| -------------- | ------------------------------------------- |
| `activities`   | Actividades (`ActivitiesPanel`, `#41`)      |
| `material`     | Material (`MaterialPanel`, `#40`)           |
| `grades`       | Calificaciones                              |
| `chat`         | Chat                                        |
| `notices`      | Avisos                                      |
| `shop`         | Tienda                                      |
| `bot`          | Asistente de estudio                        |
| `members`      | Integrantes (`ClassroomRosterPanel`, `#33`) |
| `settings`     | Configuración                               |

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

Product components beyond `activities` inbox (`#41`), the staff `members` roster (`#33`), study `material` manager (`#40`), and 2D/3D consumers remain separate stories; this infrastructure does not implement their contents. Note for `#41`: because backend `Agustin742/integratec-final-back#29` is still open, `ActivitySummaryDto` and `StudentActivityResponseDto` do not yet expose a server-derived student work status (`Pending`/`Submitted`/`Graded`/`Overdue`) or `canSubmit` flag, so `ActivitiesPanel` and `ActivityDetailPage` render only server-confirmed metadata and deadlines in the school `timeZone` without deriving overdue state from the browser clock (`rules/activities-and-grading.md`, `rules/data-and-time.md`). Backend
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
[360px](./assets/classrooms/roster-360.png), the `#40` study material
manager (`MaterialPanel`, `e2e/study-materials.spec.ts`) at
[1280px](./assets/classrooms/study-materials-1280.png) and
[360px](./assets/classrooms/study-materials-360.png), and the `#41`
student activity inbox (`ActivitiesPanel`, `e2e/activities-inbox.spec.ts`) at
[1280px](./assets/classrooms/activities-inbox-1280.png) and
[360px](./assets/classrooms/activities-inbox-360.png). Pending entries show
pending functionality rather than fabricated data; verification results and
synthetic boundaries are recorded in the contributor trackers and `e2e/` specs.
