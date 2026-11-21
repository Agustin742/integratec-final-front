# 3D Performance Monitor and 2D Classic Mode Offer (`#56`)

The classroom 3D stage measures its own rendered frame rate and, when a device cannot sustain the FD8 budget, **offers** the 2D Classic Mode. The offer is never forced: accepting calls the existing `HU-ESP-003` mode action ([Classroom workspace](./classroom-workspace.md#classic-2d-mode-switch-34)); declining keeps the 3D stage; the app never switches modes by itself. Decision record: [FD8](./technical-justification.md#fd8-3d-performance-budget).

## How it measures

| Piece                         | File                                                  | Role                                                                                                                            |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `FpsSampler`                  | `src/features/world/performance-monitor.ts`           | Pure rolling-window sampler fed with frame timestamps (no React, no three.js; tested with a simulated frame source).           |
| `PerformanceProbeRuntime`     | `src/features/world/performance-monitor.ts`           | Combines the sampler, throttled stats publishing, and a one-shot "sustained low" trigger that re-arms after the rate recovers. |
| `PerformanceProbe`            | `src/features/world/performance-probe.tsx`            | Renders inside the R3F `Canvas`, feeds every rendered frame (`useFrame`) and reads draw calls/triangles from `gl.info`.         |
| `PerformanceStatsOverlay`     | `src/features/world/performance-stats-overlay.tsx`    | Dev-time overlay (English, `aria-hidden`, absent in `production` builds) reporting fps, draw calls, triangles, GPU memory.      |
| `usePerformanceOfferStore`    | `src/features/classrooms/performance-offer-store.ts`  | In-memory per-session state `idle \| offering \| declined \| accepted`, reset on logout.                                        |
| `PerformanceOfferBanner`      | `src/features/classrooms/performance-offer-banner.tsx` | Non-blocking es-AR banner (`role="status"`, `aria-live="polite"`); rendered by the workspace in 3D mode only.                 |

### Thresholds and window (defined here, per the issue)

- **Measurement:** the canvas runs with `frameloop="demand"`, so an idle scene renders no frames. The sampler therefore measures the **rendered cadence** (timestamps of frames actually drawn), never wall-clock time: a static scene, a hidden tab or any gap longer than `1000 ms` resets the window and never triggers the offer.
- **Window:** the newest `8000 ms` of rendered frames, at most `700` stored samples, and at least `30` frames before any decision. Very slow devices that cannot fill `30` frames in the window (below ~3.75 fps) may also decide once the sampled frames span at least `6000 ms` (`minDecisionSpanMs`) with 2 or more frames. A gap above `1000 ms` between frames is still treated as idle and resets the window, so a device rendering below 1 fps is indistinguishable from an idle pause and is never offered 2D mode.
- **Offer threshold:** mean fps `< 24` (80% of the conservative `30 fps` integrated-GPU target; `0.5 fps` measurement tolerance so a nominal 24 fps stream is not flagged). The `30 fps` target is the trigger baseline because usability is the concern and runtime GPU-class detection is unreliable; the `60 fps` mid-range figure is reported by the dev overlay as the aspiration target and is never a trigger.
- **FD8 limits shown by the overlay:** `100` draw calls, `200 000` triangles, `256 MB` GPU memory. The GPU figure is a documented **estimate** (three.js exposes counts, not bytes): attribute/index sizes plus RGBA8 texture pixels with a 4/3 mip factor; unknown sizes count as `0`.

## Offer behavior

- **Shown once per session unless conditions change (S5):** the store offers once; a decline is remembered for the app session (in memory, reset on logout; cross-session persistence is not specified by the card and is not invented). If the user later returns to 3D after accepting, the next sustained-low period offers again — that is the "conditions change" interpretation.
- **Accepting** runs the workspace's `setClassroomMode(userId, '2d')` action, unmounting the canvas (zero `<canvas>` elements).
- **Declining** dismisses the banner for the session and keeps the 3D stage.
- **Accessibility:** the banner is a polite live `status` region that never steals focus or blocks the page; both actions are native buttons reachable by keyboard. Copy is centralized in `src/features/classrooms/messages.ts` (`performanceOffer`, es-AR voseo).
- **No telemetry:** nothing is sent to the server; the numbers stay in the browser.

## Reference-scene measurements

Recorded by `e2e/performance-offer.spec.ts` (Chromium via Playwright, 1280 px desktop project; mobile project for the 360 px capture) against the synthetic classroom workspace route. The classroom stage currently contains **no animating content and no meshes**, so these are the numbers of the empty stage, not of a populated classroom; re-measure when the scene gains content ([3D assets](./3d-assets.md)).

| Condition                                              | fps (rolling mean) | Draw calls | Triangles | GPU memory est. | Offer          |
| ------------------------------------------------------ | ------------------ | ---------- | --------- | --------------- | -------------- |
| Unthrottled, desktop, resize-driven frames (~10 s)     | 33.4               | 0 / 100    | 0 / 200000 | 0 B / 256 MB   | Not shown      |
| CPU throttled 20x, desktop 1280 px                     | 6.8                | 0 / 100    | 0 / 200000 | 0 B / 256 MB   | Shown          |
| CPU throttled 20x, mobile emulation 360 px             | 4.3                | 0 / 100    | 0 / 200000 | 0 B / 256 MB   | Shown          |

Readings vary between runs (earlier runs read 30.4 to 30.7 unthrottled, 6.5 to 8.1 throttled desktop and 6.0 to 6.7 throttled mobile); the values above are from the final recorded run.

> [!NOTE]
> The empty demand-loop stage renders no frames by itself. The e2e drives real rendered frames through the app's own re-frame-on-resize path (`CameraFraming` → `invalidate()`), so the unthrottled fps is a property of that resize cadence, not a device benchmark. The throttled rows show that a slow device crosses the threshold and the offer appears; they are not a claim about any specific school machine. Draw calls and triangles read `0` because the stage has no meshes yet.

## Tests

- `performance-monitor.test.ts`: simulated frame source for the sampler (60 fps, 30 fps, 24 fps boundary, 23 fps, 4 fps, short dip, idle-gap reset) and the GPU-memory estimator.
- `performance-probe.test.tsx` / `performance-stats-overlay.test.tsx`: one trigger per sustained low period with re-arm after recovery, published draw calls/triangles/GPU estimates, overlay readout against the FD8 budget.
- `performance-offer-store.test.ts` / `performance-offer.test.tsx`: fine performance never offers, sustained low fps announces the offer **without switching modes**, accept calls the mode action, decline keeps 3D and is remembered for the session.
- `e2e/performance-offer.spec.ts`: offer under throttled real frames, decline keeps 3D, accept switches to 2D, no CSP violations, no page errors, no horizontal overflow, desktop and mobile projects.

## UI evidence

- Desktop (`1280px`): [performance-offer-1280.png](./assets/classroom-workspace/performance-offer-1280.png)
- Mobile (`360px`): [performance-offer-360.png](./assets/classroom-workspace/performance-offer-360.png)
