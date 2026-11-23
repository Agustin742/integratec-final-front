# Winter coat — modular asset candidate

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock on the unchanged existing male and female bodies, adding quilted puffer torso and sleeve baffles (`QuiltBands`), a chunky pants-clearing padded hem (`Hem`), plush rolled shearling wrist cuffs (`Cuff_L`, `Cuff_R`), a rolled shearling winter collar (`ShearlingCollar`), a center-front storm flap (`StormFlap`), twin hand-warmer patch pockets with raised top welt lips (`Pockets`), and 4 beveled toggle buttons (`ToggleButtons`). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/winter-coat.blend): `WinterCoat_Master_Male` and `WinterCoat_Master_Female` scenes (`9` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-winter-coat.glb): `84,292` bytes.
- [Female export](../../public/models/avatars/female/top-winter-coat.glb): `85,820` bytes.
- [Standalone structural test](../../scripts/assets/test-winter-coat.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-seasonal-tops-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/seasonal-tops-review.blend`, scenes `REVIEW_WinterCoat_Female` and `REVIEW_WinterCoat_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/winter-coat/male-1280.png) | [Preview](../assets/winter-coat/male-360.png) |
| Female | [Preview](../assets/winter-coat/female-1280.png) | [Preview](../assets/winter-coat/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `WinterCoat_{Male,Female}_{Shell,QuiltBands,Hem,StormFlap,Pockets}` so runtime tinting reproduces palette colors accurately (previewed in indigo `#5B4F96`).
- `AvatarDetail` (`#FFF9EB` pale cream, roughness `0.90`, metallic `0.0`) covers plush `ShearlingCollar`, `Cuff_L`/`Cuff_R`, and the `4` beveled `ToggleButtons`.
- Surface-projected/sampled details (`QuiltBands`, `Hem`, `StormFlap`, `Pockets`, `ToggleButtons`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell so puffer baffles sit cleanly clear of elbow bends and female bust curvature; `ShearlingCollar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` `ShearlingCollar`-head collisions against `Reference_Head` across both genders (`odd/artifacts/seasonal-tops-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`84,292 B`, `7,710` verts across `9` meshes, max `4` influences, max sum error `7.41e-7`) and `Female` (`85,820 B`, `7,714` verts across `9` meshes, max `4` influences, max sum error `7.02e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/seasonal-tops-export.json`) |
| Outward sleeve normals (`test-seasonal-tops-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-winter-coat.mjs`, `check-asset-budget.mjs`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
