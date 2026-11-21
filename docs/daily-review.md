# Daily Review Dialog (`#55` / `HU-BOT-003`)

`DailyReviewDialog` (`src/features/daily-review/daily-review-dialog.tsx`) presents the once-per-day daily review after the first authenticated connection of the day, plus the student's daily question for the streak. It is mounted once inside `AppShell` (`src/app/router/app-shell.tsx`) and renders nothing for signed-out users.

## Behavior and boundaries

- **Server-decided eligibility:** The client never uses the browser clock, locale, or timezone. `useOwnDailyReview` (`src/features/daily-review/use-daily-review.ts`) queries `GET /users/me/daily-review` once per connection (user-scoped `ownDailyReviewQueryKey(userId)`, `staleTime: Infinity`, no focus/reconnect refetch) and opens the dialog only while the server answers `due`. Every server-decided non-delivery — already delivered today, another tab, a parent, or any ineligible state — arrives as `not_due` and keeps the dialog closed; the client does not distinguish these on its own. The daily identity (user plus calendar date in `America/Argentina/Buenos_Aires`) is backend-owned.
- **Once-per-day, reload-safe (S3):** Reloads and other tabs re-query the server, which already recorded the delivery; a `not_due` answer never reopens the dialog. Dismissal only hides the current presentation and never writes a client-side day record.
- **Roles (S2):** `audience` is server-shaped: students receive pending items and news plus the daily question with answer feedback; teachers receive review-only content without a question; parents receive `not_due` and no dialog. The client never derives the role.
- **Daily question and streak:** Students answer the server-delivered multiple-choice question via `POST /users/me/daily-review/daily-question`. The result carries `correct`, `feedback`, and the server-confirmed `streak` (`currentStreak`, `bestStreak`, `lastQualifiedDate`); the dialog renders "¡Sumaste un día! Tu racha llegó a N días." only from that server value and invalidates `ownStreakAndBadgesQueryKey` so every streak indicator refetches ([Daily streak and badges](./streak-and-badges.md)). A `409` maps to the "Ya respondiste la pregunta de hoy." message; the client never credits streaks.
- **Structured fallback (S4):** `contentKind: 'structured'` renders the authorized sections without generated wording, labeled "Resumen estructurado con tus datos guardados, sin texto generado por IA." The dialog assumes nothing about model output; a pending or failed eligibility check never blocks the application (the dialog simply stays closed).

## Provisional contract (`FD9`, back#42)

Because `Agustin742/integratec-final-back#42` is still open, the endpoints are provisional (jitless Zod schemas plus a path interface cast onto the typed client, precedent `streak-badge-service.ts`): `GET /users/me/daily-review` and `POST /users/me/daily-review/daily-question` (`src/features/daily-review/daily-review-schema.ts`, `daily-review-service.ts`). Contract-faithful MSW handlers exist in `src/test/msw/handlers.ts` (due/not-due/parent/structured-fallback/correct/incorrect states) until the backend contract lands in `src/api/schema.generated.ts`; a passing mock is not integration proof.

## States and accessibility

- The Radix `Dialog` provides focus management, `Escape`/overlay close, and the `dialog` role named by the visible title "Tu repaso diario".
- Sections are labeled lists ("Pendientes"/"Novedades"); the question is a `radiogroup` with a screen-reader legend; the answer result is a `role="status"` region; answer errors are `role="alert"`.
- Deadline timestamps arrive as UTC instants and render in the school time zone ([Data and time](../rules/data-and-time.md)); the client never decides the shown date.
- User-facing copy is centralized in `src/features/daily-review/messages.ts` (es-AR, voseo).

## UI evidence

Captured by `e2e/daily-review.spec.ts` against synthetic API responses (show once, answer flow, reload no repeat, no CSP violations, no page errors):

- Desktop (`1280px`): [daily-review-1280.png](./assets/daily-review/daily-review-1280.png)
- Mobile (`360px`): [daily-review-360.png](./assets/daily-review/daily-review-360.png)
