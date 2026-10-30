# Authorized AI Study Guide and Daily Review

The bot MUST guide a user through the material the teacher approved, and present a daily review on that user's first authenticated connection of each Argentina calendar day (every role except Parent), without inventing access, solving activities, or making unsolicited changes.

## Authority and scope

- [Master §4](../master-document.md#4-bot-con-inteligencia-artificial) establishes the bot as a study guide with RAG over teacher-approved material, the exam block, the anti-cheat rule, and the daily review; [§4.1](../master-document.md#41-repaso-diario-en-la-primera-conexión) defines the daily identity and optional provider-outage fallback; [§4.2](../master-document.md#42-integración-y-seguridad) defines integration and security.
- [Master §5–6](../master-document.md#5-stack-y-responsabilidades-técnicas) assigns inference, retrieval, and tools to NestJS, persistence to PostgreSQL, and live classroom state to Colyseus. §7.3 describes the end-to-end daily flow.
- [Master §2.10](../master-document.md#210-objetos-y-elementos-interactuables) lists the tutor bot as an in-world interactable, separate from the classroom pet; [§2.9](../master-document.md#29-modo-3d-y-modo-2d-clásico) requires it to be reachable from the 2D mode.
- The backend rule *AI bot and daily review* owns retrieval, the exam block decision, guardrails, daily arbitration, and usage limits. [Security](./security.md) governs identity, resource isolation, secrets, and safe errors. [Quality and testing](./quality-and-testing.md) governs verification.
- The rendering technology is Three.js with React Three Fiber ([3D world and camera](./3d-world-and-camera.md)). [Art direction](./art-direction.md) is the agreed visual target.
- This rule defines observable domain constraints, not an API schema, delivery state machine, model selection, or a claim of implemented behavior.

## The bot and the classroom pet are separate

- The bot is its own **in-world tutor character**, also reachable from the classic 2D mode. It has a conversation interface and a study-guide role.
- The classroom pet is a motivational element with accessories and **no conversation** ([Points and shop](./points-and-shop.md)). The bot and the pet **MUST NOT** be linked, share an object, a panel, a visual identity, or state, and **MUST NOT** be presented as the same character.
- The interface **MUST** provide the bot entry in both modes with the same endpoints and checks; the 2D entry is not a reduced bot.

## Ownership

| Concern | Responsible authority | Boundary |
|---|---|---|
| Identity and resource access | NestJS and business services | Neither the model nor a browser store grants permissions. |
| Allowed material (approved by the teacher) | NestJS (BotConfig / allowed material) | The client only displays and, for staff, edits the configuration it is authorized to. |
| Exam block decision | NestJS, from persisted exam state and server time | The client displays unavailability; it does not decide it. |
| Daily eligibility and duplicate prevention | NestJS with persistent PostgreSQL records | Browser memory and a Colyseus session are not daily records. |
| Context selection, retrieval, and tool execution | NestJS | Bedrock output is a proposal, not an authorized command. |
| Generated wording | Amazon Bedrock invoked by NestJS | Text MUST NOT fabricate successful business effects. |
| Presentation and cleanup | Frontend | Show the active user's result, not a previous account's response. |

Backend owners MUST define persistence and execution contracts; frontend owners MUST implement their public states without claiming client-only enforcement is sufficient.

## Study guide: retrieval, guidance, and anti-cheat

- The bot answers from the material the teacher approved for the classroom (RAG). The interface **SHOULD** show the source material when the server returns it and **MUST** present a "not in the approved material" answer as such, never as an error or an invented answer.
- Retrieval technology (candidate: Amazon Bedrock Knowledge Bases or equivalent) is a backend decision pending in `docs/technical-justification.md`; the interface **MUST NOT** depend on it.
- The bot acts as a **guide, not a solver**: it explains, points to material, and asks guiding questions. The interface **MUST NOT** present the bot as a way to obtain answers to activities, and **MUST NOT** render model output as a completed solution of an activity beyond what the server returns.
- The bot has **no write access** in the MVP: it does not create, modify, submit, grade, or delete anything. A request to change data **MUST** result in a pointer to the application, not an apparent success. Autonomous actions with explicit confirmation are an evolution item.
- Model output **MUST** be rendered as text and **MUST NOT** be executed or interpreted as HTML ([Security](./security.md)).
- Usage limits are enforced by the server; the interface **MUST** present a limit rejection as a clear message with bounded retry.

### Teacher configuration of allowed material

- Teacher-level users (the classroom's teacher, or the school Owner or Admin) **MUST** be able to choose which uploaded material the bot may use, per classroom, with no schedule.
- The interface **MUST** show the confirmed set of allowed material and its indexing state when the server reports it (including an indexing failure), and **MUST NOT** show a change as applied before server confirmation.
- Students and parents **MUST NOT** be offered this configuration.

## Exam block

- While an exam is in progress for the student, the bot **MUST** be unavailable: the interface **MUST** disable or replace the bot conversation with a clear, non-technical message, in both the in-world character and the 2D mode.
- The decision is made by the server on every request, including requests started before the exam and long sessions. The interface **MUST NOT** rely on a client clock or a client-held exam flag, and **MUST** handle a server rejection received while the bot looked available.
- An in-flight answer that completes after the exam started **MUST NOT** be shown to the student.
- Teacher-level users are not blocked.
- The daily review content during an exam follows the exam block; what happens to the day's delivery on an exam day is an open decision.

## First authenticated connection and daily identity

- Eligibility MUST be evaluated for an authenticated user, not an anonymous page load or a bot object's visibility.
- The daily review MUST be presented to **every role except Parent**; the interface **MUST NOT** show it to parents.
- The daily identity MUST combine the authenticated user with a calendar date interpreted in `America/Argentina/Buenos_Aires`.
- The server MUST determine that date from authoritative time; browser locale, timezone, clock, or a supplied date MUST NOT override eligibility.
- Two users connecting on the same date MUST have independent eligibility. One user's receipt MUST NOT suppress another's review.
- A classroom change MUST NOT create another daily entitlement: the routine belongs to the user/date, not the classroom, device, tab, or live connection.
- A reload, reconnect, or subsequent authenticated connection on the same date MUST NOT start another independent daily delivery.
- The next local calendar date provides a new daily identity. A rolling elapsed-day interval or a UTC date MUST NOT replace the agreed calendar rule.
- Remaining online across midnight MUST NOT silently become a scheduled-push feature: the trigger is the first authenticated connection of the day.

These constraints preserve the master's once-per-user/day promise across clients and server restarts. They do not define the precise lifecycle event that implements an authenticated connection.

### Persistent atomic duplicate prevention

- The daily record MUST persist beyond reloads, reconnects, and service restarts; `DailyReviewDelivery` is a conceptual entity in master §6.4, not an approved schema here.
- Competing attempts for the same user/date MUST be arbitrated atomically, or by an equivalent persistent mechanism that preserves the same invariant.
- A separate read followed by an unprotected write MUST NOT be treated as concurrency protection: two tabs can both observe an absent record.
- Duplicate detection MUST occur on the server; hiding a second popup or retaining a local flag is not sufficient.
- A losing concurrent attempt MUST NOT independently deliver a second daily review merely because it is a different connection.
- If authoritative eligibility cannot be established, the system MUST NOT guess that no delivery exists and generate an independent duplicate.
- Provider failure or lost delivery acknowledgment MUST NOT be interpreted as permission to bypass the daily identity.

Atomic eligibility does not prove that the user saw a response. The implementation MUST distinguish its actual evidence from an assertion of end-to-end receipt; exact recovery and marking semantics remain open below.

## Authorized content and suggestions

The normal flow is to establish identity and eligibility, obtain authorized current context, optionally generate wording through Bedrock, and present the result in the active user's context.

- For students, context MAY include pending and near-due activities, recent grades and announcements, and review of allowed material; for teachers, pending reviews and classroom activity; always with suggested next steps, as allowed by master §4.1.
- Context MUST be filtered by the user's actual access before it is sent to the model or exposed in a structured result.
- A known classroom identifier, an invitation shown in conversation, or an avatar standing beside an object MUST NOT establish permission to read its resources.
- Summaries of conversations MUST use only classrooms and content the user is authorized to access.
- Missing or denied context MUST NOT be represented as a confirmed empty workload. Empty authorized results and failed retrieval require different feedback.
- Generated suggestions MUST remain suggestions until the user acts through the application.
- The daily review MUST NOT automatically submit activities, change grades, publish messages, or modify any record.
- Generated content MUST NOT be treated as trusted executable input or trusted HTML; the security policy continues to apply.

If context or authorization changes while work is in flight, protected delivery MUST respect current access rather than rely solely on the earlier prompt.

## Server tools and intent authorization

- Bedrock calls, provider credentials, and IAM permissions MUST remain server-side under NestJS; the browser MUST NOT call Bedrock with application credentials.
- Every protected tool invocation MUST validate the user's identity, resource scope, input, and permission in the responsible business service.
- A model-provided user ID, role, classroom ID, or claim of permission MUST NOT override authenticated server context.
- Retrieved messages, material, and model text MUST NOT grant new permissions or authorize additional tools. Content that asks the bot to ignore rules remains untrusted content.
- The tool catalog is limited to read operations over the user's own accessible data; this rule does not create a catalog of write tools.
- If an intended target or action is ambiguous, the system MUST NOT silently choose a different protected resource.
- A tool's success MUST be reported only after the persistent business operation is confirmed; generated claims alone are not evidence of success.

## Failure and boundary scenarios

| Scenario | Required observable behavior |
|---|---|
| First authenticated connection, eligible date, student or teacher | Present a personalized authorized daily review; no unsolicited mutations. |
| Parent connects | No daily review and no bot are offered. |
| Two tabs race for the same user/date | Persistent arbitration prevents independent duplicate daily deliveries. |
| Reload after the review, same date | No new automatic daily delivery, even with empty browser storage. |
| Connections just before and after Argentina midnight | Evaluate distinct local dates, regardless of browser timezone. |
| Student asks the bot during an exam | The bot is shown as unavailable with a clear message. |
| Student asks the bot to solve an activity | The bot guides and points to material, without handing out the solution. |
| Question is outside the approved material | The bot says so instead of inventing an answer. |
| Bedrock or retrieval is unavailable | Explain failure safely; an optional structured authorized summary MAY replace generated wording and is labeled as nongenerated. |
| Data lookup fails during provider outage | Do not turn unavailable activities into an asserted empty workload. |
| Connection drops after server work begins | Represent uncertainty honestly; do not assume failure or blindly repeat delivery. |
| Logout or account switch during generation | Do not show the previous user's private result in the new session. |
| Resource permission is removed | Do not reveal denied content or use cached context. |

A structured fallback MUST obey the same authorization and daily duplicate-prevention constraints. It is permitted, not a promise that every outage has a successful fallback.

## Correct and incorrect examples

**Correct:** Two tabs connect for the same student on the same Argentina date. The server resolves daily eligibility persistently and atomically; the second connection does not independently start another delivery.

**Incorrect:** Each tab checks local storage, invokes generation, and marks itself as finished. Both tabs can deliver, and a reload on another device bypasses the flag.

**Correct:** During an exam, the bot character and the 2D bot entry show the same unavailable message, decided by the server.

**Incorrect:** The interface hides the bot using a locally stored exam time, so a student who changes the clock can still query it.

**Correct:** The student asks for the answer to a multiple-choice question; the bot explains the concept and points to the approved material.

**Incorrect:** The classroom pet is used as the face of the bot, or the bot returns the final answer to an activity.

## Open decisions — not implicit approvals

- The precise authenticated-connection trigger and behavior for a continuously connected user across dates; no midnight scheduler is approved here.
- Daily claim, generation, delivery, acknowledgment, retry, and recovery semantics, including crashes after claiming and failures after generation or presentation. No state machine or exactly-once transport is selected.
- Whether another tab can view an already-created review, and how recovery distinguishes redisplay from a second automatic delivery.
- Optional structured fallback content and presentation, manual reconsultation behavior, and treatment of partially available context.
- Review delivery on an exam day and what the bot shows when the first connection of the day happens during an exam.
- Retrieval technology, model selection, extent of answer-key output checks and misuse flagging, conversation retention, and consumption-limit values; none is inferred from an example.
- Cross-repository ownership and distribution of frontend/backend contracts remain unresolved in master §5–6.

## Observable acceptance checks

These are requirements for future implementation checks, not results of this documentation change.

- [ ] The bot is reachable from its in-world tutor character and from the 2D mode, with the same behavior, and is never linked to the classroom pet.
- [ ] First authenticated connection yields the eligible student's or teacher's authorized review without changing records unsolicited; parents receive neither the review nor the bot.
- [ ] Same-user concurrent tabs, reconnects, reloads, classroom changes, and service restart cannot bypass persistent daily arbitration.
- [ ] Separate users and Argentina day boundaries are tested independently of browser timezone and client clock.
- [ ] The bot is unavailable during an exam according to the server, including requests in flight, and answers are limited to approved material without handing out solutions.
- [ ] Provider outage, failed data lookup, and interrupted delivery produce honest distinct outcomes under the eventual recovery contract.
- [ ] Direct unauthorized tool requests and manipulated resource IDs fail server-side; prompt content cannot enlarge access.
- [ ] Logout, account switching, and lost permissions prevent late protected results from leaking.
- [ ] No Bedrock credential enters browser configuration, responses, logs, or generated text; verification evidence follows the quality policy.
