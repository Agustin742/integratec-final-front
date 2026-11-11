# Tracker — Agustin

## 2026-11-11 — Error boundaries and not-found/forbidden views (#20, task 3)

- **Status:** in-progress
- **Area / files:** `src/app/router/error-boundaries.tsx`, `src/app/router/route-errors.ts`, `src/app/router/routes.tsx`, `src/app/pages/not-found-page.tsx`, `src/app/pages/forbidden-page.tsx`, `src/app/messages.ts`
- **Change:** Added a root error boundary above the shell (minimal fallback with reload and home) and a per-page boundary inside the shell, so a page error or a failed lazy chunk keeps the banner, navigation and toast host. Route errors are classified (404 to not found, 403 to forbidden, stale chunk to reload, anything else to a generic error with retry); 401 is never handled there. Added notFound()/forbidden() throw helpers and a forbidden view. Error text, stack and server data are never rendered.
- **Reason:** One place decides how failures look, without login loops or leaked internals.
- **Next step:** Capability gating, skip link/focus/title (tasks 4-5).

## 2026-11-11 — Session guards for the router (#20, task 2)

- **Status:** in-progress
- **Area / files:** `src/app/router/guards.tsx`, `src/app/router/return-target.ts`, `src/app/router/routes.tsx`, `src/app/messages.ts`
- **Change:** Added `RequireAuth` (loading while the session initializes, redirect to `/login?next=` when signed out, retry state when it cannot be verified) on the protected branch, and `PublicOnly` on login, register and password reset. Invitation acceptance stays reachable signed in or out. The return target is built and read through `safeSessionRedirect`.
- **Reason:** One guard decides session access so screens never flash protected content or loop through login.
- **Next step:** Error boundaries and not-found/forbidden views, capability gating, skip link/focus/title (tasks 3-5).

## 2026-11-11 — React Router app shell (#20, task 1)

- **Status:** in-progress
- **Area / files:** `src/app/router/`, `src/app/pages/`, `src/app/messages.ts`, `src/main.tsx`, `e2e/`, `docs/development.md`, `docs/ui-showcase.md`, `package.json`
- **Change:** Added `react-router` 8.5.1 (exact pin) in data mode: a shared route table with lazy placeholder pages (login, register, password reset, invitation landing, protected home), a layout route on `BaseLayout` with `<Outlet />` and the toast host, a 404 catch-all, and the dev showcase moved to `/dev/ui`, registered only when `__UI_SHOWCASE__` is true. `main.tsx` renders `RouterProvider`; `App` was replaced by the route tests.
- **Reason:** Navigation foundation for every upcoming screen (FD4).
- **Next step:** Session guards, error boundaries, capability gating, skip link/focus/title (tasks 2-5).

