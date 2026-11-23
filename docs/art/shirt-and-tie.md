# Shirt and tie — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock and add a tailored shirt hem, smooth wrist cuffs, a folded dress-shirt collar with pointed front wings, a center-front button placket, a pentagonal left-chest pocket, a Windsor tie knot, a densely sampled surface-following pointed necktie blade, and a lower placket button. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/shirt-and-tie.blend): `ShirtAndTie_Master_Male` and `ShirtAndTie_Master_Female` scenes (`10` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-shirt-and-tie.glb): `61,988` bytes.
- [Female export](../../public/models/avatars/female/top-shirt-and-tie.glb): `63,228` bytes.
- [Standalone structural test](../../scripts/assets/test-shirt-and-tie.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-shirt-and-tie-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/shirt-and-tie-review.blend`, scenes `REVIEW_ShirtAndTie_Female` and `REVIEW_ShirtAndTie_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/shirt-and-tie/male-1280.png) | [Preview](../assets/shirt-and-tie/male-360.png) |
| Female | [Preview](../assets/shirt-and-tie/female-1280.png) | [Preview](../assets/shirt-and-tie/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `ShirtAndTie_{Male,Female}_{Shell,Hem,Cuff_L,Cuff_R,Collar,Placket,ChestPocket}` so runtime tinting reproduces palette colors accurately (previewed in pale cream `#FFF9EB`).
- `AvatarDetail` (`#5B4F96` indigo contrast, roughness `0.85`, metallic `0.0`) covers the Windsor tie knot (`TieKnot`), surface-following pointed tie blade (`TieBlade`), and lower placket button (`Button`).
- Surface-projected details (`Hem`, `Placket`, `ChestPocket`, `TieKnot`, `TieBlade`, `Button`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell; `Collar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles, `0` collar-head collisions against `Reference_Head`, and `0` buried tie vertices across both genders (`odd/artifacts/shirt-and-tie-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`61,988 B`, `5,308` verts across `10` meshes, max `4` influences, max sum error `7.45e-7`) and `Female` (`63,228 B`, `5,348` verts across `10` meshes, max `4` influences, max sum error `7.01e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/shirt-and-tie-export.json`) |
| Outward sleeve normals (`test-shirt-and-tie-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-shirt-and-tie.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
