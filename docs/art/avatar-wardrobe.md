# Original browser-only avatar wardrobe

Open **Vestidor** from reception, or visit `/wardrobe`. This restores the original `AvatarEntry` / `AvatarCustomizer` page from the user-authorized `prueba-3d/odd/worktrees/avatar-customization` checkout; it is not a replacement UI. The selector layout, Spanish copy, palettes, nickname validation and draft/loading/error protections are retained.

## Local-only workflow

1. Select a body, hairstyle, garment, optional accessory and colors.
2. Wait for a rendered preview frame. A stale frame cannot unlock a changed selection.
3. Inspect the preview with drag/touch or Left/Right/Home keys on the rotation group.
4. Use the Idle, Walk or Sit buttons to inspect actual loaded body clips; missing clips are disabled and labeled unavailable. **Pausar movimiento** stops actions. Reduced-motion preference disables autoplay; explicit inspection is opt-in.
5. Enter a nickname and choose **Entrar a la oficina →** to remember the draft in this browser and return to reception. If browser storage fails, reception retains an accessible warning that the draft was not saved; entry can continue without pretending it persisted. **Volver a recepción** returns without confirmation.

**Reception still uses its original avatar and existing network boundaries.** The wardrobe does not update world appearance, a server account, or another device. Clearing browser data loses preferences. No multiplayer/server migration, uniform catalogue integration, cloth simulation or secondary physics is included.

## Runtime boundary

| Owner | Responsibility |
|---|---|
| `AvatarEntry` | One in-memory draft; browser preferences parsed once; readiness associated with the current appearance revision. |
| `avatar-catalogue` | Validate unknown manifest data, approved IDs, rig family and exact local paths; strip assembly metadata. The source function is named `parseAppearanceCatalogue`. |
| `avatar-preferences` | Validate field-only configuration; read legacy nickname only if the versioned preference is absent; write `avatar_appearance:v1` only on confirmation. |
| `load-customized-avatar` | One uncached body rig/mixer; load modules sequentially; validate/remap joints and inverse binds; tint declared materials only; release original/replaced materials, textures, geometry and skeletons on failure/disposal. |
| `CustomizedAvatarPreview` | Dispose obsolete loads, isolate StrictMode replay, surface safe WebGL/load failures and wait for a rendered frame. |
| `App` | History-based local route and return links; unmount reception while the wardrobe owns input. No router/runtime dependency added. |

The optional `AvatarResource.availableMotions` / `setMotion` interface is additive: the existing reception loader and world module are unchanged. Only exact Idle/Walk/Sit clips present in the loaded body are exposed. Explicit clip selection uses the existing mixer and canonical skeleton bindings, not a second animation state store.

## Source assets and provenance

- Read-only source: `D:/ALEJO/AleMart/Documents/GITHUB/IntegrarTec/ProyectoFinal/prueba-3d/odd/worktrees/avatar-customization`.
- Copied 32 original body/hair/top/accessory GLBs, both catalogue JSON files, the original customizer/entry, browser preferences, modular loader, rotation helper, preview, styles and their tests. Existing target calibration/world helpers were preserved.
- The source integration catalogue intentionally offers a smaller candidate subset, not every copied GLB. Both manifests resolve to existing local files (20 references each). Selection order and labels remain source-owned.
- Corrected source `public/models/avatars-hem-correction/female/top-hoodie.glb` is relocated byte-for-byte to `public/models/avatars/female/top-hoodie.glb`; strict validation, integration manifest and tests use that allowed local path. SHA-256: `3b07baa3ee68c9da5e2abd046403cb8d6b85cca70d0608de1d8b5d0719a33ce5` (156,060 bytes).
- Copy-time source/destination mappings, sizes and SHA-256 values are in the local-only evidence file `odd/previews/wardrobe/source-copy.json`. It is deliberately not a durable published artifact.
- Body GLB metadata reports `Khronos glTF Blender I/O v5.2.40`, glTF 2.0. Both bodies contain Idle, Walk and Sit (plus other clips not exposed by this inspection UI).
- No license file was found in the source model directory or source checkout filename search. The inspected body asset metadata contains no copyright/license declaration. Requested user-owned reuse is provenance, **not verified distribution clearance**; confirm asset rights before publication.

## Verification and limitations

Focused checks use the existing runners, without installing dependencies:

```sh
node node_modules/vitest/vitest.mjs run src/features/avatar src/app
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json
git diff --check -- src/features/avatar src/app public/models/avatars/catalogue.json docs/art/avatar-wardrobe.md
```

Tests cover original selector keyboard isolation, required nickname, draft preservation, preferences corruption/storage failure, stale/late loads, WebGL failure, rotation, real modular GLB assembly and cleanup, routes, motion switching and missing clips. Structural checks are not visual fit acceptance. Historical seated garment intersections and incomplete fit remain limitations; no finite-coordinate, mixer or test result approves garment deformation.

Browser images, desktop/mobile overflow, touch/keyboard visual behavior, actual animated garment/accessory fit, grayscale/gameplay readability and combined build/full-suite verification remain parent-owned T6 checks. No browser server was started and no screenshots were fabricated for this migration. School uniforms are intentionally not connected yet.
