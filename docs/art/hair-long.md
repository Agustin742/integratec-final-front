# Long hairstyles (3 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 3 Long hairstyles from [asset wishlist](asset-wishlist.md) are authored once under `shared/` and weighted to canonical `DEF-spine.006` (`1.0` above `z = 0.82`) with smooth `DEF-spine.003` torso/shoulder blending below `z = 0.82` (up to `0.50` at `z <= 0.56`) on the `rig` 34-bone skeleton, verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any exported top. Wishlist checkboxes remain unchecked until merge.

## Styles, masters, and GLB exports

| Style | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`DEF-spine.003` blended) |
| --- | --- | --- | --- | --- |
| Long straight | [long-straight.blend](../../assets/blender/avatars/shared/hair/long-straight.blend) | [hair-long-straight.glb](../../public/models/avatars/shared/hair-long-straight.glb) | `248,976` B | `3` (`HairLongStraight_{Cap,Curtain,CurtainBangs}`), `9,602` (`1,871`) |
| Long wavy | [long-wavy.blend](../../assets/blender/avatars/shared/hair/long-wavy.blend) | [hair-long-wavy.glb](../../public/models/avatars/shared/hair-long-wavy.glb) | `321,456` B | `3` (`HairLongWavy_{Cap,Curtain,WaveBangs}`), `11,998` (`2,535`) |
| Long curls | [long-curls.blend](../../assets/blender/avatars/shared/hair/long-curls.blend) | [hair-long-curls.glb](../../public/models/avatars/shared/hair-long-curls.glb) | `445,464` B | `3` (`HairLongCurls_{Cap,Curls,Curtain}`), `14,120` (`3,693`) |

- [Standalone structural test](../../scripts/assets/test-long-hair.mjs).
- Ignored animated viewer: `odd/previews/long-hair-review.blend`, scenes `REVIEW_HairLong{Straight,Wavy,Curls}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

## Previews (Male and Female)

| Style | Male 1280px | Female 1280px |
| --- | --- | --- |
| Long straight | [Male 1280](../assets/hair-long-straight/male-1280.png) | [Female 1280](../assets/hair-long-straight/female-1280.png) |
| Long wavy | [Male 1280](../assets/hair-long-wavy/male-1280.png) | [Female 1280](../assets/hair-long-wavy/female-1280.png) |
| Long curls | [Male 1280](../assets/hair-long-curls/male-1280.png) | [Female 1280](../assets/hair-long-curls/female-1280.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/hair-<id>.glb`.
- Every hairstyle combines a watertight rounded-rim scalp cap (`Hair<Name>_Cap`) with a double-walled, smoothly back-tapered U-hem long drape (`Hair<Name>_Curtain`, wrapping behind the ears and tapering gracefully along the upper/mid back to `z ≈ 0.48–0.50` with row-by-row rounded front end-caps) and style-defining sculpted bangs/waves/curls (`LongStraight` soft center-parted curtain bangs, `LongWavy` continuous multi-tier S-wave curtain contour + swept side-part wave bangs, `LongCurls` overlapping curly fringe + cascading twist-free Parallel Transport helical ringlet lobes from crown to tips).
- Material `AvatarHairTint` is neutral white (`#FFFFFF`, roughness `0.65`, metallic `0.0`) in all masters and GLB exports for runtime tinting; preview renders sample the official hair palette in [art direction](../../rules/art-direction.md) (`#6C4D48`, `#E5AD58`, `#AF6D63`).
- Skinning binds `100%` (`1.0`, `1` influence) to `DEF-spine.006` above `z = 0.82` and blends smoothly with `DEF-spine.003` below `z = 0.82` (up to `0.50` chest / `0.50` head at `z <= 0.56`, `<= 2` normalized influences per vertex).

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, and `0` body/back/Wave-arm collisions (`p.z > 0.42`) across all 3 styles on both Male and Female (`odd/artifacts/long-hair-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | All 3 `shared/hair-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1..2` bone influences (`DEF-spine.006` + `DEF-spine.003` with max weight-sum error `<= 5.07e-7`), and `0` eye/lash/ear/body hits (`p.z > 0.42`) on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/long-hair-export.json`) |
| Structural & budget (`test-long-hair.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`249.0 KB–445.5 KB`, all `<= 1 MB`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarHairTint` with roughness `0.65`, plus optional `BackTuck` morph target (`0` default; `1` with Back accessories per [back accessories](back-accessories.md#runtime-integration-contract)) |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
