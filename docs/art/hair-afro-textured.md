# Afro-textured hairstyles (4 shared styles) — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 4 Afro-textured hairstyles from [asset wishlist](asset-wishlist.md) are authored once under `shared/` and weighted to canonical `DEF-spine.006` (`1.0` above `z = 0.82`) with smooth `DEF-spine.003` torso/shoulder blending below `z = 0.82` (up to `0.50` at `z <= 0.56`) on the `rig` 34-bone skeleton, verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any exported top. Wishlist checkboxes remain unchecked until merge.

## Styles, masters, and GLB exports

| Style | Master (`.blend`) | Shared GLB (`.glb`) | Size | Meshes / Vertices (`DEF-spine.003` blended) |
| --- | --- | --- | --- | --- |
| Afro | [afro.blend](../../assets/blender/avatars/shared/hair/afro.blend) | [hair-afro.glb](../../public/models/avatars/shared/hair-afro.glb) | `60,108` B | `2` (`HairAfro_{Cap,Cloud}`), `8,215` (`0`) |
| Dreads | [dreads.blend](../../assets/blender/avatars/shared/hair/dreads.blend) | [hair-dreads.glb](../../public/models/avatars/shared/hair-dreads.glb) | `269,472` B | `2` (`HairDreads_{Cap,Locs}`), `9,970` (`1,214`) |
| Box braids | [box-braids.blend](../../assets/blender/avatars/shared/hair/box-braids.blend) | [hair-box-braids.glb](../../public/models/avatars/shared/hair-box-braids.glb) | `199,580` B | `2` (`HairBoxBraids_{Braids,Cap}`), `7,640` (`1,701`) |
| Afro with headband | [afro-with-headband.blend](../../assets/blender/avatars/shared/hair/afro-with-headband.blend) | [hair-afro-with-headband.glb](../../public/models/avatars/shared/hair-afro-with-headband.glb) | `68,308` B | `3` (`HairAfroWithHeadband_{Cap,Cloud,Headband}`), `9,524` (`0`) |

- [Standalone structural test](../../scripts/assets/test-afro-hair.mjs).
- Ignored animated viewer: `odd/previews/afro-hair-review.blend`, scenes `REVIEW_Hair{Afro,Dreads,BoxBraids,AfroWithHeadband,ShortCurls}_{Male,Female}` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

## Previews (Male and Female)

| Style | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Afro | [Male 1280](../assets/hair-afro/male-1280.png) | [Male 360](../assets/hair-afro/male-360.png) | [Female 1280](../assets/hair-afro/female-1280.png) | [Female 360](../assets/hair-afro/female-360.png) |
| Dreads | [Male 1280](../assets/hair-dreads/male-1280.png) | [Male 360](../assets/hair-dreads/male-360.png) | [Female 1280](../assets/hair-dreads/female-1280.png) | [Female 360](../assets/hair-dreads/female-360.png) |
| Box braids | [Male 1280](../assets/hair-box-braids/male-1280.png) | [Male 360](../assets/hair-box-braids/male-360.png) | [Female 1280](../assets/hair-box-braids/female-1280.png) | [Female 360](../assets/hair-box-braids/female-360.png) |
| Afro with headband | [Male 1280](../assets/hair-afro-with-headband/male-1280.png) | [Male 360](../assets/hair-afro-with-headband/male-360.png) | [Female 1280](../assets/hair-afro-with-headband/female-1280.png) | [Female 360](../assets/hair-afro-with-headband/female-360.png) |

## Design and shared fit

- Both `male/body.glb` and `female/body.glb` share identical `Reference_Head`, `Reference_ears`, `Reference_eyes`, `Reference_smile`, and `DEF-spine.006` rest transforms, allowing a single shared export under `public/models/avatars/shared/hair-<id>.glb`.
- Every hairstyle pairs a watertight rounded-rim scalp cap (`Hair<Name>_Cap`) with style-defining sculpted silhouettes: `Afro` cohesive fused-metaball Afro cloud with lush scalloped curl volume around crown, brow, sides, and nape clear of eyes, ears, and back; `Dreads` thin scalp liner under full-head coiled dreadlocks radiating from the crown across brow, temples, behind the ears, and down the upper back; `BoxBraids` parted scalp cap with crisp geometric beaded box braids falling cleanly behind the ears and over the upper back; and `AfroWithHeadband` flush Coral red (`#E66861`) fabric headband (`HairAfroWithHeadband_Headband`) wrapped around front forehead, behind ears, and nape below a generous fused-metaball Afro halo.
- Material `AvatarHairTint` is neutral white (`#FFFFFF`, roughness `0.65`, metallic `0.0`) on all hair meshes for runtime tinting; `AfroWithHeadband` adds secondary material `AvatarDetail` in matte Coral red (`#E66861`, roughness `0.85`, metallic `0.0`) on `HairAfroWithHeadband_Headband`. Preview renders sample the official hair palette in [art direction](../../rules/art-direction.md).
- Skinning binds `100%` (`1.0`, `1` influence) to `DEF-spine.006` for `Afro` and `AfroWithHeadband` (all vertices above `z = 0.82`) and blends smoothly with `DEF-spine.003` below `z = 0.82` (up to `0.50` chest / `0.50` head at `z <= 0.56`, `<= 2` normalized influences per vertex) for `Dreads` and `BoxBraids`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` eye, `0` female eyelash, `0` ear, and `0` body/back/Wave-arm collisions (`p.z > 0.42`) across all 4 styles on both Male and Female (`odd/artifacts/afro-hair-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | All 4 `shared/hair-*.glb` imports pass exact 34-bone canonical rest matrices (`< 1e-4`), `1..2` bone influences (`DEF-spine.006` + `DEF-spine.003` with max weight-sum error `<= 5.07e-7`), and `0` eye/lash/ear/body hits (`p.z > 0.42`) on decoded frames `1, 62, 123, 201` on both genders (`odd/artifacts/afro-hair-export.json`) |
| Structural & budget (`test-afro-hair.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`60.1 KB–269.5 KB`, all `<= 1 MB`), zero animations/cameras/lights, neutral `#FFFFFF` `AvatarHairTint` (`roughness = 0.65`) and Coral `#E66861` `AvatarDetail` (`roughness = 0.85`), plus optional `BackTuck` morph target on `Dreads` and `BoxBraids` (`0` default; `1` with Back accessories per [back accessories](back-accessories.md#runtime-integration-contract)) |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
