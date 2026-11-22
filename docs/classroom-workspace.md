# Classroom context foundation

The protected directory at `/` ([routing](./routing.md#classroom-directory-and-management)) lists the classrooms returned by `GET /me/classrooms` and links each classroom card to `/classrooms/:classroomId`.

`/classrooms/:classroomId` is a protected workspace entry. For non-parent accounts, it hosts the lazy 3D classroom viewport (`Classroom3DStage`), a one-click `3D` / `Modo 2D Clásico` toggle (`#34`), and the accessible 2D Classic Mode panel launcher (`Classroom2DLayout`). A returned `PARENT` role keeps the neutral metadata view without 3D canvas or 2D classroom panels (`rules/classrooms-and-roles.md`). The production panel entry catalog follows the [approved #26 scope reconciliation](./classroom-panels.md#approved-scope-reconciliation); panel business functionality remains outside this workspace foundation. Students additionally see the read-only [points wallet indicator](./ui-wallet.md) (#45) in the workspace header in both modes; it is not part of the panel registry.

## Data and lifecycle

- `useClassroomContext` and the existing capability-only hook share `GET /classrooms/{id}` and `classroomDetailQueryKey(userId, classroomId)` in `src/features/classrooms/use-classroom-capabilities.ts`. There is no persisted role, permission mapping, or second authoritative cache.
- The ready context contains the generated GET-only `ClassroomContextResponseDto`. The shell passes that DTO to its `Outlet`, including `adultMode`, `chatMuted`, `collaborationLocked`, `gamesDisabled`, server capabilities and `availablePanels`. The nested `/classrooms/:classroomId/panels/:panelKey` route submits a one-shot intent through that same registry; unknown, unavailable and unregistered keys share the not-found view.
- The workspace mounts the [panel provider](./classroom-panels.md) using only server `availablePanels`, never a role-to-panel or capability-to-panel map. The default registry provides nine minimum entries; `activities` (`#41` + `#39`, [doc](./classroom-activities.md)), `material` (`#40`), `members` (`#33` + `#32`), and `chat` (`#51`, [guide](./ui-chat.md)) render real components while the remaining entries show pending content. Real panel components can replace that catalog through its typed `panels` prop; `pet` remains reserved and unregistered. Missing/malformed availability denies opening. An observed refresh failure unmounts the panel host; account/classroom switches discard its state.
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

| Signal                                                                                         | Client behavior                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect/reconnect                                                                              | Reconcile (refetch, keep mounted) the shared REST context after stream registration.                                                                                                         |
| `classroom.context-invalidated` with `{ classroomId }`, after the first hint of the connection | Cancel obsolete REST, discard private context/panels/capabilities, and reload. No revision, event ID, or replay semantics. Duplicates simply reconcile again.                                |
| EOF, transport/framing failure, or renewal                                                     | Reload REST; retry after exponential delays from 1 second, capped at 30 seconds. Setup 503 is retryable; 401/403/404 stop this subscription's retries. REST remains the rendering authority. |
| Classroom/user change, session cleanup, unmount                                                | Abort connection/reader and clear renewal/retry timers. Old reads cannot restore current context.                                                                                            |

The first hint of every connection is the backend's registration hint: it carries
no change and is already covered by the post-connect reconcile, so it only keeps the
workspace mounted (no reset, no 3D stage unmount). Every later hint on the same
connection is a real invalidation and resets. The client renews a connection after
50 seconds (`CONTEXT_RENEWAL_MS`, below the backend 60 second lifetime) so the
lifetime-expiry hint is not received in normal operation.

Comments (backend heartbeat every 15 seconds) carry no context. The client
tolerates chunked LF/CRLF/CR frames, discards incomplete
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
- **Back control:** An icon-only `Link` (left arrow, `aria-label` "Volver a mis aulas") at the start of the header returns to the classroom list at `/` for every role.
- **Keyboard shortcut & focus:** Non-parent views provide a header toggle button (`outline` variant, so it reads as a view control and not as a primary header action; `aria-keyshortcuts="Alt+M"`, with a visible `aria-hidden` "Atajo: Alt+M" hint beside it so sighted users can discover the shortcut without double announcement; no redundant mode badge, the active section heading names the mode) and `Alt+M` window listener that ignores repeat keys, extra modifiers, editable controls (`input`, `textarea`, `select`, `contentEditable`), and open modal dialogs. Switching moves focus to the active `<h3>` view heading (`tabIndex={-1}`); initial classroom entry never steals focus.
- **Canvas disposal & server parity:** Switching to `2D Classic Mode` unmounts `Classroom3DStage` (zero `<canvas>` elements mounted) while preserving classroom context and `<Outlet>`. Panel buttons in `Classroom2DLayout` are named exactly by the panel title (`aria-label`; the visible "Abrir panel" cue is `aria-hidden`) and filter the [F16 catalog](./classroom-panels.md) strictly by `canOpenPanel(key)` (`availablePanels`), keeping the 2D layout empty when the server grants none.
- **UI evidence (`#34`):** Captured at [1280px](./assets/classroom-workspace/mode-2d-1280.png) and [360px](./assets/classroom-workspace/mode-2d-360.png).

## 3D classroom scene and local navigation (#36)

- **Scene:** `ClassroomWorld` (`src/features/world/classroom/`) is what `Classroom3DStage` lazy-loads. `buildClassroomScene` builds a placeholder room from primitives in the art-direction palette: floor, far walls at full height and a low skirting on the camera side so walls never hide avatars, one desk per `CLASSROOM_LAYOUT` obstacle (obstacle 0 is the teacher desk; student desks are instanced), and separate named placeholders for the board, shelf, bulletin board, shop, pet and tutor bot (`userData.placeholder`, ready for `#38`). Final models replace the primitives later.
- **Camera:** `frameCamera` takes optional bounds; the classroom framing uses `CLASSROOM_BOUNDS` (layout bounds plus wall height) with the same fixed isometric angles.
- **Collisions match the server:** walkable space is `CLASSROOM_LAYOUT` from `src/realtime/contracts.generated.ts`, and `stepAvatar` / `isWalkable` (`src/features/world/movement/`) mirror the realtime server step (fixed 3 m/s, sub-stepped, sliding on obstacles). Desk visuals are derived from the same boxes, and placeholders sit inside the wall margin so nothing visible contradicts a collision.
- **Controls:** W, A, S, D or the arrow keys move the avatar in screen directions. Clicking or tapping the floor walks there along a grid A* path (`findPath`); a target on a desk or out of reach is rejected, so there is no false arrival and no marker. Any movement key or `Escape` cancels the walk. The canvas carries a screen-reader description of these controls.
- **Input arbitration:** `src/lib/input-arbitration.ts` is shared with the `Alt+M` shortcut. Typing in a text control, an open dialog, modifier chords and arrow keys inside focused tab, menu or slider widgets never move the avatar. Held keys and the destination are cleared on window blur, hidden tab, dialog open, classroom switch and unmount.
- **Rendering:** per-frame movement mutates a three `Group` inside `useFrame`; React state changes only when the avatar starts or stops (Walk / Idle clips). The demand frame loop is invalidated while moving and on input.
- **Scope boundary:** movement is local only. The avatar spawns at `spawnPoints[0]`, nothing is persisted, and the `{ x, z }` movement intent is exposed through `onIntentChange` for `#37`, which sends it to the room and renders remote avatars.

## 3D interactable objects and server desk map (#38)

- **Extensible interactable catalog:** `deriveClassroomPropSpecs`, `deriveClassroomInteractables`, and `resolveInteractableHit` (`src/features/world/classroom/classroom-interactables.ts`) share prop coordinates with `buildClassroomScene` and derive all 20 scene targets directly from `CLASSROOM_LAYOUT` and `deriveDesks`, separating all three interaction classes (`opens_panel`, `decorative`, `direct_transition`):
  - `board` → `activities`, `shelf` → `material`, `bulletin-board` → `notices`, `shop` → `shop`, `tutor-bot` → `bot` (strictly distinct from `pet`), `teacher-desk` → `members`, `student-desk:1..12` → `grades` (own assigned desk only).
  - `pet` → `decorative` (local 450 ms damped Y-hop on `classroom-pet` + non-persistent greeting in the live status region; never opens a panel or grants rewards).
  - `entrance` → `direct_transition` (exits cleanly to `/` "Mis aulas", matching the header back link).
- **Picking precedence & highlights:** `resolveInteractableHit` inspects only `intersections[0]`, letting floor walking win whenever `walkable-floor` is nearest, resolving instanced `student-desks` and `desk-legs` (relative to `TEACHER_DESK_INDEX`), and walking `object.parent` for placeholder groups and `teacher-desk`. `InteractableHighlight` renders non-raycasting, grayscale-safe highlights (warm-gold `#F7D86B` + cream `#FFFDF7` floor frame and floating octahedron beacon with a bounded 650 ms entrance pulse so demand rendering returns to idle while focus remains on a chip; distinct `#62CFC7` corner L-brackets for the user's assigned desk), sets `pointer` cursor on hover, respects `prefers-reduced-motion: reduce`, and disposes all geometries and materials on unmount.
- **Server-authoritative desk map:** `useClassroomDesks` (`src/features/classrooms/desks/classroom-desks-api.ts`) reads `GET /classrooms/{id}/desks` under `classroomDesksQueryKey(userId, classroomId)`, validates payloads with jitless Zod (`classroomDeskMapSchema`), forwards `AbortSignal`, preserves confirmed assignments across transient refresh failures while clearing on `403`/`404`, exposes `retry()`, and derives `myDeskIndex` solely from `item.userId === session.user.id`. Selecting another student's desk or having no assigned desk never opens `grades` or discloses foreign student data.
- **Accessible DOM HUD & focus management:** `ClassroomInteractablesBar` (`src/features/classrooms/classroom-interactables-bar.tsx`) lives in React DOM outside `<Canvas>` with `>= 44px` (`min-h-11`) wrapping chips filtered by server-confirmed `availablePanels` (plus `pet` and `entrance`), synchronized 3D hover/focus target pills, and an always-mounted `role="status"` live region (including a `Reintentar` action when `/desks` fails to load). Chips pass their invoking button to `openPanel` so closing restores focus to the chip; direct 3D canvas picks omit `invoker` and restore focus to the `Vista 3D del aula` stage heading. While a panel is open (`interactionLocked`), pending walk destinations clear immediately so closing never replays earlier movement.
- **UI evidence (`#38`):** Browser spec [`e2e/classroom-interactables.spec.ts`](../e2e/classroom-interactables.spec.ts) covers desktop (`1280px`) and mobile (`360px`) 3D canvas picking, pet reactions, keyboard navigation, and captures [1280px](./assets/classroom-workspace/interactables-1280.png) and [360px](./assets/classroom-workspace/interactables-360.png).

## Verification boundary

Synthetic component tests cover loading, server name/parent metadata, exact Outlet control values, shared capability cache, delayed classroom/account switches, cancellation, logout, non-disclosing failures, refresh failures and retry, plus 3D ↔ 2D toggling, `Alt+M` input/dialog arbitration, per-account mode isolation, parent exclusion, 3D interactable raycast resolution, server desk ownership enforcement, decorative pet reactions, and keyboard/touch quick-select parity. Router and capability regression checks remain required. Mock results are not live-backend authorization proof; desktop/mobile render, keyboard/focus/overflow checks and full configured checks must be recorded separately.

## Deferred

Panel business content beyond the delivered `activities` inbox and teacher editor (`#41` + `#39`), study `material` manager (`#40`), `members` staff tabs (roster `#33` and `invite_members`-gated invitations/join-code `#32`), the classroom `chat` panel (`#51`), final 3D GLB furniture models (`HU-ESP-002` placeholder geometry remains until final asset drops), remote avatars and presence (`#37`), and parent tools are not delivered. Panel registration, nested URL opening, accessible 2D Classic Mode navigation (`#34`), and 3D object interaction wiring (`#38`) are provided; remaining unimplemented entries explicitly identify their content as pending. B/SSE invalidation is consumed, but this slice promises no globally instantaneous propagation. Login return destinations remain restricted to `/`.

See [routing](./routing.md), [state ownership](../rules/state-management.md), and [classroom authority](../rules/classrooms-and-roles.md).
