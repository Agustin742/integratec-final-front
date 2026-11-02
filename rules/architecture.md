# Architecture and Responsibility Boundaries

Keep presentation, application behavior, and external integrations separate enough to change without rewriting unrelated features.

## Decision boundaries

- The expected visual design is defined by [Art direction](./art-direction.md). The rendering technology is agreed: **Three.js integrated in React through React Three Fiber** ([project document, section 3.1](../master-document.md#31-entorno-tridimensional-isométrico) and [section 5](../master-document.md#5-stack-y-responsabilidades-técnicas)). Scene-specific rules live in [3D world and camera](./3d-world-and-camera.md).
- Contributors **MUST NOT** replace it or add a competing rendering engine, introduce an architectural framework, or create a cross-repository shared package as an incidental implementation choice.
- Other agreed product and technology decisions remain governed by the [project document](../master-document.md); unresolved choices follow [decision rules](./documentation-and-decisions.md).

## Responsibilities

| Area | Responsibility |
|---|---|
| Presentation | Display data, collect input, and communicate user intent |
| Application behavior | Coordinate use cases and their observable states |
| Integration boundary | Adapt API and realtime contracts to application needs |
| Backend | Authorize operations and validate persistent business changes |
| Visual environment | Three.js scene (via React Three Fiber) representing the agreed art direction and surfacing interaction intent |

- Visual objects **MUST NOT** be the only owners of business rules or permission decisions.
- Feature code **SHOULD** expose narrow entry points rather than depend on another feature's private implementation.
- Shared modules **MUST NOT** import feature-specific UI. Extract shared code only for an actual common responsibility.
- API and realtime access **MUST** use explicit integration boundaries rather than be scattered through unrelated UI or visual objects.
- Subscriptions, connections, and external resources **MUST** have explicit lifecycle owners and cleanup.

## Verification

A change **MUST** identify the responsible feature, its external boundaries, and how resources are released. Moving or replacing the visual implementation **SHOULD NOT** require redefining task, permission, or API rules.
