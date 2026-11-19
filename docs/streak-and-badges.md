# Daily Study Streak and Badge Showcase

Implements [issue #47](https://github.com/Agustin742/integratec-final-front/issues/47) (`HU-GAM-002`): reusable `StreakIndicator` and `BadgeShowcase` components integrated into `ProfileView` (`/profile`).

## Architecture and Contract

- **Query key & isolation:** `ownStreakAndBadgesQueryKey(userId)` (`src/api/query-keys.ts`) scopes cached streak and badge data by `userId`.
- **Provisional contract (`back#33`):** Because `Agustin742/integratec-final-back#33` is still open, `fetchOwnStreakAndBadges` (`src/features/points/streak-badge-service.ts`) consumes `GET /users/me/streak-and-badges` (`{ currentStreak, bestStreak, lastQualifiedDate, badges }`) validated with jitless Zod schemas (`src/features/points/streak-badge-schema.ts`) and backed by `createOwnStreakAndBadgesHandler` (`src/test/msw/handlers.ts`) until `back#33` lands in `src/api/schema.generated.ts`.
- **Server-authoritative display:** The client never increments streaks on login, never computes day boundaries (`America/Argentina/Buenos_Aires`), and never awards or simulates badges. Initial load failures render `ErrorState` with retry instead of fabricating `0` values; background refresh failures show `StaleDataNotice`.
- **Components:** `StreakIndicator` (`src/features/points/streak-indicator.tsx`) and `BadgeShowcase` (`src/features/points/badge-showcase.tsx`) are composed inside `StreakAndBadgesSection` (`src/features/points/streak-and-badges-section.tsx`) and ready for reuse in the report card (`#46`).

## Scope deferral: new-badge notification (HU-COM-004)

[Issue #47](https://github.com/Agustin742/integratec-final-front/issues/47) scope item "Show new-badge notification via the notification center (consumes HU-COM-004 when available)" is **deferred until `Agustin742/integratec-final-back#33` publishes the badge-award notification kind** in the backend OpenAPI contract. The in-app notification center (`HU-COM-004`, issue #50) is already merged into `develop` and renders server-created notifications through `NotificationDto.kind` (`src/api/schema.generated.ts`), but the current generated contract defines only `activity_published`, `grade_posted`, `announcement`, `mention`, and `activity_forum_reply`, and requires a `classroomId` on every notification. The client must not create notifications or invent a kind (`rules/communication-and-notifications.md`).

When `back#33` lands, the frontend will consume the server-created badge-award notification through the existing center by regenerating `src/api/schema.generated.ts` (`pnpm api:sync`), extending `NOTIFICATION_KINDS` and `getNotificationTargetPath` (`src/features/notifications/notification-schema.ts`) to target `/profile`, and invalidating `ownStreakAndBadgesQueryKey` when such a notification arrives. The report-card display of the streak follows issue #46.

## UI Evidence

- Desktop (`1280px`): [streak-badges-1280.png](./assets/profile/streak-badges-1280.png)
- Mobile (`360px`): [streak-badges-360.png](./assets/profile/streak-badges-360.png)
