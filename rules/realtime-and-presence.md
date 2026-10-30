# Authoritative Realtime Classrooms and Presence

Authorized teachers and students MUST see live presence and movement in their shared classroom without turning transient connections into persistent business records or treating visual access as permission.

## Authority and scope

- [Master §2.1](../master-document.md#21-escuelas-profesores-y-aulas) and [§2.11](../master-document.md#211-movimiento-avatares-y-presencia) distinguish the persistent classroom from the live session and commit to movement, reconnection, disconnected-avatar removal, and remote movement interpolation/adjustment; [§2.8](../master-document.md#28-controles-de-aula-y-herramientas-en-vivo) defines the classroom controls whose live state this rule renders.
- [Master §6](../master-document.md#6-arquitectura-general-actualizada) assigns Colyseus live state, NestJS/PostgreSQL persistent business authority, and confirmed-change notification ordering.
- [Master §7.4](../master-document.md#74-despliegue-red-y-operación) establishes separate services and an initial single Colyseus service instance; this rule does not choose a distributed presence design.
- [Security](./security.md) applies to admission and every protected action. [Quality and testing](./quality-and-testing.md) defines verification reporting.
- [Art direction](./art-direction.md) remains the agreed visual target. The rendering technology is Three.js with React Three Fiber ([3D world and camera](./3d-world-and-camera.md)); this rule selects no physics library or wire format.
- The backend rule *Realtime and presence* owns the server side. Parents do not enter the live 3D classroom; the 2D mode does not change authorization.
- This document defines reusable synchronization invariants, not wire event names, schemas, tick rates, reconnect durations, or evidence that a server already implements them.

## Separate persistent and live identity

| Concept | Owner | Meaning |
|---|---|---|
| Classroom | NestJS/PostgreSQL | Persistent space with its membership, roles, and business resources (material, activities, chat, announcements, pet). |
| Colyseus `Room` session | Colyseus | Live session associated with an authorized classroom and its connected participants. |
| User identity and permission | Authenticated backend context | Determines who may enter, observe, or act. |
| Transient position and presence | Authoritative Colyseus state | Describes live participation, not a durable activity ledger. |
| Rendered avatar and smoothing | Frontend presentation | Represents server state; cannot create membership or permission. |

- A persistent classroom MUST remain a product resource when no users are connected; an empty live session is not a deletion instruction.
- A Colyseus session identifier MUST NOT be assumed to be the PostgreSQL classroom identifier or a durable invitation.
- The mapping between a live session and its persistent classroom MUST be controlled by the server, not inferred from a client-provided label.
- Recreating a live session MUST NOT create another persistent classroom or copy its memberships by accident.
- Closing or losing a live session MUST NOT erase activities, grades, messages, avatar configuration, or other persistent records.

This separation allows ephemeral sessions to recover without changing the business identity or rights of the space.

## Ownership and admission

Backend owners MUST define coherent authorization across NestJS and Colyseus. Frontend integration owners MUST manage connection/subscription lifecycle and display confirmed versus unresolved state accurately.

- Admission MUST require verifiable authenticated identity and authorization for the associated persistent classroom before protected classroom state is exposed. A student is admitted by enrollment and a teacher by teacher-level authority (the classroom's teacher, or the school Owner or Admin); a Parent has no live admission.
- A guessed session ID, visible door, local route, or client store membership MUST NOT bypass admission checks.
- Classroom identity alone MUST NOT replace its access rules: access depends on current membership and role under master §2.1 and §2.2, and users of different classrooms or schools MUST NOT share a live room.
- The client MUST NOT select another participant's identity or authoritative role through a message payload.
- Protected actions received after joining MUST still be authorized for their target and current context; admission is not a permanent grant to every resource.
- Lost membership, invalid authentication, or revoked access MUST NOT leave the client entitled to receive protected updates or perform protected actions.
- HTTP failures follow the master/security `401` and `403` distinction. Realtime rejection MUST preserve that distinction in meaning without assuming HTTP status codes for every message.
- A connection outage MUST NOT be presented as proof of a permission denial, nor a denied join as proof of an empty classroom.

How permission changes reach live sessions is an integration decision. The invariant is that stale client state cannot extend access; this rule does not choose a polling interval or invalidation channel.

## Movement and presence authority

- Colyseus MUST own authoritative live presence and synchronized movement; the browser sends intent under a validated contract rather than assigning trusted world state.
- The server MUST validate positions, classroom access, and actions as necessary to preserve master §2.11's navigable world, obstacles, collisions, access boundaries, and the freeze seat lock.
- Malformed input, spoofed participant identity, or an unauthorized classroom target MUST NOT alter authoritative presence or movement.
- A claimed position beyond a door MUST NOT grant membership, access another classroom's data, or authorize a business action there.
- A frozen avatar MUST NOT be able to move: the client stops issuing movement input while frozen, and the server rejects any movement that arrives ([Live classroom tools](./live-classroom-tools.md)).
- Transient movement, per-frame render state, and interpolated positions MUST NOT produce a database write for every step.
- The persisted avatar configuration remains separate from a live avatar's position and connection lifecycle.
- Presence MUST describe the authoritative live context, not assert that an offline user is physically in the classroom because they have a membership record. The presence list MUST show only members of the same classroom.
- Elaborate availability statuses are not established; this rule MUST NOT create a status enumeration or infer activity from network silence alone. Connected time feeds only a coarse server-side aggregate for the activity metric ([Activities and grading](./activities-and-grading.md)); the client MUST NOT report it.

The precise movement envelope, collision-validation strategy, input schema, and abuse thresholds remain open. “Server-authoritative” establishes ownership, not a chosen simulation algorithm.

## Client representation and interpolation

- The frontend MUST render synchronized state without making its visual objects or stores a parallel permission authority.
- Remote motion MUST support interpolation or visual adjustment as contemplated by master §2.3, while converging on accepted server state.
- Smoothing MUST NOT convert a rejected movement into a confirmed position or keep an unauthorized classroom visible as though access succeeded.
- Any displayed pending or locally estimated movement MUST remain subordinate to authoritative correction; this rule does not mandate prediction.
- Visual movement and corrections MUST preserve scene readability and settled human avatars under art direction, rather than replacing them with a different avatar concept.
- Seat assignment and the freeze lock MUST be rendered from authoritative state: avatars are shown at their seats while frozen, including for users who join or reconnect during a freeze.
- Presence indicators MUST NOT imply current connectivity when the client cannot establish it; stale/unresolved state needs honest feedback.
- Essential application interfaces and permission checks MUST NOT depend on the bot, avatar, or rendering engine being the authority. A user in the classic 2D mode MUST still receive the live state that affects them (chat mute, freeze, collaboration lock, disabled games, notifications).

For navigation and interaction detail, see `rules/movement-and-interactions.md`; for avatar behavior, see `rules/avatars-and-customization.md`. Neither path here defines a rendering implementation.

## Classroom controls and live state

- Freeze, chat mute, mute everyone, collaboration lock, and games disabled reach the client as authoritative state, accepted by the server only from a user with teacher-level authority at that moment ([Live classroom tools](./live-classroom-tools.md)). The client MUST NOT apply them to itself or others as enforcement.
- Persisted classroom states (chat mute, collaboration lock, games disabled) MUST be loaded from the server on join and reconnect; the client MUST NOT assume an unmuted, unlocked, or enabled default.
- Freeze is ephemeral: after a service restart the lock may no longer exist, and the interface MUST reconcile with the authoritative state instead of preserving a stale lock.
- Collaborative whiteboard, chart, and LaTeX state is shared live state scoped to the classroom. Its synchronization mechanism (Colyseus state or a CRDT such as Yjs) is a candidate, still undecided; operation streams MUST NOT be persisted per operation.
- Video and voice media do not pass through Colyseus; see [Live classroom tools](./live-classroom-tools.md).

## Reconnect, removal, and scope cleanup

| Situation | Required behavior | Boundary |
|---|---|---|
| Authorized initial join | Receive the correct classroom's authoritative live state. | Do not reuse another classroom's cached participants as current. |
| Temporary connection loss | Show uncertainty and support the agreed reconnect flow. | Do not claim uninterrupted presence or invent a fixed grace period. |
| Reconnect attempt | Establish valid identity, classroom association, and current access. | A prior session alone does not preserve revoked permission. |
| Server recognizes disconnection/removal | Remove the departed avatar from the relevant authoritative live state and clients. | Removal timing remains unspecified, not optional forever. |
| Classroom switch | Release old classroom subscriptions and reconcile the destination context. | Late old-classroom data cannot populate the destination. |
| Logout or account switch | Release authenticated subscriptions and clear affected private state. | A late callback cannot restore the previous account's classroom. |
| Live session is recreated | Reconcile with its authoritative current state. | Do not treat an obsolete session snapshot as the new session's truth. |
| Admission fails | Explain the failure without exposing protected classroom contents. | Do not fabricate successful presence. |

- Reconnection MUST reconcile current authoritative state; it MUST NOT blindly replay an old local snapshot as trusted classroom state.
- Duplicate or late messages MUST NOT create duplicate participants, resurrect removed participants, or repeat persistent business effects.
- Data MUST remain scoped to the authenticated account, persistent classroom, and relevant live session lifecycle; a matching display name is not sufficient correlation.
- Older data MUST NOT overwrite newer authoritative state simply because it arrives later. The contract MUST make stale/duplicate handling unambiguous without relying on arrival order alone.
- Cleanup MUST include listeners and in-flight work that could apply results after the owning classroom or account has changed.

These invariants require a defined contract, but do not choose sequence fields, ordering algorithms, timeouts, or a multi-tab identity policy. One avatar per connection versus per user remains unresolved below.

## Persistent changes before broadcast

- NestJS/PostgreSQL MUST remain the authority for persistent activities, grades, points, messages, announcements, notifications, classroom settings, and other business records.
- Colyseus MUST coordinate persistent operations through secure backend application contracts, not trust a client assertion that a write succeeded.
- A persistent change MUST be authorized, validated, and confirmed by the business authority before it is broadcast as a successful change.
- Pending visual feedback MAY be shown only as pending; it MUST NOT be represented as a confirmed broadcast or saved record.
- Failed persistence MUST NOT produce a successful activity, grade, message, or announcement notification to other participants.
- A notification MUST NOT create a second write merely because another client receives it; repeated delivery cannot duplicate the business effect.
- Broadcast recipients MUST be authorized for the resource. Being in a live classroom MUST NOT disclose a user's unrelated private resource.
- If persistence succeeds but notification fails, feedback MUST NOT falsely say the persistent operation failed. Reconciliation MUST use the business authority instead of blindly repeating a write.

Master §6.2's event names (for example `classroom:frozen`, `chat:muted`, `whiteboard:update`) are illustrative, not approved protocol identifiers. Default live room synchronization belongs to Colyseus; a separate Socket.IO channel MUST NOT be introduced without a justified independent need and an agreed contract.

## Correct and incorrect examples

**Correct:** A user selects a door. The server checks identity and destination access, maps the authorized classroom to a live session, and only then exposes its protected state.

**Incorrect:** The browser changes its classroom ID and starts receiving participants because the door was visible in the scene.

**Correct:** The frontend adjusts a remote avatar toward accepted server movement and removes it when authoritative state removes that participant.

**Incorrect:** A stale update from the previous session recreates the avatar after a classroom switch, or each interpolated step is saved in PostgreSQL.

**Correct:** A grade is saved in NestJS/PostgreSQL before authorized clients receive a change notification. If notification fails, clients reconcile against persisted data.

**Incorrect:** Colyseus announces a published grade immediately from a client message, then tries to save it; a rejected write leaves peers believing it succeeded.

## Open decisions — not implicit approvals

- Exact admission credentials, session mapping contracts, reconnect behavior, removal timing, and handling of permission changes require backend/frontend agreement; no timeout or token format is chosen here.
- Multi-tab or multi-device identity, simultaneous participation across classrooms, and how duplicate connections map to avatars remain unresolved; examples MUST NOT settle one-avatar-per-user or one-avatar-per-connection.
- Movement bounds, validation algorithms, tick/update frequency, interpolation technique, and correction presentation remain to be specified.
- Ordering, deduplication, snapshot reconciliation, missed-notification recovery, and mutation correlation mechanisms need explicit contracts; this rule defines outcomes only.
- Additional activity states and any justified dedicated messaging channel require separate decisions, not assumed enums or Socket.IO installation.
- Horizontal scaling requires the strategy identified in master §7.4; no broker, distributed presence layer, or multi-instance architecture is selected here.
- What seated students may do while frozen, how freeze applies to users in the 2D mode, and the collaborative synchronization mechanism remain open ([Live classroom tools](./live-classroom-tools.md)).
- Cross-repository contract distribution and ownership remain unresolved. Frontend types or illustrative events MUST NOT silently become a shared contract package.

## Observable acceptance checks

These describe future implementation evidence; passing a documentation check does not prove realtime compliance.

- [ ] Unauthorized direct joins, spoofed identities, and protected messages fail without exposing another classroom's state; a Parent has no live join.
- [ ] Two authorized users observe shared presence and server-accepted movement; client claims cannot grant access or override rejected movement.
- [ ] Movement does not produce per-step database rows, and leaving an empty live session does not delete the persistent classroom.
- [ ] A frozen avatar cannot move, later joins are seated and locked, and persisted classroom controls (chat mute, collaboration lock, games disabled) are restored on reconnect.
- [ ] Disconnect, removal, reconnect, permission loss, logout, and classroom/account switches reconcile state without private leaks or ghost participants.
- [ ] Delayed and duplicate data cannot resurrect removed participants, contaminate another classroom, or duplicate a business mutation.
- [ ] Persistence failure produces no success broadcast; notification failure after persistence does not cause an unsafe duplicate write.
- [ ] Visual corrections remain readable under art direction without assuming a chosen engine or claiming image-reference fidelity.
