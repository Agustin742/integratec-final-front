# Denim jacket — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock on the unchanged existing male and female bodies as an open-front denim trucker jacket layered over a cream inner T-shirt (`InnerTee`), with open front panels (`FrontPanels`), a structured denim waistband recessed across the front opening (`Waistband`), jacket wrist cuffs (`Cuff_L`, `Cuff_R`), an open horseshoe collar with angled front lapels (`Collar`), twin chest trucker pockets with pointed flaps (`Pockets`), and 8 beveled buttons (`4` along the open right panel edge, `2` on pocket flaps, `2` on cuffs). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/denim-jacket.blend): `DenimJacket_Master_Male` and `DenimJacket_Master_Female` scenes (`9` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-denim-jacket.glb): `71,520` bytes.
- [Female export](../../public/models/avatars/female/top-denim-jacket.glb): `73,732` bytes.
- [Standalone structural test](../../scripts/assets/test-denim-jacket.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-jackets-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/jackets-review.blend`, scenes `REVIEW_DenimJacket_Female` and `REVIEW_DenimJacket_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/denim-jacket/male-1280.png) | [Preview](../assets/denim-jacket/male-360.png) |
| Female | [Preview](../assets/denim-jacket/female-1280.png) | [Preview](../assets/denim-jacket/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `DenimJacket_{Male,Female}_{Shell,Waistband,Cuff_L,Cuff_R,Collar,FrontPanels,Pockets}` so runtime tinting reproduces palette colors accurately (previewed in indigo `#5B4F96`).
- `AvatarDetail` (`#FFF9EB` pale cream contrast, roughness `0.85`, metallic `0.0`) covers the layered `InnerTee` and beveled jacket `Buttons`.
- Surface-projected/sampled details (`Waistband`, `InnerTee`, `FrontPanels`, `Pockets`, and torso `Buttons`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell; `Collar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` plus cuff buttons bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` collar-head collisions against `Reference_Head` across both genders (`odd/artifacts/jackets-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`71,520 B`, `6,140` verts across `9` meshes, max `4` influences, max sum error `7.30e-7`) and `Female` (`73,732 B`, `6,201` verts across `9` meshes, max `4` influences, max sum error `7.25e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/jackets-export.json`) |
| Outward sleeve normals (`test-jackets-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-denim-jacket.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
