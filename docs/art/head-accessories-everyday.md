# Everyday Head Accessories (5 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** These first 5 everyday Head accessories from [asset wishlist](asset-wishlist.md) are authored once under `shared/` to fit **over standard hairstyles** (`_Cap` envelope across short, medium, long, and tied-up hair) and rigid-weighted `100%` (`1` influence per vertex) to canonical `DEF-spine.006` on the `rig` 34-bone skeleton, verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `accessory-*` files, or any exported hair/top. Wishlist checkboxes remain unchecked until merge.

## Items, masters, and GLB exports

| Item | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`min Z`) |
| --- | --- | --- | --- | --- |
| Cap | [cap.blend](../../assets/blender/avatars/shared/head/cap.blend) | [head-cap.glb](../../public/models/avatars/shared/head-cap.glb) | `31,860` B | `3` (`HeadCap_{Crown,Brim,Detail}`), `4,130` (`1.0349 m`) |
| Backwards cap | [backwards-cap.blend](../../assets/blender/avatars/shared/head/backwards-cap.blend) | [head-backwards-cap.glb](../../public/models/avatars/shared/head-backwards-cap.glb) | `32,140` B | `3` (`HeadBackwardsCap_{Crown,Brim,Detail}`), `4,130` (`1.0412 m`) |
| Beanie | [beanie.blend](../../assets/blender/avatars/shared/head/beanie.blend) | [head-beanie.glb](../../public/models/avatars/shared/head-beanie.glb) | `32,168` B | `3` (`HeadBeanie_{Crown,Cuff,Tag}`), `3,334` (`1.0063 m`) |
| Headband | [headband.blend](../../assets/blender/avatars/shared/head/headband.blend) | [head-headband.glb](../../public/models/avatars/shared/head-headband.glb) | `19,564` B | `2` (`HeadHeadband_{Band,Trim}`), `1,376` (`1.0828 m`) |
| Headphones | [headphones.blend](../../assets/blender/avatars/shared/head/headphones.blend) | [head-headphones.glb](../../public/models/avatars/shared/head-headphones.glb) | `26,944` B | `4` (`HeadHeadphones_{Band,BandPad,Cups,Cushions}`), `2,276` (`0.7586 m`) |

- [Standalone structural test](../../scripts/assets/test-head-accessories-batch1.mjs).
- Ignored animated viewer: `odd/previews/head-accessories-1-review.blend`, scenes `REVIEW_Head{Cap,BackwardsCap,Beanie,Headband,Headphones}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`; includes unexported `RefHair_*` preview hairstyles, never included in masters or GLBs).
- Remaining 4 Head accessories (`Astronaut helmet`, `Top hat`, `Crown`, `Graduation cap`) follow in Batch 2. Legacy `public/models/avatars/{male,female}/accessory-{cap,headphones}.glb` remain untouched until runtime integration.

## Previews (Male and Female)

