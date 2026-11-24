# 3D Asset Pipeline & Budget (FD8)

This guide defines how GLB/glTF assets are compressed, loaded, cached, disposed, and checked against the FD8 performance budget (`rules/3d-world-and-camera.md`).

## Runtime Loader & Same-Origin Decoders

- **Loaders**: `createConfiguredGltfLoader()` in `src/features/world/asset-cache.ts` configures `GLTFLoader` with:
  - `DRACOLoader` reading from `/decoders/draco/` (`public/decoders/draco/`).
  - `KTX2Loader` reading from `/decoders/basis/` (`public/decoders/basis/`).
  - `MeshoptDecoder` bundled from `three/examples/jsm/libs/meshopt_decoder.module.js`.
- **CSP compatibility**: `src/config/security-headers.ts` allows `'wasm-unsafe-eval'` in `script-src` and `blob:` in `worker-src` so same-origin Draco and KTX2 WebAssembly decoders run without enabling JavaScript `eval()`.
- **Caching & isolation**: `loadGlbAsset()` / `readCachedGlbAsset()` deduplicate fetches and parses per URL. `<GlbAsset />` (`src/features/world/glb-asset.tsx`) wraps each asset in its own `Suspense` and error boundary so a failing GLB renders a placeholder without breaking the rest of the scene.
- **Disposal**: `disposeObject3D()` and `clearAssetCache()` release geometries, materials, textures, and skeletons when `WorldCanvas` unmounts, when `scopeKey` (classroom) changes, or when `ClassroomWorkspace` runs its `SessionController` logout cleanup (which also disposes shared Draco/KTX2 decoders). Individual `WebGLRenderTarget` instances are disposed via `disposeObject3D(renderTarget)`.

## Modular Avatars

The base avatar is modular: one skinned body plus optional hair and top parts, all sharing the same skeleton (female 41 joints, male 34).

```text
public/models/avatars/<male|female>/
  body.glb          skinned body, animation clips (for example Idle), morph targets
  hair-<id>.glb     hair part; its material is named AvatarHairTint
  top-<id>.glb      top part; its material is named AvatarTopTint
```

- **Tinting**: `hairColor` and `clothingColor` recolor the materials named `AvatarHairTint` and `AvatarTopTint`. `composeAvatar()` clones those materials per avatar instance, so two avatars with different colors never share state, and everything it creates is released by its `dispose()`. Other materials (skin, shoes) keep their authored look.
- **Composition**: `composeAvatar()` (`src/features/world/avatar/compose-avatar.ts`) carries every part mesh onto the body, skinned or static, preserving its authored world placement (a mesh nested under a transform group keeps its place). Skinned meshes are bound to the body skeleton by bone name. A part that does not match the body skeleton is skipped and reported, never half-bound. `resolveAvatarParts()` maps a saved configuration to the three URLs and the two tints.
- **`AvatarModel`** (`src/features/world/avatar/avatar-model.tsx`) is the single component every 3D surface uses to draw a configured avatar:

| Prop                            | Purpose                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `avatar`                        | The five saved fields (`bodyId`, `hairId`, `topId`, `hairColor`, `clothingColor`).                                                                                                                                                                                                                                                                   |
| `scopeKey`                      | Asset-cache scope; the host's `WorldCanvas` frees it on unmount.                                                                                                                                                                                                                                                                                     |
| `position`, `rotation`, `scale` | Placement of the composed avatar.                                                                                                                                                                                                                                                                                                                    |
| `animation`                     | Clip name in `body.glb` (for example `Idle`). Under `prefers-reduced-motion`, or when the clip does not exist, the avatar is posed at the clip's first frame (or left in the bind pose when there is no clip) and does not move. A playing clip invalidates the `demand` frame loop every frame, so it keeps animating without `frameloop="always"`. |
| `fallback`, `errorFallback`     | Scene content while files load and when the body fails.                                                                                                                                                                                                                                                                                              |
| `onBodyError`, `onPartsSkipped` | Lets a DOM host react to a failed body or to omitted parts.                                                                                                                                                                                                                                                                                          |

