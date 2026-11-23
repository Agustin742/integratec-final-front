# Tank top — modular asset candidate

**Awaiting human visual review before local commit on `feat/91-modular-avatar-assets` (not yet committed, pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master author a seamless double-walled sleeveless bodice (`Shell`) with sculpted U-scoop neckline, deep armholes, and shoulder straps (`|x| = 0.058..0.108`) over the unchanged existing male and female torso silhouettes, paired with a slim pants-clearing hem (`Hem`), contrasting ringer scoop-neck binding (`NeckBind`), left/right ringer armhole bindings (`ArmholeBind_L`, `ArmholeBind_R`), and a rounded left-chest pocket (`ChestPocket`), leaving the bare arms and shoulders of the base bodies fully visible. Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/tank-top.blend): `TankTop_Master_Male` and `TankTop_Master_Female` scenes (`6` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-tank-top.glb): `86,968` bytes.
- [Female export](../../public/models/avatars/female/top-tank-top.glb): `87,248` bytes.
- [Standalone structural test](../../scripts/assets/test-tank-top.mjs).
- Ignored animated viewer: `odd/previews/flannel-and-tank-review.blend`, scenes `REVIEW_TankTop_Female` and `REVIEW_TankTop_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/tank-top/male-1280.png) | [Preview](../assets/tank-top/male-360.png) |
| Female | [Preview](../assets/tank-top/female-1280.png) | [Preview](../assets/tank-top/female-360.png) |

## Design and reuse

- Reuses the unchanged existing `male` and `female` reference bodies and canonical 34-bone rest skeleton without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `TankTop_{Male,Female}_{Shell,Hem,ChestPocket}` so runtime tinting reproduces palette colors accurately (previewed in sky blue `#75B7DA`).
- `AvatarDetail` (`#FFF9EB` pale cream contrast, roughness `0.85`, metallic `0.0`) covers the ringer `NeckBind`, `ArmholeBind_L`, and `ArmholeBind_R` trims.
- `Shell` receives torso-only canonical weights (`<= 4` bones, normalized to `1.0`, remapping legacy `DEF-bust.L/R` to `DEF-spine.002` and excluding arm/leg bones so arm motion never pulls the sleeveless straps); `Hem`, `ArmholeBind_{L,R}`, and `ChestPocket` receive barycentric weights from `Shell`, and `NeckBind` binds `100%` to `DEF-spine.003`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` torso skin poke-through vertices inside the sleeveless bodice and `0` `NeckBind`-head collisions against `Reference_Head` across both genders (`odd/artifacts/flannel-and-tank-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`86,968 B`, `5,514` verts across `6` meshes, max `4` influences, max sum error `7.41e-7`) and `Female` (`87,248 B`, `5,560` verts across `6` meshes, max `4` influences, max sum error `7.72e-7`); canonical `34`-bone rest matrices within `1e-4` (`odd/artifacts/flannel-and-tank-export.json`) |
| Structural & budget (`test-tank-top.mjs`, `pnpm assets:check`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
