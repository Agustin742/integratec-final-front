# Student points wallet

The student points wallet shows the server-computed balance and the paginated
ledger movements of the signed-in student in one classroom
([#45](https://github.com/Agustin742/integratec-final-front/issues/45),
`HU-GAM-001`). It is read-only: the client never computes, edits, or transfers
points, and a balance it cannot retrieve is shown as unavailable, never as
zero ([points and shop](../rules/points-and-shop.md)).

## Where it mounts

`WalletIndicator` renders in the classroom workspace header when the server
context resolves the caller as `STUDENT` for that classroom
([classroom workspace](./classroom-workspace.md)). The role decision comes only
from `GET /classrooms/{id}`; the component itself performs no role gating. The
indicator is deliberately **not** part of the panel registry: the backend
`ClassroomPanelKey` enum has no `wallet` key, so the wallet opens its own dialog
instead of the server-gated panel host.

## Indicator (`WalletIndicator`)

`src/features/points/wallet-indicator.tsx` (`classroomId: string`):

- `ready`: `${balance} puntos`, the value from the server.
- `pending`: `Cargando tu saldo…`; the control stays enabled and focusable, and
  the dialog shows the panel's loading state.
- `error`: `Saldo no disponible` — the endpoint's mapped `ApiError`, never a
  numeric value.
- The visible text carries the state and the accessible name also names the
  action (`Ver movimientos de puntos`). Closing the dialog returns focus to the
  trigger button.

## Panel (`WalletPanel`)

`src/features/points/wallet-panel.tsx` (optional `classroomId` prop, route
param fallback): the dialog content opened by the indicator.

- Balance heading with the server's current value.
- One page of movements, each with the date (`formatInstant`, `es-AR`, school
  timezone per FD11), the server-written reason verbatim, and the signed amount
  (`+50` / `-20`), so the direction is never signaled by color alone.
- `PaginationControls` with local page state; loading, empty (teaching: points
  appear when a teacher grades an activity or after a shop purchase), error
  with retry, and stale states use the shared feedback primitives. A failed
  background refresh keeps the confirmed list and shows the stale notice.

## Data and lifecycle

`src/features/points/use-student-wallet.ts` wraps one query:
`GET /classrooms/{id}/points` (`StudentWalletDto` = balance plus one movements
page). The query key is scoped by user and classroom with normalized
pagination (`domain 'points'`, `resource 'wallet'`), so the indicator and panel
share one cache entry and pages are isolated. Signed-out sessions disable the
query. Grading and purchase features call `invalidateStudentWallet` after
their mutations so every movements page and the balance refresh together.
A `403` (non-student) and a `404` (out-of-scope classroom) arrive as mapped
`ApiError`s ([RN-04](../docs/functional-requirements.md)); the indicator and
panel never disclose classroom existence.

## Screenshots

- [Desktop 1280px](assets/wallet/wallet-1280.png)
- [Mobile 360px](assets/wallet/wallet-360.png)

## Verification boundary

Component tests cover the indicator states, the panel states and pagination,
the student-only mounting, and hook-level 403/404/invalidation behavior with
contract-faithful MSW handlers. `e2e/wallet.spec.ts` walks the desktop and
mobile student flow against the showcase build with synthetic credentials.
Mock results are not live-backend authorization proof; the backend remains the
authority for every value shown ([API contracts](../rules/api-contracts.md)).

See [points and shop](../rules/points-and-shop.md),
[error handling](../rules/error-handling-and-feedback.md),
[data and time](../rules/data-and-time.md), and
[UI accessibility](../rules/ui-and-accessibility.md).
