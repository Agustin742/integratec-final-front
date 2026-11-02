# Live Classroom Tools (Interface)

Teacher controls and live collaboration channels act on a running classroom. The interface must show their state clearly, lock input when a control requires it, and never assume that applying a restriction on screen is enforcement.

## Authority and scope

- [Master §2.8](../master-document.md#28-controles-de-aula-y-herramientas-en-vivo) defines the controls (freeze, mute everyone, chat mute, collaboration lock, game disable) and the tools (video and voice calls, live presentations, collaborative whiteboard, charts, and LaTeX). [§6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns each to its authority and channel; [§5](../master-document.md#5-stack-y-responsabilidades-técnicas) lists the candidate technologies.
- [Master §9.2](../master-document.md#92-mvp-extendido-en-orden-de-prioridad) places calls, presentations, mute everyone, the collaborative tools, and mini-games in the extended MVP (in that priority order); freeze with seat lock belongs to the MVP core.
- The backend rule *Live classroom tools* owns authorization of controls, seat assignment, media credentials, the collaboration lock, and persistence. [Realtime and presence](./realtime-and-presence.md) owns live state delivery; chat mute is in [Communication and notifications](./communication-and-notifications.md); game disable is in [Points and shop](./points-and-shop.md).
- Only a user with teacher-level authority over the classroom (its teacher, or the school Owner or Admin) at that moment may trigger a control. Roles come from [Classrooms and roles](./classrooms-and-roles.md).
- The technologies below are **candidates**, not decisions: the media service (LiveKit or Amazon Chime SDK), collaborative synchronization (Colyseus state or a CRDT such as Yjs), and LaTeX rendering (KaTeX). Their choice is pending in `docs/technical-justification.md`; these rules are independent of it.

## Ownership

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Authorize controls, persist classroom state (chat mute, collaboration lock, games disabled), issue media credentials |
| Colyseus | Apply and broadcast live state (freeze, seats), validate movement of frozen avatars, relay classroom controls from authorized senders |
| Media service (candidate) | Carry video, voice, and presentation traffic; enforce publish permissions |
| Frontend | Show control state, lock the user's input, render tools, connect to the media service with issued credentials, and represent unavailable services honestly |

- The client **MUST NOT** apply a restriction on itself or on others as enforcement. The server decides; the client reflects.
- Control triggers shown in the interface **MUST** appear only for teacher-level users of that classroom; students and parents **MUST NOT** be offered them, and a later server denial **MUST** be handled.
- State sent to the client for a control **MUST** be the state the server confirms; pending controls **MUST** be marked as pending.

## Teacher control panel

- Teacher-level users **MUST** have a clear control panel (or equivalent) that exposes freeze/unfreeze, mute everyone, chat mute, collaboration lock, and mini-games disable, each with its current state and an explicit reverse operation.
- Repeating a control is idempotent for the server; the interface **MUST** show the resulting state rather than toggling blindly, and **MUST NOT** show a control as applied before server confirmation.
- The panel **MUST** be reachable from the 3D world (for example the teacher desk) and from the 2D mode.
- A teacher-level user acting in a classroom **MUST** always see which classroom the controls affect.
- The server may rate limit controls; the interface **MUST** present the rejection as feedback, not as silent failure.

## Freeze and seat lock

- **Freeze** sends every avatar to its assigned seat and locks it there. The server owns seat assignment and the lock and rejects movement input from frozen avatars.
- When freeze is active, the interface **MUST** show it to every user (for example a banner or indicator) and render avatars at their seats. Avatars that join or reconnect while frozen **MUST** be rendered at a seat and locked.
- **Input lock:** while the local avatar is frozen, the interface **MUST** stop issuing movement input (WASD, click-to-move, touch) and **MUST NOT** present a movement attempt as accepted. The lock is a usability reflection; the server rejects movement regardless. See [Movement and interactions](./movement-and-interactions.md).
- Stale movement input or a pending destination **MUST** be discarded when freeze starts, and unfreezing **MUST NOT** replay it.
- Unfreezing releases the lock without teleporting avatars; the interface **MUST** return input control only after the server confirms the release.
- Freeze does **not** lock the teacher (decided): teacher-level users keep their movement and the interface **MUST NOT** apply the input lock to them.
- Seats grow with the number of students, always one seat per student (decided); there is no case of more users than seats, and the interface **MUST** render a seat for every student.
- Whether seated students may still use seat-bound interactions (chat, desk, bot) is an open decision. The interface **MUST NOT** assume it; it presents what the server allows.
- Freeze is ephemeral live state and is cleared by a server restart; the interface **MUST** tolerate that without claiming the lock is still active.
- Freeze, seats, and locks apply to the 3D world. A user in 2D mode **MUST** still be informed of the frozen state; how it applies to a 2D user is an open decision tied to [Classrooms and roles](./classrooms-and-roles.md).

## Mute everyone, chat mute, and mini-game disable

- **Mute everyone** silences the audio of all students in calls. The server enforces it through the media service permissions; the interface **MUST** show the muted state, disable the student's publish control, and **MUST NOT** rely on that disabled control for enforcement. Students **MUST NOT** be able to unmute themselves while it is active. Hand raising and selective unmute are open decisions.
- **Chat mute** is persisted classroom state checked on every send; the interface **MUST** show the muted state and the server rejection ([Communication and notifications](./communication-and-notifications.md)).
- **Mini-game disable** is persisted classroom state; the interface **MUST** show games as unavailable ([Points and shop](./points-and-shop.md)).
- All three states **MUST** be restored from the server on reload or reconnect, and **MUST NOT** default to unmuted or enabled on the client.

## Calls and live presentations

- Video calls, voice calls, and live presentations use a media service (candidate: LiveKit or Amazon Chime SDK). The interface **MUST** request a short-lived access credential from the backend for the current classroom and **MUST NOT** choose the media session through a client-supplied name or hold credentials longer than needed.
- Credentials and session tokens **MUST NOT** be logged, stored in persistent client storage, or placed in URLs that are logged ([Security](./security.md)).
- The call or presentation UI **MUST** present the participant roster, microphone and camera state, and the mute state; controls reflect the permissions the credential carries. A student's publish control follows mute-everyone and the presentation rule.
- A live presentation is started and ended by teacher-level users; whether a student may present when allowed is open. The presentation view **MUST** be reachable from the projector or screen object and from the 2D mode.
- Joining a call or presentation requires user action where the browser needs it (for example a permission prompt); the interface **MUST** explain denied device permissions and **MUST NOT** start capturing without the user's choice.
- Loss of access, expulsion, session end, or logout **MUST** remove the participant from the media session; the interface **MUST** leave the call and clear its state.
- Recording is not in scope; the interface **MUST NOT** indicate or offer recording.
- If the media service is unavailable, the classroom, chat, and activities **MUST** keep working and the user **MUST** receive a clear non-technical error with bounded retry ([Error handling and feedback](./error-handling-and-feedback.md)).
- Calls and presentations are extended MVP; the 3D scene **MUST NOT** depend on them to be usable.
- Audio, video, and any live presentation content **MUST** have accessible controls: keyboard operation, visible focus, and non-color-only state ([UI and accessibility](./ui-and-accessibility.md)); audio **MUST** be user-controllable.

## Collaborative whiteboard, charts, and LaTeX

- The whiteboard, the chart tool, and the LaTeX editor are collaborative. The synchronization mechanism is a **candidate**: Colyseus synchronized state or a CRDT library (for example Yjs), still undecided; the interface **MUST NOT** depend on a particular one beyond the contract it consumes.
- Each tool belongs to a classroom board; boards of different classrooms **MUST NOT** share state, and a user **MUST NOT** see or edit another classroom's board.
- Edits are accepted by the server only from users in the classroom and permitted by the collaboration lock. The interface identifies the actor through the authenticated session, never through a payload.
- **Lock state:** when the teacher locks collaboration, the interface **MUST** switch the tool to a read-only state for students, with an explicit indicator, and **MUST** stop sending edits. The teacher keeps edit rights. The lock is checked by the server on every edit, so a forced edit is rejected and the interface **MUST** present that outcome.
- The lock **MUST** be restored from the server on reload or reconnect. The interface **MUST NOT** default to unlocked.
- Remote edits **MUST** be applied as data; LaTeX and other text content **MUST NOT** be interpreted as HTML or executed. LaTeX rendering (candidate: KaTeX) **MUST** treat input as untrusted and fail visibly on invalid expressions without breaking the board.
- Edit rate and document size are bounded by the server; the interface **MUST** present rejections and **MUST NOT** hide them by silently dropping content.
- Live edit streams **MUST NOT** be persisted per operation. Whether a board is persisted (to keep it after the session, share it as material, or export it) is open; the interface **MUST NOT** claim persistence until decided.
- Reconnection **MUST** reconcile the board with the current shared state rather than replay a local snapshot as truth ([Realtime and presence](./realtime-and-presence.md)).
- The tools **MUST** be usable in the 2D mode (the board belongs to the classroom, not to the 3D scene) and provide keyboard access for essential operations (text entry, formulas). Drawing may need pointer input; that limitation **MUST** be acknowledged by an alternative for essential content where feasible, and is an open accessibility decision.
- The tools **SHOULD** remain usable on touch devices.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Teacher freezes the classroom | Every connected avatar goes to its seat; student movement input stops; the state is visible to everyone |
| Student joins a frozen classroom | The avatar is placed at a seat and locked |
| Student modifies the client to move while frozen | The server rejects the movement; the avatar stays seated |
| Teacher unfreezes | Control returns after server confirmation; avatars are not teleported |
| Student sends a control message | It is ignored by the server; no state changes |
| Mute everyone is active | Students cannot publish audio and cannot unmute themselves |
| Teacher locks collaboration | Students see read-only tools; forced edits are rejected |
| Reload during lock, mute, or disabled games | The state is restored from the server |
| Media credential denied or expired | The user sees a clear message; classroom, chat, and activities continue |
| Access is lost during a call | The participant leaves the call and the UI is cleared |
| Invalid LaTeX is entered | The tool reports the error without breaking the board or running content |

## Correct and incorrect examples

**Correct:** The teacher panel sends a freeze request; the interface shows freeze as pending, then active after the server confirms, and stops local movement input.

**Incorrect:** The panel shows the classroom as frozen immediately and relies on each student's browser to stop moving.

**Correct:** The whiteboard becomes read-only for students when the lock is on and still reports a rejected forced edit.

**Incorrect:** The lock only hides the toolbar, so a script keeps sending edits that are accepted.

## Observable acceptance checks

Use [Quality and testing](./quality-and-testing.md); these are verification expectations, not claims of implemented behavior.

- [ ] Controls are offered only to teacher-level users; student and parent attempts are ignored by the server.
- [ ] Freeze locks the local avatar's input, applies to later joins, and releases only after confirmation.
- [ ] Mute everyone, chat mute, collaboration lock, and games disabled show their state after reload and reconnect.
- [ ] Rejected forced actions (movement while frozen, sending while muted, editing while locked) are presented as rejections, not as success.
- [ ] Calls and presentations use short-lived credentials, leave the session on access loss, and degrade without breaking the classroom.
- [ ] Collaborative tools isolate boards by classroom, treat content as untrusted data, and show lock state.
- [ ] The tools are reachable and the controls state visible in the 2D mode.
- [ ] Media, whiteboard, and LaTeX candidates are not treated as decided technologies.
- [ ] [Art direction](./art-direction.md) remains the sole visual target for the board, screen, and projector objects.

## Open decisions — not implementation defaults

- Media service (LiveKit or Amazon Chime SDK) and credential format.
- Collaborative synchronization approach (Colyseus state or a CRDT such as Yjs), LaTeX renderer (candidate KaTeX), and persistence or export of boards.
- What seated students may do while frozen, and how freeze applies to users in 2D mode.
- Hand raising, selective unmuting, and student presenters.
- Accessible alternatives for drawing-based content.
- Recording of calls (not in scope).
- Cross-repository contract distribution remains unresolved; event names are illustrative.
