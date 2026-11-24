# Track jacket — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock on the unchanged existing male and female bodies, adding a stand-up funnel collar (`HighCollar`), body-colored ribbed waistband (`Waistband`), contrasting ribbed wrist cuffs (`Cuff_L`, `Cuff_R`), center-front zipper track with raised zipper pull (`Zipper`), twin 360-degree chest accent stripes (`ChestStripe`), twin upper/outer sleeve stripes (`SleeveStripes`), and angled lower welt pocket trims (`SidePockets`). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/track-jacket.blend): `TrackJacket_Master_Male` and `TrackJacket_Master_Female` scenes (`9` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-track-jacket.glb): `70,040` bytes.
- [Female export](../../public/models/avatars/female/top-track-jacket.glb): `71,804` bytes.
- [Standalone structural test](../../scripts/assets/test-track-jacket.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-jackets-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/jackets-review.blend`, scenes `REVIEW_TrackJacket_Female` and `REVIEW_TrackJacket_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/track-jacket/male-1280.png) |
| Female | [Preview](../assets/track-jacket/female-1280.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `TrackJacket_{Male,Female}_{Shell,HighCollar,Waistband}` so runtime tinting reproduces palette colors accurately (previewed in coral red `#E66861`).
- `AvatarDetail` (`#FFF9EB` pale cream contrast, roughness `0.85`, metallic `0.0`) covers ribbed `Cuff_L`, `Cuff_R`, `Zipper`, `ChestStripe`, `SleeveStripes`, and `SidePockets`.
- Surface-projected/sampled details (`Waistband`, `Zipper`, `ChestStripe`, `SleeveStripes`, `SidePockets`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell so sleeve stripes deform cleanly across bent elbows; `HighCollar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` collar/zipper-head collisions against `Reference_Head` across both genders (`odd/artifacts/jackets-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`70,040 B`, `6,124` verts across `9` meshes, max `4` influences, max sum error `7.30e-7`) and `Female` (`71,804 B`, `6,186` verts across `9` meshes, max `4` influences, max sum error `7.45e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/jackets-export.json`) |
| Outward sleeve normals (`test-jackets-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-track-jacket.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
