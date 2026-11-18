# Classroom context foundation

The protected directory at `/` ([routing](./routing.md#classroom-directory-and-management)) lists the classrooms returned by `GET /me/classrooms` and links each classroom card to `/classrooms/:classroomId`.

`/classrooms/:classroomId` is a protected workspace entry. For non-parent accounts, it hosts the lazy 3D classroom viewport (`Classroom3DStage`), a one-click `3D` / `Modo 2D Clásico` toggle (`#34`), and the accessible 2D Classic Mode panel launcher (`Classroom2DLayout`). A returned `PARENT` role keeps the neutral metadata view without 3D canvas or 2D classroom panels (`rules/classrooms-and-roles.md`). The production panel entry catalog follows the [approved #26 scope reconciliation](./classroom-panels.md#approved-scope-reconciliation); panel business functionality remains outside this workspace foundation.

## Data and lifecycle

- `useClassroomContext` and the existing capability-only hook share `GET /classrooms/{id}` and `classroomDetailQueryKey(userId, classroomId)` in `src/features/classrooms/use-classroom-capabilities.ts`. There is no persisted role, permission mapping, or second authoritative cache.
- The ready context contains the generated GET-only `ClassroomContextResponseDto`. The shell passes that DTO to its `Outlet`, including `adultMode`, `chatMuted`, `collaborationLocked`, `gamesDisabled`, server capabilities and `availablePanels`. The nested `/classrooms/:classroomId/panels/:panelKey` route submits a one-shot intent through that same registry; unknown, unavailable and unregistered keys share the not-found view.
- The workspace mounts the [panel provider](./classroom-panels.md) using only server `availablePanels`, never a role-to-panel or capability-to-panel map. The default registry provides nine minimum pending-content entries. Real panel components can replace that catalog through its typed `panels` prop; `pet` remains reserved and unregistered. Missing/malformed availability denies opening. An observed refresh failure unmounts the panel host; account/classroom switches discard its state.
- Query cancellation reaches the supported request `signal`. Changing classroom/user scopes isolates responses; pending states contain no previous classroom. The shell keys its subtree by user and classroom so future local child state is released on a scope change. URL intents are consumed once per navigation, outside the private subtree: REST reloads and account changes cannot reopen an old intent. Closing a URL-opened dialog replaces the URL with the encoded classroom workspace path, rather than going back to an unrelated history entry.
- Signed-out snapshots expose no context. The existing session provider owns private-cache teardown; this hook does not replace session cleanup.
- Initial loading uses the shared loading state. Both 403 and 404 at this entry show the same not-found view without confirming existence. Other errors offer a retry. Any observed failed refresh removes confirmed context, even while a bounded automatic retry is pending. The existing capability guard retains its distinct 403/404 policy.

## Contract source

REST types were regenerated with the existing `scripts/api-sync/sync-contracts.mjs`
`syncContracts` generator, pinned to merged backend B commit
`4e4fae1a07073b1c486a79504e1e515040e8e5c7` ([#93](https://github.com/Agustin742/integratec-final-back/pull/93)).
The complete generated REST file includes `GET /classrooms/{id}/context-events`;
it was not manually edited or reduced. The generator's `outputPaths` redirects
unrelated realtime artifacts to ignored verification artifacts, preserving existing
realtime source without dependency changes.

## Context invalidation B

One workspace-owned subscription uses the authenticated OpenAPI client with
`parseAs: 'stream'` and `Accept: text/event-stream`. Existing middleware supplies
Bearer authorization and bounded 401 refresh/GET replay; neither native
`EventSource` nor URL credentials are used. Explicit successful SSE responses
bypass JSON buffering through an abortable, per-chunk session-epoch fence.
Ordinary REST responses retain their previous buffering and authentication behavior.

| Signal                                                                         | Client behavior                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect/reconnect                                                              | Reset and reload the complete shared REST context after stream registration.                                                                                                                 |
| `classroom.context-invalidated` with `{ classroomId }`, including initial hint | Cancel obsolete REST, discard private context/panels/capabilities, and reload. No revision, event ID, or replay semantics. Duplicates simply reconcile again.                                |
| EOF, transport/framing failure, or renewal                                     | Reload REST; retry after exponential delays from 1 second, capped at 30 seconds. Setup 503 is retryable; 401/403/404 stop this subscription's retries. REST remains the rendering authority. |
| Classroom/user change, session cleanup, unmount                                | Abort connection/reader and clear renewal/retry timers. Old reads cannot restore current context.                                                                                            |

Comments (backend heartbeat every 15 seconds) carry no context. The client renews
a connection at 60 seconds, tolerates chunked LF/CRLF/CR frames, discards incomplete
EOF frames, and bounds an individual frame to 64 KiB. Malformed/foreign hints cause
conservative REST reconciliation, not permission grants. Capability consumers only
read the existing TanStack Query cache and do not create subscriptions.

Same-session token rotation does not itself restart an already-authorized stream:
backend periodic authorization checks/renewal bound that window, and every new
connection uses current middleware credentials. Actual session transitions abort
immediately. This channel is not guaranteed distributed immediate delivery;
REST reconciliation and server authorization on every protected operation remain
necessary. A hint removes stale content as soon as the client observes it.

## Classic 2D mode switch (#34)

- **State & open decision:** `useClassroomModeStore` (`src/features/classrooms/classroom-mode-store.ts`) stores `{ ownerUserId, mode }` in an in-memory Zustand store keyed by authenticated `userId` (`'3d'` default). Per `#34` and [classroom rules](../rules/classrooms-and-roles.md#3d-world-and-classic-2d-mode), server-side preference persistence remains an open decision; this implementation does not invent a backend field and avoids cross-account browser persistence.
- **Isolation & cleanup:** Switching accounts (`useSessionSnapshot`) synchronously drops any previous user's preference via `syncClassroomModeOwner`, and logout/session teardown clears the store through `useSessionCleanup(resetClassroomModeStore)` registered by `AppShell`, so logging out from any protected route (not only the workspace) resets it. If the lazy 3D chunk fails to load, a local boundary shows the world fallback inside the stage and the 2D switch stays available.
- **Back control:** An icon-only `Link` (left arrow, `aria-label` "Volver a mis aulas") at the start of the header returns to `/classrooms` for every role.
- **Keyboard shortcut & focus:** Non-parent views provide a header toggle button (`aria-keyshortcuts="Alt+M"`) and `Alt+M` window listener that ignores repeat keys, extra modifiers, editable controls (`input`, `textarea`, `select`, `contentEditable`), and open modal dialogs. Switching moves focus to the active `<h3>` view heading (`tabIndex={-1}`); initial classroom entry never steals focus.
- **Canvas disposal & server parity:** Switching to `2D Classic Mode` unmounts `Classroom3DStage` (zero `<canvas>` elements mounted) while preserving classroom context and `<Outlet>`. Panel buttons in `Classroom2DLayout` filter the [F16 catalog](./classroom-panels.md) strictly by `canOpenPanel(key)` (`availablePanels`), keeping the 2D layout empty when the server grants none.
- **UI evidence (`#34`):** Captured at [1280px](./assets/classroom-workspace/mode-2d-1280.png) and [360px](./assets/classroom-workspace/mode-2d-360.png).

## Verification boundary

Synthetic component tests cover loading, server name/parent metadata, exact Outlet control values, shared capability cache, delayed classroom/account switches, cancellation, logout, non-disclosing failures, refresh failures and retry, plus 3D ↔ 2D toggling, `Alt+M` input/dialog arbitration, per-account mode isolation, and parent exclusion. Router and capability regression checks remain required. Mock results are not live-backend authorization proof; desktop/mobile render, keyboard/focus/overflow checks and full configured checks must be recorded separately.

## Deferred

Panel business content beyond the delivered `members` staff roster (`#33`), full in-scene 3D furniture/interactions, and parent tools are not delivered. Panel registration, nested URL opening, and accessible 2D Classic Mode navigation (`#34`) are provided; the remaining eight minimum entries explicitly identify their content as pending. B/SSE invalidation is consumed, but this slice promises no globally instantaneous propagation. Login return destinations remain restricted to `/`.

See [routing](./routing.md), [state ownership](../rules/state-management.md), and [classroom authority](../rules/classrooms-and-roles.md).
