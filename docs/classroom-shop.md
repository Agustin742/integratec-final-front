# Classroom Shop Catalog and Idempotent Purchase Flow (#48)

Enrolled active students browse classroom shop items, inspect their
server-authoritative individual point balance, confirm purchases safely with
per-attempt idempotency keys, and review their confirmed purchase history from
the `Tienda` panel (`shop` in `classroomPanelCatalog`, reachable from 2D Classic
Mode, 3D workspace panel registry, and `/classrooms/:classroomId/panels/shop`).

Teachers, admins, and parents never see purchase controls and never trigger
student-only shop requests.

## Contract and domain boundaries

All requests target the generated OpenAPI contract (`src/api/schema.generated.ts`,
backend `#34`):

- `GET /classrooms/{id}/shop/items` — paginated active catalog items filterable
  by `kind` (`AVATAR_ACCESSORY`, `DESK_UPGRADE`, `CLASSROOM_ITEM`,
  `PET_ACCESSORY`) and sortable via the backend allow-list (`createdAt`,
  `defaultPrice`, `-defaultPrice`, `name`, `-name`).
- `GET /classrooms/{id}/shop/purchases` — authenticated student's confirmed
  purchase history (`pricePaid`, `shopItemName`, `shopItemKind`, `createdAt`).
- `POST /classrooms/{id}/shop/purchase` — strict `{ shopItemId }` JSON body with
  required `Idempotency-Key` header (`1..128` chars). Accepts `201 Created`
  (fresh purchase, `replayed: false`) and `200 OK` (idempotent replay,
  `replayed: true`).

Client-side rules (`src/features/shop/`):

- **Server-only balance & pricing**: never computes or optimistically deducts
  points; reads balance via `useStudentWallet` (showing unavailable rather than
  `0` on error) and clamps formatted display so negative balances are never
  rendered.
- **No unpurchasable buy actions**: items with `isPurchasable: false` render
  honest status badges (**Ya lo tenés**, **Desbloqueado en el aula**,
  **Próximamente**) with no buy button.
- **Idempotency & uncertain writes**: each purchase attempt generates an
  in-memory `Idempotency-Key` (never persisted to storage, cleared on
  user/classroom scope changes). Rapid double-clicks are blocked via a
  synchronous `submittingRef` lock. On uncertain outcomes (`5xx`, network error,
  malformed `2xx`), the UI preserves the exact same `Idempotency-Key`,
  reconciles catalog + wallet against the server, and only offers an explicit
  retry (**Reintentar con la misma solicitud**) if ownership is not yet
  confirmed.
- **`409 CONFLICT` & `429 TOO_MANY_REQUESTS`**: because backend `409` envelopes
  share one safe code across insufficient balance, already owned, unimplemented
  item, and key mismatch, the dialog reconciles catalog + wallet before
  contextualizing the refusal honestly; `429` surfaces rate-limit feedback
  explicitly.
- **Wallet synchronization**: confirmed purchases, `409` conflicts, `404`
  removals, and uncertain outcomes call `invalidateStudentWallet` so
  `WalletIndicator` and `WalletPanel` refresh immediately.

## UI evidence

Playwright captures (`e2e/classroom-shop.spec.ts`, synthetic API responses) at
desktop (`1280px`) and mobile (`360px`):

- Shop catalog: [1280px](./assets/shop/catalog-1280.png) and
  [360px](./assets/shop/catalog-360.png).
- Purchase confirmation dialog: [1280px](./assets/shop/confirm-1280.png) and
  [360px](./assets/shop/confirm-360.png).

See [classroom panels](./classroom-panels.md),
[student wallet](./ui-wallet.md),
[threat model](./threat-model.md), and
[points and shop rules](../rules/points-and-shop.md).
