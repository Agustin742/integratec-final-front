# Face Accessories (6 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 6 Face accessories from [asset wishlist](asset-wishlist.md) are authored once under `shared/`, rigid-weighted `100%` (`1` influence per vertex) to canonical `DEF-spine.006` on the `rig` 34-bone skeleton, and verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `accessory-*` files, Head accessories, or any exported hair/top. Wishlist checkboxes remain unchecked until merge.

## Items, masters, and GLB exports

| Item | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`min Z`) |
| --- | --- | --- | --- | --- |
| Round glasses | [round-glasses.blend](../../assets/blender/avatars/shared/face/round-glasses.blend) | [face-round-glasses.glb](../../public/models/avatars/shared/face-round-glasses.glb) | `27,676` B | `3` (`FaceRoundGlasses_{Frame,Detail,Lenses}`), `2,542` (`0.8602 m`) |
| Square glasses | [square-glasses.blend](../../assets/blender/avatars/shared/face/square-glasses.blend) | [face-square-glasses.glb](../../public/models/avatars/shared/face-square-glasses.glb) | `26,524` B | `3` (`FaceSquareGlasses_{Frame,Detail,Lenses}`), `2,346` (`0.8787 m`) |
| Sunglasses | [sunglasses.blend](../../assets/blender/avatars/shared/face/sunglasses.blend) | [face-sunglasses.glb](../../public/models/avatars/shared/face-sunglasses.glb) | `27,224` B | `3` (`FaceSunglasses_{Frame,Detail,Lenses}`), `2,470` (`0.8762 m`) |
| Mask (masquerade) | [masquerade-mask.blend](../../assets/blender/avatars/shared/face/masquerade-mask.blend) | [face-masquerade-mask.glb](../../public/models/avatars/shared/face-masquerade-mask.glb) | `28,788` B | `3` (`FaceMasqueradeMask_{Mask,Trim,Strap}`), `2,760` (`0.8938 m`) |
| Face mask | [face-mask.blend](../../assets/blender/avatars/shared/face/face-mask.blend) | [face-face-mask.glb](../../public/models/avatars/shared/face-face-mask.glb) | `30,552` B | `3` (`FaceFaceMask_{Body,Trim,Straps}`), `3,622` (`0.7722 m`) |
| Face paint | [face-paint.blend](../../assets/blender/avatars/shared/face/face-paint.blend) | [face-face-paint.glb](../../public/models/avatars/shared/face-face-paint.glb) | `15,908` B | `2` (`FaceFacePaint_{Primary,Accent}`), `404` (`0.8558 m`) |

