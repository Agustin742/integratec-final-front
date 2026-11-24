# Tied-up hairstyles (6 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 6 Tied-up hairstyles from [asset wishlist](asset-wishlist.md) are authored once under `shared/` and weighted to canonical `DEF-spine.006` (`1.0` above `z = 0.82`) with smooth `DEF-spine.003` torso/shoulder blending below `z = 0.82` (up to `0.50` at `z <= 0.56`) on the `rig` 34-bone skeleton, verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any exported top. Wishlist checkboxes remain unchecked until merge.

## Styles, masters, and GLB exports

| Style | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`DEF-spine.003` blended) |
| --- | --- | --- | --- | --- |
| Ponytail | [ponytail.blend](../../assets/blender/avatars/shared/hair/ponytail.blend) | [hair-ponytail.glb](../../public/models/avatars/shared/hair-ponytail.glb) | `33,244` B | `3` (`HairPonytail_{Cap,HairTie,Tail}`), `3,380` (`127`) |
| Two pigtails | [two-pigtails.blend](../../assets/blender/avatars/shared/hair/two-pigtails.blend) | [hair-two-pigtails.glb](../../public/models/avatars/shared/hair-two-pigtails.glb) | `32,980` B | `3` (`HairTwoPigtails_{Bangs,Cap,Pigtails}`), `3,682` (`0`) |
| Bun | [bun.blend](../../assets/blender/avatars/shared/hair/bun.blend) | [hair-bun.glb](../../public/models/avatars/shared/hair-bun.glb) | `30,928` B | `2` (`HairBun_{Bun,Cap}`), `3,396` (`0`) |
| Braid | [braid.blend](../../assets/blender/avatars/shared/hair/braid.blend) | [hair-braid.glb](../../public/models/avatars/shared/hair-braid.glb) | `101,376` B | `2` (`HairBraid_{Braid,Cap}`), `3,820` (`1,036`) |
| Two braids | [two-braids.blend](../../assets/blender/avatars/shared/hair/two-braids.blend) | [hair-two-braids.glb](../../public/models/avatars/shared/hair-two-braids.glb) | `162,928` B | `3` (`HairTwoBraids_{Bangs,Braids,Cap}`), `5,554` (`1,830`) |
| Half-up | [half-up.blend](../../assets/blender/avatars/shared/hair/half-up.blend) | [hair-half-up.glb](../../public/models/avatars/shared/hair-half-up.glb) | `224,612` B | `3` (`HairHalfUp_{Cap,Curtain,HalfUpTie}`), `8,524` (`2,329`) |

- [Standalone structural test](../../scripts/assets/test-tied-up-hair.mjs).
- Ignored animated viewer: `odd/previews/tied-up-hair-review.blend`, scenes `REVIEW_Hair{Ponytail,TwoPigtails,Bun,Braid,TwoBraids,HalfUp}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

## Previews (Male and Female)

| Style | Male 1280px | Female 1280px |
| --- | --- | --- |
| Ponytail | [Male 1280](../assets/hair-ponytail/male-1280.png) | [Female 1280](../assets/hair-ponytail/female-1280.png) |
| Two pigtails | [Male 1280](../assets/hair-two-pigtails/male-1280.png) | [Female 1280](../assets/hair-two-pigtails/female-1280.png) |
| Bun | [Male 1280](../assets/hair-bun/male-1280.png) | [Female 1280](../assets/hair-bun/female-1280.png) |
| Braid | [Male 1280](../assets/hair-braid/male-1280.png) | [Female 1280](../assets/hair-braid/female-1280.png) |
| Two braids | [Male 1280](../assets/hair-two-braids/male-1280.png) | [Female 1280](../assets/hair-two-braids/female-1280.png) |
| Half-up | [Male 1280](../assets/hair-half-up/male-1280.png) | [Female 1280](../assets/hair-half-up/female-1280.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/hair-<id>.glb`.
- Every hairstyle pairs a watertight rounded-rim pulled-back or center-parted scalp cap (`Hair<Name>_Cap`) with style-defining sculpted silhouette masses: `Ponytail` visible hair-wrap collar + high-to-mid swooping multi-lobe tail; `TwoPigtails` center-parted bangs + twin upper-back-side hair ties and bouncy arched pigtails; `Bun` high-back coiled spiral bun with snug base collar; `Braid` single chunky tightly nested chevron plait down the center back with top and bottom wrap ties + teardrop tip; `TwoBraids` center-parted bangs + twin behind-the-ear woven plaits with top and bottom wrap ties; and `HalfUp` wide silky behind-the-ear U-hem lower back curtain seamlessly tucked under `Cap` + full 3-lobe gathered half-ponytail with soft scrunchy band.
- Material `AvatarHairTint` is neutral white (`#FFFFFF`, roughness `0.65`, metallic `0.0`) in all masters and GLB exports for runtime tinting; preview renders sample the official hair palette in [art direction](../../rules/art-direction.md) (`#6C4D48`, `#E5AD58`, `#353849`, `#AF6D63`, `#C77DAA`).
- Skinning binds `100%` (`1.0`, `1` influence) to `DEF-spine.006` for `TwoPigtails` and `Bun` (all vertices `z >= 0.82`) and blends smoothly with `DEF-spine.003` below `z = 0.82` (up to `0.50` chest / `0.50` head at `z <= 0.56`, `<= 2` normalized influences per vertex) for `Ponytail`, `Braid`, `TwoBraids`, and `HalfUp`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, and `0` body/back/Wave-arm collisions (`p.z > 0.42`) across all 6 styles on both Male and Female (`odd/artifacts/tied-up-hair-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | All 6 `shared/hair-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1..2` bone influences (`DEF-spine.006` + `DEF-spine.003` with max weight-sum error `<= 5.07e-7`), and `0` eye/lash/ear/body hits (`p.z > 0.42`) on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/tied-up-hair-export.json`) |
| Structural & budget (`test-tied-up-hair.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`30.9 KB–224.6 KB`, all `<= 1 MB`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarHairTint` with roughness `0.65`, plus optional `BackTuck` morph target on `Braid`, `TwoBraids`, and `HalfUp` (`0` default; `1` with Back accessories per [back accessories](back-accessories.md#runtime-integration-contract)) |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
