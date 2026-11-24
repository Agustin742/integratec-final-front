# Vest — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock as a layered long-sleeve under-shirt (with smooth cuffs and folded dress-shirt collar) topped by a tailored buttoned V-neck vest (`VestBody`), two welt pockets, and three front buttons. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/vest.blend): `Vest_Master_Male` and `Vest_Master_Female` scenes (`8` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-vest.glb): `76,072` bytes.
- [Female export](../../public/models/avatars/female/top-vest.glb): `76,512` bytes.
- [Standalone structural test](../../scripts/assets/test-vest.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-vest-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/vest-review.blend`, scenes `REVIEW_Vest_Female` and `REVIEW_Vest_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/vest/male-1280.png) |
| Female | [Preview](../assets/vest/female-1280.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `Vest_{Male,Female}_{VestBody,Pocket_L,Pocket_R}` so runtime tinting reproduces palette colors accurately (previewed in deep green `#3E8654`).
- `AvatarDetail` (`#FFF9EB` pale cream contrast, roughness `0.85`, metallic `0.0`) covers the layered long-sleeve shirt (`Shell`, `Cuff_L`, `Cuff_R`, `Collar`) and front vest `Buttons`.
- Surface-projected/sampled details (`VestBody`, `Pocket_{L,R}`, `Buttons`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell; `Collar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` collar/vest-head collisions against `Reference_Head` across both genders (`odd/artifacts/vest-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`76,072 B`, `6,716` verts across `8` meshes, max `4` influences, max sum error `7.26e-7`) and `Female` (`76,512 B`, `6,686` verts across `8` meshes, max `4` influences, max sum error `7.30e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/vest-export.json`) |
| Outward sleeve normals (`test-vest-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-vest.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
