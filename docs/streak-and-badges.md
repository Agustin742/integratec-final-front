# Daily Study Streak and Badge Showcase

Implements [issue #47](https://github.com/Agustin742/integratec-final-front/issues/47) (`HU-GAM-002`): reusable `StreakIndicator` and `BadgeShowcase` components integrated into `ProfileView` (`/profile`).

## Architecture and Contract

- **Query key & isolation:** `ownStreakAndBadgesQueryKey(userId)` (`src/api/query-keys.ts`) scopes cached streak and badge data by `userId`.
- **Provisional contract (`back#33`):** Because `Agustin742/integratec-final-back#33` is still open, `fetchOwnStreakAndBadges` (`src/features/points/streak-badge-service.ts`) consumes `GET /users/me/streak-and-badges` (`{ currentStreak, bestStreak, lastQualifiedDate, badges }`) validated with jitless Zod schemas (`src/features/points/streak-badge-schema.ts`) and backed by `createOwnStreakAndBadgesHandler` (`src/test/msw/handlers.ts`) until `back#33` lands in `src/api/schema.generated.ts`.
- **Server-authoritative display:** The client never increments streaks on login, never computes day boundaries (`America/Argentina/Buenos_Aires`), and never awards or simulates badges. Initial load failures render `ErrorState` with retry instead of fabricating `0` values; background refresh failures show `StaleDataNotice`.
- **Components:** `StreakIndicator` (`src/features/points/streak-indicator.tsx`) and `BadgeShowcase` (`src/features/points/badge-showcase.tsx`) are composed inside `StreakAndBadgesSection` (`src/features/points/streak-and-badges-section.tsx`) and ready for reuse in the report card (`#46`).

## UI Evidence

- Desktop (`1280px`): [streak-badges-1280.png](./assets/profile/streak-badges-1280.png)
- Mobile (`360px`): [streak-badges-360.png](./assets/profile/streak-badges-360.png)
