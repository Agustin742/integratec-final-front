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

## Classroom kit failure recovery (#135)

The classroom reports failed kit modules to the scene and then to a DOM `role="status"` message in the 3D stage. Only the failed essential module's existing picking proxy becomes visible: floor tile, entrance threshold, student/teacher desks (including separately instanced legs), board or bookshelf. Other modules remain in the successful material batch; decorative kit failures are reported without inventing replacement geometry. Picking names, instance ordering within each desk kind, floor navigation and collision footprints remain unchanged.

Every module failure immediately invalidates the R3F demand canvas after updating proxy visibility, without waiting for other loads to settle. A regression rejects floor and desk loads separately while the board load stays pending and verifies each invalidation observes the updated visibility.

Recovery materials are cloned lazily from scene-owned proxies, never from cached GLBs. Scene disposal releases these materials and shared proxy resources exactly once. Scope changes remount the kit and stage feedback, cancel obsolete loads and allow the existing rejected-cache eviction to retry on remount; there is no automatic retry loop.

Focused automated evidence: 59 tests passed across scene building, recovery, kit loading, picking, scene/world composition and stage feedback. A real rejected-loader test covers failed floor/desks alongside a surviving board; a scene-host test verifies real kit failure recovery, scope replacement (including a return to an earlier classroom) and disposal. The reconciled candidate passed 2,019 unit tests, Node22 lint/types/build/security/format checks, and the full desktop/mobile hardware E2E suite (173 passed, one existing desktop-only measurement skipped on mobile). Independent source review confirmed the demand-frame and scene-identity corrections. [Actual recovery captures and remaining approval gates](pr136-readiness.md) distinguish verified behavior from live-backend, mobile-layout and geometry-budget limitations; no school-device performance claim is made.

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
- **Profile ownership verification**: `e2e/profile.spec.ts` mocks the published `GET /users/me/avatar/styles` (`AvatarStylesDto`) with the complete sorted catalog: free styles, acquired Rastas, and the already-saved hoodie are owned; other paid styles remain locked. The desktop/mobile flow checks Rastas is selectable, an unowned hairstyle is disabled, and the saved selection survives reload. Its diagnostic captures go to ignored `odd/artifacts/pr136-profile/`, leaving published screenshots untouched. `src/features/profile/profile-page.test.tsx` separately covers owned-style saves, unowned locks, and failed ownership reads with an explicit notice and no invented paid ownership (the confirmed saved style remains usable). These are mocked checks, not live-backend integration evidence; focused browser verification of the corrected fixture is pending.
- **Budget**: each part and base body counts as an avatar GLB (`<= 1 MB`). Both `male/body.glb` (`729,192` B) and `female/body.glb` (`887,008` B) now ship Draco-compressed within budget alongside all `16` canonical animation clips (see [avatar animations](art/avatar-animations.md)), retiring the legacy `#91` exceptions.
- **Head-accessory compatibility**: Shared head accessories (`public/models/avatars/shared/head-*.glb`) fit over standard hair caps so avatars never go bald; deterministic Three.js submesh-hiding rules for hats/crown (`Cloud`, `Bun`, `Crest`, `TousledTufts`, tied-up volumes, and `Afro + Headband`) and closed helmets (`head-astronaut-helmet.glb`, supporting all `23` hairstyles without UI blocks—`6/6` short styles fit directly in geometry, while external curtains/braids/locs hide outside the shell keeping `_Cap` + bangs visible behind `AvatarGlass`) are documented in [everyday head accessories](art/head-accessories-everyday.md#runtime-integration-contract-threejs--hair--head-accessories) and [special head accessories](art/head-accessories-special.md#runtime-integration-contract-threejs--hair--special-head-accessories).
- **Face-accessory compatibility**: Shared face accessories (`public/models/avatars/shared/face-*.glb`: `round-glasses`, `square-glasses`, `sunglasses`, `masquerade-mask`, `face-mask`, `face-paint`) bind `100%` to `DEF-spine.006`, use neutral `#FFFFFF` `AvatarAccessoryTint`, `AvatarDetail`, and `AvatarGlass` (`alphaMode: "BLEND"` on eyewear lenses), and end cleanly behind `Reference_ears` (`0` rear-hair overlaps across all `23` hairstyles; documented in [face accessories](art/face-accessories.md)).
- **Back-accessory compatibility**: Wings export once under `public/models/avatars/shared/back-wings.glb` while strap/collar-fitted back items (`backpack`, `rolling-backpack`, `superhero-cape`, `guitar`, `racket`) export under `public/models/avatars/<male|female>/back-*.glb`, using neutral `#FFFFFF` `AvatarAccessoryTint` + fixed `AvatarDetail`. Geometry adjustments keep all `15` non-long hairstyles clean (`0` hits), and the `8` long hair GLBs expose a standardized glTF morph target named `BackTuck` (default `0`; set `mesh.morphTargetInfluences[idx] = 1` whenever a back accessory is equipped) to yield `0` collisions across all `23 × 6 = 138` pairs without disabling UI options; documented in [back accessories runtime contract](art/back-accessories.md#runtime-integration-contract).
- **Hand-item compatibility**: Shared hand-held items (`public/models/avatars/shared/hand-*.glb`: `pencil`, `book`, `ruler`, `mug`, `phone`, `mate`, `magnifying-glass`, `paintbrush`, `tablet`, `trophy`) bind `100%` (`1` influence) to canonical `DEF-hand.R`, use neutral `#FFFFFF` `AvatarAccessoryTint` + `AvatarDetail` (plus `AvatarGlass` `alphaMode: "BLEND"` on `magnifying-glass`), and clear `Idle`, `Walk`, `Sit`, and `Wave` on both genders (`0` head/body/thigh hits; documented in [hand items](art/hand-items.md)).
- **Neck and ear accessory compatibility**: Shared ear items (`public/models/avatars/shared/neck-{earrings,star-earrings,ear-cuffs}.glb`, `100%` rigid `DEF-spine.006`) and body-fitted neck items (`public/models/avatars/<male|female>/neck-{scarf,necklace,bow-tie,lanyard-badge,bandana,achievement-medal}.glb`, with `bow-tie` `100%` rigid `DEF-spine.004` and draped items weighted across `DEF-spine.004/.003/.002`) use neutral `#FFFFFF` `AvatarAccessoryTint` + fixed `AvatarDetail` and clear `Body`, `Head`, `TShirt`, and `SchoolSmock` collars/busts across `Idle`, `Walk`, `Sit`, and `Wave` (`0` hits; documented in [neck and ear accessories](art/neck-ears.md)).

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

None currently active. The legacy pre-`#25` uncompressed `public/models/avatars/{male,female}/body.glb` exceptions (`#91`) were retired once both bodies shipped Draco-compressed with the full `16`-clip canonical animation set ([avatar animations](art/avatar-animations.md)).

## Welcome scene on the public screens

`/login`, `/register`, `/password-reset` and `/invitations/accept` share one brand panel, which shows an animated front view ([`preview-scene.tsx`](../src/features/world/preview/preview-scene.tsx)). The classroom keeps its own top-down view, and the profile customization preview is separate.

- **Content:** a random character from the profile catalogs, in one outfit, waves, plays one of `Cheer`, `Clap` or `Dance` (only positive gestures on public screens), rests on `Idle` and repeats. Character, outfit and scenery are drawn once per page load and change only on reload.
- **Face:** slightly happy, like the profile preview ([resting face](art/avatar-animations.md#resting-face)).
- **Backdrop:** a CSS gradient from a cream sky (`--stage-sky`) to a sand floor (`--stage-floor`) behind a transparent canvas, in a rounded frame on the green panel. The classroom canvas stays opaque.
- **Scenery:** one of the five classroom theme corners behind the character, or two pieces from the hallway, schoolyard, library or lab beside it. The hallway also lays a runner rug and the schoolyard a ground tile under the character. Wide pieces are shrunk just enough to stay inside the 16:9 frame. Every page load draws again; randomness is injected through `PreviewScene`'s `random` prop.
- **Loading:** `PreviewScene` imports no Three.js. The scene is a lazy chunk, requested only when the browser has WebGL 2. The panel box has a fixed aspect ratio, so the form never waits or moves.
- **Fallback:** without WebGL, after a lost context, or when the chunk or the body fails, the box stays empty and decorative. A scenery piece that fails is left out.
- **Motion:** under `prefers-reduced-motion` the character holds one `Idle` pose. The canvas renders on demand and pauses while hidden or offscreen.
- **Resources:** the composed avatar is disposed with the scene; cached models are freed when the visitor leaves these screens.
- **CSP:** the scenery and character models have no embedded textures. Models that do are covered by [embedded textures and the CSP](#embedded-textures-and-the-csp).

## Embedded textures and the CSP

`GLTFLoader` turns an embedded image into a `blob:` URL. Its default `ImageBitmapLoader` fetches that URL, which the CSP `connect-src` blocks. The shared loader in [`asset-cache.ts`](../src/features/world/asset-cache.ts) reads textures through `TextureLoader` instead: an image element, covered by `img-src 'self' data: blob:`. The policy is unchanged.

## Tutor bot skins

Classroom staff choose the skin in the classroom settings panel (`Robot tutor`). The value synced by the room wins over the REST one, and an unknown value shows the default bot. [`tutor-bot-skin.ts`](../src/features/world/npc/tutor-bot-skin.ts) follows the [art contract](art/tutor-bot-skins.md): it binds a copy of the skin to the bot bones by name and hides the base meshes it covers, which are therefore never merged. Taking a skin off restores them and frees the skin's own cache scope. A skin that cannot load or does not fit the rig leaves the default bot.
