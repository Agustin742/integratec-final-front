# Classroom context foundation

`/classrooms/:classroomId` is a protected, context-only entry. It displays the server's classroom name and resolved role, without panel links or classroom tools. A returned parent context gets the same neutral metadata, not a new parent classroom experience. This slice does **not** complete #26.

## Data and lifecycle

- `useClassroomContext` and the existing capability-only hook share `GET /classrooms/{id}` and `classroomDetailQueryKey(userId, classroomId)` in `src/features/classrooms/use-classroom-capabilities.ts`. There is no persisted role, permission mapping, or second authoritative cache.
- The ready context contains the generated GET-only `ClassroomContextResponseDto`. The shell passes that DTO to its `Outlet`, including `adultMode`, `chatMuted`, `collaborationLocked`, `gamesDisabled`, server capabilities and `availablePanels`. No nested panel routes are registered yet.
- The workspace mounts the [panel provider](./classroom-panels.md) using only server `availablePanels`, never a role-to-panel or capability-to-panel map. Real panel components can be registered through its typed `panels` prop; the default registry is empty. Missing/malformed availability denies opening. An observed refresh failure unmounts the panel host; account/classroom switches discard its state.
- Query cancellation reaches the supported request `signal`. Changing classroom/user scopes isolates responses; pending states contain no previous classroom. The shell keys its subtree by user and classroom so future local child state is released on a scope change. There are no queued intents in this foundation.
- Signed-out snapshots expose no context. The existing session provider owns private-cache teardown; this hook does not replace session cleanup.
- Initial loading uses the shared loading state. Both 403 and 404 at this entry show the same not-found view without confirming existence. Other errors offer a retry. Any observed failed refresh removes confirmed context, even while a bounded automatic retry is pending. The existing capability guard retains its distinct 403/404 policy.

## Contract source

REST types were generated through `pnpm api:sync` from backend A's merged
`develop` commit `1f7bf1fdd7bf3c1f8be715b896b05886a75ac6d0` (backend #88),
not B's open branch. The generated REST file also contains previously published
backend endpoints; it was not manually reduced to A. Realtime changes from that
sync are excluded from this REST-only slice: the room-state artifact references
an unpublished-to-this-frontend sibling `Avatar` module and requires a separate
realtime integration. Existing realtime files are preserved; no dependencies added.

## Verification boundary

Synthetic component tests cover loading, server name/parent metadata, exact Outlet control values, shared capability cache, delayed classroom/account switches, cancellation, logout, non-disclosing failures, refresh failures and retry. Router and capability regression checks remain required. Mock results are not live-backend authorization proof; desktop/mobile render, keyboard/focus/overflow checks and full configured checks must be recorded separately.

## Deferred

Product panel registration/navigation and content, nested panel URLs, 2D/3D experiences, parent tools, and general invalidation B/SSE are not delivered. Permission changes are reflected when a request observes them; this slice promises no instantaneous propagation. Login return destinations remain restricted to `/`.

See [routing](./routing.md), [state ownership](../rules/state-management.md), and [classroom authority](../rules/classrooms-and-roles.md).
