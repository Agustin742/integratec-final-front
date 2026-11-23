# Sweater — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock and add a chunky ribbed knit waistband, ribbed wrist cuffs, a layered V-neck undershirt triangle, a continuous folded V-neck knit collar trim, and a horizontal torso chest knit accent band. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/sweater.blend): `Sweater_Master_Male` and `Sweater_Master_Female` scenes (`7` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-sweater.glb): `58,232` bytes.
- [Female export](../../public/models/avatars/female/top-sweater.glb): `59,192` bytes.
- [Standalone structural test](../../scripts/assets/test-sweater.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-sweater-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/sweater-review.blend`, scenes `REVIEW_Sweater_Female` and `REVIEW_Sweater_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/sweater/male-1280.png) | [Preview](../assets/sweater/male-360.png) |
| Female | [Preview](../assets/sweater/female-1280.png) | [Preview](../assets/sweater/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `Sweater_{Male,Female}_{Shell,Waistband,WristCuff_L,WristCuff_R}` so runtime tinting reproduces palette colors accurately (previewed in cozy coral `#E66861`).
- `AvatarDetail` (`#FFF9EB` pale cream contrast, roughness `0.85`, metallic `0.0`) covers the continuous V-neck knit trim (`VNeckTrim`), inner undershirt triangle (`InnerShirt`), and horizontal chest band (`ChestBand`).
- Surface-projected/sampled details (`Waistband`, `InnerShirt`, `VNeckTrim`, `ChestBand`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell; `WristCuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` `VNeckTrim`-head collisions against `Reference_Head` across both genders (`odd/artifacts/sweater-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`58,232 B`, `4,910` verts across `7` meshes, max `4` influences, max sum error `7.32e-7`) and `Female` (`59,192 B`, `4,966` verts across `7` meshes, max `4` influences, max sum error `7.02e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/sweater-export.json`) |
| Outward sleeve normals (`test-sweater-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-sweater.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