## 2026-11-09 — Native Colyseus join credential (FD3) and realtime contract sync path

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `rules/realtime-and-presence.md`, `scripts/api-sync/sync-contracts.mjs`, `src/api/sync-contracts.test.ts`, `README.md`, `docs/architecture.md`
- **Change:** FD3 now sends the access token as `client.auth.token` (SDK `Authorization: Bearer` header on matchmaking) instead of in the `join` options, which carry only `classroomId`. `pnpm api:sync` reads the room state from `packages/contracts/src/realtime/generated/ClassroomState.ts`, the path published by backend #24 (#71).
- **Reason:** Match the backend implementation of the Colyseus join gate (backend PR #77): framework-native auth path, same Bearer shape as REST, credentials kept out of room options and URLs.
- **Verification:** lint, typecheck, 147/147 unit tests, format check, docs check; a real sync against the backend #24 branch writes all three generated files with no warnings.
- **Next step:** After backend #77 merges, run `pnpm api:sync` and commit the generated types together with the Colyseus client dependency (`@colyseus/schema`).

## 2026-11-05 — Tactile design pass for the base UI components

- **Status:** completed
- **Area / files:** `src/styles/tokens.css`, `src/styles/index.css`, `src/components/ui/*`, `src/components/layout/`, `src/app/App.tsx`, `docs/ui-*.md`, `package.json`
- **Change:** Self-hosted Fredoka and Figtree fonts, tactile depth tokens (bevels, lavender ambient, inset wells), resin-key buttons, recessed inputs, tray tabs, pill badges with palette variants, tinted alerts with icon chip, clay table/dialog/sheet, shimmer skeleton and pill sidebar nav. Contrast pairs recorded in `docs/ui-foundations.md`.
- **Reason:** The components looked like stock shadcn; they now follow the painted-toy / soft-resin art direction.
- **Follow-up:** The toast now drops Sonner's stock styling for a clay panel with a display title, a per-type icon chip and an in-panel close key (`src/components/ui/toast.tsx`, `docs/ui-overlays.md`).
- **Verification:** lint, typecheck, 146/146 unit tests, build and 16/16 Playwright scenarios against the showcase preview; manual keyboard focus pass. Screenshots in `docs/assets/ui-foundations/`.
- **Next step:** Team review on PR #68.

## 2026-11-04 — Move frontend hosting to us-east-2 with keyless Amplify deploy (FD5 update)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md` (FD5, D5/D6 impact), `docs/architecture.md`, `rules/deployment-and-operations.md`
- **Change:** Recorded the FD5 update: Amplify Hosting in `us-east-2` and deployment through the Amplify GitHub App connection instead of GitHub Actions OIDC, with no AWS credentials in GitHub. Mirrored the backend D5/D6 updates. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The AWS account (new sign-up experience) assigns `us-east-2` and denies other Regions and the GitHub OIDC provider through AWS-managed policies (backend #16, PR #57); frontend issue #22 was updated accordingly.
- **Verification:** Amplify availability in `us-east-2` and the GitHub App connection checked in the AWS documentation on 2026-11-04; docs link check passed. Cost and Free Tier limits are not assessed.
- **Next step:** Provision Amplify Hosting under frontend issue #22.

## 2026-11-02 — Record multiple-choice quizzes and mention autocomplete source (FD12)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/functional-requirements.md`, `rules/` (activities-and-grading, communication-and-notifications)
- **Change:** Recorded FD12: auto-graded multiple choice is MVP Core and rendered as a quiz or exam UI with server-provided results (never graded client-side); mention autocomplete consumes backend `GET /classrooms/:id/members`. Mirrored backend D11 and D12 and fixed the requirements wording on self-assessed quizzes. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The requirements contradicted themselves on multiple-choice scope, and the chat composer needs a defined, minimal source for mention suggestions (frontend issue #51, backend issue #52).
- **Next step:** Build the quiz/exam interface and the mention autocomplete against the published contract and MSW handlers (FD9).

## 2026-11-02 — Record contract mocks, UI language and deadline time zone (FD9–FD11)

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/architecture.md`, `rules/` (api-contracts, quality-and-testing, frontend-conventions, data-and-time, deployment-and-operations)
- **Change:** Recorded FD9 (MSW handlers built from the published contract; dev and test only), FD10 (UI in Spanish `es-AR`, centralized strings, single locale), FD11 (deadlines shown in the school's IANA time zone with the zone indicated; server decides lateness in UTC) and mirrored backend D9 and D10. Fixed the Amplify `sa-east-1` wording to "verified" in the deployment rule. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** UI work must proceed before backend endpoints land, and the interface language and deadline time zone were undecided.
- **Next step:** Centralize strings and add MSW handlers when the application is scaffolded.

## 2026-11-02 — Record contract sync, 3D performance budget and verified hosting region

- **Status:** completed
- **Area / files:** `docs/technical-justification.md`, `docs/architecture.md`, `README.md`, `rules/` (api-contracts, realtime-and-presence, 3d-world-and-camera, art-direction, and the rules that listed realtime contract distribution as open)
- **Change:** Recorded FD7 (backend commits `openapi.json` and realtime type artifacts; `pnpm api:sync` pulls them and generated types are committed in `src/api/` and `src/realtime/`), FD8 (conservative 3D performance budget with an automatic offer of the 2D Classic Mode), and marked the Amplify availability in `sa-east-1` as verified (FD5). Closed the FD2 open sub-choice and the realtime type distribution items. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Contract changes must be visible in pull requests without a running backend, and school hardware needs measurable 3D limits.
- **Next step:** Implement `pnpm api:sync` and the runtime performance check when the application is scaffolded.

## 2026-11-02 — Record frontend decisions and sync with backend

- **Status:** completed
- **Area / files:** `README.md`, `master-document.md`, `docs/functional-requirements.md`, `docs/requirements-decision.md`, `docs/technical-justification.md`, `docs/architecture.md`, `rules/index.md`, `rules/README.md`, `rules/authentication-and-session.md`, `rules/api-contracts.md`, `rules/realtime-and-presence.md`, `rules/classrooms-and-roles.md`, `rules/security.md`, `rules/deployment-and-operations.md`, `AGENTS.md`
- **Change:** Removed leftover office-model wording; synced the shared requirements and master document with the backend; recorded backend decisions D1-D7 and new frontend decisions FD1-FD6 (token storage, API types, Colyseus join credential, router, hosting, repository layout); updated the affected rules (session, contracts, join credential, classroom join code, CSP); added the rule routing index and pointed agent instructions at it. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Keep the frontend documentation consistent with the approved backend decisions and make agents read only the rules relevant to a task.
- **Next step:** Verify Amplify Hosting availability in `sa-east-1`; decide whether generated API types are committed or generated in CI.

## 2026-10-30 — Realign frontend rules with the school niche

- **Status:** completed
- **Area / files:** `rules/classrooms-and-roles.md`, `rules/activities-and-grading.md`, `rules/communication-and-notifications.md`, `rules/points-and-shop.md`, `rules/live-classroom-tools.md`, `rules/ai-bot-and-daily-briefing.md`, `rules/realtime-and-presence.md`, `rules/3d-world-and-camera.md`, `rules/movement-and-interactions.md`, `rules/avatars-and-customization.md`, `rules/art-direction.md`, `rules/ui-and-accessibility.md`, `rules/state-management.md`, `rules/README.md`, `master-document.md` (section 13)
- **Change:** Renamed the rooms, tasks, and meetings rules to classrooms-and-roles, activities-and-grading, and communication-and-notifications and rewrote them for the interface of the school model (role-specific UI, 2D/3D mode, parent area, review and grading, chat moderation and mute, announcements, in-app notifications). Added points-and-shop and live-classroom-tools. Updated the other rules to the classroom scene, keeping the classroom pet and the AI bot separate. Updated the rules index and master section 13. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Align the frontend rules with master document v0.3 and the already realigned backend rules.
- **Next step:** Realign `docs/` (functional requirements, user stories, requirements decision, technical justification, architecture) with the school model.

## 2026-10-30 — Rewrite master document for the school niche

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Rewrote the product scope for schools (teachers, students, parents, school owner/admin): organization paths, roles, activities and grades, points and shop, classroom controls, 2D classic mode, RAG-based AI bot, MVP split into core and extended, updated R1-R8 checks, and version 0.3. Removed offices/rooms, Kanban, generic tasks, and meetings. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** The team narrowed the product to an education niche; the master document must match before the data model and rules are derived from it.
- **Next step:** Realign the `rules/` files with the new scope (classrooms and roles, activities and grading, points and shop, live classroom tools, notifications, data, AI bot); decide the candidate technologies in `docs/technical-justification.md`.

## 2026-10-28 — Record Terraform decision in master document

- **Status:** completed
- **Area / files:** `master-document.md`
- **Change:** Added Terraform to the stack table and deployment section and listed the backend-owned infrastructure-as-code rule in section 13. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Keep the master document synchronized with the backend after adopting Terraform.
- **Next step:** None.

## 2026-10-27 — Confirm rendering technology and complete frontend rules

- **Status:** completed
- **Area / files:** `rules/`, `rules/3d-world-and-camera.md`, `docs/technical-justification.md`, `docs/ai-usage.md`, `docs/architecture.md`, `master-document.md`, `AGENTS.md`
- **Change:** Replaced "undecided rendering engine" wording with the agreed Three.js + React Three Fiber decision; added the 3D world and camera rule and the technical justification, AI usage declaration, and architecture docs; aligned the master document rule index with real filenames; required tracker updates in agent instructions. Done with AI assistance (Claude Code), reviewed by Agustin.
- **Reason:** Close the gaps between master document section 13 and the existing rules, and resolve the contradiction about the rendering technology.
- **Next step:** Team to fill the real cases in `docs/ai-usage.md`, then open a pull request to `develop`.
