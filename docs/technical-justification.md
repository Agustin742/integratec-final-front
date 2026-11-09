# Technical Justification (Frontend)

Frontend-side justification for course requirement R6. Decisions come from the [project document](../master-document.md#5-stack-y-responsabilidades-técnicas) (sections 5 and 11). The backend runtime, framework, database, ORM, authentication, AI, and AWS services are justified in the backend repository's own document.

## Summary

| Area | Decision | Role in this project |
|---|---|---|
| Application | React + TypeScript + Vite | Authenticated shell, navigation, and functional panels |
| 3D world | Three.js + React Three Fiber | Isometric 3D scene, avatars, camera, object interactions |
| Styling and components | Tailwind CSS + shadcn/ui | Panels and forms |
| Client state | Zustand | UI state, interactions, local preferences |
| Server data | TanStack Query | Queries, cache, invalidation of persistent data |
| Forms | React Hook Form + Zod | Form handling and input validation |
| Drag and drop (optional) | dnd-kit | Only if a future feature needs drag and drop; no current requirement does |
| Testing | Vitest + Playwright | Unit/integration and end-to-end tests |
| Router | React Router | Routes and protected navigation (FD4) |
| API client | openapi-typescript + openapi-fetch | Types generated from the backend OpenAPI document (FD2, FD7) |
| Hosting | AWS Amplify Hosting (`us-east-2`) | Static build served over HTTPS |

## Decisions

### React + TypeScript + Vite

- **Why:** The product is an authenticated, highly interactive application whose panels are independent of the 3D world. Vite gives fast builds and a static output suited to Amplify. TypeScript types the API and realtime boundaries.
- **Alternatives:** Next.js.
- **Trade-offs:** Server-side rendering is given up as a central feature, which is acceptable for an authenticated application without SEO needs.

### Three.js + React Three Fiber

- **Why:** The product needs a real 3D world with an isometric camera and spatial interactions. Three.js is the established WebGL library; R3F lets the scene be organized declaratively inside React and share its lifecycle.
- **Alternatives:** PixiJS 2.5D (discarded after the change of aesthetic); using Three.js imperatively without R3F.
- **Trade-offs:** The team must control assets, performance, camera, and collisions itself. R3F adds an abstraction layer to learn. Scene rules: [3D world and camera](../rules/3d-world-and-camera.md).

### Tailwind CSS + shadcn/ui

- **Why:** Consistent, accessible panels and forms built quickly; components are copied into the repository and remain editable.
- **Alternatives:** A packaged component library such as MUI; hand-written CSS.
- **Trade-offs:** Components become project code to maintain; Tailwind utility classes require team conventions.

### Zustand

- **Why:** Small API for client-only UI state, kept separate from server data and realtime state ([State management](../rules/state-management.md)).
- **Alternatives:** Redux Toolkit; React Context only.
- **Trade-offs:** Less enforced structure than Redux; discipline is required to avoid duplicating server state.

### TanStack Query

- **Why:** Standard handling of loading, error, cache, and invalidation for REST data, avoiding hand-written fetching state.
- **Alternatives:** Manual `fetch` with effects; SWR.
- **Trade-offs:** Cache keys and invalidation need deliberate design.

### React Hook Form + Zod

- **Why:** Efficient forms with schema validation that also types the data. The backend validates again; client validation is only for feedback.
- **Alternatives:** Formik; manual validation.
- **Trade-offs:** Schemas may duplicate backend rules; types are generated from the backend OpenAPI document (FD2).

### dnd-kit

- **Why:** No current requirement or user story needs drag and drop, so this dependency is optional and MUST NOT be installed until a feature requires it. If one does, dnd-kit offers accessible, framework-aligned drag and drop.
- **Alternatives:** react-beautiful-dnd; native HTML drag and drop.
- **Trade-offs:** More setup than native drag; essential operations still need a non-drag alternative ([UI and accessibility](../rules/ui-and-accessibility.md)).

### Vitest + Playwright

- **Why:** Vitest matches the Vite toolchain for unit and integration tests; Playwright covers end-to-end journeys across browsers.
- **Alternatives:** Jest; Cypress.
- **Trade-offs:** End-to-end tests are slower and need a running environment; WebGL scenes are hard to assert, so the DOM alternative is the primary test surface.

### AWS Amplify Hosting

- **Why:** Serves the static Vite build over HTTPS with CI-driven deploys, without managing servers for the frontend.
- **Alternatives:** S3 + CloudFront configured manually; other static hosts.
- **Trade-offs:** Less control than a hand-built distribution; tied to AWS, consistent with the rest of the infrastructure.

## Architecture decisions

Decided and approved by Agustin (decision owner) on 2026-11-02. This is not a claim of team-wide approval; per [Documentation and decisions](../rules/documentation-and-decisions.md), a conflict with the team **MUST** be resolved before dependent implementation proceeds.

### Backend decisions D1-D12 and their frontend impact

The backend repository records decisions D1-D12 in its `docs/technical-justification.md` section 7 (a relative link to that repository is not possible, so it is cited here). They affect the frontend as follows.

| ID | Backend decision | Frontend impact |
|---|---|---|
| D1 | Short-lived JWT access token plus a rotated, hashed opaque refresh token; the server checks a session identifier on every protected request and a revoked session yields `401` | The client holds both tokens (FD1), sends the access token as `Authorization: Bearer`, refreshes on expiry, and ends the session when refresh fails ([Authentication and session](../rules/authentication-and-session.md)) |
| D2 | Colyseus `onAuth` calls an internal NestJS endpoint to verify the session and access before admitting a join | The client supplies the access token when joining, as the SDK `Authorization` header (FD3); admission is decided by the server |
| D3 | Backend pnpm monorepo (`apps/api`, `apps/realtime`, `packages/contracts`) | None, except the contract types the frontend consumes (D4) |
| D4 | NestJS generates an OpenAPI document served with the Scalar reference UI; the frontend generates its types from it | The frontend generates API types from that document (FD2); the backend also commits the document and the realtime type artifacts (backend D8), which the frontend syncs (FD7) |
| D5 | AWS region `us-east-2` (changed from `sa-east-1` on 2026-11-04: the AWS account assigns the Region and denies others) | The frontend hosting is placed in the same region (FD5) |
| D6 | No long-lived AWS access keys; GitHub Actions OIDC is the target, but the AWS account currently denies creating the OIDC provider (backend D6 update, 2026-11-04) | The frontend deploys through Amplify Hosting's GitHub App connection, with no AWS credentials in GitHub (FD5) |
| D7 | Two ways to join: single-use email invitations (mandatory for teachers and parents) and a per-classroom join code that grants only the `Student` role | The interface supports entering a classroom code and the teacher's code management, and keeps email invitations for other roles ([Classrooms, roles, and permissions](../rules/classrooms-and-roles.md)) |
| D8 | The backend commits `openapi.json` (CI fails if stale), generates Colyseus room state types with `schema-codegen`, exports realtime message payload types from `packages/contracts`, and commits them | The frontend pulls these artifacts with `pnpm api:sync` and commits the generated types (FD7) |
| D9 | Contract-first: the backend publishes each endpoint's DTOs and OpenAPI entry (a `501` stub is allowed) before or with its implementation; the committed `openapi.json` carries it | The frontend builds MSW handlers from the contract and proceeds before the backend implementation lands (FD9) |
| D10 | Timestamps stored in UTC and returned as ISO 8601 UTC; each School has a persisted IANA time zone (default `America/Argentina/Buenos_Aires`); the server decides lateness in UTC | The frontend displays deadlines in the school's time zone and indicates the zone (FD11) |
| D11 | Auto-graded multiple choice in activities and exams is MVP Core; ungraded self-assessed practice quizzes stay MVP Extendido | The interface renders multiple choice as a quiz or exam and shows the server's result (FD12) |
| D12 | `GET /classrooms/:id/members` returns id, display name, classroom role, and avatar summary to every classroom member; paginated, optional `q` prefix filter, `404` for non-members | Mention autocomplete consumes it (FD12) |

### FD1. Token storage

- **Question:** Where does the browser keep the access and refresh tokens of D1?
- **Decision:** Both tokens are stored in `sessionStorage` (option C). Tokens are sent as `Authorization: Bearer`; no cookies are used, so API calls need no CSRF token.
- **Rationale:** Matches the backend agreement recorded in D1, needs no cookie or CSRF infrastructure, and limits token lifetime to the tab.
- **Alternatives:** (A) access token in memory and refresh token in an HttpOnly cookie, rejected by the decision owner; (B) both tokens in `localStorage`, rejected because they persist across browser restarts and enlarge the XSS exposure window.
- **Trade-offs:** Tokens are readable by any script running in the page (XSS); each new tab or window requires login; the session ends when the tab closes.
- **Mandatory mitigations:** strict Content-Security-Policy (no inline scripts, no `unsafe-eval`, allowlisted sources); never render unsanitized HTML (no `dangerouslySetInnerHTML` with user content); no third-party scripts beyond those approved; short access-token lifetime and refresh rotation per D1; clear both tokens on logout and on any `401` after a failed refresh. They are enforced by [Authentication and session](../rules/authentication-and-session.md) and [Security](../rules/security.md).
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD2. API types

- **Question:** How does the frontend obtain typed access to the backend API (D4)?
- **Decision:** `openapi-typescript` generates types from the backend OpenAPI document and `openapi-fetch` is the typed HTTP client; TanStack Query wraps the calls. Generated output lives in `src/api/`, is committed, and is regenerated by the sync script (FD7).
- **Rationale:** One authoritative specification owned by the backend; type drift becomes a compile-time failure.
- **Alternatives:** Orval, rejected because its generated layer is heavier.
- **Trade-offs:** The frontend depends on the backend publishing an accurate OpenAPI document.
- **Update:** Whether the generated output is committed or generated in CI is closed by [FD7](#fd7-contract-sync): it is committed.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD3. Colyseus join credential

- **Question:** What credential does the client present to join a Colyseus room (D2)?
- **Decision:** The client sends the access token in the `join` options; Colyseus `onAuth` forwards it to NestJS. When the token expires, the client refreshes it and rejoins.
- **Rationale:** Consistent with D2, where NestJS remains the single authorization service.
- **Alternatives:** A NestJS-issued join ticket, rejected for consistency with D2.
- **Trade-offs:** A join attempt with an expired token fails and requires a refresh and a rejoin.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.
- **Update (2026-11-09):** The credential transport changed. The client sets `client.auth.token` on the Colyseus SDK client, which sends it as an `Authorization: Bearer <access token>` header on the matchmaking HTTP request; Colyseus receives it as the `token` argument of `static onAuth` and forwards it to NestJS. The `join` options carry only `classroomId` and never the token. Rationale: it is the framework-native path, it matches the Bearer shape of the REST API, and it keeps credentials out of room options (less log exposure) and out of URLs. The previous "token in the `join` options" transport is rejected for those reasons; the refresh-and-rejoin behavior is unchanged. Implemented by backend issue #24. Approved by Agustin (decision owner) on 2026-11-09.

### FD4. Router

- **Question:** Which routing library does the application use?
- **Decision:** React Router.
- **Rationale:** Sufficient for an authenticated application with protected routes.
- **Alternatives:** TanStack Router, rejected because of its extra learning curve.
- **Trade-offs:** Less end-to-end route type safety than TanStack Router.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD5. Hosting

- **Question:** Where and how is the static build hosted?
- **Decision:** AWS Amplify Hosting in `sa-east-1`, consistent with D5. The deploy pipeline authenticates to AWS per D6 (GitHub OIDC).
- **Rationale:** Keeps the frontend in the same region and under the same credential model as the backend.
- **Alternatives:** S3 + CloudFront configured manually; other static hosts (see "AWS Amplify Hosting" above).
- **Trade-offs:** Less control than a hand-built distribution; tied to AWS.
- **Verified:** AWS Amplify Hosting is available in `sa-east-1` (Sao Paulo), per the AWS documentation "AWS Amplify endpoints and quotas" (https://docs.aws.amazon.com/general/latest/gr/amplify.html), checked on 2026-11-02. Availability only; cost and quotas are not assessed here.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.
- **Update (2026-11-04):** The AWS account uses the AWS "new sign-up experience", which assigns `us-east-2` by country and denies other Regions and the creation of the GitHub OIDC provider through AWS-managed policies (backend D5 and D6 updates). Hosting moves to Amplify Hosting in `us-east-2`; the region and credential decision above is superseded. Deployment uses Amplify Hosting's own GitHub connection: the Amplify GitHub App gets read-only access to the selected repository and Amplify builds and deploys the connected branch, so no AWS credentials are stored in GitHub. Creating the app from the Amplify console needs no token; creating it through the CLI, CloudFormation, or an SDK requires a GitHub personal access token at creation time, which **MUST NOT** be committed. Verified on 2026-11-04: Amplify is available in `us-east-2` ("AWS Amplify endpoints and quotas", https://docs.aws.amazon.com/general/latest/gr/amplify.html) and the GitHub App connection is documented in "Setting up Amplify access to GitHub repositories" (https://docs.aws.amazon.com/amplify/latest/userguide/setting-up-GitHub-access.html). Cost and Free Tier limits are not assessed. Approved by Agustin (decision owner) on 2026-11-04.

### FD6. Repository layout

- **Question:** How is the frontend repository organized?
- **Decision:** A single pnpm application (no monorepo) on Node 22, with generated API types in `src/api/`.
- **Rationale:** The repository contains one application only.
- **Alternatives:** A monorepo with `packages/`, rejected because there is a single app.
- **Trade-offs:** Introducing a second package later requires restructuring.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD7. Contract sync

- **Question:** How does the frontend obtain the REST and realtime contracts of the backend (D4, backend D8) without depending on a running backend?
- **Decision:** The backend generates `openapi.json` from NestJS and commits it in its repository (planned path, for example `apps/api/openapi.json`; the exact path is set by the backend monorepo bootstrap); backend CI fails if the committed file is stale versus the code. The frontend runs a sync script (`pnpm api:sync`) that fetches that committed file from the backend repository (`develop` branch, through the raw GitHub URL or a local checkout path) and regenerates types with `openapi-typescript` into `src/api/`. The backend also generates client-side TypeScript for Colyseus room state with `@colyseus/schema` codegen (`schema-codegen`) and exports realtime message payload types from `packages/contracts`, committing both; the same script pulls them into `src/realtime/`. Generated types in `src/api/` and `src/realtime/` **ARE committed** in this repository, so contract changes appear in pull request diffs, and the frontend build does not depend on a running backend.
- **Rationale:** Contract changes become reviewable diffs, builds are reproducible offline from committed files, and the backend stays the single source of the specification.
- **Alternatives:** Generating types in frontend CI from the deployed backend, rejected because the build would depend on backend availability and contract changes would not be visible in pull requests; publishing `packages/contracts` to GitHub Packages, rejected because of publishing, versioning, and registry authentication overhead; hand-written realtime types in the frontend, rejected because of drift and runtime errors.
- **Trade-offs:** Someone must run the sync; types are stale until then.
- **Affected contracts:** [API contracts](../rules/api-contracts.md), [Realtime and presence](../rules/realtime-and-presence.md), [Frontend conventions](../rules/frontend-conventions.md) for generated code, and backend decision D8. This closes the open sub-choice of FD2 and the open item on realtime type distribution.
- **Open:** The script itself and the exact artifact paths on the backend side do not exist yet; they are set when the backend monorepo is bootstrapped and when this application is scaffolded.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD8. 3D performance budget

- **Question:** What measurable limits must the 3D scene meet on school hardware?
- **Decision:** A conservative budget. Frame rate: target 30 fps on integrated GPUs and 60 fps on mid-range machines. On screen: at most 100 draw calls and 200k triangles. Assets: avatar GLB at most 1 MB; the full classroom scene at most 8 MB compressed (Draco or meshopt geometry, KTX2 textures). GPU memory: at most 256 MB. If the device cannot sustain the target, measured at runtime, the client automatically **offers** the 2D Classic Mode and the user can decline. The measurable rules live in [3D world and camera](../rules/3d-world-and-camera.md#performance-and-mobile).
- **Rationale:** School devices are often low-end and integrated-GPU machines; a stuttering scene is worse than a simpler one.
- **Alternatives:** A standard budget (60 fps on mid-range, 300 draw calls, 500k triangles, 20 MB), rejected because school devices would stutter.
- **Trade-offs:** Less visual richness and tighter asset authoring; the runtime measurement adds code and needs tuning.
- **Affected contracts:** [3D world and camera](../rules/3d-world-and-camera.md), [Art direction](../rules/art-direction.md), [Classrooms, roles, and permissions](../rules/classrooms-and-roles.md) for the 2D mode.
- **Open:** The runtime measurement method and thresholds that trigger the offer are defined during implementation; the budget numbers are limits to verify, not yet measured results.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD9. Contract mocks

- **Question:** How does the frontend build screens before the backend implements an endpoint, without drifting from the real contract (backend D9)?
- **Decision:** The backend publishes each endpoint's DTOs and OpenAPI entry (a stub returning `501` is allowed) in a pull request before or together with its implementation; the committed `openapi.json` (backend D8) carries it. Frontend stories build MSW (Mock Service Worker) handlers from that contract so UI work proceeds before the backend implementation lands. MSW is a development and test dependency only and **MUST NOT** be part of production builds.
- **Rationale:** Both teams work in parallel from one authoritative contract, and mocks that follow the generated types cannot silently drift.
- **Alternatives:** The frontend waits for backend merges (rejected: serializes the teams); hand-written mocks without a contract (rejected: drift).
- **Trade-offs:** Handlers must be updated when the contract changes, and a passing mock is not proof of backend integration.
- **Affected contracts:** [API contracts](../rules/api-contracts.md), [Quality and testing](../rules/quality-and-testing.md), and backend decision D9.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD10. UI language

- **Question:** In which language and locale is the interface written?
- **Decision:** UI copy is in Spanish (Argentina, `es-AR`), a single locale for the MVP. Strings are centralized so another locale can be added later. Code, identifiers, and comments stay in English.
- **Rationale:** The product is sold in Argentina and there is no second locale to serve yet; centralized strings keep a later addition cheap.
- **Alternatives:** A full i18n framework from day one (rejected: cost without a second locale).
- **Trade-offs:** Adding a locale later requires extracting any strings that were not centralized.
- **Affected contracts:** [Quality and testing](../rules/quality-and-testing.md#code-language), [Frontend conventions](../rules/frontend-conventions.md), [Data and time](../rules/data-and-time.md) for locale formatting.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD11. Deadline time zone

- **Question:** In which time zone does the interface show deadlines (backend D10)?
- **Decision:** The API returns ISO 8601 UTC instants. The frontend displays deadlines in the school's persisted IANA time zone (default `America/Argentina/Buenos_Aires`) and indicates the zone; the server decides lateness using UTC, never the browser clock.
- **Rationale:** Students and teachers of one school see the same deadline time regardless of their device settings.
- **Alternatives:** Display in each viewer's browser time zone (rejected: students and teachers could see different deadline times).
- **Trade-offs:** The client must receive the school's time zone and format with it explicitly.
- **Affected contracts:** [Data and time](../rules/data-and-time.md), [Activities and grading](../rules/activities-and-grading.md), and backend decision D10.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD12. Multiple-choice quizzes and mention autocomplete

- **Question:** How does the frontend present auto-graded multiple choice, and where do @mention suggestions come from (backend D11 and D12)?
- **Decision:** Auto-graded multiple choice is MVP Core (backend D11). The frontend renders it as a quiz or exam interface, and results come from the server: the browser **MUST NOT** grade answers or submit a computed score. Optional self-assessed practice quizzes remain MVP Extendido. Mention autocomplete in the chat composer consumes backend `GET /classrooms/:id/members` (backend D12, backend issue #52; frontend issue #51), which is paginated and accepts an optional `q` case-insensitive display-name prefix filter. The interface shows only the fields the endpoint returns (id, display name, classroom role, avatar summary) and treats a typed `@name` as a confirmed mention only after the server accepts the message.
- **Rationale:** Server-side grading keeps answer keys and scores authoritative, and a single member directory gives suggestions without exposing personal data or building a client-side roster.
- **Alternatives:** Grading in the browser (rejected: exposes answer keys and allows forged scores); building the suggestion list from chat history or other endpoints (rejected: incomplete and may expose data the directory deliberately omits).
- **Trade-offs:** Suggestions need a network request (debounced, with cached pages), and the quiz result is available only after the server responds; the number of attempts and partial credit stay open.
- **Affected contracts:** [Activities and grading](../rules/activities-and-grading.md), [Communication and notifications](../rules/communication-and-notifications.md#mentions), and backend decisions D11 and D12.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

## Open items

- The runtime performance measurement that triggers the 2D Classic Mode offer is to be defined at implementation (FD8).
