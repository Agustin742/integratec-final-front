# Classroom chat panel

The classroom chat is the per-classroom conversation channel of `HU-COM-002`
([#51](https://github.com/Agustin742/integratec-final-front/issues/51)).
Members with chat access read the server-confirmed history as a real
conversation, send
plain-text messages with `@mention` autocomplete, and teacher-level staff hide
individual messages with a confirmed, audited moderation. Parents are never
offered this chat. Every displayed value comes from the server; the client
never fabricates, aggregates, or broadcasts anything on its own authority
([communication and notifications](../rules/communication-and-notifications.md)).

## Where it mounts

`ChatPanel` (with its composer slot) registers under the server `chat` panel
key in `classroomPanelCatalog`
([classroom panels](./classroom-panels.md)), so it opens from the same 2D
Classic Mode navigation buttons and URL intents
(`/classrooms/{id}/panels/chat`) as every other panel. A 3D chat object is not
required by the issue. Panel visibility comes only from the server's
`availablePanels` on `GET /classrooms/{id}`; the panel content then branches
on the server-resolved `myRole`:

| Caller role                   | Content                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `STUDENT`                     | Full history (visible rows) + composer (disabled with the reason while muted)                                       |
| `TEACHER` / `OWNER` / `ADMIN` | Full history incl. hidden rows with their moderation audit + composer (send allowed while muted) + hide controls    |
| `PARENT`                      | Denied up front, without issuing any chat or directory request; the panel explains that families do not participate |

## Read side: conversation with infinite history

`src/features/classrooms/chat/chat-panel.tsx`:

- Layout: the panel fills the dialog as a flex column. Header and composer
  keep their size and only the message list scrolls, so the composer is always
  visible (also at 360px). The scroll container disables the browser's own
  scroll anchoring and keeps the reader's position manually.
- History comes from `GET /classrooms/{id}/messages` (`ChatController_list`,
  20 rows per page, server-fixed order `createdAt DESC, id DESC`, latest
  first) through one `useInfiniteQuery` (`initialPageParam: 1`; page N + 1 is
  OLDER messages, requested while fewer rows than the server `total` are
  loaded). Pages are flattened, deduplicated by message id (offset pagination
  shifts when messages arrive between requests) and reversed, so messages read
  oldest to newest, top to bottom.
- There is no pager. A sentinel above the oldest message is watched with an
  `IntersectionObserver`; when it nears the viewport the next page loads, and a
  small constant-height row shows `Cargando mensajes anteriores…` while it
  fetches and `Inicio de la conversación` when nothing older exists. Scroll
  position: the first load is anchored at the newest message; prepending older
  messages adds the new content height to `scrollTop` before paint (no jump);
  a newer message scrolls into view only when the reader is at the bottom or
  just sent one (the composer asks the list through `ChatScrollContext`).
- Messages are bubbles: own messages are tinted and right-aligned
  (`data-own="true"`), others left-aligned with the author name and a `Docente`
  badge for staff. Each carries a time-only stamp in a `<time dateTime>`
  (`HH:mm` in the school time zone) and days are separated by `Hoy`, `Ayer` or
  a long date. Hidden messages (staff view) are italic and muted with their
  audit line.
- The history key (`classroomChatHistoryQueryKey`) is scoped by user and
  classroom and carries only `pageSize`; cached data is
  `InfiniteData<PaginatedChatHistoryDto>`. It shares the `chat` domain, so
  `createClassroomChatPredicate` invalidations still refetch every loaded page.
- Author labels come from the optional `GET /classrooms/{id}/members`
  directory lookup (`list_directory`-capable callers only): display names and
  a `Docente` badge for staff rows, a `(Vos)` marker on the signed-in
  member's own rows. Absent, denied or failed lookups degrade to neutral
  labels (`Integrante del aula`), never to guesses.
- Message bodies are untrusted content rendered as plain text nodes (never
  `dangerouslySetInnerHTML`), preserving whitespace with `break-words`
  ([security](../rules/security.md)).
- States use the shared feedback primitives: loading, empty
  (`Todavía no hay mensajes en el chat`), stale (background refresh failed,
  confirmed rows kept with a notice), forbidden (`403`) and not-found (`404`)
  without revealing whether the resource exists. A failed older-page request
  keeps the loaded messages behind the stale notice and is not retried in a
  loop. A terminal `403`/`404` also
  revalidates the classroom context once so a lost permission does not keep
  serving a stale denied page.

## Live messages

New messages and moderation hides arrive through the Colyseus classroom room
([back #48](https://github.com/Agustin742/integratec-final-back/issues/48):
`chat:message` carries the persisted message, `chat:message.hidden` carries
`{ messageId, hiddenAt }`). The workspace SSE
`classroom.context-invalidated` hint no longer carries chat.

- **One shared connection.** `ClassroomRealtimeProvider` (mounted once in
  `main.tsx`) owns a `ClassroomRealtimeManager`
  (`src/realtime/classroom-realtime-manager.ts`): at most one Colyseus
  connection per classroom, reference-counted by subscribers and capped at
  `MAX_CONNECTIONS_PER_USER`. It closes shortly after the last subscriber
  leaves and retries transient failures with backoff. Any chat UI (this panel
  today, a floating chat later) calls `useClassroomChatLive(classroomId)`
  and shares that connection.
- **Cache first.** Every payload is validated against the generated contract
  (`chatMessagePayloadSchema`, `chatMessageHiddenPayloadSchema`) and ignored
  if invalid or from another classroom. `chat:message` is prepended to the
  newest page of the cached history, deduplicated by id, so an echo of the
  user's own message or a repeated event never shows twice and no refetch is
  needed. A hidden message is removed from a student history; staff refetch
  because the audit pair only comes from REST.
- **Missed events.** After a connection loss, the history is revalidated once
  the connection is back, because Colyseus does not replay messages. Without the
  provider or while the room is unavailable the chat keeps working on REST
  (confirmed sends and moderation hides still reconcile through the `chat`
  query domain).
- **Presence side effect.** Joining the classroom room registers the user's
  avatar and connected time on the server for as long as the connection is
  open, whether or not the 3D view is shown.

REST stays the rendering authority
([communication and notifications](../rules/communication-and-notifications.md)).

## Composer

`src/features/classrooms/chat/chat-composer.tsx`:

- Contract limits: 1–2000 characters after trimming, multiline
  `\n`/`\r`/`\t` allowed, other control characters rejected before the
  request. Only `body` is sent; the server assigns author, instant and
  mention resolution.
- `@mention` autocomplete: typing `@` plus a prefix queries
  `GET /classrooms/{id}/members` with the `q` case-insensitive display-name
  prefix filter (backend decision D12), debounced by about 200 ms (one request
  per burst of keystrokes, the in-flight one is aborted). Its query key lives
  outside the `chat` domain, so chat reconciliation (sends, hides, reconnects)
  never refetches the member directory. Suggestions never expose users outside
  the roster the server returns.
- The draft stays a native `textbox` (`combobox` is not an allowed role on a
  `<textarea>`): it carries `aria-autocomplete="list"`, `aria-controls` (the
  popup, only while open) and `aria-activedescendant` (the highlighted
  option); the popup is a `role="listbox"` of `role="option"` items and the
  polite suggestions notice tells screen readers when it opens. Focus never
  leaves the textarea. ArrowDown/ArrowUp move the highlight (wrapping), Enter selects the
  highlighted option (the first one when none is highlighted; it never sends
  or adds a newline while the list is open), Tab selects the highlighted
  option, Escape closes the list without changing the text, and a mouse click
  selects without stealing focus. Selecting inserts `@DisplayName ` as plain
  text; the server resolves or ignores it.
- Enter sends and Shift+Enter inserts a newline (Enter during IME composition
  or while the mention list is open never sends); a short hint is visible.
  While sending, the button shows `Enviando…` and the textarea is read-only
  (never disabled), so focus is kept; after a confirmed send the list scrolls
  to the newest message, focus stays in the textarea and the result is
  announced once through a visually hidden live region (no toast). The message
  only becomes history after the server confirms (201), and the draft clears
  only then. Definite
  rejections keep the draft: a `400` maps onto the body field, and a `429` is
  shown as the rate-limit feedback while send stays disabled for the
  `Retry-After` seconds (5 seconds when the header is not exposed) and
  re-enables by itself. Transport-uncertain outcomes keep send disabled while
  the history is reconciled; the send has no idempotency key, so the composer
  then looks for the current user's message with the same body created since
  the send began (5 seconds of clock-skew tolerance, also when it arrives
  later through live delivery): if found the draft is treated as sent (cleared
  and announced once), otherwise the draft is kept with the uncertainty
  notice — never a blind retry
  ([error handling](../rules/error-handling-and-feedback.md)).
- Typing in the composer never triggers world movement or shortcuts: the
  workspace shortcut listener ignores editable targets and open dialogs.

## Muted chat

`chatMuted` is server-owned context on the classroom detail. While muted,
students get a disabled composer with the reason (`El chat está silenciado`)
and no send control, but the confirmed history stays readable;
teacher-level staff keep the active composer. The disabled control is never
the enforcement: a send that still reaches the server is rejected and that
outcome is presented, with the explanation always coming from the revalidated
context, never from a `403` body. The disabled textarea is described by the
muted explanation (`aria-describedby`).

## Moderation

Teacher-level staff (server-granted `moderate_chat` on this classroom) see an
compact icon button (accessible name with author and instant) on visible
rows: always visible on touch, shown on row hover or keyboard focus with a
fine pointer, and always reachable by Tab. `DELETE /classrooms/{id}/messages/{messageId}`
(`ChatController_hide`) is a logical, idempotent staff-only moderation:

- A confirmation dialog quotes the exact message; nothing changes before the
  server answers. While a confirmation is open, every row control is
  disabled so at most one moderation is in flight.
- A definite `204` reconciles the history first and then closes the dialog,
  leaving the row badged `Ocultado` with its audit (`Ocultado por … el …`).
  The row is never deleted, so staff keep reading it.
- Students receive only visible rows from the server, so hidden messages
  simply vanish from their view; no client-side filtering decides it.
- A later server denial shows the failure, closes the dialog and revalidates
  the classroom context so a lost permission removes the control. Uncertain
  outcomes reconcile against the revalidated history before any retry.

Message editing by authors, automatic content filtering, student reporting
and per-student muting are not established and do not appear as UI
([communication and notifications](../rules/communication-and-notifications.md));
mute controls themselves belong to `HU-VIV-002` (extended) and are out of
scope for #51.

## Accessibility notes

- The scrollable conversation region (focusable, so it scrolls by keyboard),
  history list, composer region and suggestion listbox carry explicit
  accessible names; sent confirmations and suggestion availability are
  announced through visually hidden live regions. The message list itself is
  not a live region, so incoming messages do not spam screen readers.
- Hide controls are named with the author and instant of the target row, so
  the action is unambiguous for screen-reader users; focus returns to the
  row control when a moderation is denied and to the history list when the
  row's control is gone after a confirmed hide.
- Composer and dialog actions keep the shared 44px minimum target height, and
  the muted state explains itself instead of only disabling the control
  ([UI and accessibility](../rules/ui-and-accessibility.md)).

## Contract and mocks

Frontend types are generated from the backend's committed OpenAPI document
(`pnpm api:sync`; chat REST from back #38, member directory from back #52),
and the feature layer validates every response with jitless Zod schemas
mirroring the backend DTOs (`ChatMessageDto`, `ChatHistoryMessageDto`,
directory rows). The stateful MSW store in `src/test/msw/handlers.ts`
(`createClassroomChatStore`) serves contract-shaped fixtures with
`403`/`404`/`429`, muted, and uncertain-write failure options so UI work and
tests run against the committed contract (FD9). A passing mock is not
integration proof.

## UI evidence

Note: the screenshots below predate the conversation layout (fixed composer,
bubbles, infinite history) and are regenerated by `e2e/classroom-chat.spec.ts`.

Desktop 1280px, student chat panel with confirmed history and composer after
a server-confirmed send:

![Classroom chat panel at 1280px](./assets/chat/classroom-chat-1280.png)

Mobile 360px, same panel and composer:

![Classroom chat panel at 360px](./assets/chat/classroom-chat-360.png)
