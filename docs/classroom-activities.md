# Classroom activities panel and teacher editor

The `activities` panel entry of the [classroom workspace](./classroom-panels.md)
renders the unified `ActivitiesPanel` component combining the student/staff
activity inbox and detail navigation
([`#41`](https://github.com/Agustin742/integratec-final-front/issues/41)) with
the teacher activity editor, multiple-choice builder, one-way publish flow, and
logical deactivation
([`#39`](https://github.com/Agustin742/integratec-final-front/issues/39),
`HU-ACT-001` part 1/2). Students see published activities only, read-only, with
links to `ActivityDetailPage`. The components, schemas, messages, and services
live in `src/features/classrooms/activities/`; the endpoints are generated from
the committed backend OpenAPI contract in `src/api/schema.generated.ts`.

## Entry points

The unified `ActivitiesPanel` is registered once in the production catalog
(`src/features/classrooms/panels/classroom-panel-catalog.tsx`, key `activities`)
and is opened through the shared panel controller, so the 2D workspace controls
and the future 3D teacher desk open the same component with the same focus
behavior. The protected 2D URL intent
`/classrooms/:classroomId/panels/activities` deep-links the panel through
`src/features/classrooms/classroom-panel-route.tsx`, and each list item links
to `/classrooms/:classroomId/activities/:activityId` (`ActivityDetailPage`).
Opening still follows the server-confirmed `availablePanels` visibility
described in the [panel integration](./classroom-panels.md#caller-contract);
this visibility never grants action authorization, which stays on the server.

## Role and capability behavior

- **Staff with the `publish_content` capability** see drafts and published
  activities, the DRAFT/PUBLISHED state filter, and the create, edit, publish
  (drafts only), and deactivate actions alongside `Ver actividad` detail links.
  Each action is gated on the capability returned by `GET /classrooms/{id}`;
  the client never maps roles to actions.
- **Students** receive the server's published-only list (the server decides;
  the client does not filter drafts out of a student response) with sort,
  pagination, and `Ver actividad` detail links, and no teacher controls, state
  filter, or publish affordances. The student detail view contract
  (`StudentActivityResponseDto`) includes questions and options without
  `isCorrect` (never exposing correct answers), while list summaries carry no
  questions at all.
- **Parents** are denied access by the server (`403`) and see a non-disclosing
  forbidden state without activity data.

## Contract endpoints consumed

All six operations come from the generated `ActivitiesController` contract
(`src/api/schema.generated.ts`):

- `GET /classrooms/{id}/activities` — paginated summaries for the list
  (`page`, `pageSize`, `sort`, optional staff `state` filter).
- `POST /classrooms/{id}/activities` — creates a DRAFT activity.
- `GET /classrooms/{id}/activities/{activityId}` — detail for `ActivityDetailPage`
  and the teacher editor; the response shape is role-dependent, and the teacher
  view (`TeacherActivityResponseDto`) is the only one with `createdById` and
  `questions[].options[].isCorrect`.
- `PATCH /classrooms/{id}/activities/{activityId}` — edits an activity; `PATCH`
  omits `questions` when unchanged so metadata edits on published activities
  that already have submissions do not trigger unnecessary `409 Conflict`
  refusals.
- `POST /classrooms/{id}/activities/{activityId}/publish` — one-way
  DRAFT → PUBLISHED transition.
- `DELETE /classrooms/{id}/activities/{activityId}` — logical deactivation.

The create/edit form enforces the contract DTO invariants and backend bounds
(`ACTIVITY_LIMITS` in `activity-schema.ts`): `type` (`TP`/`EXAM`), `format`
(`FILE`/`MULTIPLE_CHOICE`, immutable after creation), `title` (`1..120` chars),
multiline `description` (`<= 5000` chars), EXAM-only `opensAt` strictly before
`dueAt`, `dueAt` (strict ISO-8601 instant with offset), `allowLate`, `maxScore`
(integer `0..100`), `weightMultiplier` (`0.5..3` with `<= 2` decimal places),
and `questions` (`1..50` required for `MULTIPLE_CHOICE`, forbidden for `FILE`,
each with `2..6` options and exactly one `isCorrect: true`).

List and detail responses are validated with jitless Zod schemas before
rendering (`activityDetailDtoSchema` union preserves `createdById` and
`isCorrect` for staff while stripping them for students). Writes separate
confirmed rejections (`400`/`403`/`404`/`409`) from outcome-uncertain failures
(network, `5xx`, malformed `2xx` tracked via `isUncertainActivityWriteError` /
`isUncertainWriteError`): confirmed rejections show a translated `es-AR`
message, while `403`/`404`/`409` and uncertain outcomes trigger scoped query
invalidation (`createClassroomActivitiesPredicate`, covering both list and
detail queries) before any retry, following
[error handling](../rules/error-handling-and-feedback.md).

## School-timezone deadlines (FD11)

Teachers enter `dueAt` (and EXAM `opensAt`) as school wall-clock values in the
`datetime-local` input, pinned to the classroom's server-reported IANA time
zone (`America/Argentina/Buenos_Aires` by default, with safe fallback via
`resolveSchoolTimeZone` on empty/unknown zones), never the browser zone
(`src/features/classrooms/activities/activity-school-datetime.ts`). Submit
converts them into unambiguous UTC instants with an explicit offset, rejecting
impossible calendar dates and DST gaps; `ActivitiesPanel`, `ActivityDetailPage`,
and `PublishActivityDialog` display instants back in the school zone with the
`es-AR` locale and explicit IANA timezone indicator via
`formatActivityDeadline`, so the value shown matches what a re-submit sends.
See [data and time rules](../rules/data-and-time.md).

## Publish is one way

Publishing opens `PublishActivityDialog`, which states the one-way
DRAFT → PUBLISHED change, explains that students will see the activity
immediately, and shows the deadline in the school time zone. It is offered
after a confirmed save of a draft and from the list. The server owns the
transition: any `400` (including backend `400 VALIDATION_FAILED` with field
`details` for past `dueAt` or invalid questions) maps to
`publishNotPublishable`, `409` maps to `publishAlreadyPublished`, and
`403`/`404`/`409`/uncertain failures reconcile all classroom activity queries.
The publish action is not offered again for a published item, and no unpublish
exists in the contract.

## Logical deactivation with refusal explanation

The contract's `DELETE` is a logical deactivation, not a row removal, and the
server refuses it when the activity has submissions. The UI follows that rule:
the destructive action opens an inline confirmation that explains deactivation
preserves academic history, and a `409` refusal is surfaced as an explanation
instead of a silent failure or a fabricated success. Confirmed `403`/`404`/`409`
and uncertain outcomes reconcile the list before any retry.

## Multiple-choice builder boundary

The builder (`src/features/classrooms/activities/multiple-choice-builder.tsx`)
adds, removes, and reorders questions and options with `>= 44×44px` buttons only
— no drag dependency — with visible labels on every control and a native radio
group per question for the single-correct rule. Correct answers exist only
inside this teacher-gated dialog and staff detail view: the student view
contract has no `isCorrect`, and list summaries carry no questions at all.

## Verification boundary

Unit and component tests cover list/detail rendering per role, sort and state
filters, pagination and out-of-range recovery, loading/empty/error/stale states,
terminal `403`/`404` non-looping cache cleanup, SSE live revocation, contract
validation bounds (`maxScore`, `weightMultiplier`, `questions`, `options`,
strict ISO-offset instants, DST gaps, invalid time zone fallbacks), conditional
`PATCH` `questions` omission, builder add/remove/reorder interactions, publish
success/400 `VALIDATION_FAILED`/409/404/403/uncertain reconciliation, and
deactivation refusal copy. The Playwright specs `e2e/teacher-activity-editor.spec.ts`
and `e2e/activities-inbox.spec.ts` exercise the showcase build with synthetic
API responses across desktop (`1280px`) and mobile (`360px`). Mock and showcase
results are not live-backend proof; backend protections (server-side answer
isolation, submission-window checks, notification fan-out) remain backend
responsibilities. Full local check results are recorded in the contributor
trackers.

## Out of scope

The study material manager (`HU-ACT-001` part 2/2, delivered in `#40`), the
teacher grading queue and form (`HU-ACT-004`, delivered separately in `#44` — see
[classroom grading](./classroom-grading.md) — and wired into the default
`Revisión docente` tab of `ActivityDetailPage`), student submissions (`back#29`),
and server-side answer protection and notification fan-out (backend) are outside
`#39`/`#41`.
Whether a teacher may edit a published activity that already has submissions
stays a server decision: the editor never claims an edit succeeded and surfaces
the server outcome, including the `409` questions-locked refusal.

## UI evidence

The showcase browser run captures the teacher list with a draft and a
published item at [1280px](./assets/activities/list-1280.png) and
[360px](./assets/activities/list-360.png), the editor with the
multiple-choice builder at [1280px](./assets/activities/editor-1280.png) and
[360px](./assets/activities/editor-360.png), and the one-way publish
confirmation at [1280px](./assets/activities/publish-1280.png) and
[360px](./assets/activities/publish-360.png), alongside the `#41` inbox captures
at [1280px](./assets/classrooms/activities-inbox-1280.png) and
[360px](./assets/classrooms/activities-inbox-360.png). All data in the captures
is synthetic; the specs that produce them are
`e2e/teacher-activity-editor.spec.ts` and `e2e/activities-inbox.spec.ts`.

See [panel integration](./classroom-panels.md),
[classroom workspace](./classroom-workspace.md), and
[activities and grading rules](../rules/activities-and-grading.md).
