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
| Drag and drop | dnd-kit | Kanban interactions |
| Testing | Vitest + Playwright | Unit/integration and end-to-end tests |
| Hosting | AWS Amplify Hosting | Static build served over HTTPS |

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
- **Trade-offs:** Schemas may duplicate backend rules; the contract distribution between repositories is still open.

### dnd-kit

- **Why:** Accessible, framework-aligned drag and drop for the Kanban board.
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

## Open items

- Distribution and ownership of API/realtime contracts between the frontend and backend repositories remain undecided ([API contracts](../rules/api-contracts.md)).
- Performance budgets for the 3D scene require measurement and a team decision.
