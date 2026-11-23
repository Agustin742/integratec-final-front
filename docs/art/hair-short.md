# Short hairstyles (6 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 6 Short hairstyles from [asset wishlist](asset-wishlist.md) are authored once under `shared/` and weighted `100%` to canonical `DEF-spine.006` (`rig` 34-bone skeleton), verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any exported top. Wishlist checkboxes remain unchecked until merge.

## Styles, masters, and GLB exports

| Style | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices |
| --- | --- | --- | --- | --- |
| Buzz cut | [buzz-cut.blend](../../assets/blender/avatars/shared/hair/buzz-cut.blend) | [hair-buzz-cut.glb](../../public/models/avatars/shared/hair-buzz-cut.glb) | `20,280` B | `1` (`HairBuzzCut_Cap`), `1,658` |
| Classic short | [classic-short.blend](../../assets/blender/avatars/shared/hair/classic-short.blend) | [hair-classic-short.glb](../../public/models/avatars/shared/hair-classic-short.glb) | `23,020` B | `2` (`HairClassicShort_{Cap,FrontWave}`), `1,900` |
| Fringe | [fringe.blend](../../assets/blender/avatars/shared/hair/fringe.blend) | [hair-fringe.glb](../../public/models/avatars/shared/hair-fringe.glb) | `25,880` B | `2` (`HairFringe_{Cap,Bangs}`), `2,368` |
| Short curls | [short-curls.blend](../../assets/blender/avatars/shared/hair/short-curls.blend) | [hair-short-curls.glb](../../public/models/avatars/shared/hair-short-curls.glb) | `46,744` B | `2` (`HairShortCurls_{Cap,Curls}`), `5,826` |
| Soft mohawk | [soft-mohawk.blend](../../assets/blender/avatars/shared/hair/soft-mohawk.blend) | [hair-soft-mohawk.glb](../../public/models/avatars/shared/hair-soft-mohawk.glb) | `25,088` B | `2` (`HairSoftMohawk_{Cap,Crest}`), `2,156` |
| Side part | [side-part.blend](../../assets/blender/avatars/shared/hair/side-part.blend) | [hair-side-part.glb](../../public/models/avatars/shared/hair-side-part.glb) | `26,540` B | `2` (`HairSidePart_{Cap,Sweep}`), `2,586` |

- [Standalone structural test](../../scripts/assets/test-short-hair.mjs).
- Ignored animated viewer: `odd/previews/short-hair-review.blend`, scenes `REVIEW_Hair{BuzzCut,ClassicShort,Fringe,ShortCurls,SoftMohawk,SidePart}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

## Previews (Male and Female)

| Style | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Buzz cut | [Male 1280](../assets/hair-buzz-cut/male-1280.png) | [Male 360](../assets/hair-buzz-cut/male-360.png) | [Female 1280](../assets/hair-buzz-cut/female-1280.png) | [Female 360](../assets/hair-buzz-cut/female-360.png) |
| Classic short | [Male 1280](../assets/hair-classic-short/male-1280.png) | [Male 360](../assets/hair-classic-short/male-360.png) | [Female 1280](../assets/hair-classic-short/female-1280.png) | [Female 360](../assets/hair-classic-short/female-360.png) |
| Fringe | [Male 1280](../assets/hair-fringe/male-1280.png) | [Male 360](../assets/hair-fringe/male-360.png) | [Female 1280](../assets/hair-fringe/female-1280.png) | [Female 360](../assets/hair-fringe/female-360.png) |
| Short curls | [Male 1280](../assets/hair-short-curls/male-1280.png) | [Male 360](../assets/hair-short-curls/male-360.png) | [Female 1280](../assets/hair-short-curls/female-1280.png) | [Female 360](../assets/hair-short-curls/female-360.png) |
| Soft mohawk | [Male 1280](../assets/hair-soft-mohawk/male-1280.png) | [Male 360](../assets/hair-soft-mohawk/male-360.png) | [Female 1280](../assets/hair-soft-mohawk/female-1280.png) | [Female 360](../assets/hair-soft-mohawk/female-360.png) |
| Side part | [Male 1280](../assets/hair-side-part/male-1280.png) | [Male 360](../assets/hair-side-part/male-360.png) | [Female 1280](../assets/hair-side-part/female-1280.png) | [Female 360](../assets/hair-side-part/female-360.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/hair-<id>.glb`.
- Every hairstyle uses a watertight rounded-rim cap conformed to `Reference_Head` with smooth temple/ear arches (`z >= 0.982` over ears), tapered nape (`z >= 0.818` clearing top collars), and forehead bangs/waves kept clear of eyes and Female `Reference_Eyelashes` (`z >= 1.012`, `>= 3.9 cm` clearance).
- Material `AvatarHairTint` is neutral white (`#FFFFFF`, roughness `0.65`, metallic `0.0`) in all masters and GLB exports for runtime tinting; preview renders sample the official hair palette in [art direction](../../rules/art-direction.md) (`#353849`, `#6C4D48`, `#AF6D63`, `#C77DAA`, `#E5AD58`).
- Skinning binds `100%` (`1.0`, `1` influence per vertex) to `DEF-spine.006`; none of the 6 short styles drape onto the shoulders, so `DEF-spine.003` is unused.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, and `0` ear collisions across all 6 styles on both Male and Female (`odd/artifacts/short-hair-author-report.json`); minimum clearance `3.9 cm` eyes / `4.1 cm` eyelashes (`Fringe`), `4.6 cm+` ears |
| Decoded GLB roundtrip (Blender MCP) | All 6 `shared/hair-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1` bone influence (`DEF-spine.006`, weight `1.0` with `0.0` sum error), and `0` eye/lash/ear hits across decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/short-hair-export.json`) |
| Structural & budget (`test-short-hair.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`20.3 KB–46.7 KB`, all `<= 1 MB`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarHairTint` with roughness `0.65` |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