| Item | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Cap | [Male 1280](../assets/head-cap/male-1280.png) | [Male 360](../assets/head-cap/male-360.png) | [Female 1280](../assets/head-cap/female-1280.png) | [Female 360](../assets/head-cap/female-360.png) |
| Backwards cap | [Male 1280](../assets/head-backwards-cap/male-1280.png) | [Male 360](../assets/head-backwards-cap/male-360.png) | [Female 1280](../assets/head-backwards-cap/female-1280.png) | [Female 360](../assets/head-backwards-cap/female-360.png) |
| Beanie | [Male 1280](../assets/head-beanie/male-1280.png) | [Male 360](../assets/head-beanie/male-360.png) | [Female 1280](../assets/head-beanie/female-1280.png) | [Female 360](../assets/head-beanie/female-360.png) |
| Headband | [Male 1280](../assets/head-headband/male-1280.png) | [Male 360](../assets/head-headband/male-360.png) | [Female 1280](../assets/head-headband/female-1280.png) | [Female 360](../assets/head-headband/female-360.png) |
| Headphones | [Male 1280](../assets/head-headphones/male-1280.png) | [Male 360](../assets/head-headphones/male-360.png) | [Female 1280](../assets/head-headphones/female-1280.png) | [Female 360](../assets/head-headphones/female-360.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/head-<id>.glb`.
- **Over-hair envelope:** Every item conforms to the outer envelope of `Reference_Head` plus standard `_Cap` meshes, with expanded front/temple/rear clearance on `Cap` (`+5.2 cm` front brow, `+2.4 cm` side temple, `+1.4 cm` rear), `Backwards cap` (`+5.2 cm` front brow, `+2.4 cm` side temple, `+1.4 cm` rear, raised/padded forehead strap at `z = 1.088 m`), and `Beanie` (`+4.8 cm` front cuff, `+1.5 cm` temple clearance). `HairShortCurls` clears both `Cap` and `Backwards cap` directly in geometry (`0` pokes across `1,741` radial rays and all vertices), and deepened `HeadHeadphones` over-ear cups (`|x| = 0.518 m`, cushion inner edge flush at `|x| = 0.360 m`) clear `HairBob`, `HairWavy`, `HairMiddlePart`, and `HairMessy` directly (`0` pokes outside cup/band shell).
- **Cap & Backwards cap**: Conformal 6-panel baseball crown with front brow fullness (`Cap`) so curtain/front-wave bangs tuck cleanly behind/under the brim while keeping both eyes and female eyelashes unobstructed even from a 40° elevated camera (`min_eye_dist >= 10.5 cm`), plus top squatchee button and rear/forehead snapback strap with clasp (`AvatarDetail` `#FFF9EB`, roughness `0.82`).
- **Beanie**: Smooth rounded knit dome (`28` vertical ribs) with chunky folded ribbed cuff clearing front bangs, ears (`min_ear_dist = 5.2 cm`), and eyes (`min_eye_dist = 6.5 cm`), plus a cream woven cuff tag (`HeadBeanie_Tag`).
- **Headband**: Sturdy curved arch hugging the top-side hair cap (`min_ear_dist = 12.6 cm`), topped with a raised cream center trim (`HeadHeadband_Trim`) for clear gameplay and grayscale readability.
- **Headphones**: Deep over-ear shells (`HeadHeadphones_Cups`, `|x| = 0.422–0.518 m`) with widened side yokes and top headband (`HeadHeadphones_Band`) clearing both standard hair caps and wide medium curtains (`HairBob`, `HairWavy`, `HairMiddlePart`), paired with matte charcoal (`#353849`, roughness `0.88`) `HeadHeadphones_BandPad` and plush oval ear cushions (`HeadHeadphones_Cushions`, inner face at `|x| = 0.360 m` so short hair and bare heads never float).
- Material `AvatarAccessoryTint` is neutral white (`#FFFFFF`, metallic `0.0`) on primary surfaces (`roughness`: `0.82` caps, `0.88` beanie, `0.78` headband, `0.58` headphones) for runtime tinting; preview renders sample the official palette in [art direction](../../rules/art-direction.md).

## Runtime integration contract (Three.js — hair + head accessories)

Keep hairstyles visible whenever a head accessory is equipped (the avatar should **never** go bald when putting on a cap, backwards cap, beanie, headband, or headphones). Instead of oversizing hats to swallow tall vertical crowns into helmets, enforce these deterministic Three.js submesh rules when equipping a crown-covering hat (`head-cap.glb`, `head-backwards-cap.glb`, `head-beanie.glb`, and future Batch 2 hats):

| Equipped hair asset | Submeshes hidden (`mesh.visible = false`) under hats | Submeshes kept visible (`mesh.visible = true`) |
| --- | --- | --- |
| `hair-afro.glb` | `HairAfro_Cloud` | `HairAfro_Cap` |
| `hair-afro-with-headband.glb` | `HairAfroWithHeadband_Cloud`, `HairAfroWithHeadband_Headband` | `HairAfroWithHeadband_Cap` |
| `hair-bun.glb` | `HairBun_Bun` | `HairBun_Cap` |
| `hair-soft-mohawk.glb` | `HairSoftMohawk_Crest` | `HairSoftMohawk_Cap` |
| `hair-messy.glb` | `HairMessy_TousledTufts` | `HairMessy_Cap`, `HairMessy_Curtain` |
| `hair-ponytail.glb` | `HairPonytail_Tail`, `HairPonytail_HairTie` *(optional if tail sits behind brim)* | `HairPonytail_Cap` |
| `hair-two-pigtails.glb` | `HairTwoPigtails_Pigtails` | `HairTwoPigtails_Cap`, `HairTwoPigtails_Bangs` |
| `hair-half-up.glb` | `HairHalfUp_HalfUpTie` | `HairHalfUp_Cap`, `HairHalfUp_Curtain` |

- **Afro + `head-headband.glb`**: When `hair-afro.glb` is paired with `head-headband.glb`, either swap to the custom-fitted `hair-afro-with-headband.glb` asset (tinting its `AvatarDetail` material to the selected headband color and hiding the separate `head-headband.glb` mesh) or suppress `head-headband.glb` while `HairAfro_Cloud` is visible, since an Afro volume encloses the skull scalp arch.
- **No-hide direct pairs:** `HairBuzzCut`, `HairClassicShort`, `HairSidePart`, `HairMiddlePart`, `HairFringe`, `HairShortCurls`, `HairWavy`, `HairBob`, `HairLongStraight`, `HairLongWavy`, `HairLongCurls`, `HairBraid`, `HairTwoBraids`, `HairBoxBraids`, and `HairDreads` keep all submeshes visible under `Cap`, `Backwards cap`, `Beanie`, `Headband`, and `Headphones` (both `HairShortCurls + Cap/BackwardsCap` and `HairBob + Headphones` pass directly in geometry with `0` poke-through).

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, `0` body hits (`p.z > 0.42`), `0` hair-crown pokes (`z > 1.15`), and `min_vert_z >= 0.7586 m` across all 5 items on both Male and Female (`odd/artifacts/head-accessories-batch1-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | All 5 `shared/head-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1` bone influence (`DEF-spine.006`, weight `1.0`, sum error `0.0`), `min_vert_z >= 0.7586 m`, and `0` eye/lash/ear/body hits on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/head-accessories-batch1-export.json`) |
| Structural & budget (`test-head-accessories-batch1.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`19.6 KB–32.2 KB`, all `<= 1 MB`, glTF `POSITION.min[1] >= 0.72`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarAccessoryTint` + `AvatarDetail` |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
