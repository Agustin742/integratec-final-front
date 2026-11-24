# Hoodie — modular asset candidate

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the concentric closed spherical elbow-cap shell from the approved school smock and add a resting draped hood behind the neck/shoulders, front kangaroo pouch with angled contrasting pocket openings, drawstrings, ribbed waistband, and ribbed wrist cuffs. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/hoodie.blend): `Hoodie_Master_Male` and `Hoodie_Master_Female` scenes (10 semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-hoodie.glb): 56,828 bytes.
- [Female export](../../public/models/avatars/female/top-hoodie.glb): 58,636 bytes.
- [Standalone structural test](../../scripts/assets/test-hoodie.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-sweatshirt-hoodie-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/hoodie-review.blend`, scenes `REVIEW_Hoodie_Female` and `REVIEW_Hoodie_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/hoodie/male-1280.png) |
| Female | [Preview](../assets/hoodie/female-1280.png) |

## Design and reuse

- Reuses the proven concentric closed hemispherical elbow-cap torso/sleeve shell (`|x| > 0.225` elbow domes centered on `DEF-forearm.{L,R}.head_local`) without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `Hoodie_{Male,Female}_Shell`, `Waistband`, `WristCuff_{L,R}`, `Hood`, and `KangarooPocket` so runtime color selection tints the entire hoodie cohesively.
- `AvatarDetail` (`#F4E6D2` warm cream contrast, roughness `0.85`, metallic `0.0`) highlights the angled kangaroo pocket opening trims (`PocketOpening_{L,R}`) and chest-draped drawstrings (`Drawstring_{L,R}`).
- The resting hood (`Hood`) is contoured to clear `Reference_Head` across all tested frames (`Idle 1/25`, `Walk 62`, `Sit 123`, `Wave 201`) with `0` collisions (`DEF-spine.003`); `KangarooPocket`, `PocketOpening_{L,R}`, `Drawstring_{L,R}`, and `Waistband` use barycentric shell weight transfer (`<= 4` canonical bones, normalized to `1.0`), and `WristCuff_{L,R}` bind `100%` to `DEF-forearm.{L,R}.001`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` exposed body arm vertices/triangles, `0` hood-head collisions across both genders (`odd/artifacts/sweatshirt-hoodie-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`56,828 B`, `4,470` verts across `10` meshes, max `4` influences, max sum error `7.49e-7`) and `Female` (`58,636 B`, `4,514` verts across `10` meshes, max `4` influences, max sum error `7.00e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on frames `1, 62, 123, 201` (`odd/artifacts/sweatshirt-hoodie-export.json`) |
| Outward sleeve normals (`test-sweatshirt-hoodie-sleeve-normals.py`) | `1,360` left / `1,360` right sleeve triangles per body, `0` inward |
| Structural & budget (`test-hoodie.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
