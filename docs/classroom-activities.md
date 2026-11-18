# Classroom activities panel and teacher editor

The `activities` panel entry of the [classroom workspace](./classroom-panels.md)
now renders a real product component: teachers create, edit and publish TP and
Exam activities, including a multiple-choice question builder
([#39](https://github.com/Agustin742/integratec-final-front/issues/39),
`HU-ACT-001` part 1/2). Students see published activities only, read-only.
The component, schemas and services live in
`src/features/classrooms/activities/`; the endpoints are generated from the
committed backend OpenAPI contract in `src/api/schema.generated.ts`.

## Entry points

The panel is registered once in the production catalog
(`src/features/classrooms/panels/classroom-panel-catalog.tsx`, key `activities`)
and is opened through the shared panel controller, so the 2D workspace controls
and the future 3D teacher desk open the same component with the same focus
behavior. The protected 2D URL intent
`/classrooms/:classroomId/panels/activities` deep-links the panel through
`src/features/classrooms/classroom-panel-route.tsx`. Opening still follows the
server-confirmed `availablePanels` visibility described in the
[panel integration](./classroom-panels.md#caller-contract); this visibility never
grants action authorization, which stays on the server.

## Role and capability behavior

- **Staff with the `publish_content` capability** see drafts and published
  activities, the DRAFT/PUBLISHED state filter, and the create, edit, publish
  and deactivate actions. Each action is gated on the capability returned by
  `GET /classrooms/{id}`; the client never maps roles to actions.
- **Students** receive the server's published-only list (the server decides;
  the client does not filter drafts out of a student response) and no teacher
  controls, state filter, or publish affordances. The student view contract
  (`StudentActivityResponseDto`) never contains questions or correct answers.

## Contract endpoints consumed

All five operations come from the generated
`ActivitiesController` contract (`src/api/schema.generated.ts`):

- `GET /classrooms/{id}/activities` — paginated summaries for the list
  (`page`, `pageSize`, `sort`, optional staff `state` filter).
- `POST /classrooms/{id}/activities` — creates a DRAFT activity.
- `GET /classrooms/{id}/activities/{activityId}` — detail for the editor; the
  response shape is role-dependent, and the teacher view is the only one with
  `questions[].options[].isCorrect`.
- `PATCH /classrooms/{id}/activities/{activityId}` — edits a draft.
- `POST /classrooms/{id}/activities/{activityId}/publish` — one-way
  DRAFT → PUBLISHED transition.
- `DELETE /classrooms/{id}/activities/{activityId}` — logical deactivation.

The create/edit form follows the contract DTOs rather than assumed field
limits: `type` (`TP`/`EXAM`), `format` (`FILE`/`MULTIPLE_CHOICE`, immutable
after creation), `title`, `description`, EXAM-only `opensAt` strictly before
`dueAt`, `dueAt` (ISO instant with offset), `allowLate`, `maxScore`,
`weightMultiplier` (≤ 2 decimals), and `questions` — required for
multiple-choice activities, forbidden for file activities, with exactly one
correct option per question enforced per question in the builder.

List and detail responses are validated with jitless Zod schemas before
rendering. Writes separate confirmed rejections (`400`/`403`/`404`/`409`) from
outcome-uncertain failures (network, `5xx`, malformed `2xx`): confirmed
rejections show a translated message, while uncertain outcomes trigger list
reconciliation instead of a blind retry, following
[error handling](../rules/error-handling-and-feedback.md). Caching is scoped
through user- and classroom-scoped query keys and predicates in
`src/api/query-keys.ts`; MSW handlers generated from the same contract cover
success and `400`/`403`/`404`/`409` failures in component tests.

## School-timezone deadlines (FD11)

Teachers enter `dueAt` (and EXAM `opensAt`) as school wall-clock values in the
`datetime-local` input, pinned to the classroom's server-reported IANA time
zone (`America/Argentina/Buenos_Aires` by default), never the browser zone
(`src/features/classrooms/activities/activity-school-datetime.ts`). Submit
converts them into unambiguous UTC instants with an explicit offset; the list
and publish confirmation display instants back in the school zone with the
`es-AR` locale and the zone label, so the value shown is exactly the value a
re-submit would send. See [data and time rules](../rules/data-and-time.md).

## Publish is one way

Publishing opens a confirmation that states the one-way DRAFT → PUBLISHED
change and that students will see the activity, with the deadline shown in the
school zone. It is offered after a confirmed save of a draft and from the list.
The server owns the transition: a past `dueAt` or invalid questions answer `400`
(not publishable), an already published activity answers `409`, and the
reconciled list shows the server-confirmed state. The publish action is not
offered again for a published item, and no unpublish exists in the contract.

## Logical deactivation with refusal explanation

The contract's `DELETE` is a logical deactivation, not a row removal, and the
server refuses it when the activity has submissions. The UI follows that rule:
the destructive action opens an inline confirmation that explains deactivation
preserves academic history, and a `409` refusal is surfaced as an explanation
(why the server refused) instead of a silent failure or a fabricated success.
Confirmed `403`/`404` and uncertain outcomes reconcile the list before any
retry.

## Multiple-choice builder boundary

The builder (`src/features/classrooms/activities/multiple-choice-builder.tsx`)
adds, removes and reorders questions and options with buttons only — no drag
dependency — with visible labels on every control and a native radio group per
question for the single-correct rule. Correct answers exist only inside this
teacher-gated dialog: the student view contract has no `isCorrect`, and the
published list summary carries no questions at all.

## Verification boundary

Component tests cover list rendering per role, state filters, pagination,
loading/empty/error/stale states, form validation boundaries (title, dates,
scores, weights, question rules), builder add/remove/reorder interactions,
publish success/failure/uncertain outcomes, and server refusal copy. The
Playwright spec `e2e/teacher-activity-editor.spec.ts` exercises the showcase
build with a synthetic in-test API: a teacher publishes a multiple-choice exam
on desktop and mobile, and a student sees only published activities without
teacher actions. Mock and showcase results are not live-backend proof; the
backend protections (server-side answer isolation, submission-window checks,
notification fan-out) are backend responsibilities. Full local check results
are recorded in the contributor tracker.

## Out of scope

The study material manager (`HU-ACT-001` part 2/2), the grading queue
(`HU-ACT-004`), student submissions, and server-side answer protection and
notification fan-out (backend) are not delivered here. Whether a teacher may
edit a published activity that already has submissions stays a server decision:
the editor never claims an edit succeeded; it shows the server outcome,
including the `409` questions-locked refusal.

## UI evidence

The showcase browser run captures the teacher list with a draft and a
published item at [1280px](./assets/activities/list-1280.png) and
[360px](./assets/activities/list-360.png), the editor with the
multiple-choice builder at [1280px](./assets/activities/editor-1280.png) and
[360px](./assets/activities/editor-360.png), and the one-way publish
confirmation at [1280px](./assets/activities/publish-1280.png) and
[360px](./assets/activities/publish-360.png). All data in the captures is
synthetic; the spec that produces them is `e2e/teacher-activity-editor.spec.ts`.

See [panel integration](./classroom-panels.md),
[classroom workspace](./classroom-workspace.md), and
[activities and grading rules](../rules/activities-and-grading.md).
