# Holiday sweater — modular asset candidate

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock on the unchanged existing male and female bodies, adding a chunky ribbed knit waistband (`Waistband`), ribbed knit wrist cuffs (`Cuff_L`, `Cuff_R`), a ribbed crewneck collar (`CrewCollar`), horizontal Fair-Isle border bands across torso and sleeves (`FairIsleBands`), front and rear geometric knit diamond motifs (`ChevronTrim`), and a centered 6-point winter snowflake emblem (`ChestEmblem`). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/holiday-sweater.blend): `HolidaySweater_Master_Male` and `HolidaySweater_Master_Female` scenes (`8` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-holiday-sweater.glb): `79,216` bytes.
- [Female export](../../public/models/avatars/female/top-holiday-sweater.glb): `80,520` bytes.
- [Standalone structural test](../../scripts/assets/test-holiday-sweater.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-seasonal-tops-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/seasonal-tops-review.blend`, scenes `REVIEW_HolidaySweater_Female` and `REVIEW_HolidaySweater_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/holiday-sweater/male-1280.png) |
| Female | [Preview](../assets/holiday-sweater/female-1280.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `HolidaySweater_{Male,Female}_Shell` so runtime tinting reproduces palette colors accurately (previewed in festive coral red `#E66861`).
- `AvatarDetail` (`#FFF9EB` pale cream, roughness `0.88`, metallic `0.0`) covers ribbed `Waistband`, `Cuff_L`/`Cuff_R`, `CrewCollar`, `FairIsleBands`, `ChevronTrim`, and `ChestEmblem`.
- Surface-projected/sampled details (`Waistband`, `FairIsleBands`, `ChevronTrim`, `ChestEmblem`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell so sleeve bands and torso knit patterns deform smoothly across animated poses; `CrewCollar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` `CrewCollar`-head collisions against `Reference_Head` across both genders (`odd/artifacts/seasonal-tops-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`79,216 B`, `7,564` verts across `8` meshes, max `4` influences, max sum error `7.08e-7`) and `Female` (`80,520 B`, `7,580` verts across `8` meshes, max `4` influences, max sum error `7.23e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/seasonal-tops-export.json`) |
| Outward sleeve normals (`test-seasonal-tops-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-holiday-sweater.mjs`, `check-asset-budget.mjs`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
