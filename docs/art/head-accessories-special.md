# Special & Achievement Head Accessories (4 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** These remaining 4 Head accessories from [asset wishlist](asset-wishlist.md) complete the 9-item Head accessory slot under `shared/`. Every item is rigid-weighted `100%` (`1` influence per vertex) to canonical `DEF-spine.006` on the `rig` 34-bone skeleton and verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `accessory-*` files, Batch 1 headwear, or any exported hair/top. Wishlist checkboxes remain unchecked until merge.

## Items, masters, and GLB exports

| Item | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`min Z`) |
| --- | --- | --- | --- | --- |
| Astronaut helmet | [astronaut-helmet.blend](../../assets/blender/avatars/shared/head/astronaut-helmet.blend) | [head-astronaut-helmet.glb](../../public/models/avatars/shared/head-astronaut-helmet.glb) | `55,088` B | `4` (`HeadAstronautHelmet_{Shell,Collar,Trim,Visor}`), `8,355` (`0.7586 m`) |
| Top hat | [top-hat.blend](../../assets/blender/avatars/shared/head/top-hat.blend) | [head-top-hat.glb](../../public/models/avatars/shared/head-top-hat.glb) | `31,556` B | `3` (`HeadTopHat_{Crown,Brim,Band}`), `3,166` (`1.1147 m`) |
| Crown (achievement) | [crown.blend](../../assets/blender/avatars/shared/head/crown.blend) | [head-crown.glb](../../public/models/avatars/shared/head-crown.glb) | `32,056` B | `2` (`HeadCrown_{Body,Detail}`), `3,468` (`1.2235 m`) |
| Graduation cap (achievement) | [graduation-cap.blend](../../assets/blender/avatars/shared/head/graduation-cap.blend) | [head-graduation-cap.glb](../../public/models/avatars/shared/head-graduation-cap.glb) | `26,816` B | `3` (`HeadGraduationCap_{Skullcap,Board,Tassel}`), `2,376` (`1.1052 m`) |

- [Standalone structural test](../../scripts/assets/test-head-accessories-batch2.mjs).
- Ignored animated viewer: `odd/previews/head-accessories-2-review.blend`, scenes `REVIEW_Head{AstronautHelmet,TopHat,Crown,GraduationCap}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`; includes unexported `RefHair_*` preview hairstyles, never included in masters or GLBs).
- Earlier everyday 5 items live in [everyday head accessories](head-accessories-everyday.md).

## Previews (Male and Female)

| Item | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Astronaut helmet | [Male 1280](../assets/head-astronaut-helmet/male-1280.png) | [Male 360](../assets/head-astronaut-helmet/male-360.png) | [Female 1280](../assets/head-astronaut-helmet/female-1280.png) | [Female 360](../assets/head-astronaut-helmet/female-360.png) |
| Top hat | [Male 1280](../assets/head-top-hat/male-1280.png) | [Male 360](../assets/head-top-hat/male-360.png) | [Female 1280](../assets/head-top-hat/female-1280.png) | [Female 360](../assets/head-top-hat/female-360.png) |
| Crown | [Male 1280](../assets/head-crown/male-1280.png) | [Male 360](../assets/head-crown/male-360.png) | [Female 1280](../assets/head-crown/female-1280.png) | [Female 360](../assets/head-crown/female-360.png) |
| Graduation cap | [Male 1280](../assets/head-graduation-cap/male-1280.png) | [Male 360](../assets/head-graduation-cap/male-360.png) | [Female 1280](../assets/head-graduation-cap/female-1280.png) | [Female 360](../assets/head-graduation-cap/female-360.png) |

## Design and shared fit

