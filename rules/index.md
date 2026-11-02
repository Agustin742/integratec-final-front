# Rule Routing Index

This index tells contributors and AI agents **which rules to read for a given task and which to skip**. Read only the rules whose trigger matches the work; reading every rule for every task wastes context and is not required. When a task spans several areas, read every matching rule.

Rule descriptions and writing criteria live in the [rules README](./README.md). Product scope lives in the [project document](../master-document.md).

## How to use

1. Find the task type in [Read by task](#read-by-task) and read the listed rules.
2. Check [Read by touched area](#read-by-touched-area) for every area the change touches and add those rules.
3. Skip any rule whose trigger does not match. Use the **Skip when** column to confirm.
4. If no row matches, or a rule links to another rule for a requirement you need, follow that link instead of reading unrelated rules.

[`example.md`](./example.md) is a writing template, not a rule; read it only when creating a new rule document.

## Read by task

| Task | Read |
|---|---|
| Any change that will be committed | [Git workflow](./git-workflow.md) |
| Code change (feature, fix, refactor, test) | [Quality and testing](./quality-and-testing.md), [Security](./security.md), [Frontend conventions](./frontend-conventions.md), plus the area rules below |
| New or changed screen, panel, or component | [UI and accessibility](./ui-and-accessibility.md), [Frontend conventions](./frontend-conventions.md), plus the product rule for the feature |
| New or changed 3D scene, object, or camera behavior | [3D world and camera](./3d-world-and-camera.md), [Art direction](./art-direction.md), [Movement and interactions](./movement-and-interactions.md) |
| Documentation-only change | [Documentation and decisions](./documentation-and-decisions.md); add area rules only if the text states their requirements |
| Recording or changing a technical or product decision | [Documentation and decisions](./documentation-and-decisions.md), plus the rules the decision affects |
| Creating or updating a rule document | [rules README](./README.md), [`example.md`](./example.md) |
| Planning work, creating issues, or updating the board | [GitHub Projects](./github-projects.md) |
| Reviewing a pull request | [Git workflow](./git-workflow.md), [Quality and testing](./quality-and-testing.md), plus the area rules the diff touches |
| Using AI assistance in delivered work | [Responsible AI usage](./ai-usage.md) |
| Checking academic compliance or preparing a milestone | [Course requirements](./project-requirements.md) |

## Read by touched area

### Product behavior

| Rule | Read when the work touches | Skip when |
|---|---|---|
| [Classrooms, roles, and permissions](./classrooms-and-roles.md) | Role-specific interface, organization paths, invitations, classroom join code, parent area, 2D/3D mode, any visibility that depends on a role | The change shows no role-dependent behavior |
| [Activities and grading](./activities-and-grading.md) | Activity screens, student submission, teacher review and grading, exams, upload progress | Outside the academic module |
| [Communication and notifications](./communication-and-notifications.md) | Classroom chat, mentions, announcement board, parent messages, in-app notifications | No messaging or notification interface |
| [Points, streak, shop, pet, and medals](./points-and-shop.md) | Balance, streak, shop, classroom pet, medals, mini-games | Outside gamification |
| [Live classroom tools](./live-classroom-tools.md) | Freeze and seat lock, mute controls, calls, presentations, whiteboard, charts, LaTeX | No live teacher control or collaboration tool |
| [AI bot and daily briefing](./ai-bot-and-daily-briefing.md) | Study-guide bot interface, exam block, daily review presentation, provider-failure states | No bot or daily review interface |
| [Movement and interactions](./movement-and-interactions.md) | WASD, click, and touch navigation, input arbitration, collisions, object interactions | No navigation or in-scene interaction |
| [Avatars and customization](./avatars-and-customization.md) | Avatar appearance, customization UI, persistence, visibility, fallback avatars | No avatar rendering or editing |
| [Realtime and presence](./realtime-and-presence.md) | Colyseus client, join credential, presence, reconnection, stale-state cleanup, live updates | REST-only or purely local UI work |

### Architecture and integration

| Rule | Read when the work touches | Skip when |
|---|---|---|
| [Architecture](./architecture.md) | Module placement, responsibility boundaries between UI, scene, and integration layers | The change stays inside one existing module and adds no new dependency between layers |
| [3D world and camera](./3d-world-and-camera.md) | React Three Fiber scene, fixed isometric camera, asset loading, scene performance, non-3D alternatives | No 3D scene code |
| [Frontend conventions](./frontend-conventions.md) | New modules, TypeScript boundaries, React composition, effects and lifecycle cleanup | A change of text or styling only |
| [State management](./state-management.md) | Stores, TanStack Query keys and cache, realtime state, drafts, account switching | No state is added or changed |
| [API contracts](./api-contracts.md) | API client, generated types in `src/api/`, request and response handling, mocks | No request or response shape is consumed |
| [Authentication and session](./authentication-and-session.md) | Login, logout, token storage and refresh, route protection, `401` handling, Content-Security-Policy | The change does not touch session behavior |
| [Data and time](./data-and-time.md) | Identifiers, optional values, dates, time zones, formatting | No IDs, dates, or serialized values |

### Experience and operation

| Rule | Read when the work touches | Skip when |
|---|---|---|
| [UI and accessibility](./ui-and-accessibility.md) | Controls, styling, keyboard and touch access, focus, responsive layout, motion, drag and drop | No visible interface change |
| [Art direction](./art-direction.md) | Palette, avatars, environments, materials, lighting, visual assets, styling of the scene | No visual or asset change |
| [Forms and validation](./forms-and-validation.md) | Forms, schemas, field and server errors, pending submissions, drafts | No form is added or changed |
| [Error handling and feedback](./error-handling-and-feedback.md) | Loading, empty, error, and uncertain states; retries; user-visible failures | Failure behavior is unchanged |
| [Configuration and environments](./configuration-and-environments.md) | Environment variables, build configuration, public configuration, `.env.example` | No configuration is added or read |
| [Observability and privacy](./observability-and-privacy.md) | Logging, diagnostics, analytics, error reporting, personal data in telemetry | No diagnostics or telemetry change |
| [Deployment and operations](./deployment-and-operations.md) | Hosting, deploy pipeline, release and rollback, deployment evidence | Local-only or CI-check-only changes |

### Project-wide policies

| Rule | Read when the work touches | Skip when |
|---|---|---|
| [Security](./security.md) | Secrets, permissions, input handling, rendering user content, CSP, transport | Documentation-only changes that state no security requirement |
| [Quality and testing](./quality-and-testing.md) | Tests, verification reporting, definition of done | Nothing is being delivered |
| [Git workflow](./git-workflow.md) | Branches, commits, pull requests, reviews, merges | Nothing will be committed |
| [GitHub Projects](./github-projects.md) | Issues, board status, traceability | No planning or tracking work |
| [Documentation and decisions](./documentation-and-decisions.md) | Documentation, approved choices, proposals, exceptions | No documentation or decision changes |
| [Course requirements](./project-requirements.md) | Academic minimums, milestones, evaluation criteria | The work has no academic compliance angle |
| [Responsible AI usage](./ai-usage.md) | AI-assisted work, privacy of prompts, usage declaration | No AI assistance was used |

## Maintenance

Add a row here whenever a rule is added, renamed, or its scope changes, and keep the [rules README](./README.md) list in sync.
