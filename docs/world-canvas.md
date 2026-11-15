# Isometric rendering foundation

`src/features/world` provides an R3F-owned `WorldCanvas`, explicit selection intents, and a technical reference at the existing showcase-only `/dev/ui`. This is not a classroom, approved final art, navigation, or a working classic mode.

## Quick check

1. Use Node **22.23.4** and pnpm **10.34.9** with the project's normal public configuration ([development](development.md)). No real `.env` contents are needed for verification.
2. Open `/dev/ui` in development or a showcase build. Scroll to **Referencia técnica 3D**.
3. Compare the floor and the 1 m / 2 m references at desktop and portrait sizes. Select the taller reference by pointer/touch or its DOM button. The result is local selection only.

## Ownership and contract

| Area            | Implementation                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public boundary | `WorldCanvas`, `WorldReference`, `WorldIntent`, `selectionIntent`, `raycastInteractables` via `src/features/world/index.ts`; centralized es-AR copy in `messages.ts`                                                                  |
| Coordinates     | 1 unit = 1 meter; Y up; ground at Y = 0. Reference bounds: X ±3 m, Z ±2 m, Y 0–2 m                                                                                                                                                    |
| Camera          | Fixed orthographic, azimuth 45°, elevation 35.264°, target (0, 1, 0), distance 16 m, near/far 0.1/50. No orbit controls                                                                                                               |
| Resize          | Project all eight target-bound corners into camera space; fit both axes with 15% padding, preserving viewport aspect. R3F observes size; the camera is manual to prevent its default pixel frustum from overwriting world framing     |
| Rendering       | DPR 1–2, static `demand`; `never` before visibility is known, offscreen, or when the tab is hidden. No animation, tween, or custom frame loop, including reduced motion                                                               |
| Color           | sRGB output, ACES filmic tone mapping, exposure 1; warm light and soft blue fill. No shadows/postprocessing/textures                                                                                                                  |
| Picking         | Explicit mesh/group registrations and their descendants only, never arbitrary `userData`. R3F reference pointer events are attached only to the interactable group; decoration has no handlers. Helper raycasts only registered roots |
| Intents         | `{ type: 'select', targetId: string }`; no API, auth, permission, persistence, or classroom business calls                                                                                                                            |
| DOM             | Controls and feedback remain outside Canvas; essential reference selection works without WebGL                                                                                                                                        |

### Framing comparison (mathematical, not art approval)

At azimuth 45°, a horizontal meter contributes approximately **0.354 m**, **0.408 m**, **0.455 m**, or **0.500 m** to screen height at elevations 30°, 35.264°, 40°, or 45°. At 35.264° the three unit axes have equal projected lengths: a useful scale-comparison default between the flatter 30° and more top-down 45°. This does not settle team camera/art choices or occlusion treatment. There are no avatars, walls, classroom assets or finished-world readability claims here.

## Failure and resource lifecycle

Unsupported WebGL uses the Canvas DOM fallback; renderer creation failure, scene error and context loss show understandable DOM feedback. Classic 2D (#34) is explicitly pending, with no dead navigation or claim that it works. Reloading/remounting creates a fresh host; there is no automatic retry.

R3F 9.4 performs renderer configuration in an async function without forwarding its rejection to React. The host therefore bridges **only exact errors captured from its own renderer constructor** through `unhandledrejection`, prevents that rejection's default browser handling, and shows fallback. Unrelated promise failures are untouched. This bridge must be reconsidered when upgrading R3F.

The host cleans its visibility listener, intersection observer (or scroll/resize fallback), rejection listener and context-loss listener. R3F owns reconciliation, events, loop teardown and GPU disposal; reference geometries/materials are declarative and not shared global resources. No loaders, externally allocated textures, or second renderer framework are added. Mock tests verify delegation/unmount, not real GPU reclamation.

## Dependencies

Pinned `@react-three/fiber` **9.4.0**, `three` **0.181.2**, and development-only `@types/three` **0.181.0** are MIT licensed (installed manifests). Fiber's peer ranges accept React/React DOM `^19.0.0` and Three `>=0.156`; installed React 19.3.1 and Three 0.181.2 satisfy them. Types match Three's minor and require TypeScript ≥5.2 (project 5.9.3). No drei or new physics/runtime feature is used; transitive type-package dependencies are not application feature approval. Preserve upstream MIT notices on redistribution. Independent verification confirmed the approved direct versions, peers, MIT declarations and corresponding lockfile changes; no unrelated protected-surface changes or severe candidate-caused blockers were found. Fiber's installed package has no standalone LICENSE file (packaging advisory). A later optional installed-transitive audit could not execute after its scratch directory disappeared; comprehensive transitive license/peer validation and scratch-log retention are not claimed.

## Verification and remaining evidence

- Deterministic tests cover projection/bounds in portrait and landscape, collapsed sizing, camera convention, explicit picking, renderer configuration, initial/changed visibility, failure, context loss, StrictMode cleanup and DOM selection.
- The showcase preservation test keeps existing editable controls and dialog access beside the lazy reference.
- `e2e/world-canvas.spec.ts` passed all six desktop/mobile cases: actual WebGL, 1280/360 px overflow, reduced-motion mode, keyboard/touch DOM selection, renderer-creation failure, and real context-loss fallback. Complete browser suite: **40/40 passed**, no skipped cases, 36.8 seconds.
- Recorded technical-reference captures: [desktop, 1280 px viewport](assets/world-canvas/desktop.png) and [mobile emulation, 360 px viewport](assets/world-canvas/mobile.png). Parent inspected both: reference bounds remain visible, proportions preserved, text/button wrap without clipping. These show scale references, not finished classroom art or physical-device proof.
- On Node 22.23.4/pnpm 10.34.9: full Vitest suite **411/411 across 40 files**; lint, typecheck, default configured formatting, production/showcase builds and fresh-production security check passed. Lint reported an existing JSXEmptyExpression tooling warning; builds reported >500 kB chunks (showcase world chunk 862.87 kB before gzip). No thresholds were weakened.
- Independent scratch verification passed **25/25 focused tests** and four real Three.js raycast boundary cases. Mocks establish lifecycle delegation, not GPU reclamation.
- Initial parent checks could not execute because the shell selected a Node placeholder; explicit `node.exe` resolved that. Formatting initially failed on 16 unchanged CRLF checkout files; normalized-HEAD equality was proven before local LF normalization, with no authored Git delta. Initial browser setup failed before tests because `npm_execpath` was absent; process-only explicit pnpm path resolved it. Earlier failures remain failures, distinct from the later passing runs. Detailed parent logs are local under ignored `odd/artifacts/world-canvas/`; no deployment or remote CI run is claimed.
- **Physical-mobile notes (user-reported):** phone identified tentatively as A36, using Chrome (browser version and OS not supplied). The user saw the floor and both rounded scale references, reported no distortion or clipping when rotating the phone, successfully activated the DOM selection button and received its local-intent confirmation, and said the page looked good. Existing showcase loading/error/empty examples were explained as intentional demos, not 3D failures. The user's transcription said “12m”; source labels say “2 m”, so exact displayed-label verification is not claimed from that transcription. These are human observations, distinct from the automated mobile emulation above.
- **Measured fps/draw calls/triangles/GPU memory, a physical-device zoom/contrast/grayscale audit, and direct GPU-reclamation measurements remain unverified.** This static reference adds no runtime performance monitor; FD8 limits are requirements, not measured results ([3D rules](../rules/3d-world-and-camera.md)).
- No data loading, empty data, forms, validation or backend uncertain-write states exist in this static reference. Lazy loading and rendering failure have DOM feedback; selection has local status feedback.