- **Astronaut helmet**: Smooth retro-cozy superellipsoid shell (`AvatarAccessoryTint` `#FFFFFF`, `roughness = 0.48`) with sculpted side ear-pod housings enclosing `Reference_ears` (`min_ear_dist = 2.13 cm`), lower jaw/cheek clearance around the raised `Wave` arm (`min_body_dist = 4.0 mm`), charcoal (`#353849`, `roughness = 0.82`) `Collar` locking rim + visor bezel gasket + circular side comm pods + short left-side (`+X`) antenna (`HeadAstronautHelmet_Trim`), and a recessed single-layer translucent visor pane (`HeadAstronautHelmet_Visor`, material `AvatarGlass`: `#A9E7F4`, `alphaMode: "BLEND"`, `alpha = 0.28`, `roughness = 0.18`, `metallic = 0.0`) keeping `:)` eyes, eyelashes, smile, and front hair bangs completely readable (`min_eye_dist = 10.53 cm`).
- **Top hat**: Conformal skull seat over `Reference_Head` + standard hair `_Cap` + `HairShortCurls` (`0` pokes), rising smoothly to `z = 1.585 m` with subtle waist taper and bell flare, rolled/curled brim clearing eyes even from elevated 40° cameras (`min_eye_dist = 17.37 cm`), and a Coral red (`#E66861`, `roughness = 0.80`) satin ribbon band with front-left keeper fold (`HeadTopHat_Band`).
- **Crown (achievement)**: Chunky 5-point scalloped circlet (`AvatarAccessoryTint` `#FFFFFF`, `roughness = 0.48`; previewed in Butter `#F7D86B`) seated atop the upper hair envelope (`z = 1.224–1.547 m`) with taller front-center hero point, spherical tip finials, lower rim molding, and Coral red (`#E66861`, `roughness = 0.78`) front cabochon jewel + 4 band studs (`HeadCrown_Detail`).
- **Graduation cap (achievement)**: Conformal skullcap clearing standard caps and `HairShortCurls` (`0` pokes), topped by a thick beveled diamond-oriented square mortarboard (`0.75 m × 0.75 m`, `HeadGraduationCap_Board`) and Butter yellow (`#F7D86B`, `roughness = 0.80`) center button, draped cord, keeper knot, and fluted side tassel (`HeadGraduationCap_Tassel`) hanging cleanly outside the skullcap on `+X/-Y` (`min_ear_dist = 14.47 cm`).

## Runtime integration contract (Three.js — hair + special head accessories)