- **Fallbacks**: a hair or top that fails to load (or does not fit the body) is left out and the body still renders; its rejected cache entry is evicted so a later mount retries. A failing body shows `errorFallback` and calls `onBodyError`; the profile preview then shows the 2D `AvatarPreview`. WebGL being unavailable or lost also shows the 2D preview, through `WorldCanvas`'s `onUnavailable`. An asset failure never blocks saving the avatar.
- **Profile preview**: `AvatarPreviewView` (`src/features/profile/avatar-preview-view.tsx`) shows the draft in 3D, loaded as a lazy chunk (the 2D preview is shown while it loads), using `WorldCanvas` with `framing="avatar"` (front view, head to feet; bounds in `AVATAR_FRAME`, `camera.ts`) and the shared `WarmLighting`. It uses its own `scopeKey` (`profile-avatar-preview`). While the avatar files download, the canvas shows a neutral placeholder silhouette (`AvatarModel`'s `fallback`), and the loading announcement stays visible, so the preview is never an empty stage.
- **Budget**: each part counts as an avatar GLB (`<= 1 MB`); the two `body.glb` files are recorded exceptions below until #91.
- **Head-accessory compatibility**: Shared head accessories (`public/models/avatars/shared/head-*.glb`) fit over standard hair caps so avatars never go bald; deterministic Three.js submesh-hiding rules for hats/crown (`Cloud`, `Bun`, `Crest`, `TousledTufts`, tied-up volumes, and `Afro + Headband`) and closed helmets (`head-astronaut-helmet.glb`, supporting all `23` hairstyles without UI blocks—`6/6` short styles fit directly in geometry, while external curtains/braids/locs hide outside the shell keeping `_Cap` + bangs visible behind `AvatarGlass`) are documented in [everyday head accessories](art/head-accessories-everyday.md#runtime-integration-contract-threejs--hair--head-accessories) and [special head accessories](art/head-accessories-special.md#runtime-integration-contract-threejs--hair--special-head-accessories).
- **Face-accessory compatibility**: Shared face accessories (`public/models/avatars/shared/face-*.glb`: `round-glasses`, `square-glasses`, `sunglasses`, `masquerade-mask`, `face-mask`, `face-paint`) bind `100%` to `DEF-spine.006`, use neutral `#FFFFFF` `AvatarAccessoryTint`, `AvatarDetail`, and `AvatarGlass` (`alphaMode: "BLEND"` on eyewear lenses), and end cleanly behind `Reference_ears` (`0` rear-hair overlaps across all `23` hairstyles; documented in [face accessories](art/face-accessories.md)).
- **Back-accessory compatibility**: Wings export once under `public/models/avatars/shared/back-wings.glb` while strap/collar-fitted back items (`backpack`, `rolling-backpack`, `superhero-cape`, `guitar`, `racket`) export under `public/models/avatars/<male|female>/back-*.glb`, using neutral `#FFFFFF` `AvatarAccessoryTint` + fixed `AvatarDetail`. Geometry adjustments keep all `15` non-long hairstyles clean (`0` hits), and the `8` long hair GLBs expose a standardized glTF morph target named `BackTuck` (default `0`; set `mesh.morphTargetInfluences[idx] = 1` whenever a back accessory is equipped) to yield `0` collisions across all `23 × 6 = 138` pairs without disabling UI options; documented in [back accessories runtime contract](art/back-accessories.md#runtime-integration-contract).

## Authoring & Compression Pipeline

All production `.glb` assets under `public/models/` should be compressed before committing:

```bash
# Geometry compression (Draco or meshopt) + KTX2/BasisU texture compression
npx @gltf-transform/cli optimize input.glb output.glb \
  --compress draco \
  --texture-compress ktx2
```

For manual texture-only compression with Khronos KTX-Software (`toktx`):

```bash
toktx --t2 --uastc 2 --zcmp 18 output.ktx2 input.png
```

Target conventions (`rules/3d-world-and-camera.md`):

- World units: `1 unit = 1 meter`, `Y` up, ground plane at `Y = 0`.
- Keep draw calls `<= 100`, triangles `<= 200k`, and GPU memory `<= 256 MB` (runtime measurement deferred to F17).

## Budget Check (`pnpm assets:check`)

`pnpm assets:check` runs `scripts/assets/check-asset-budget.mjs` against `public/models/` and is wired into `.github/workflows/ci.yml`:

| Category             | Limit (FD8)                   | Scope                                                                                               |
| -------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Avatar GLB           | `<= 1 MB` (`1,048,576` bytes) | Individual avatar/character `.glb` files (excluding scene files)                                    |
| Full classroom scene | `<= 8 MB` (`8,388,608` bytes) | Scene `.glb` files (`scenes/` path or `classroom*` / `scene*` filename prefix) and total scene size |

The script prints a per-file report and exits with code `1` if any file exceeds its limit.

## Recording a Budget Exception

Per `rules/documentation-and-decisions.md` and `rules/3d-world-and-camera.md`, any asset that must temporarily or permanently exceed the FD8 table requires a recorded exception before merging:

1. **Scope**: exact file path(s) and measured size vs. budget.
2. **Reason**: why compression/simplification cannot meet the limit without breaking functionality or readability.
3. **Approving team decision**: PR/issue link with explicit team sign-off.
4. **Review condition**: milestone or condition under which the exception will be re-evaluated or removed.

### Recorded Exceptions

| Asset path                              | Size vs. FD8 budget                 | Reason                                                     | Approving team decision                                                                | Review condition                                                                                      |
| --------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `public/models/avatars/female/body.glb` | `3.63 MB` (`3,804,416` B) vs `1 MB` | Pre-existing uncompressed avatar GLB predating issue `#25` | Issue `#25` / PR `#90` (exact byte ceiling in `scripts/assets/check-asset-budget.mjs`) | Issue `#91` — compress below `1 MB` and remove this entry and `BUDGET_EXCEPTIONS` entry once resolved |
| `public/models/avatars/male/body.glb`   | `2.61 MB` (`2,740,644` B) vs `1 MB` | Pre-existing uncompressed avatar GLB predating issue `#25` | Issue `#25` / PR `#90` (exact byte ceiling in `scripts/assets/check-asset-budget.mjs`) | Issue `#91` — compress below `1 MB` and remove this entry and `BUDGET_EXCEPTIONS` entry once resolved |
