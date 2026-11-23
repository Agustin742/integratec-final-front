# School sweatshirt — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock and add a ribbed crewneck collar, front V-gusset, left-chest school crest shield, ribbed waistband, and ribbed wrist cuffs. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/school-sweatshirt.blend): `SchoolSweatshirt_Master_Male` and `SchoolSweatshirt_Master_Female` scenes (7 semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-school-sweatshirt.glb): 48,936 bytes.
- [Female export](../../public/models/avatars/female/top-school-sweatshirt.glb): 50,320 bytes.
- [Standalone structural test](../../scripts/assets/test-school-sweatshirt.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-sweatshirt-hoodie-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/school-sweatshirt-review.blend`, scenes `REVIEW_SchoolSweatshirt_Female` and `REVIEW_SchoolSweatshirt_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/school-sweatshirt/male-1280.png) | [Preview](../assets/school-sweatshirt/male-360.png) |
| Female | [Preview](../assets/school-sweatshirt/female-1280.png) | [Preview](../assets/school-sweatshirt/female-360.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `SchoolSweatshirt_{Male,Female}_Shell` so runtime tinting reproduces palette colors accurately.
- `AvatarDetail` (`#F4E6D2` warm cream contrast, roughness `0.85`, metallic `0.0`) covers the ribbed crewneck collar (`CrewCollar`), front V-gusset (`VGusset`), left-chest school shield crest (`SchoolCrest`), ribbed waistband (`Waistband`), and ribbed wrist cuffs (`WristCuff_{L,R}`).
- Surface-projected details (`VGusset`, `SchoolCrest`, `Waistband`) receive barycentric skin weights (`<= 4` canonical bones, normalized to `1.0`) from the shell; `CrewCollar` binds to `DEF-spine.003` and `WristCuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles, `0` collar-head collisions across both genders (`odd/artifacts/sweatshirt-hoodie-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`48,936 B`, `4,292` verts across `7` meshes, max `4` influences, max sum error `7.49e-7`) and `Female` (`50,320 B`, `4,340` verts across `7` meshes, max `4` influences, max sum error `7.00e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/sweatshirt-hoodie-export.json`) |
| Outward sleeve normals (`test-sweatshirt-hoodie-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-school-sweatshirt.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