Keep hairstyles visible so the avatar never goes bald when equipping hats, crowns, or helmets. Enforce these deterministic Three.js `mesh.visible = false` rules alongside [everyday head accessories](head-accessories-everyday.md#runtime-integration-contract-threejs--hair--head-accessories):

1. **`head-top-hat.glb`, `head-crown.glb`, and `head-graduation-cap.glb`**: Same crown-covering hat table as Batch 1 (`HairAfro_Cloud`, `HairAfroWithHeadband_{Cloud,Headband}`, `HairBun_Bun`, `HairSoftMohawk_Crest`, `HairMessy_TousledTufts`, `HairPonytail_{Tail,HairTie}`, `HairTwoPigtails_Pigtails`, `HairHalfUp_HalfUpTie` hidden; `_Cap`, `HairHalfUp_Curtain`, `HairTwoPigtails_Bangs`, and all other short/medium/long/braid styles kept visible). `HairShortCurls` and all 15 standard styles pass directly in geometry (`0` pokes across all `23` hairstyles).
2. **`head-astronaut-helmet.glb` (closed helmet — automatic Three.js submesh hiding, zero UI blocks)**: All `23` hairstyles work with `head-astronaut-helmet.glb` without blocking any combination in the UI and without making the avatar go bald. All **6/6 short hairstyles** (`hair-buzz-cut.glb`, `hair-classic-short.glb`, `hair-fringe.glb`, `hair-short-curls.glb`, `hair-side-part.glb`, `hair-soft-mohawk.glb`) pass `100%` inside the helmet dome in geometry (`0` pokes, zero submeshes hidden). For the remaining hairstyles, hide only the external volumes/curtains/locs listed below (`mesh.visible = false`) while keeping `_Cap` (and compatible front bangs/braids) visible through the translucent `AvatarGlass` visor:

| Equipped hair asset | Submeshes hidden (`mesh.visible = false`) inside `head-astronaut-helmet.glb` | Submeshes kept visible (`mesh.visible = true`) |
| --- | --- | --- |
| `hair-afro.glb` | `HairAfro_Cloud` | `HairAfro_Cap` |
| `hair-afro-with-headband.glb` | `HairAfroWithHeadband_Cloud`, `HairAfroWithHeadband_Headband` | `HairAfroWithHeadband_Cap` |
| `hair-bob.glb` | `HairBob_Curtain`, `HairBob_Bangs` | `HairBob_Cap` |
| `hair-wavy.glb` | `HairWavy_Curtain` | `HairWavy_Cap`, `HairWavy_WaveBangs` |
| `hair-messy.glb` | `HairMessy_Curtain`, `HairMessy_TousledTufts` | `HairMessy_Cap` |
| `hair-middle-part.glb` | `HairMiddlePart_Curtain`, `HairMiddlePart_CurtainBangs` | `HairMiddlePart_Cap` |
| `hair-long-straight.glb` | `HairLongStraight_Curtain` | `HairLongStraight_Cap`, `HairLongStraight_CurtainBangs` |
| `hair-long-wavy.glb` | `HairLongWavy_Curtain` | `HairLongWavy_Cap`, `HairLongWavy_WaveBangs` |
| `hair-long-curls.glb` | `HairLongCurls_Curtain`, `HairLongCurls_Curls` | `HairLongCurls_Cap` |
| `hair-ponytail.glb` | `HairPonytail_Tail`, `HairPonytail_HairTie` | `HairPonytail_Cap` |
| `hair-two-pigtails.glb` | `HairTwoPigtails_Pigtails` | `HairTwoPigtails_Cap`, `HairTwoPigtails_Bangs` |
| `hair-bun.glb` | `HairBun_Bun` | `HairBun_Cap` |
| `hair-braid.glb` | `HairBraid_Braid` *(optional: `0` shell pokes above collar)* | `HairBraid_Cap` |
| `hair-two-braids.glb` | `HairTwoBraids_Braids` *(optional: `0` shell pokes above collar)* | `HairTwoBraids_Cap`, `HairTwoBraids_Bangs` |
| `hair-half-up.glb` | `HairHalfUp_Curtain`, `HairHalfUp_HalfUpTie` | `HairHalfUp_Cap` |
| `hair-dreads.glb` | `HairDreads_Locs` | `HairDreads_Cap` |
| `hair-box-braids.glb` | `HairBoxBraids_Braids` *(optional: `0` shell pokes above collar)* | `HairBoxBraids_Cap` |

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, `0` body hits (`p.z > 0.42`), `0` hair-crown / `HairShortCurls` / `HairSoftMohawk` pokes, and `min_vert_z >= 0.7586 m` across all 4 items on both Male and Female (`odd/artifacts/head-accessories-batch2-author-report.json`) |
| Exhaustive `4 × 23` hair compatibility (`92` pairings) | `0` pokes (`> 2 mm`) across all `92/92` pairings (`23` hairstyles × `4` Batch 2 accessories) under the Three.js submesh-hiding contract above, with all `6/6` short styles (`BuzzCut`, `ClassicShort`, `Fringe`, `ShortCurls`, `SidePart`, `SoftMohawk`) passing `0` pokes inside `AstronautHelmet` with zero submeshes hidden (`odd/previews/head-accessories-2-probador.blend`, `PROBADOR_HeadBatch2_{Female,Male}`) |
| Decoded GLB roundtrip (Blender MCP) | All 4 `shared/head-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1` bone influence (`DEF-spine.006`, weight `1.0`, sum error `0.0`), `min_vert_z >= 0.7586 m`, and `0` eye/lash/ear/body hits on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/head-accessories-batch2-export.json`) |
| Structural & budget (`test-head-accessories-batch2.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`26.8 KB–55.2 KB`, all `<= 1 MB`, glTF `POSITION.min[1] >= 0.72`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarAccessoryTint` + `AvatarDetail`, plus `AvatarGlass` (`alphaMode: "BLEND"`, `alpha = 0.28`) on `head-astronaut-helmet.glb` |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
