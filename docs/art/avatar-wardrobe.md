# Original browser-only avatar wardrobe

The wardrobe is the first screen when the page loads (`/` or `/wardrobe`), like a game menu. Confirm your avatar to enter reception wearing it; the **Vestidor** button inside reception reopens the wardrobe. This restores the original `AvatarEntry` / `AvatarCustomizer` page from the user-authorized `prueba-3d/odd/worktrees/avatar-customization` checkout; it is not a replacement UI. The selector layout, Spanish copy, palettes, nickname validation and draft/loading/error protections are retained.

## Local-only workflow

1. Select a body, hairstyle, garment, optional accessory and colors.
2. Wait for a rendered preview frame. A stale frame cannot unlock a changed selection.
3. Inspect the preview with drag/touch or Left/Right/Home keys on the rotation group.
4. Pick one of the two school uniforms from **Prenda** (see [School uniforms in the wardrobe](#school-uniforms-in-the-wardrobe)), then check it in the preview card. The card shows only a status line and the 3D avatar; the Idle, Walk, Sit and **Pausar movimiento** buttons were removed.
5. Enter a nickname and choose **Entrar a la oficina →** to remember the draft in this browser and enter reception with the customized avatar. If browser storage fails, reception retains an accessible warning that the draft was not saved; entry can continue without pretending it persisted.
6. In reception, the floating **Vestidor** button (top right) reopens the wardrobe. The old top navigation link and draft note were removed.

**Reception shows the customized avatar built from the confirmed selection, within existing network boundaries.** This remains a local-browser preview: the wardrobe does not update a server account, shared-room appearance, or another device. Clearing browser data loses preferences. No multiplayer/server migration, cloth simulation or secondary physics is included.

## School uniforms in the wardrobe

Both `male/body.glb` and `female/body.glb` keep their original base `Pants` and `boots` from the waist down; the wardrobe never hides, replaces or re-loads them. The two school uniforms are ordinary single-file upper-body **Prenda** (`tops`) options in [`src/features/avatar/integration-catalogue.json`](../../src/features/avatar/integration-catalogue.json), appended after the original garments: **Uniforme primaria** (`coat-tie.glb`) and **Uniforme secundaria** (`polo-sweater.glb`). Each loads one GLB over the unmodified base body, with no `extraPaths` and no `hideBodyMeshes`. Uniforms declare no tint, so the clothing color control does not recolor them. The trousers, skirt and shoes modules from the design study are not offered in the wardrobe.

| Body | Option ID (label) |
|---|---|
| Male | `uniform-primary` (Uniforme primaria, `coat-tie.glb`); `uniform-secondary` (Uniforme secundaria, `polo-sweater.glb`) |
| Female | `uniform-primary` (Uniforme primaria, `coat-tie.glb`); `uniform-secondary` (Uniforme secundaria, `polo-sweater.glb`) |

The loader still exposes Idle, Walk and Sit clips for every uniform, but the wardrobe no longer shows buttons to switch them. **Known limitation:** the Sit pose still deforms uniforms (coat side-front penetration, exposed elbows on secondary sleeves). The user accepted this limitation when connecting the uniforms; it is not fit approval. See [student-uniforms.md](./student-uniforms.md) for the study evidence.

## Runtime boundary

| Owner | Responsibility |
|---|---|
| `AvatarEntry` | One in-memory draft; browser preferences parsed once; readiness associated with the current appearance revision. |
| `avatar-catalogue` | Validate unknown manifest data, approved IDs, rig family and exact local paths (one to five options per slot); strip assembly metadata. Uniform options are exact single-file tops (`uniform-primary` / `uniform-secondary`); no option may carry `extraPaths` or `hideBodyMeshes`. The source function is named `parseAppearanceCatalogue`. |
| `avatar-preferences` | Validate field-only configuration; read legacy nickname only if the versioned preference is absent; write `avatar_appearance:v1` only on confirmation. |
| `load-customized-avatar` | One uncached body rig/mixer; never hide body meshes (base `Pants` and `boots` stay visible); load each selected slot's single `path` sequentially; validate/remap joints and inverse binds; tint declared materials only; release original/replaced materials, textures, geometry and skeletons on failure/disposal. |
| `CustomizedAvatarPreview` | Dispose obsolete loads, isolate StrictMode replay, surface safe WebGL/load failures and wait for a rendered frame. |
| `ReceptionPreview` | With a confirmed `configuration` and `catalogue`, load the avatar via `loadCustomizedAvatar`; otherwise fall back to the original `loadAvatar`. |
| `App` | Start in the wardrobe, hold the confirmed selection in memory, enter reception with it, keep any storage warning visible and reopen the wardrobe from the **Vestidor** button. No router/runtime dependency added. |

The optional `AvatarResource.availableMotions` / `setMotion` interface is additive and remains in the loader, but no wardrobe UI uses it now. Only exact Idle/Walk/Sit clips present in the loaded body are exposed.

## Source assets and provenance

- Read-only source: `D:/ALEJO/AleMart/Documents/GITHUB/IntegrarTec/ProyectoFinal/prueba-3d/odd/worktrees/avatar-customization`.
- Copied 32 original body/hair/top/accessory GLBs, [`src/features/avatar/integration-catalogue.json`](../../src/features/avatar/integration-catalogue.json), the original customizer/entry, browser preferences, modular loader, rotation helper, preview, styles and their tests. Existing target calibration/world helpers were preserved.
- [`src/features/avatar/integration-catalogue.json`](../../src/features/avatar/integration-catalogue.json) is the single source of truth for the avatar catalogue and intentionally offers a curated candidate subset, not every copied GLB. Its 24 asset references (20 original plus 4 uniform GLBs) resolve to existing local files under `public/models/avatars/`. Original selection order and labels remain source-owned; uniform options are appended.
- Corrected source `public/models/avatars-hem-correction/female/top-hoodie.glb` is relocated byte-for-byte to `public/models/avatars/female/top-hoodie.glb`; strict validation, integration manifest and tests use that allowed local path. SHA-256: `3b07baa3ee68c9da5e2abd046403cb8d6b85cca70d0608de1d8b5d0719a33ce5` (156,060 bytes).
- Copy-time source/destination mappings, sizes and SHA-256 values are in the local-only evidence file `odd/previews/wardrobe/source-copy.json`. It is deliberately not a durable published artifact.
- Body GLB metadata reports `Khronos glTF Blender I/O v5.2.40`, glTF 2.0. Both bodies contain Idle, Walk and Sit (plus other clips not exposed by this inspection UI).
- No license file was found in the source model directory or source checkout filename search. The inspected body asset metadata contains no copyright/license declaration. Requested user-owned reuse is provenance, **not verified distribution clearance**; confirm asset rights before publication.

## Verification and limitations

Focused checks use the existing runners, without installing dependencies:

```sh
node node_modules/vitest/vitest.mjs run src/features/avatar src/features/world src/app
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json
python scripts/ci/check_docs.py docs/art/avatar-wardrobe.md docs/art/student-uniforms.md
git diff --check -- src/features/avatar src/features/world src/app vite.config.ts docs/art/avatar-wardrobe.md docs/art/student-uniforms.md
```

The avatar catalogue lives solely at [`src/features/avatar/integration-catalogue.json`](../../src/features/avatar/integration-catalogue.json) (imported by `AvatarEntry.tsx`, because Vite rejects JavaScript imports from `public/`); no duplicate catalogue JSON files are kept under `public/models/avatars/`.

Tests cover uniform catalogue validation (exact single-file paths, rejected companion fields, five-option bound), three-GLB loading (body, hair, top) with base `Pants` and `boots` kept visible, and cleanup, plus original selector keyboard isolation, required nickname, draft preservation, preferences corruption/storage failure, stale/late loads, WebGL failure, rotation, real modular GLB assembly and cleanup, the wardrobe-first entry, confirmed-avatar handoff into reception, the **Vestidor** button and the removed motion buttons. Structural checks are not visual fit acceptance. Historical seated garment intersections and incomplete fit remain limitations; no finite-coordinate, mixer or test result approves garment deformation.

Browser images, desktop/mobile overflow, touch/keyboard visual behavior, actual animated garment/accessory fit, grayscale/gameplay readability and combined build/full-suite verification remain parent-owned checks. No browser server was started and no screenshots were fabricated for this integration. Uniform modules export their armature container as `rig.058` instead of `rig`; the loader now compares parent names only when a parent is a bone, and still validates rest and inverse-bind matrices.
