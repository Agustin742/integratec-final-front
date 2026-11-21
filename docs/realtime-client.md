# Colyseus Realtime Client Wrapper

The realtime client layer (`src/realtime/`) provides one lifecycle-safe Colyseus connection boundary for classroom presence, movement, chat, and live tools (`#23`). It builds strictly on backend-generated contracts synced via `pnpm api:sync` (`FD7`), public configuration (`F05`), and session token lifecycle (`F08`).

## Synced Contracts and Ownership

- `src/realtime/contracts.generated.ts`: `CLASSROOM_ROOM_NAME`, `ClassroomJoinOptions`, close codes (`4001`, `4002`, `4100`), `avatarInputSchema`, and shared constants synced from `packages/contracts/src/index.ts`.
- `src/realtime/room-state.generated.ts`: `ClassroomState` synced from `packages/contracts/src/realtime/generated/ClassroomState.ts`.
- `src/realtime/avatar.generated.ts`: `Avatar` schema synced from `packages/contracts/src/realtime/generated/Avatar.ts`.
- **No hand-written contract drift:** Schema files are regenerated via `pnpm api:sync` (`rules/api-contracts.md`, `rules/realtime-and-presence.md`).

## Join Credential & F08 Refresh (`FD3`, `TM-015`)

- `createClassroomRealtimeClient` reads `realtimeUrl` from `getPublicConfig().realtimeUrl` (`F05`).
- The access token from `SessionController.getAccessToken()` is assigned to `client.auth.token` (sent by the Colyseus SDK as `Authorization: Bearer <token>` on matchmaking) and **never** placed in `joinOrCreate` options or URLs. Join options carry only `{ classroomId }`.
- When a join fails with HTTP `401` / unauthorized, the client refreshes the token once via `SessionController.refreshAccessToken()` (`F08`) and retries `joinOrCreate` **at most once**. Failures with `4001` (`access_revoked`), `4002` (`too_many_connections`), or `403` never trigger token refresh.

## Connection State Machine & Honest Presence (`TM-016`, `TM-017`)

| Status         | `presenceUncertain` | Cause                                                                                                  |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| `connecting`   | `true`              | Initial `joinOrCreate` in flight.                                                                      |
| `connected`    | `false`             | Authoritative `ClassroomState` attached.                                                               |
| `reconnecting` | `true`              | Unexpected socket drop (`onDrop`); attempting Colyseus `reconnect(reconnectionToken)`.                 |
| `rejected`     | `true`              | Admission refused (`401`, `403`, `4002` `too_many_connections`, or invalid classroom).                 |
| `lost-access`  | `true`              | Live eviction or denied reconnect (`4001` `access_revoked`).                                           |
| `disconnected` | `true`              | Clean leave (`1000`), logout, classroom switch, network error, or `4100` (`verification_unavailable`). |

- Incoming messages are filtered by `type`, active `classroomId`, seen `eventId` deduplication, monotonic `seq`, and caller Zod schemas; unknown or malformed messages are ignored safely.
- Outgoing movement intents (`sendAvatarInput`) validate against jitless `avatarInputSchema` and only send while `status === 'connected'`.
- `useClassroomRealtime` (`src/realtime/use-classroom-realtime.ts`) scopes one connection to `(sessionUserId, classroomId, enabled)` and disposes rooms and listeners synchronously on StrictMode double-mounts, classroom switches, and `SessionController` logout cleanup (`registerCleanup`). When mounted under `ClassroomRealtimeProvider` without custom test client/URL overrides, it acquires a shared lease from `ClassroomRealtimeManager` so the 3D classroom workspace (`#37`) and classroom chat (`#51`) share one connection per classroom without consuming duplicate per-user connection slots.
- `ClassroomRealtimeProvider` / `createClassroomRealtimeManager` (`src/realtime/classroom-realtime-*`) are the app-level owner for classroom realtime subscriptions (3D presence and classroom chat, see [classroom workspace](./classroom-workspace.md#real-time-classroom-presence-and-remote-avatars-37) and [chat guide](./ui-chat.md#live-messages)): at most one connection per classroom shared by ref-counted subscribers, capped at `MAX_CONNECTIONS_PER_USER`, closed shortly after the last release, with backoff retry for transient failures. Joining the room registers the user's avatar and connected time on the server, so open connections only while a subscriber needs them.
- `RealtimeSnapshot` exposes `controls` (`chatMuted`, `collaborationLocked`, `gamesDisabled`, `frozen`) and optional per-participant `avatar` appearance extracted safely from room state when present, resetting to `{ frozen: false }` whenever the connection is not `connected`.
