# Classrooms, Roles, and Permissions (Interface)

Users must be able to reach the classrooms and tools their role allows, in the 3D world or the classic 2D interface, without confusing a visible door, a persistent membership, or a live connection with permission to use a resource.

## Authority and scope

- [Master §2.1](../master-document.md#21-escuelas-profesores-y-aulas) defines the two organization paths and the classroom as a persistent resource; [§2.2](../master-document.md#22-roles-permisos-e-invitaciones) defines the roles, invitations, and capability matrix; [§2.9](../master-document.md#29-modo-3d-y-modo-2d-clásico) defines the 3D and classic 2D modes; [§2.5](../master-document.md#25-vista-de-padres) defines the parent view.
- [Master §6](../master-document.md#6-arquitectura-general-actualizada) establishes persistence, realtime responsibilities, and authentication boundaries.
- The backend rule *Classrooms, roles, and permissions* owns the server-side constraints (matrix enforcement, invitation storage, adult mode persistence). This document owns how the frontend presents roles, classrooms, and invitations and what it must never decide by itself.
- [Security](./security.md) governs protected operations; [Quality and testing](./quality-and-testing.md) governs evidence.
- These rules refine established behavior, not a new permission matrix or database schema. The rendering technology is Three.js with React Three Fiber ([3D world and camera](./3d-world-and-camera.md)); [Art direction](./art-direction.md) remains the agreed visual target.

## Organization paths, classrooms, and durable identity

| Concept | Authority | Frontend responsibility |
|---|---|---|
| Organization path (independent teacher or school) | NestJS / PostgreSQL | Offer the choice at registration and show the resulting structure; never assume the path from the UI route |
| School and classroom | NestJS / PostgreSQL | List and open only the classrooms the server returns; a classroom exists when nobody is connected |
| Membership (school role, enrollment, parent link) | NestJS / PostgreSQL | Display the role per context; do not cache it as authority |
| Live presence in a classroom | Colyseus | Represent connection state; it is not membership |

- The classroom **MUST** be presented as a persistent resource that groups its teacher, students, material, activities, chat, announcements, and pet, independent of live connections.
- The user interface **MUST NOT** treat a persistent classroom and a Colyseus `Room` session as the same thing; the association is controlled by the server and **MUST NOT** be established by a client-supplied identifier.
- A single account can hold both the school path and the independent-teacher path (decided), and several memberships (for example Teacher in one school and Parent elsewhere); the user **MUST** see the active context clearly, and switching it **MUST** discard data of the previous context.
- Registration **MUST** present the two paths (independent teacher, school) and surface a failed provisioning attempt honestly instead of showing a classroom as available; recovery mechanics are a backend contract decision.
- A failed or uncertain classroom-creation request **MUST NOT** be shown as a created classroom; reconcile through the server before retrying.

### Membership is not presence

- Disconnecting **MUST NOT** remove a membership or hide a classroom the user belongs to.
- A membership **MUST NOT** imply a visible avatar; an avatar appears only after authorized live admission.
- A live connection **MUST NOT** be treated as proof that every later operation is authorized.
- Movement and presence **MUST NOT** generate a PostgreSQL write per step; they belong to the live session boundary.

## Interface per role

The role decides which surfaces are offered. The server still checks every action; hiding or showing a control is usability, not enforcement.

| Role | Surfaces the interface offers | Boundary |
|---|---|---|
| School Owner / Admin | School management, teacher invitations, every classroom of the school with teacher-level tools | Authority is derived by the server from the school role; the UI **MUST NOT** require a per-classroom membership to show it |
| Teacher | Own classrooms: material, activities and review, announcements, chat moderation, classroom controls, bot configuration, student tracking | Only classrooms the teacher teaches; another teacher's classroom is not offered |
| Student | Pending activities, material, grades, points, streak and medals, shop, chat, bot | Own submissions, grades, points, and purchases only |
| Parent | Minimal view: child status notifications, child's grades, messages with the teacher and the child | No access to the 3D classroom, classroom chat, or bot; the area is intentionally small |

- The interface **MUST** derive visible capabilities from data returned by the server for the current context, not from a role name embedded in client code or a persisted client store.
- The interface **MUST NOT** extend the capability matrix of master §2.2; a control missing from the matrix **MUST NOT** be offered.
- Controls that the user lacks authority for **SHOULD** be absent or disabled with an explanation, and a later server denial **MUST** still be handled.
- A teacher-level user **MUST** be able to tell which classroom they are acting on whenever they use a classroom control or review tool.
- An error or stale permission **MUST NOT** leave staff-only content on screen after the role is lost.

### Parent area

- The parent interface **MUST** stay minimal: a list of linked children, the notifications and grades of the selected child, and conversations with the teacher and the child ([Communication and notifications](./communication-and-notifications.md)).
- A parent with several children **MUST** see which child each item belongs to, and switching children **MUST** discard the data of the previous one.
- The parent role **MUST NOT** be offered the 3D classroom, the classroom chat, the shop, or the bot ([AI bot and daily briefing](./ai-bot-and-daily-briefing.md)).
- A student has at most 2 guardians (parents) (decided); the interface **MUST NOT** offer a third parent invitation and **MUST** show the server's rejection if attempted.
- In a classroom running in adult education mode, new parent invitations and links **MUST NOT** be offered. When a classroom switches to adult mode, existing parent links stay but their actions over the child's account are disabled (decided): the interface **MUST** show the parent area as disabled for that child and **MUST NOT** offer any parent action over it. The mode is a persisted classroom property supplied by the server.

## 3D world and classic 2D mode

Teachers and students can alternate between the 3D world and the classic 2D interface ([master §2.9](../master-document.md#29-modo-3d-y-modo-2d-clásico)).

- Both modes **MUST** expose the same essential functions (activities, material, chat, grades, shop, bot) through the same server checks. The 2D mode **MUST NOT** be a privileged bypass or a degraded subset of permissions.
- Switching mode **MUST NOT** change membership, authority, or the live session by itself; it changes the presentation. Whether a user in 2D mode keeps a visible avatar in the shared classroom is an open decision.
- The selected mode is a per-user preference; where it is persisted (client storage or server profile) is an open decision. It **MUST NOT** carry data between accounts.
- The 2D mode is also the accessibility path required by [master §3.2](../master-document.md#32-interfaz-y-accesibilidad); see [UI and accessibility](./ui-and-accessibility.md).
- The Parent role has no 3D classroom; its interface is the minimal area above.

## Ownership and authorization

| Owner | Required responsibility |
|---|---|
| NestJS / PostgreSQL | Persistent schools, classrooms, memberships, roles, invitations, adult mode, and authorized business changes |
| Colyseus | Live session admission, presence, movement, and permission checks for received actions |
| Frontend | Show context and role-specific surfaces, request actions, represent pending/rejected results, and clear inaccessible state |
| Backend and frontend maintainers | Agree on consumed contracts without assuming a cross-repository distribution mechanism |

- Every protected read or mutation **MUST** be authorized server-side; a visible door, an open panel, a cached classroom, or a client store **MUST NOT** grant authority.
- Visibility, discovery, admission, and resource modification **MUST NOT** be treated as interchangeable permissions.
- Bot-mediated actions **MUST** obey the same backend permission boundary as direct actions.
- A rejected action **MUST NOT** change what the interface presents as saved classroom, membership, or resource state.
- HTTP authentication and permission failures **MUST** follow [Security](./security.md); realtime rejection **MUST** preserve equivalent access boundaries without inventing HTTP codes for WSS messages.
- A resource outside the user's access returns `404` (decided, not `403`), so the interface **MUST** present it as not found and **MUST NOT** reveal that a foreign classroom exists. A `403` remains for insufficient role within a resource the user can reach ([Security](./security.md)).
- Lost access (removal, expulsion, deactivation) **MUST** take effect in the interface immediately, including an open live session and any open panel.

## Invitations

- Onboarding is by email invitation: teachers and administrators invite teachers; teachers and administrators invite students and parents to a classroom. Master §2.1 and §2.2 define it; the server owns the secret, expiry, and single use.
- The interface **MUST** let authorized staff send invitations for a school or classroom with a role, and show the pending, accepted, expired, or revoked state returned by the server. Resending or revoking is offered only if the backend contract supports it.
- Invitation acceptance **MUST** require authentication. The interface **MUST NOT** treat possession of an invitation link as access to unrelated resources.
- An invalid, expired, revoked, or reused invitation **MUST** be explained without exposing protected school, classroom, or user information, and **MUST NOT** create a visible membership.
- The invitation form **MUST NOT** reveal whether an address already has an account.
- The invited email does **not** need to match the account email exactly (decided); the interface **MUST NOT** block acceptance on an email mismatch. Link lifetime, reuse, and revocation **MUST NOT** be guessed by the client.

## Normal and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Teacher opens an owned classroom | The classroom loads, tools match the server-returned capabilities, and live presence follows authorized admission |
| School Admin opens a classroom of the school | Teacher-level tools are available without a per-classroom membership |
| Teacher tries another teacher's classroom through a manipulated identifier | No data is shown and no state changes |
| Student reconnects to an enrolled classroom | Presence returns without recreating membership or business records |
| Last connected user leaves | Live presence ends; the classroom and its records remain |
| User approaches a visible door to an unauthorized classroom | Entry is rejected; spatial proximity grants no permission |
| Parent opens the application | Only the minimal parent area for linked children is offered |
| Classroom runs in adult mode | No new parent invitation is offered; existing parent links remain but their actions are disabled |
| Role changes while a panel is open | Later protected actions use current server authorization, not the panel's earlier access |
| User switches between 3D and 2D | The same actions remain available with the same checks and no membership change |
| Logout or account switch races with a response | Old private data cannot populate the new context |

A permission change **MUST NOT** be defeated by a stale cache or an already-open connection. The propagation mechanism and timing remain contract decisions.

## Correct and incorrect examples

**Correct:** A door sends an entry intention for a persistent classroom. The server validates the user and classroom authorization, then associates the accepted live session with that space.

**Incorrect:** A door sets `canEnter = true` in Zustand and connects using any classroom identifier supplied by the browser.

**Correct:** The 2D interface lists the student's pending activities using the same endpoints and checks as the desk in the 3D classroom.

**Incorrect:** The 2D mode shows teacher controls because the user switched mode, or a student gains grading tools by changing a client flag.

**Correct:** A settings panel reflects the capabilities returned through the agreed contract and handles a later server denial.

**Incorrect:** An example grants a teacher authority over another teacher's classroom, or a parent access to the classroom chat, merely because of a role name.

## Observable acceptance checks

Apply [Quality and testing](./quality-and-testing.md); these checks describe required evidence, not current runtime compliance.

- [ ] Registration offers both organization paths and shows the resulting structure only after server confirmation.
- [ ] Each role sees only the surfaces of its row above; the parent view stays minimal and has no 3D classroom, chat, shop, or bot.
- [ ] A school Owner or Admin reaches teacher-level tools in every classroom of its school and none in another school.
- [ ] Direct API and realtime attempts with missing identity, insufficient permissions, and foreign IDs cannot bypass authorization, whatever the interface shows.
- [ ] 3D and 2D modes expose the same essential functions with the same server checks; switching preserves membership and context.
- [ ] Invitation states and failures are explained without leaking information, and acceptance requires authentication.
- [ ] Adult education mode hides parent invitations and disables the actions of existing parent links; a third guardian cannot be invited.
- [ ] Disconnect/reconnect preserves classroom and membership records while presence changes.
- [ ] Lost access, logout, and late responses clear or isolate affected private state under [Security](./security.md).
- [ ] Classroom layouts preserve readable doors, routes, and human avatars under [Art direction](./art-direction.md), without selecting an engine.

## Open decisions — not implementation defaults

- Exact Admin delegation compared with the Owner, including transfer or deletion of a school (deferred to the roles implementation).
- Whether a user may belong to several schools (a single account holding both organization paths is decided).
- Where the 2D/3D preference is persisted, and whether a user in 2D mode keeps a visible avatar in the shared classroom.
- Permission-change propagation and active-session handling; no timeout or eviction protocol is selected here.
- Authoritative contract publication and distribution between the independent repositories.

Decisions **MUST** be recorded with the responsible backend and frontend owners before consumers rely on them. Examples above demonstrate invariants only, not additional approved roles or workflows.
