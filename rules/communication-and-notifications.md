# Communication and Notifications (Interface)

Users must be able to exchange authorized classroom messages, consult persisted history, follow announcements, and receive in-app notifications without treating presence or a contextual interface as permission.

## Authority and scope

- [Master §2.3](../master-document.md#23-herramientas-del-profesor), [§2.5](../master-document.md#25-vista-de-padres), and [§2.12](../master-document.md#212-comunicación) establish the classroom chat with teacher moderation and history, chat mute, @mentions, the announcement board, parent messages, and notifications (in-app for all roles, plus email for parents).
- [Master §2.10](../master-document.md#210-objetos-y-elementos-interactuables) gives the bulletin board and the report card as illustrative entry points; they are not a fixed object catalog, and [§2.9](../master-document.md#29-modo-3d-y-modo-2d-clásico) requires the same functions in the 2D mode.
- [Master §6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns message history, announcements, and notifications to NestJS/PostgreSQL, with live messaging through Colyseus by default and email through a service invoked by NestJS.
- [Master §9.1](../master-document.md#91-mvp-núcleo) places chat with moderation, chat mute, @mentions, the announcement board, parent messages, and notifications in the MVP core.
- The backend rule *Communication and notifications* owns persistence, moderation records, mention resolution, notification creation, and email delivery. Role permissions come from [Classrooms and roles](./classrooms-and-roles.md).
- [Security](./security.md) and [Quality and testing](./quality-and-testing.md) remain the common authorization and verification policies.
- This document defines behavior boundaries, not message lifecycle features or approved delivery values.

## Ownership and confirmed information

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Authorize and persist chat history, moderation state, chat mute, announcements, mentions, parent messages, and notifications |
| Colyseus | Deliver authorized live messaging and change notifications without becoming the history database |
| Email service (invoked by NestJS) | Deliver parent and invitation email; not a frontend concern |
| Frontend | Display scoped history and panels, retain safe input, and represent pending or failed actions |
| Backend AI tools | Read only information the requesting user may access |

- Persistent communication records **MUST** remain available under their access rules after reload or restart; a live broadcast alone does not meet the history commitment.
- Live notifications of persistent changes **MUST** correspond to backend-confirmed records, following master §6.2.
- A received realtime event **MUST NOT** independently establish permanent storage or grant access to another resource.
- Socket.IO **MAY** serve a justified independent channel under the master; it **MUST NOT** be installed by default or duplicate Colyseus synchronization.
- Client caches and local conversation arrays **MUST NOT** become authoritative message or notification stores.
- Frontend and backend owners **MUST** agree on observable contracts without assuming a shared package or cross-repository distribution strategy.

## Classroom chat and history

- The classroom chat is a channel per classroom, open between students; teacher-level staff moderate it and have the full history. Direct student-to-student messages are not part of the scope.
- Every history read and message submission **MUST** be authorized server-side. Enrolled students and the classroom's teaching staff can read and write; parents **MUST NOT** be offered the classroom chat.
- Membership and live presence **MUST** remain distinct: an offline member is not a connected avatar, and a connected avatar is not a universal communication permission.
- Historical access before joining, after leaving, or after a permission change **MUST** follow an explicit contract; membership **MUST NOT** be interpreted as an unlimited historical grant.
- History queries and caches **MUST** carry the user and classroom scope so one context cannot reuse another's protected records ([State management](./state-management.md)).
- Changing a classroom or message identifier **MUST NOT** reveal another classroom's history.
- Message bodies are untrusted content: they **MUST** be rendered as text, never as HTML or markup, under [Security](./security.md).
- A visible chat object or open conversation panel **MUST NOT** authorize sending, reading, or summarizing content.
- Empty history **MUST** be distinguishable from loading, denied access, and failure to retrieve history.
- Presentation **SHOULD** make the current classroom context clear so users do not mistake one destination for another.
- A rejected send **MUST NOT** appear as a persisted message or confirmed broadcast.
- The chat **MUST** be reachable from the 3D classroom and the 2D mode, with the same history and checks. Typing in the chat **MUST NOT** move the avatar ([UI and accessibility](./ui-and-accessibility.md)).

### Moderation UI

- Teacher-level staff **MUST** be able to hide or delete a message from the chat view. The backend records moderation as a state change, so the teacher keeps the full history and sees who moderated and when; students see moderated messages as removed.
- The moderation controls **MUST** appear only for teacher-level users of that classroom, and a later server denial **MUST** be handled.
- A moderation action **MUST** show pending and confirmed states and **MUST NOT** present the message as removed for others before server confirmation.
- Message editing by authors, automatic content filtering, reporting by students, and muting a single student are not established; they **MUST NOT** appear as UI until decided.

### Chat mute

- The teacher can mute the chat for the whole classroom. The state is persisted by the backend and enforced on every send; the live change is announced to connected clients.
- While the chat is muted, the composer **MUST** show a clear muted state to students (disabled, with the reason) and **MUST NOT** rely on the disabled control for enforcement: a send that reaches the server while muted is rejected and the interface **MUST** present that outcome.
- Teacher-level staff may still write while the chat is muted; unmuting restores sending. The mute control is offered only to teacher-level users, with an explicit reverse operation.
- A client that connects or reloads while the chat is muted **MUST** receive the current state from the server, not assume an unmuted default.
- The same control family is described in [Live classroom tools](./live-classroom-tools.md).

### @mentions

- The composer **MAY** offer mention suggestions limited to the classroom roster the server returns; it **MUST NOT** expose users outside the classroom or members the actor may not see.
- The server resolves mentions; the interface **MUST** render unresolved text as plain text and **MUST NOT** treat a typed `@name` as a confirmed mention until the server accepts it.
- A mentioned user receives an in-app notification (see below) only if they still have access to the classroom.
- A bound on mentions per message is an open decision; the interface **MUST** show the server's rejection if exceeded.

## Announcement board

- Announcements belong to a classroom's bulletin board. The board **MUST** display backend-authorized records, not independent copies with conflicting saved details, and **MUST** be reachable from the 3D bulletin-board object and from the 2D mode.
- Only teacher-level staff of the classroom may publish. Authors may edit and delete their own; the school Owner or Admin may edit or delete any announcement of the school's classrooms. The interface offers these actions only to those users, and the server remains authoritative.
- Announcements may contain @mentions; the same rules as the chat apply.
- Announcement publication **MUST** show pending, confirmed, and rejected outcomes, retain safe input after failure, and **MUST NOT** announce a successful change that the server rejected.
- Whether parents see announcements of the classrooms their linked children attend is an open decision; the interface **MUST NOT** assume either.
- School-wide announcements are an evolution item and **MUST NOT** be introduced here.

## Parent messages

- Parents can exchange messages with the teacher and with their child. A conversation is bound to one parent-child link; the server verifies the link on every read and write.
- The parent message screen **MUST** make the child, the other participant, and the conversation context clear before submission.
- Private message content **MUST NOT** be shown to unrelated audiences; the UI **MUST NOT** expose unauthorized recipients or conversations through search, cached results, or guessed identifiers.
- Parent-to-teacher and parent-to-child conversations are visible only to their participants. Whether the school Owner or Admin may read them is open; the interface **MUST NOT** offer that reading until decided.
- In adult education mode, parent messaging and links are disabled; the interface **MUST NOT** offer them.
- Teachers and students **MUST** be able to receive and answer these messages in the 2D mode and through the corresponding object in the 3D classroom where one exists.
- Arbitrary cross-classroom reachability, groups, attachments, delivery/read receipts, and blocking policies are not approved by these examples.

## In-app notifications

- Notifications are in-app for all roles and also by email for parents. The in-app notification is the durable record with a read state; email is a delivery channel handled by the backend.
- The interface **MUST** present a notification center or equivalent for each role, with read and unread states returned by the server, reachable from the 3D world and the 2D mode.
- Notifications **MUST** be created by the backend after the triggering change is committed (for example grade published, activity published, mention, new parent message, announcement, invitation). The client **MUST NOT** create notifications or treat a locally generated item as one.
- Live delivery of a new notification is best effort. The server remains the source of truth; the interface **MUST** reconcile with it after reconnect and **MUST NOT** claim that no notification exists when retrieval failed.
- A notification **MUST** link to the application area for detail and carry only the minimum data needed, particularly for parent notifications about a child's state.
- Marking as read **MUST** show pending versus confirmed state and **MUST NOT** diverge across clients after reconciliation.
- A recipient who lost access **MUST NOT** see old content from the affected classroom; the notification list **MUST** be cleared or isolated on logout or account switch.
- Parent notification display **MUST** identify the child concerned.
- The parent's email preferences, opt-out for non-essential email, frequency limits, and digest-versus-immediate policy are backend decisions still open; the interface **MUST NOT** offer settings for them until decided.

## Input and failure recovery

- Message composers and announcement forms **MUST** show validation failures and pending submissions, prevent accidental repeated submission, and preserve safe input in the authorized context.
- Pending sends **MUST NOT** be presented as confirmed records before acknowledgement of the persistent result.
- Draft preservation **MUST NOT** expose previous-account or inaccessible-classroom content after logout or lost access.
- A transport timeout **MUST NOT** be assumed to mean that nothing was saved; reconcile the outcome before repeating a write.
- Retries **MUST** be bounded and safe against duplicate effects; optimistic display **MUST** reconcile rejected or uncertain outcomes without inventing a retry interval or duplicate-suppression protocol.
- Late responses and reconnect updates **MUST NOT** inject another classroom's messages into the active conversation.
- A bot summary **MUST NOT** reveal communication outside the requesting user's authorized scope.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Authorized student sends a chat message | Saved content appears in authorized history and confirmed live delivery |
| Recipient reconnects or reloads | Authorized persisted history is available independently of prior live delivery |
| Teacher hides a message | Students see it as removed; the teacher still sees the original with who moderated it |
| Chat is muted and a student types | The composer shows the muted state; a forced send is rejected and explained |
| Student mentions a classmate | The mention is confirmed by the server and the mentioned user is notified |
| Parent opens a conversation with the teacher | Child and participant are clear; link is verified by the server |
| Parent opens the classroom chat by guessing an identifier | Protected content remains unavailable |
| Permission is lost while composing | Submission is denied and inaccessible content is not retained through stale client state |
| Send times out after possible persistence | UI reports uncertainty and reconciles before sending again |
| Classroom changes while history is loading | The old response cannot populate the new classroom's conversation |
| Live notification is missed | Reconciliation retrieves it from the server |

## Correct and incorrect examples

**Correct:** A bulletin board opens authorized announcements. A teacher's new announcement is pending until the server confirms it.

**Incorrect:** Walking near the bulletin board writes a publication or grants publishing rights.

**Correct:** A failed message submission keeps safe editable text while clearly distinguishing it from confirmed history.

**Incorrect:** A local message bubble is counted as persisted, or an automatic retry produces another message without reconciling the first outcome.

**Correct:** The chat composer is disabled while muted and the server still rejects a forced send.

**Incorrect:** The mute is applied only by hiding the input, so a modified client can keep sending.

## Observable acceptance checks

Use [Quality and testing](./quality-and-testing.md); these are verification expectations, not a claim of implemented runtime compliance.

- [ ] Authorized chat messages remain in accessible history after reload and backend restart.
- [ ] Unauthorized reads, sends, publications, and parent-message mutations cannot change or expose persistent records.
- [ ] Parents are not offered the classroom chat; students cannot moderate or mute.
- [ ] Foreign-ID requests and stale classroom/account responses preserve conversation isolation.
- [ ] Loading, empty history, rejection, transport failure, pending send, and confirmed history are distinguishable.
- [ ] Moderated messages appear removed to students and remain visible with moderation info to teacher-level staff.
- [ ] Chat mute holds across reload and reconnect, and a send during mute is rejected visibly.
- [ ] Mentions resolve through the server and notify only users with access.
- [ ] Notifications reconcile after reconnect and are isolated on logout and account switch.
- [ ] Announcement and board views agree on authorized records.
- [ ] Safe composer input survives failure without leaking across logout or lost access.
- [ ] Chat, board, parent messages, and notifications are reachable in the 2D mode.
- [ ] Contextual UI preserves [Art direction](./art-direction.md), scene readability, and human avatars without choosing a renderer or duplicating visual tokens.

## Open decisions — not implementation defaults

- Message ordering, history pagination, historical-access boundaries, length limit, and delivery reconciliation contracts.
- Whether chat is sent through REST followed by a broadcast or through a validated realtime message.
- Retention of message history and of parent conversations; message editing, per-student mute, content filtering, receipts, and attachments.
- Whether the school Owner or Admin may read parent conversations.
- Parent visibility of announcements.
- Mentions bound per message.
- Email service confirmation (candidate: Amazon SES), digest policy, opt-out, and bounce handling.
- Transport deduplication, reconnect recovery details, and cross-repository contract publication and distribution.

These choices **MUST** be resolved explicitly by the responsible product and backend/frontend owners before examples or UI placeholders are treated as commitments.
