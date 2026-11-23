# Flannel shirt — modular asset candidate

**Awaiting human visual review before local commit on `feat/91-modular-avatar-assets` (not yet committed, pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock on the unchanged existing male and female bodies, adding a tailored pants-clearing hem (`Hem`), smooth shirt wrist cuffs (`Cuff_L`, `Cuff_R`), folded casual shirt collar (`Collar`), center-front button placket (`Placket`), twin chest pockets with pointed flaps (`Pockets`), stylized low-relief 3D woven buffalo-plaid bands across torso and sleeves (`PlaidBands`), and 8 beveled buttons (`Buttons`: 4 placket, 2 pocket flaps, 2 cuffs). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/flannel-shirt.blend): `FlannelShirt_Master_Male` and `FlannelShirt_Master_Female` scenes (`9` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-flannel-shirt.glb): `107,408` bytes.
- [Female export](../../public/models/avatars/female/top-flannel-shirt.glb): `110,088` bytes.
- [Standalone structural test](../../scripts/assets/test-flannel-shirt.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-flannel-shirt-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/flannel-and-tank-review.blend`, scenes `REVIEW_FlannelShirt_Female` and `REVIEW_FlannelShirt_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/flannel-shirt/male-1280.png) | [Preview](../assets/flannel-shirt/male-360.png) |
| Female | [Preview](../assets/flannel-shirt/female-1280.png) | [Preview](../assets/flannel-shirt/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `FlannelShirt_{Male,Female}_{Shell,Hem,Cuff_L,Cuff_R,Collar,Placket,Pockets}` so runtime tinting reproduces palette colors accurately (previewed in coral red `#E66861`).
- `AvatarDetail` (`#382F3F` warm deep charcoal/plum, roughness `0.85`, metallic `0.0`) covers `PlaidBands` (3 horizontal 360° torso bands, 4 front vertical stripes, 3 rear vertical stripes, 3 circumferential rings + 1 upper-crest stripe per sleeve) and all `8` beveled `Buttons`.
- Surface-projected/sampled details (`Hem`, `Placket`, `Pockets`, `PlaidBands`, and torso/pocket `Buttons`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell so sleeve plaid rings and stripes deform cleanly across bent elbows; `Collar` binds `100%` to `DEF-spine.003` and `Cuff_{L,R}` plus cuff buttons bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles and `0` collar-head collisions against `Reference_Head` across both genders (`odd/artifacts/flannel-and-tank-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`107,408 B`, `10,570` verts across `9` meshes, max `4` influences, max sum error `7.38e-7`) and `Female` (`110,088 B`, `10,715` verts across `9` meshes, max `4` influences, max sum error `7.41e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/flannel-and-tank-export.json`) |
| Outward sleeve normals (`test-flannel-shirt-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-flannel-shirt.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
