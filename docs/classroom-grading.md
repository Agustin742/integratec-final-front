# Teacher Grading Queue and Review (#44)

Teachers and authorized classroom staff (`publish_content`) review student
submissions, inspect attached files via short-lived signed links, record grades
(`0–100`) with written feedback, and perform version-checked regrades from both:

- the classroom `Calificaciones` panel (`grades` in `classroomPanelCatalog`,
  reachable from 2D Classic Mode and `/classrooms/:classroomId/panels/grades`),
  with activity, state, and sort filters plus pagination; and
- the `Revisión docente` tab inside `ActivityDetailPage`
  (`/classrooms/:classroomId/activities/:activityId`), pre-scoped to the
  current activity.

Students and linked parents never see teacher grading controls and never trigger
staff submission requests; opening `Calificaciones` without `publish_content`
shows the honest pending placeholder until the student/parent report card lands.

## Contract and domain boundaries

All requests target the generated OpenAPI contract (`src/api/schema.generated.ts`,
backend decision D18 / `#32`):

- `GET /classrooms/{id}/submissions` — paginated staff queue filterable by
  `activityId`, `state` (`submitted` | `graded`), and `sort`
  (`submittedAt`, `-submittedAt`, `gradedAt`, `-gradedAt`).
- `GET /submissions/{submissionId}` — submission metadata and short-lived signed
  download URLs (`Cache-Control: no-store`). URLs are validated as `http:` or
  `https:`, never persisted or logged, fetched with `staleTime: 0` and
  `gcTime: 0`, evicted on dialog unmount, and refreshable via **Renovar enlaces**.
- `GET /submissions/{submissionId}/grade` — fetches the authoritative grade and
  optimistic `version` for `409` conflict recovery and uncertain-write
  reconciliation.
- `POST /submissions/{submissionId}/grade` — initial grade (`{ score, feedback }`).
- `PATCH /submissions/{submissionId}/grade` — optimistic-concurrency regrade
  (`{ score, feedback, version }`).

Client-side jitless Zod validation (`src/features/classrooms/grading/grading-schema.ts`)
enforces integer scores in `0–100` (respecting `activity.maxScore` on initial
grades and score changes) and mirrors backend `@VisibleText` rules on `feedback`
(`1–5000` trimmed characters, rejecting control characters and line breaks).
Weighted points are never computed locally: the UI displays only server-confirmed
`score` and `pointsAwarded`, and regrade mode explicitly states that the server
creates a compensating points ledger adjustment without overwriting the original
entry.

## Concurrency, uncertain writes, and access isolation

- **`409 CONFLICT` (`field: 'version'`)**: preserves the teacher's typed draft
  and offers **Cargar versión actual** to fetch the latest server version before
  retrying.
- **`409 CONFLICT` (`field: 'submission' | 'activity'`)**: reconciles classroom
  grading queries and explains already-graded, inactive-student, or non-file
  activity refusals.
- **Uncertain writes (`5xx`, network error, malformed `2xx`)**: tracked via a
  single `WeakSet` (`isUncertainGradingWriteError`); drafts are preserved without
  claiming success and reconciled against `GET /submissions/{submissionId}/grade`
  and the queue before offering a retry.
- **Terminal `403`/`404` & live SSE revocation**: clears inactive cached queue
  pages, invalidates `classroomDetailQueryKey` at most once per error instance
  (preventing active-query refetch loops), evicts cached private grading entries
  on role demotion/unmount, and isolates foreign classroom/submission `404`s.

## UI evidence

Playwright captures (`e2e/teacher-grading.spec.ts`, synthetic API responses) at
desktop (`1280px`) and mobile (`360px`):

- Grading queue: [1280px](./assets/grading/queue-1280.png) and
  [360px](./assets/grading/queue-360.png).
- Submission viewer & grading dialog: [1280px](./assets/grading/review-1280.png)
  and [360px](./assets/grading/review-360.png).

See [classroom panels](./classroom-panels.md),
[classroom activities](./classroom-activities.md),
[threat model](./threat-model.md), and
[activities and grading rules](../rules/activities-and-grading.md).
