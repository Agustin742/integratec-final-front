# Frontend Architecture Overview

Overview of the frontend. Normative constraints are in the [rules](../rules/README.md); the product-wide architecture is in [project document, section 6](../master-document.md#6-arquitectura-general-actualizada). This repository currently holds documentation only; the diagram describes the agreed design, not existing code.

## Structure

```mermaid
flowchart LR
  subgraph Browser["Browser (React + Vite app)"]
    Shell["React shell: routing, auth, panels"]
    Scene["R3F canvas: Three.js scene"]
    Store["Zustand: client UI state"]
    Query["TanStack Query: server data"]
    RT["Realtime client: Colyseus"]
  end
  Shell --> Store
  Shell --> Query
  Scene -- "intent (selection, destination)" --> Shell
  RT -- "room state" --> Scene
  Query -- "REST" --> API["NestJS API (backend repo)"]
  RT -- "WebSocket" --> Colyseus["Colyseus server (backend repo)"]
  Amplify["AWS Amplify Hosting"] -. "serves static build" .-> Browser
```

## Responsibilities

| Part | Owns | Rules |
|---|---|---|
| React shell | Navigation, authentication UI, panels, forms, dialogs | [Frontend conventions](../rules/frontend-conventions.md), [UI and accessibility](../rules/ui-and-accessibility.md) |
| R3F scene | 3D world, camera, avatars, object picking; surfaces intent only | [3D world and camera](../rules/3d-world-and-camera.md), [Art direction](../rules/art-direction.md) |
| Client state (Zustand) | UI coordination and local preferences | [State management](../rules/state-management.md) |
| Server data (TanStack Query) | Persistent data cache and invalidation | [State management](../rules/state-management.md) |
| Realtime client | Room connection, presence, synchronized state | [Realtime and presence](../rules/realtime-and-presence.md) |

## Boundaries

- Business rules and permissions are enforced by the backend; the frontend never treats a visible object or panel as authorization ([Security](../rules/security.md)).
- API and realtime access go through explicit integration boundaries, not scattered through UI or scene objects ([Architecture](../rules/architecture.md), [API contracts](../rules/api-contracts.md)).
- Live movement and presence come from Colyseus state; persistent effects go through the REST API.
- Essential functions have a DOM-based alternative to 3D-only interaction.

## Open items

- Backend Colyseus room-state codegen (`apps/realtime/src/rooms/schema/generated.ts`) will be pulled automatically by `pnpm api:sync` once backend issues #24/#25 publish the room schema (FD7).
- The runtime performance measurement that triggers the 2D Classic Mode offer is to be defined (FD8).

Decided: REST contracts come from the backend's committed OpenAPI document (D4, FD2) and realtime types from backend-generated committed artifacts, both synced with `pnpm api:sync` and committed as generated types (FD7); the 3D scene follows a conservative performance budget (FD8); frontend mocks are built from the published contract (FD9), the UI is Spanish `es-AR` (FD10), and deadlines are shown in the school's time zone (FD11); the frontend is hosted on Amplify Hosting in `us-east-2` and deployed through its GitHub App connection (FD5, updated 2026-11-04); the session follows D1 with both tokens in `sessionStorage` (FD1) ([Authentication and session](../rules/authentication-and-session.md)); see the [architecture decisions](./technical-justification.md#architecture-decisions).
