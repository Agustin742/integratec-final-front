# In-App Notification Center (`#50` / `HU-COM-004`)

`NotificationCenter` (`src/features/notifications/notification-center.tsx`) renders an accessible notification bell with unread counter and slide-over `Sheet` tray inside `AppShell` (`src/app/router/app-shell.tsx`) when the user is authenticated and a `QueryClientProvider` is mounted.

## Behavior and boundaries

- **Server-authoritative list & read state:** Queries `GET /notifications` via `notificationsListQueryKey(userId, params)` and confirms `PATCH /notifications/{id}/read` and `PATCH /notifications/read-all` with jitless Zod schemas (`src/features/notifications/notification-schema.ts`).
- **Polling & deduplication:** Polls every 30 seconds by default (`DEFAULT_NOTIFICATION_POLL_INTERVAL_MS`, configurable via `pollIntervalMs`) and refetches on window focus. `dedupeAndSortNotifications` prevents duplicate items from overlapping or out-of-order responses while preserving confirmed `readAt` timestamps.
- **Accessibility & deep links:** Announces new arrivals and unread count changes via a polite `aria-live="polite"` region. Maps `kind` and validated UUID `classroomId` to internal `/classrooms/{classroomId}/panels/{panelKey}` routes; destination panels and backend endpoints authorize access independently.
- **Session & access isolation:** Unmounts immediately on logout (`snapshot.status !== 'authenticated'`), keys component state by `userId`, and removes inaccessible classroom notifications on the next server-filtered poll.

## UI evidence

Captured by `e2e/notifications.spec.ts` against synthetic API responses:

- Desktop (`1280px`): [notifications-1280.png](./assets/notifications/notifications-1280.png)
- Mobile (`360px`): [notifications-360.png](./assets/notifications/notifications-360.png)
