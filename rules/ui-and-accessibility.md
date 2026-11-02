# UI Consistency and Accessibility

Essential product functions must remain understandable and usable beyond a visual scene or a single input method.

## Components and visual boundaries

- Application panels **SHOULD** reuse agreed shadcn/ui components and Tailwind conventions instead of creating competing controls for the same purpose.
- World appearance follows [Art direction](./art-direction.md); scene rules are in [3D world and camera](./3d-world-and-camera.md). This document does not finalize a separate panel theme.
- Repeated UI patterns **MUST** use consistent labels, states, and interactions.
- Color, animation, or sound **MUST NOT** be the only way to communicate essential information.

## Input and focus

- Essential functions **MUST** have a keyboard-accessible interface rather than depend exclusively on selecting a spatial object. The classic 2D mode of master §2.9 is the agreed accessible alternative: it **MUST** expose activities, material, chat, grades, shop, and bot with the same data and server checks as the 3D classroom ([Classrooms and roles](./classrooms-and-roles.md)).
- Pointer interactions **MUST** offer touch equivalents without relying on hover.
- Controls **MUST** have accessible names and visible focus. Prefer semantic HTML over simulated controls.
- Dialogs **MUST** manage focus, prevent accidental interaction behind them, and return focus to a meaningful location when closed.
- Typing in inputs or using UI controls **MUST NOT** trigger world movement or unrelated global shortcuts.
- Drag-and-drop actions **MUST** have a non-drag alternative for essential operations.
- The parent interface **MUST** stay minimal and fully usable without the 3D classroom.

## Responsive and motion behavior

- Affected screens **MUST** be checked at mobile and desktop sizes, including zoom and content overflow.
- Text and essential controls **MUST** retain readable contrast against their actual background.
- Nonessential motion **SHOULD** respect reduced-motion preferences; audio **MUST** be user-controllable when introduced.
- Success, loading, empty, and failure states follow [Feedback rules](./error-handling-and-feedback.md).

## Verification

Review affected controls using keyboard and touch-equivalent input, verify focus after dialogs, and confirm the main action remains usable without precise pointing in the world, including through the classic 2D mode.