- [Standalone structural test](../../scripts/assets/test-face-accessories.mjs).
- Ignored animated scenes: `odd/previews/face-accessories-review.blend` (`REVIEW_Face*_{Male,Female}`) and `odd/previews/face-accessories-probador.blend` (`PROBADOR_Face_{Female,Male}`, toggle all `6` Face accessories × all `23` hairstyles across Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`; never included in masters or GLBs).
- The legacy per-body glasses files (`accessory-glasses.glb`, `accessory-{round,square}-glasses.glb`) were removed; these shared face accessories replace them.

## Previews (Male and Female)

| Item | Male 1280px | Female 1280px |
| --- | --- | --- |
| Round glasses | [Male 1280](../assets/face-round-glasses/male-1280.png) | [Female 1280](../assets/face-round-glasses/female-1280.png) |
| Square glasses | [Male 1280](../assets/face-square-glasses/male-1280.png) | [Female 1280](../assets/face-square-glasses/female-1280.png) |
| Sunglasses | [Male 1280](../assets/face-sunglasses/male-1280.png) | [Female 1280](../assets/face-sunglasses/female-1280.png) |
| Mask (masquerade) | [Male 1280](../assets/face-masquerade-mask/male-1280.png) | [Female 1280](../assets/face-masquerade-mask/female-1280.png) |
| Face mask | [Male 1280](../assets/face-face-mask/male-1280.png) | [Female 1280](../assets/face-face-mask/female-1280.png) |
| Face paint | [Male 1280](../assets/face-face-paint/male-1280.png) | [Female 1280](../assets/face-face-paint/female-1280.png) |

## Design and shared fit

- **Shared facial geometry**: Both `male/body.glb` and `female/body.glb` share identical `Reference_Head` (`z = 0.7095–1.2833 m`), `Reference_ears`, and `DEF-spine.006` rest transforms, with union `:)` eye/eyelash/smile bounds cleanly centered at `x = ±0.156–0.162 m`, `z = 0.940–0.976 m` (eyes/lashes) and `z = 0.878–0.913 m` (smile). Every accessory exports once under `shared/` with `>= 13.3 mm` forward/side head clearance on glasses/masks and `1.8–4.6 mm` conformal cheek relief on `Face paint`.
- **Round glasses**: Chunky painted-toy circular rims (`radius = 0.088 m`), keyhole bridge with center accent collar, front hinge rivets (`FaceRoundGlasses_Detail`), smooth temple arms hooking behind `Reference_ears` (`y <= 0.058 m`), and translucent `AvatarGlass` lenses (`#A9E7F4`, `alphaMode: "BLEND"`, `alpha = 0.24`, `roughness = 0.16`).
- **Square glasses**: Scholarly softened-rectangle rims (`p = 3.2` superellipse, `0.092 m × 0.068 m`), straight-arched upper bridge, twin corner lug pins, temple accent bars, and translucent `AvatarGlass` lenses (`#A9E7F4`, `alpha = 0.24`).
- **Sunglasses**: Wider retro wayfarer silhouette with continuous flat-arched brow bar (`z = 1.026 m`), flared outer wing lugs with cream rivets, tapered temples, and dark-tinted `AvatarGlass` lenses (`#353849`, `alphaMode: "BLEND"`, `alpha = 0.62`, `roughness = 0.14`) that read unmistakably as sunglasses while keeping `:)` eyes faintly visible.
- **Mask (masquerade)**: Continuous analytical butterfly-domino shell (`FaceMasqueradeMask_Mask`) with smooth flared wing tips, center nose notch clearing `Reference_smile` (`>= 15.9 mm`), generous almond eye windows clearing both eyes and female eyelashes (`>= 19.0 mm`), matching perimeter and eye-window trim + center diamond crest (`FaceMasqueradeMask_Trim`), and behind-ear straps (`FaceMasqueradeMask_Strap`).
- **Face mask**: Conformal 3-pleat cloth face mask (`FaceFaceMask_Body`) tented cleanly ahead of `Reference_smile` (`>= 14.2 mm`), stitched perimeter piping (`FaceFaceMask_Trim`), and jaw-hugging elastic ear-loops (`FaceFaceMask_Straps`) clearing both `Reference_ears` and the raised `-X` `Wave` hand/arm (`>= 7.3 mm`).
- **Face paint**: Bold school-festival cheek swashes + dots (`FaceFacePaint_Primary`, `AvatarAccessoryTint` `#FFFFFF`) and 5-point cheek stars (`FaceFacePaint_Accent`, `AvatarDetail`) projected conformally onto the open lower cheek canvas (`|x| = 0.155–0.285 m`, `z = 0.856–0.934 m`), completely clear of eyes, female eyelashes, smile, and front hair bangs.

## Hairstyle compatibility (`6 × 23 = 138` pairings)

All `6` Face accessories end cleanly behind `Reference_ears` (`y <= 0.062 m`), yielding `0` rear-hair collisions across all `138/138` pairings (`odd/artifacts/face-accessories-hair-audit.json`):

- **Face paint**: `23/23` hairstyles zero-touch (`0` front, `0` side, `0` rear).
- **Face mask**: `19/23` hairstyles zero-touch (`0` front across all `23`; light natural side-curtain contact over the ear-loop straps on `Bob`, `Messy`, `MiddlePart`, and `Wavy`).
- **Glasses & Masquerade mask**: `0` rear collisions; front bangs (`Bob`, `Fringe`, `Messy`, `Wavy`, `LongCurls`, `LongStraight`, `LongWavy`, `MiddlePart`, `TwoBraids`, `TwoPigtails`) and cheek-framing side curtains drape naturally over the brow bar or temple arms without blocking eyes.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` head penetrations, `0` eye, `0` female eyelash, `0` smile, `0` ear, and `0` body hits (`p.z > 0.42`) across all `6` items on both Male and Female (`odd/artifacts/face-accessories-author-report.json`) |
| `6 × 23` hairstyle audit (`138` pairings) | `0` rear hair hits (`y > 0.08 m`), `face-paint` `23/23` zero-touch, `face-mask` `19/23` zero-touch (`odd/artifacts/face-accessories-hair-audit.json`) |
| Decoded GLB roundtrip (Blender MCP) | All `6` `shared/face-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1` bone influence (`DEF-spine.006`, weight `1.0`, sum error `0.0`), `min_vert_z >= 0.7722 m`, `0` head penetrations, and `0` eye/lash/smile/ear/body hits on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/face-accessories-export.json`) |
| Structural & budget (`test-face-accessories.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`15.9 KB–30.6 KB`, all `<= 1 MB`, glTF `POSITION.min[1] >= 0.72`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarAccessoryTint` + `AvatarDetail`, plus `AvatarGlass` (`alphaMode: "BLEND"`) on all 3 eyewear GLBs |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
