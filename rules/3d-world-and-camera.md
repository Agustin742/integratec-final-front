# 3D World and Camera

Define how the Three.js scene is built, framed, loaded, and released inside the React application.

## Authority and scope

- [Master document, section 3.1](../master-document.md#31-entorno-tridimensional-isométrico) and [section 5](../master-document.md#5-stack-y-responsabilidades-técnicas) agree **Three.js integrated in React through React Three Fiber (R3F)**.
- Visual specifics (palette, proportions, materials, lighting, camera angles) belong to [Art direction](./art-direction.md) and are not restated here.
- Movement behavior belongs to [Movement and interactions](./movement-and-interactions.md); live state to [Realtime and presence](./realtime-and-presence.md); responsibility boundaries to [Architecture](./architecture.md).
- This rule does not select a physics library, pathfinding approach, or asset catalog.

## Classroom scene

- **MUST:** The scene represents the persistent classroom of master section 2.1: seats for the freeze lock, interactable objects (board, teacher desk, student desks, shelf or folder, bulletin board, report card, shop, pet, tutor bot, game console, doors, projector) and avatars, as illustrative examples of master section 2.10, not a closed catalog.
- **MUST:** The classroom pet and the AI tutor bot are separate scene elements with distinct objects and entry points; the scene **MUST NOT** present them as the same character ([AI bot and daily briefing](./ai-bot-and-daily-briefing.md)).
- **MUST:** The scene is optional for essential functions: the same functions are available in the classic 2D mode ([Classrooms and roles](./classrooms-and-roles.md)). Parents have no 3D classroom.

## Scene and React separation

- **MUST:** R3F owns the scene graph. Scene components **MUST** live inside the canvas; application panels, dialogs, forms, chat, grade tables, and the shop **MUST** be regular React/DOM UI outside it ([master section 2.10](../master-document.md#210-objetos-y-elementos-interactuables)).
- **MUST NOT:** Scene objects own business rules, permission decisions, or network calls. They surface intent (for example "object selected") to the application, which decides what happens.
- **MUST:** Scene components read state through the owners defined in [State management](./state-management.md); they **MUST NOT** create parallel authoritative copies of server or classroom state.
- **SHOULD:** Per-frame updates mutate scene objects directly (refs, frame loop) instead of triggering React state updates on every frame.

## Camera

- **MUST:** Use an orthographic isometric camera with fixed framing, as agreed in master section 3.1. Elevation, azimuth, and zoom values follow [Art direction](./art-direction.md).
- **MUST NOT:** Require a free camera. User-controlled rotation or orbit is not an initial requirement; any later addition needs a team decision.
- **MUST:** Resize handling keeps the framing readable across desktop and mobile viewports without distorting proportions.

## World units and ground

- **MUST:** Use one documented world unit (1 unit = 1 meter is the recommended convention) for all assets and logic.
- **MUST:** Define a single ground plane convention (Y up, ground at Y = 0) and place assets relative to it.
- **SHOULD:** Keep scale consistent across assets; correct scale in the source asset rather than with ad hoc runtime multipliers.

## Asset loading

- **MUST:** Use GLB/glTF for complex models, loaded through Three.js loaders or the R3F loading integration.
- **MUST:** Cache and reuse loaded assets; the same asset **MUST NOT** be fetched or parsed repeatedly per instance.
- **MUST:** Loading is asynchronous with a visible fallback (Suspense or equivalent) and an error state per [Error handling and feedback](./error-handling-and-feedback.md). A failed asset **MUST NOT** break the rest of the scene.
- **MUST:** Release geometries, materials, textures, and render targets that are no longer used; do not rely on garbage collection alone.
- **SHOULD:** Compress textures and meshes where it measurably reduces load time.
- **MAY:** Use helper libraries (for example `@react-three/drei`) for loaders, controls, or utilities. They are permitted, not mandatory, and **MUST NOT** hide lifecycle or disposal responsibilities.

## Performance and mobile

- **MUST:** Treat stable frame rate as higher priority than visual effects; verify on a representative mobile device.
- **SHOULD:** Cap device pixel ratio (for example at 2) and reduce it on constrained devices.
- **SHOULD:** Render on demand (frame-on-demand) when the scene is static, and pause rendering when the tab is hidden or the canvas is not visible.
- **SHOULD:** Use instancing for repeated meshes and share geometries and materials across similar objects.
- **SHOULD:** Limit shadow-casting lights, shadow map size, and post-processing; keep a documented draw-call and texture-size budget once measured.
- Concrete budgets are not set here; they require measurement and a team decision.

## Raycast and selection

- **MUST:** Pointer picking (raycast) identifies the target object and reports it to the application as an intent; business effects are validated by the backend ([Security](./security.md)).
- **MUST:** Pointer interactions have touch equivalents without relying on hover ([Movement and interactions](./movement-and-interactions.md)).
- **SHOULD:** Restrict raycasts to interactable objects rather than the entire scene.

## Lifecycle and cleanup

- **MUST:** Canvas mount and unmount **MUST** release listeners, animation loops, loaders, and GPU resources; remounting **MUST NOT** duplicate them ([Frontend conventions](./frontend-conventions.md)).
- **MUST:** Classroom changes, logout, and lost access dispose scene content tied to the previous context ([State management](./state-management.md)).
- **SHOULD:** Handle WebGL context loss with a visible recovery or fallback state.

## Accessibility alternative

- **MUST:** Essential functions remain usable without pointing at 3D objects, through the classic 2D mode and keyboard-accessible UI ([UI and accessibility](./ui-and-accessibility.md), master sections 2.9 and 3.2).
- **SHOULD:** Respect reduced-motion preferences for non-essential scene animation.

## Verification

A scene change **MUST** state how assets are loaded and disposed, confirm the DOM-based alternative for any essential interaction, and report mobile behavior and frame-rate observations. Unmeasured performance claims are not verification.
