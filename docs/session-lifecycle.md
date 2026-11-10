# Session lifecycle integration

Frontend [#18](https://github.com/Agustin742/integratec-final-front/issues/18) consumes the authentication contract published by backend `develop`, commit `419240443c6de648ca31f1eb892cff6fb84a3205`. Login screens, route guards and realtime rejoin belong to separate stories.

## Backend contract

| Operation | Request | Successful response |
| --- | --- | --- |
| `POST /auth/login` | Email and password | `200`: accessToken, refreshToken, tokenType `Bearer`, expiresIn (seconds) |
| `POST /auth/refresh` | JSON refreshToken; no Bearer | `200`: replacement token pair |
| `POST /auth/logout` | Access token as Bearer; no refresh body | `204`: session revoked |
| `GET /users/me` | Access token as Bearer | `200`: OwnProfileDto |

Backend dependencies [#18](https://github.com/Agustin742/integratec-final-back/issues/18) and [#20](https://github.com/Agustin742/integratec-final-back/issues/20) are closed. Backend `main` is not the current integration contract. Types are generated, never copied by hand:

```sh
pnpm api:sync --branch 419240443c6de648ca31f1eb892cff6fb84a3205
```

The sync also downloads the Colyseus runtime room-state class. This session-only change commits REST types and shared payload contracts, not that runtime class: it requires the `@colyseus/schema` dependency planned with the Colyseus client. The downloaded room-state artifact is kept locally under ignored `odd/contracts/`; no generated content was hand-edited.

Refresh rotates both credentials. The session retains its original expiry. The published contract allows recently rotated refresh credentials within `REFRESH_REUSE_GRACE` (default 30 seconds); reuse beyond this window revokes the session. Invalid refresh credentials return the same generic `401`, with no distinct reuse error. Frontend renewal must still be single-flight.

## Delivery status

Contract investigation is complete. Client lifecycle implementation and functional verification are pending; generated contracts and passing mocks alone do not prove live backend integration.

See [authentication rules](../rules/authentication-and-session.md), [API contracts](../rules/api-contracts.md) and [quality requirements](../rules/quality-and-testing.md).
