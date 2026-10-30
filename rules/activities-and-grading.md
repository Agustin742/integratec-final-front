# Activities and Grading (Interface)

Students must be able to see, submit, and learn the outcome of authorized activities, and teachers must be able to create, review, and grade them comfortably, while everyone retains their input, understands write outcomes, and keeps the classroom context.

## Authority and scope

- [Master §2.3](../master-document.md#23-herramientas-del-profesor), [§2.4](../master-document.md#24-funciones-del-alumno), and [§2.6](../master-document.md#26-actividades-y-calificaciones) define activities (homework/practical work "TP" and exam), formats (file submission and multiple choice), review, grades, weighted points, and the activity metric.
- [Master §2.10](../master-document.md#210-objetos-y-elementos-interactuables) makes the teacher desk, student desk, shelf, and report card illustrative entry points, not exclusive access mechanisms; [§2.9](../master-document.md#29-modo-3d-y-modo-2d-clásico) requires the classic 2D mode to offer the same functions.
- [Master §6.2](../master-document.md#62-canales-y-propiedad-de-los-datos) assigns persistent changes to NestJS/PostgreSQL and the subsequent live notification to Colyseus.
- [Master §9.1](../master-document.md#91-mvp-núcleo) and §10, R5, require persisted activity CRUD with review, grades, and points in the production journey.
- The backend rule *Activities and grading* owns validation, grading, and the grade-to-points conversion; *Points and shop* ([here](./points-and-shop.md)) owns the points display. [Security](./security.md) and [Quality and testing](./quality-and-testing.md) supply the common validation, feedback, and evidence requirements.
- These rules define observable invariants, not a selected activity schema, point weights, or concurrency protocol. Decided: grades use a 0-100 scale, and resubmission is configured by the teacher per activity.

## Responsibilities

| Owner | Responsibility |
|---|---|
| NestJS / PostgreSQL | Authorize access, validate, persist activities, submissions, and grades; grade multiple choice; convert grades to points |
| Frontend activity feature | Render lists, forms, the review screen, and results; retain safe drafts; reconcile confirmed results |
| Colyseus | Notify authorized active clients after confirmed changes; not a competing activity database |
| Backend bot tools | Read-only access to the user's own accessible activities; never create, grade, or submit |

- Each read and mutation **MUST** enforce the classroom boundary server-side, including access through manipulated identifiers.
- Open desks, board panels, a cached list, classroom visibility, or session presence **MUST NOT** confer authority over an activity.
- A client **MUST NOT** supply or derive the score, the points, the correct answers, or the state of a submission; it displays what the server confirms.
- Records **MUST** survive reloads and server restarts; drafts and optimistic items are not persistence evidence.
- Rejected changes **MUST NOT** be shown as saved. The interface **MUST NOT** write movement or presence into the activity data as a side effect of using a desk.

## Teacher interface: creating and publishing

- Teacher-level users (the classroom's teacher, or the school Owner or Admin) **MUST** be able to create, edit, publish, and delete activities of the classrooms they have authority over. Students and parents **MUST NOT** see unpublished activities.
- The creation form **MUST** make the activity **type** (TP or exam) and **format** (file submission or multiple choice) explicit and independent, validated against the closed sets of the agreed contract.
- A multiple-choice builder **MUST** let the teacher define questions and options and mark the correct ones; correct answers **MUST NOT** appear in any student-facing view or response while an attempt is open.
- Title, description, due date, and exam window **MUST** follow limits from an agreed contract, not placeholder examples. Dates follow [Data and time](./data-and-time.md): a date-only deadline **MUST NOT** shift when the browser timezone changes.
- Exam fields (start and end or duration) are displayed from server values; whether an exam is in progress is decided by the server, not by the browser clock.
- Editing a published activity that already has submissions, and deleting one with submissions, are open. Until decided, the interface **MUST NOT** offer deletion when the server refuses it, and **MUST** explain the refusal.
- Deletion confirmation, undo, and recovery behavior are not selected by the CRUD commitment.

## Teacher interface: review and grading

- The review screen **MUST** list submissions of the classroom's activities with a stable order, filters by activity and state, and pagination, scoped to the classrooms the teacher has authority over.
- It **MUST** show for each student the work as completed or pending, so the teacher sees what each student did (master §2.3), alongside the activity-level metric ([Activity-level metric](#activity-level-metric)).
- Opening a file submission **MUST** use access issued by the server after authorization (for example a short-lived link); the interface **MUST NOT** build public file URLs.
- Entering a grade **MUST** validate input locally for usability against the 0-100 grade scale while the server remains authoritative over the bounds; a rejected grade **MUST** keep the entered value and explain the rejection.
- Multiple-choice submissions are graded automatically by the server; the interface shows the result and **MUST NOT** let the browser submit a computed score. Whether the teacher may override an automatic grade is open.
- After a grade is saved the interface **MUST** show the confirmed grade and the resulting points as returned by the server, never as a locally computed value. A regrade **MUST** be presented as an update of the same grade.
- Bulk grading, if offered, **MUST** report each result independently and show partial failures; it **MUST NOT** present the whole batch as saved when some grades were rejected.
- Using the review tools **SHOULD** preserve the classroom context rather than force an unrelated navigation reset; the review screen **MUST** be reachable from the 2D mode as well as from the desk in the 3D world.

## Student interface

- Students **MUST** be able to see their pending activities, uploaded material, and grades, in the 3D world (for example the student desk, shelf, and report card) and in the 2D mode, with the same data and checks.
- The visible state of the student's work is **pending**, **submitted**, or **graded**, as derived by the server from the Submission and Grade records; the interface **MUST NOT** keep a separate local state that can disagree with it.
- File submission **MUST** show the selected file, validation errors (type, size, count) from the agreed contract, upload progress, and the confirmed result. A pending upload **MUST NOT** be presented as submitted.
- A submission **MUST** be guarded against accidental duplication; a timeout **MUST NOT** be treated as proof that the submission failed. Reconcile the outcome before offering a resubmission. Whether resubmission is allowed is configured by the teacher per activity (decided): the activity form **MUST** let teacher-level users set it, and the student interface **MUST** offer resubmission only when the server says it is allowed.
- A multiple-choice attempt **MUST** keep selected answers across a recoverable failure and submit them in the format the contract defines. Number of attempts and partial credit are open.
- After grading, the student sees the grade, the points awarded, and updates to the balance as confirmed by the server ([Points and shop](./points-and-shop.md)).
- A student **MUST NOT** see other students' submissions or grades.

### Exams

- While an exam is in progress, the interface **MUST** make that visible and **MUST** show the AI bot as unavailable with a clear non-technical message; the decision comes from the server, which checks it on every bot request ([AI bot and daily briefing](./ai-bot-and-daily-briefing.md)).
- A submission after the exam window is rejected or flagged as late according to a recorded decision (open); the interface **MUST** show the server outcome, not assume one.
- Whether an exam targets the whole classroom or selected students is open; the interface **MUST NOT** assume either.

## Parent interface

- A parent sees the grades of linked children and the status notifications about them, without submissions or unpublished activities ([Classrooms and roles](./classrooms-and-roles.md)).
- Grades **MUST** be shown with the child they belong to and the activity they refer to, as published by the teacher.

## Activity-level metric

- The activity level (connected time, submissions, participation) is computed by the server. The teacher interface shows the raw values the server exposes alongside any combined level; the combining formula is open.
- A student sees only their own metric; a parent only the linked child's; staff the students of classrooms they have authority over.
- The client **MUST NOT** report its own connected time as the metric.

## Input, dates, and validation

- Client validation **MUST** support usability; server validation **MUST** enforce integrity independently ([Forms and validation](./forms-and-validation.md)).
- Forms **MUST** expose field or form-level validation errors and preserve safe editable input after rejection.
- Field requirements, lengths, and date constraints **MUST** follow an agreed contract, not placeholder examples; grades use the 0-100 scale.
- Invalid or missing dates **MUST NOT** be silently converted into a misleading deadline.
- The daily review timezone **MUST NOT** silently become the scheduling timezone for activities.

## Pending writes and recovery

- Create, edit, publish, delete, submit, and grade operations **MUST** visibly distinguish pending work from confirmed results.
- Repeated activation during a pending submission **MUST** be guarded against accidental duplicates.
- Safe editable input **MUST** remain available after validation or transport failure within the authorized context.
- Preserving a draft **MUST NOT** retain inaccessible private content after logout, account switch, or lost access.
- Automatic retries **MUST** be bounded and safe against duplicate effects; optimistic changes **MUST** reconcile rejected outcomes. No retry count or conflict algorithm is selected here.
- Confirmed changes **MUST** update affected views through an explicit reconciliation strategy; live notifications **MUST NOT** claim a change the backend rejected.
- Two clients grading or submitting the same record **MUST** each show confirmed or unresolved outcomes honestly; a losing request **MUST** learn that it was not applied, and concurrent edits **MUST NOT** be described as safely merged unless the contract defines it.
- Late responses after a classroom or account switch **MUST NOT** populate the wrong context.

## Normal, failure, and boundary scenarios

| Scenario | Required observable result |
|---|---|
| Teacher publishes an activity | Confirmation appears; students see it, and it remains after reload |
| Student submits a file, then reloads | The submission is shown as submitted from server data |
| Submission times out after reaching the backend | Outcome is unresolved until reconciled, not blindly resubmitted |
| Teacher grades a submission | The confirmed grade and points appear; the student is notified after the commit |
| Grade is rejected by the server | The entered value is kept and the reason is visible |
| Student opens the bot during an exam | The bot is shown as unavailable with a clear message |
| Student reads another student's submission by guessing an identifier | No protected data is shown |
| Parent opens a child's grades | Only the linked child's published grades are shown |
| Late response arrives after switching classrooms or accounts | It cannot populate the wrong context |
| Date is displayed in another browser timezone | The original date/instant meaning is preserved |

## Correct and incorrect examples

**Correct:** A grade is marked pending; after server confirmation, the review list, the student's report card, and the points balance reflect the saved state. On rejection the entered value remains and the error is understandable.

**Incorrect:** The review screen adds up weighted points in the browser and shows them as saved while the server holds a different value.

**Correct:** The 2D mode and the student desk show the same pending activities from the same endpoint.

**Incorrect:** An example silently mandates point weights or a late-submission policy.

## Observable acceptance checks

These checks guide implementation evidence under [Quality and testing](./quality-and-testing.md); this document does not certify a running feature.

- [ ] Authorized create/read/update/delete of activities succeed and persist after reload and restart.
- [ ] Students and parents do not see unpublished activities; students do not see other students' submissions or correct answers.
- [ ] Submission, review, and grading flows show pending, confirmed, rejected, and uncertain outcomes distinctly.
- [ ] Grades and points shown always come from the server; the client never supplies a score.
- [ ] Review list is paginated, filterable, and scoped to the teacher's authority; the 2D mode offers the same review.
- [ ] Validation failure preserves safe input; pending submission does not create duplicates.
- [ ] Exam in progress shows the bot as unavailable; the decision is server-side.
- [ ] Dates follow the agreed semantics and reject invalid inputs.
- [ ] Direct unauthorized CRUD, submission, or grade attempts and foreign-ID requests leave persistent state unchanged.
- [ ] Contextual panels retain usable classroom context and follow the accessible alternative of master §3.2.
- [ ] [Art direction](./art-direction.md) remains the sole visual target; no renderer, palette, proportions, or asset format is selected here.

## Open decisions — not implementation defaults

- Field limits; point weights per type (deferred to implementation).
- Number of attempts, late submission, and partial credit.
- Whether exams target the whole classroom or selected students, and how the exam window is defined.
- Editing or deleting an activity that already has submissions; whether the teacher may override an automatic grade.
- Activity-metric formula and aggregation interval.
- File limits and scanning; deletion confirmation and undo.
- Concurrency/conflict handling, mutation deduplication, and live reconciliation details.
- Cross-repository contract distribution remains unresolved; examples are not published API contracts.
