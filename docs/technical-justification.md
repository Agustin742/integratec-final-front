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
| API client | openapi-typescript + openapi-fetch | Types generated from the backend OpenAPI document (FD2) |
| Hosting | AWS Amplify Hosting (`sa-east-1`) | Static build served over HTTPS |

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

### Backend decisions D1-D7 and their frontend impact

The backend repository records decisions D1-D7 in its `docs/technical-justification.md` section 7 (a relative link to that repository is not possible, so it is cited here). They affect the frontend as follows.

| ID | Backend decision | Frontend impact |
|---|---|---|
| D1 | Short-lived JWT access token plus a rotated, hashed opaque refresh token; the server checks a session identifier on every protected request and a revoked session yields `401` | The client holds both tokens (FD1), sends the access token as `Authorization: Bearer`, refreshes on expiry, and ends the session when refresh fails ([Authentication and session](../rules/authentication-and-session.md)) |
| D2 | Colyseus `onAuth` calls an internal NestJS endpoint to verify the session and access before admitting a join | The client supplies the access token when joining (FD3); admission is decided by the server |
| D3 | Backend pnpm monorepo (`apps/api`, `apps/realtime`, `packages/contracts`) | None, except the contract types the frontend consumes (D4) |
| D4 | NestJS generates an OpenAPI document served with the Scalar reference UI; the frontend generates its types from it | The frontend generates API types from that document (FD2); realtime message and state types remain open on the backend side |
| D5 | AWS region `sa-east-1` | The frontend hosting is placed in the same region (FD5) |
| D6 | GitHub Actions OIDC federation to an IAM role, no long-lived access keys | The frontend deploy pipeline authenticates the same way (FD5) |
| D7 | Two ways to join: single-use email invitations (mandatory for teachers and parents) and a per-classroom join code that grants only the `Student` role | The interface supports entering a classroom code and the teacher's code management, and keeps email invitations for other roles ([Classrooms, roles, and permissions](../rules/classrooms-and-roles.md)) |

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
- **Decision:** `openapi-typescript` generates types from the backend OpenAPI document and `openapi-fetch` is the typed HTTP client; TanStack Query wraps the calls. Generated output lives in `src/api/` and is regenerated by a script.
- **Rationale:** One authoritative specification owned by the backend; type drift becomes a compile-time failure.
- **Alternatives:** Orval, rejected because its generated layer is heavier.
- **Trade-offs:** The frontend depends on the backend publishing an accurate OpenAPI document.
- **Open:** Whether the generated output is committed or generated in CI.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD3. Colyseus join credential

- **Question:** What credential does the client present to join a Colyseus room (D2)?
- **Decision:** The client sends the access token in the `join` options; Colyseus `onAuth` forwards it to NestJS. When the token expires, the client refreshes it and rejoins.
- **Rationale:** Consistent with D2, where NestJS remains the single authorization service.
- **Alternatives:** A NestJS-issued join ticket, rejected for consistency with D2.
- **Trade-offs:** A join attempt with an expired token fails and requires a refresh and a rejoin.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

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
- **Open:** Availability of Amplify Hosting in `sa-east-1` **MUST** be verified before provisioning; if it is unavailable, this decision is revisited.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

### FD6. Repository layout

- **Question:** How is the frontend repository organized?
- **Decision:** A single pnpm application (no monorepo) on Node 22, with generated API types in `src/api/`.
- **Rationale:** The repository contains one application only.
- **Alternatives:** A monorepo with `packages/`, rejected because there is a single app.
- **Trade-offs:** Introducing a second package later requires restructuring.
- **Approval:** Approved by Agustin (decision owner) on 2026-11-02.

## Open items

- Whether generated API types are committed or generated in CI (FD2).
- Availability of AWS Amplify Hosting in `sa-east-1` must be verified before provisioning (FD5).
- Distribution of realtime message and state types remains open on the backend side (D4).
- Performance budgets for the 3D scene require measurement and a team decision.
