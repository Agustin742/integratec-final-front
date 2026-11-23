# Medium hairstyles (4 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 4 Medium hairstyles from [asset wishlist](asset-wishlist.md) are authored once under `shared/` and weighted to canonical `DEF-spine.006` (`1.0` above `z = 0.82`) with smooth `DEF-spine.003` collar/shoulder blending below `z = 0.82` (up to `0.30` at `z <= 0.72`) on the `rig` 34-bone skeleton, verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any exported top. Wishlist checkboxes remain unchecked until merge.

## Styles, masters, and GLB exports

| Style | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`DEF-spine.003` blended) |
| --- | --- | --- | --- | --- |
| Bob | [bob.blend](../../assets/blender/avatars/shared/hair/bob.blend) | [hair-bob.glb](../../public/models/avatars/shared/hair-bob.glb) | `51,504` B | `3` (`HairBob_{Bangs,Cap,Curtain}`), `5,746` (`483`) |
| Wavy | [wavy.blend](../../assets/blender/avatars/shared/hair/wavy.blend) | [hair-wavy.glb](../../public/models/avatars/shared/hair-wavy.glb) | `60,568` B | `3` (`HairWavy_{Cap,Curtain,WaveBangs}`), `7,630` (`727`) |
| Messy | [messy.blend](../../assets/blender/avatars/shared/hair/messy.blend) | [hair-messy.glb](../../public/models/avatars/shared/hair-messy.glb) | `63,412` B | `3` (`HairMessy_{Cap,Curtain,TousledTufts}`), `7,430` (`727`) |
| Middle part | [middle-part.blend](../../assets/blender/avatars/shared/hair/middle-part.blend) | [hair-middle-part.glb](../../public/models/avatars/shared/hair-middle-part.glb) | `49,908` B | `3` (`HairMiddlePart_{Cap,Curtain,CurtainBangs}`), `5,622` (`481`) |

- [Standalone structural test](../../scripts/assets/test-medium-hair.mjs).
- Ignored animated viewer: `odd/previews/medium-hair-review.blend`, scenes `REVIEW_Hair{Bob,Wavy,Messy,MiddlePart}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

## Previews (Male and Female)

| Style | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Bob | [Male 1280](../assets/hair-bob/male-1280.png) | [Male 360](../assets/hair-bob/male-360.png) | [Female 1280](../assets/hair-bob/female-1280.png) | [Female 360](../assets/hair-bob/female-360.png) |
| Wavy | [Male 1280](../assets/hair-wavy/male-1280.png) | [Male 360](../assets/hair-wavy/male-360.png) | [Female 1280](../assets/hair-wavy/female-1280.png) | [Female 360](../assets/hair-wavy/female-360.png) |
| Messy | [Male 1280](../assets/hair-messy/male-1280.png) | [Male 360](../assets/hair-messy/male-360.png) | [Female 1280](../assets/hair-messy/female-1280.png) | [Female 360](../assets/hair-messy/female-360.png) |
| Middle part | [Male 1280](../assets/hair-middle-part/male-1280.png) | [Male 360](../assets/hair-middle-part/male-360.png) | [Female 1280](../assets/hair-middle-part/female-1280.png) | [Female 360](../assets/hair-middle-part/female-360.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/hair-<id>.glb`.
- Every hairstyle combines a watertight rounded-rim scalp cap (`Hair<Name>_Cap`) with a double-walled, rounded-hem medium drape (`Hair<Name>_Curtain`, recessed smoothly inside the cap top with wide arched ear clearance) and style-defining sculpted bangs/tufts (`Bob` pageboy bangs, `Wavy` continuous horizontal/diagonal S-wave tiers + swept wave bangs, `Messy` crown cowlicks + choppy bangs + short lower-hem flicks, `Middle part` crisp center groove + twin curtain bangs).
- Material `AvatarHairTint` is neutral white (`#FFFFFF`, roughness `0.65`, metallic `0.0`) in all masters and GLB exports for runtime tinting; preview renders sample the official hair palette in [art direction](../../rules/art-direction.md) (`#353849`, `#6C4D48`, `#AF6D63`, `#E5AD58`).
- Skinning binds `100%` (`1.0`, `1` influence) to `DEF-spine.006` above `z = 0.82` and blends smoothly with `DEF-spine.003` below `z = 0.82` (up to `0.30` chest / `0.70` head at `z <= 0.72`, `<= 2` normalized influences per vertex).

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, and `0` body/Wave-arm collisions across all 4 styles on both Male and Female (`odd/artifacts/medium-hair-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | All 4 `shared/hair-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1..2` bone influences (`DEF-spine.006` + `DEF-spine.003` with max weight-sum error `<= 2.68e-7`), and `0` eye/lash/ear/body hits across decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/medium-hair-export.json`) |
| Structural & budget (`test-medium-hair.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`49.9 KB–63.4 KB`, all `<= 1 MB`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarHairTint` with roughness `0.65` |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
