# Per-Activity Query Forum Tab (#52)

Students (`participate_activities`) and teaching staff (`publish_content`) ask
and answer questions inside each activity's `Foro de consultas` tab on
`/classrooms/:classroomId/activities/:activityId` (`ActivityDetailRoute` /
`ActivityForumPanel`). Parents and unauthorized callers never see the forum tab
and never trigger forum requests.

## Contract and domain boundaries

All requests target the generated OpenAPI contract (`src/api/schema.generated.ts`,
backend `#39`):

- `GET /classrooms/{id}/activities/{activityId}/forum/threads` — paginated
  threads (`page`, `pageSize`, `sort`: `-createdAt` newest-first default or
  `createdAt`).
- `POST /classrooms/{id}/activities/{activityId}/forum/threads` — opens a new
  thread (`{ body }`).
- `GET /classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts`
  — paginated replies (`sort`: `createdAt` chronological default or
  `-createdAt`).
- `POST /classrooms/{id}/activities/{activityId}/forum/threads/{threadId}/posts`
  — posts a reply (`{ body }`).
- `GET /classrooms/{id}/members` — optional directory lookup (when
  `list_directory` is granted) to label `authorId` with `displayName` and
  `Docente` / `Estudiante` badges, degrading cleanly to `Vos` or a neutral label
  without guessing roles when absent.

Client-side rules (`src/features/classrooms/activities/forum/`):

- **Validation (`forum-schema.ts`)**: jitless Zod (`z.config({ jitless: true })`)
  matching backend `ForumBody()` rules — preserves multiline newlines/tabs,
  rejects disallowed control chars and blank input, and enforces trimmed length
  `1..2000`.
- **Plain-text safety**: thread previews, post bodies, and author names render
  strictly as React text nodes (`whitespace-pre-wrap break-words`), never
  `dangerouslySetInnerHTML`.
- **No untracked optimistic posts**: composes use `useProtectedSubmit` (blocking
  double submits), preserve draft text on any error, never render pending or
  rejected posts as confirmed history, and reconcile forum queries (`403`/`404`
  - `5xx`/network/malformed `2xx` via `isUncertainForumWriteError`) before
    retrying.

## UI evidence

Playwright captures (`e2e/activity-forum.spec.ts`, synthetic API responses) at
desktop (`1280px`) and mobile (`360px`):

- Forum thread list & new-thread composer:
  [1280px](./assets/forum/threads-1280.png) and
  [360px](./assets/forum/threads-360.png).
- Thread conversation & teacher reply:
  [1280px](./assets/forum/thread-detail-1280.png) and
  [360px](./assets/forum/thread-detail-360.png).

See [classroom activities](./classroom-activities.md),
[threat model](./threat-model.md), and
[communication rules](../rules/communication-and-notifications.md).
