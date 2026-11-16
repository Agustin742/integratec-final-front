# Classroom panel integration

The classroom workspace mounts the reusable panel provider with backend A's
`availablePanels`, **not action authorization**. No product panel catalog or
contents are included: the default registry is empty and offers no fake links.

## Caller contract

For classroom routes, supply real descriptors through `ClassroomWorkspace`'s
optional `panels` prop; keys derive from the generated `ClassroomPanelKey` enum.
Nested consumers call `useClassroomPanels` from
`src/features/classrooms/panels/classroom-panels.tsx`. The workspace supplies
current user/classroom scope, server availability, description and heading focus
fallback. Its Outlet still receives the complete classroom context.

For a standalone host, import `ClassroomPanelsProvider` and its public types:

- Supply the current `userId`, `classroomId`, and registry descriptors (`key`,
  `title`, `component`). Keys must be stable and unique; duplicate keys deny opening.
- Supply `availability` only from confirmed server visibility for that context:
  `{ confirmed: true, keys }`. Missing, unconfirmed, or empty input denies all.
  Invalidate with `{ confirmed: false }` as soon as context becomes uncertain.
- Supply a meaningful centralized es-AR `description` and descriptor titles.
  `fallbackFocus()` must resolve a current, connected, focusable workspace target
  (for example, a heading with `tabIndex={-1}`), not a removed trigger.
- Consumers call `openPanel(key, invoker?)`. It returns whether opening was
  accepted; DOM controls pass their initiating HTMLElement. Non-DOM intents omit
  it and use the workspace fallback. Denied calls do not move focus.

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

Product components, nested panel URLs, 2D/3D consumers, and general permission
propagation remain deferred; this slice does not complete #26. Backend
[B (#93)](https://github.com/Agustin742/integratec-final-back/pull/93) is not consumed:
A reflects permission changes only when REST is refetched, not instantaneously.
Never infer availability from `myRole` or action capabilities; panel reads and
mutations still require their own server checks. See [security rules](../rules/security.md).
Synthetic rendered tests cover denial, opening/closing, focus containment and
restoration, revocation, and user/classroom draft isolation. They are not live
backend authorization proof or desktop/mobile visual verification.
