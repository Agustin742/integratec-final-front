# Isometric rendering foundation

`src/features/world/world-canvas.tsx` provides an isolated R3F-owned `WorldCanvas` for scene children. Application panels and controls stay regular DOM outside the canvas. No classroom, asset loader, navigation or business operation is added.

## Host contract

- Import `WorldCanvas` from `src/features/world/world-canvas.tsx`; pass a descriptive `label` and R3F scene children.
- World coordinates: 1 unit = 1 meter, Y up, ground at Y = 0. Fixed reference bounds: X ±3 m, Z ±2 m, Y 0–2 m.
- Orthographic camera: elevation 35.264°, azimuth 45°, target (0, 1, 0), distance 16 m. Project the eight bound corners and fit both axes with 15% padding on resize. No orbit controls or approved-final-art claim.
- DPR 1–2; static demand rendering, paused until visibility is known, when offscreen or the tab is hidden. No nonessential animation, including reduced motion.
- Renderer creation failure, unsupported WebGL and context loss show accessible DOM feedback. Classic 2D (#34) is explicitly pending; no working alternative route is claimed.

## Resources and dependencies

The host cleans visibility/context/rejection listeners and intersection observers (or scroll/resize fallback). R3F owns event/loop/scene teardown and declarative resource disposal. Its asynchronous renderer-creation errors are bridged only by exact error identity; unrelated promise failures remain untouched. No automatic retry.

Pinned MIT dependencies: `@react-three/fiber` 9.4.0, `three` 0.181.2; development-only `@types/three` 0.181.0. Fiber peers accept the installed React 19.3.1 and Three version. Keep upstream notices; the installed Fiber package lacks a standalone LICENSE file. No engine override, global install or protected-route/CSP change.

## Verification

Camera/projection and mocked lifecycle tests accompany the host. They passed in the observed 19-test world-module run and 411-test full suite on Node 22.23.4/pnpm 10.34.9; typecheck, lint, formatting, production build and security checks passed. Mock lifecycle proof does not measure GPU reclamation. This foundation itself has no product route; technical reference exposure and its browser/device evidence follow in the next work unit. [3D world rules](../rules/3d-world-and-camera.md) remain authoritative; quantitative FD8 metrics are not measured here.
