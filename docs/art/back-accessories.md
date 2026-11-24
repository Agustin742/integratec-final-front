# Back Accessories (6 styles) & Long-Hair `BackTuck` Morph Contract — modular asset candidates

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** All 6 Back accessories from [asset wishlist](asset-wishlist.md) are authored in the painted-toy style, bound to the canonical `rig` 34-bone skeleton, and verified on both unchanged Male and Female avatar bodies without modifying `male/body.glb`, `female/body.glb`, legacy `accessory-*` files, or any exported top. Wishlist checkboxes remain unchecked until merge.

Because chest geometry differs between Male (`y ≈ -0.150 m`) and Female (`y ≈ -0.278 m`), **`Wings` exports once under `shared/`**, while the **5 strap/collar-fitted accessories (`Backpack`, `Rolling backpack`, `Superhero cape`, `Guitar`, `Racket`) export under `male/` and `female/`** with shared rear props and gender-fitted straps/collar. To achieve **`0` collisions across all `23 × 6 = 138` hairstyle × back accessory combinations**, all `15` non-long hairstyles clear in geometry and the **`8` long/back-draping hair GLBs carry a standardized glTF morph target named `BackTuck`**.

## Items, masters, and GLB exports

| Item | Master (`.blend`) | Runtime GLB(s) | Male / Female Size | Meshes / Vertices (`min Z`) / Skinning |
| --- | --- | --- | --- | --- |
| Backpack | [backpack.blend](../../assets/blender/avatars/shared/back/backpack.blend) | [male](../../public/models/avatars/male/back-backpack.glb) · [female](../../public/models/avatars/female/back-backpack.glb) | `30,572` B · `30,556` B | `4` (`BackBackpack_{Pack,Pocket,Straps,Detail}`), `2,612` (`0.4302 m`), `100%` `DEF-spine.003` |
| Rolling backpack | [rolling-backpack.blend](../../assets/blender/avatars/shared/back/rolling-backpack.blend) | [male](../../public/models/avatars/male/back-rolling-backpack.glb) · [female](../../public/models/avatars/female/back-rolling-backpack.glb) | `32,136` B · `32,208` B | `4` (`BackRollingBackpack_{Pack,Pocket,Straps,Hardware}`), `2,878` (`0.3505 m`), `100%` `DEF-spine.003` |
| Superhero cape | [superhero-cape.blend](../../assets/blender/avatars/shared/back/superhero-cape.blend) | [male](../../public/models/avatars/male/back-superhero-cape.glb) · [female](../../public/models/avatars/female/back-superhero-cape.glb) | `30,844` B · `30,860` B | `3` (`BackSuperheroCape_{Cape,Collar,Clasp}`), `1,954` (`0.2340 m`), `Collar`/`Clasp` `100%` `DEF-spine.003`, `Cape` blended `DEF-spine.003`..`DEF-spine` (`<= 3` influences) |
| Wings | [wings.blend](../../assets/blender/avatars/shared/back/wings.blend) | [shared](../../public/models/avatars/shared/back-wings.glb) | `26,600` B (shared) | `2` (`BackWings_{Wings,Mount}`), `2,300` (`0.5025 m`), `100%` `DEF-spine.003` |
| Guitar on the back | [guitar.blend](../../assets/blender/avatars/shared/back/guitar.blend) | [male](../../public/models/avatars/male/back-guitar.glb) · [female](../../public/models/avatars/female/back-guitar.glb) | `26,220` B · `26,316` B | `3` (`BackGuitar_{Body,Detail,Strap}`), `2,016` (`0.3682 m`), `100%` `DEF-spine.003` |
| Racket | [racket.blend](../../assets/blender/avatars/shared/back/racket.blend) | [male](../../public/models/avatars/male/back-racket.glb) · [female](../../public/models/avatars/female/back-racket.glb) | `24,948` B · `24,980` B | `3` (`BackRacket_{Frame,Detail,Strap}`), `1,812` (`0.3684 m`), `100%` `DEF-spine.003` |

- [Standalone structural & morph contract test](../../scripts/assets/test-back-accessories.mjs).
- Ignored animated scenes: `odd/previews/back-accessories-review.blend` (`REVIEW_Back*_{Male,Female}`) and `odd/previews/back-accessories-probador.blend` (`PROBADOR_Back_{Female,Male}`, toggle all `6` Back accessories × `4` sample tops × `14` hairstyles with interactive `BackTuck` slider across Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`; never included in masters or GLBs).

## Previews (Male and Female)

| Item | Male 1280px | Male 360px | Female 1280px | Female 360px |
| --- | --- | --- | --- | --- |
| Backpack | [Male 1280](../assets/back-backpack/male-1280.png) | [Male 360](../assets/back-backpack/male-360.png) | [Female 1280](../assets/back-backpack/female-1280.png) | [Female 360](../assets/back-backpack/female-360.png) |
| Rolling backpack | [Male 1280](../assets/back-rolling-backpack/male-1280.png) | [Male 360](../assets/back-rolling-backpack/male-360.png) | [Female 1280](../assets/back-rolling-backpack/female-1280.png) | [Female 360](../assets/back-rolling-backpack/female-360.png) |
| Superhero cape | [Male 1280](../assets/back-superhero-cape/male-1280.png) | [Male 360](../assets/back-superhero-cape/male-360.png) | [Female 1280](../assets/back-superhero-cape/female-1280.png) | [Female 360](../assets/back-superhero-cape/female-360.png) |
| Wings | [Male 1280](../assets/back-wings/male-1280.png) | [Male 360](../assets/back-wings/male-360.png) | [Female 1280](../assets/back-wings/female-1280.png) | [Female 360](../assets/back-wings/female-360.png) |
| Guitar | [Male 1280](../assets/back-guitar/male-1280.png) | [Male 360](../assets/back-guitar/male-360.png) | [Female 1280](../assets/back-guitar/female-1280.png) | [Female 360](../assets/back-guitar/female-360.png) |
| Racket | [Male 1280](../assets/back-racket/male-1280.png) | [Male 360](../assets/back-racket/male-360.png) | [Female 1280](../assets/back-racket/female-1280.png) | [Female 360](../assets/back-racket/female-360.png) |

## Design, materials, and strap routing

Every item uses `AvatarAccessoryTint` (neutral `#FFFFFF`, non-metallic, runtime tintable via a single user-selected `backColor`) for its primary submeshes and `AvatarDetail` (non-metallic fixed semantic accent) for hardware/accents:

- **Backpack**: Chunky rounded-square main body, zippered front organizer pocket, twin side bottle pouches, top grab loop, and Cream (`#FFF9EB`) zipper/badge/buckle details (`BackBackpack_Detail`). Shoulder straps route cleanly between `TShirt` shoulder lift and `Wave` head clearance (`|x| ≈ 0.082–0.114 m`, `z <= 0.742 m`), dropping medially across the chest below `TShirt_Hem` (`z = 0.456 m`) and wrapping around the waist to clear `Sit` hands/forearms.
- **Rolling backpack**: Boxier beveled trolley case (`superellipse p = 4.2`), twin bottom caster wheels, base bumper foot, Charcoal (`#353849`) wheel housings and twin-rail telescoping T-handle (`z_max = 0.828 m`, `y_max = 0.327 m`, compacted to clear `HairPonytail_Tail`), plus Cream release accent.
- **Superhero cape**: Thickened double-sided pleated solid shell (`BackSuperheroCape_Cape`) smoothly weighted down the spine (`DEF-spine.003`..`DEF-spine`, `<= 3` influences) so it flows with `Walk`/`Sit`/`Wave` without leg clipping (`min_world_z = 0.1220 m`), anchored by a shoulder/clavicle yoke (`BackSuperheroCape_Collar`) and Butter yellow (`#F7D86B`) front clasp medallions (`BackSuperheroCape_Clasp`).
- **Wings**: 100% shared mesh (`shared/back-wings.glb`) mounted cleanly via a rounded back crest plate (`BackWings_Mount`, Butter yellow `#F7D86B`, `roughness = 0.58`) with zero front chest straps, fanning 3 layered tiers of plush feathered blades (`z_max = 0.7806 m`, clearing `Bob`, `Wavy`, `Messy`, and `TwoPigtails`).
- **Guitar on the back**: Figure-8 stylized acoustic body (`BackGuitar_Body`), recessed soundhole/rosette, bridge, fretboard, strings, and 6 tuning pegs (`BackGuitar_Detail`, Charcoal `#353849`), angled over the right shoulder with a crossbody sling strap (`BackGuitar_Strap`).
- **Racket**: Tilted oval tennis racket frame with throat bridge and crossbody sling strap (`BackRacket_Frame`, `BackRacket_Strap`) paired with Cream (`#FFF9EB`) wrapped grip and thick readable crisscross strings (`BackRacket_Detail`), tilted clear of `Bob`, `MiddlePart`, `Wavy`, `Messy`, and `ShortCurls`.

## Runtime Integration Contract

When integrating Back accessories into `src/features/world/avatar/` and the avatar customization catalog/UI, follow these four rules:

### 1. Asset URL resolution and material tinting

- **URL lookup**:
  - `id === 'wings'` -> `/models/avatars/shared/back-wings.glb` *(shared across both bodies)*
  - `id in ['backpack', 'rolling-backpack', 'superhero-cape', 'guitar', 'racket']` -> `/models/avatars/${bodyId}/back-${backId}.glb` *(where `bodyId` is `'male' | 'female'`)*
- **Materials**: Clone and tint **`AvatarAccessoryTint`** using the user's chosen `backColor` (same pattern as `AvatarHairTint` / `AvatarTopTint`). Keep **`AvatarDetail`** unmodified so buckles, hardware, strings, golden mounts, and clasps keep their authored accent contrast.
- **Skeleton binding**: Attach all skinned meshes to the body skeleton by bone name (`34` canonical bones matching `male/body.glb` / `female/body.glb`). No extra runtime transforms (`translation=[0,0,0]`, `rotation=[0,0,0,1]`, `scale=[1,1,1]`).

### 2. Long-hair `BackTuck` morph target (`morphTargetInfluences`)

All **`15` short, medium, afro, bun, ponytail, and pigtail hairstyles** already achieve **`0` collisions** against all `6` Back accessories in base geometry (`BackTuck` not present).

For the **`8` long/back-draping hairstyles** (`public/models/avatars/shared/hair-<id>.glb`), the rear-draping submesh(es) expose a single glTF morph target named **`BackTuck`** (`mesh.extras.targetNames = ["BackTuck"]`, exported with default weight **`0.0`** so hair remains full-length whenever no Back accessory is worn):

| Hair ID | Shared GLB | Morph-Target Submesh(es) | Untouched Submesh(es) (`no morph`) |
| --- | --- | --- | --- |
| `long-straight` | `shared/hair-long-straight.glb` | `HairLongStraight_Curtain` | `HairLongStraight_Cap`, `HairLongStraight_CurtainBangs` |
| `long-wavy` | `shared/hair-long-wavy.glb` | `HairLongWavy_Curtain` | `HairLongWavy_Cap`, `HairLongWavy_WaveBangs` |
| `long-curls` | `shared/hair-long-curls.glb` | `HairLongCurls_Curtain`, `HairLongCurls_Curls` | `HairLongCurls_Cap` |
| `braid` | `shared/hair-braid.glb` | `HairBraid_Braid` | `HairBraid_Cap` |
| `two-braids` | `shared/hair-two-braids.glb` | `HairTwoBraids_Braids` | `HairTwoBraids_Cap`, `HairTwoBraids_Bangs` |
| `half-up` | `shared/hair-half-up.glb` | `HairHalfUp_Curtain` | `HairHalfUp_Cap`, `HairHalfUp_HalfUpTie` |
| `box-braids` | `shared/hair-box-braids.glb` | `HairBoxBraids_Braids` | `HairBoxBraids_Cap` |
| `dreads` | `shared/hair-dreads.glb` | `HairDreads_Locs` | `HairDreads_Cap` |

Whenever **any Back accessory is equipped** (`Boolean(backId)`), set **`BackTuck` influence to `1`** on every composed hair mesh that defines it; otherwise set it to **`0`**:

```ts
function applyHairBackTuck(hairRoot: THREE.Object3D, hasBackAccessory: boolean): void {
  const weight = hasBackAccessory ? 1 : 0;
  hairRoot.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.morphTargetInfluences) return;
    const idx = child.morphTargetDictionary?.['BackTuck'];
    if (idx !== undefined) {
      child.morphTargetInfluences[idx] = weight;
    }
  });
}
```

### 3. Composing alongside Head & Face accessories

- **`BackTuck` + Head accessories**: `BackTuck` only adjusts vertex positions on the rear-draping submeshes (`_Curtain`, `_Curls`, `_Braid`, `_Braids`, `_Locs`), while Head accessory visibility rules in [everyday head accessories](head-accessories-everyday.md#runtime-integration-contract-threejs--hair--head-accessories) and [special head accessories](head-accessories-special.md#runtime-integration-contract-threejs--hair--special-head-accessories) toggle `mesh.visible`. Both compose independently without conflict (if a closed helmet hides `HairLongWavy_Curtain`, its morph influence simply has no visible effect; on open hats/caps/headbands where `Curtain` stays visible, `BackTuck = 1` keeps it clear of both the hat and the back accessory).
- **UI / Catalog checklist**:
  1. Extend the avatar draft/saved config schema and `resolveAvatarParts()` with optional `backId` (`'backpack' | 'rolling-backpack' | 'superhero-cape' | 'wings' | 'guitar' | 'racket' | null`) and `backColor`.
  2. In `composeAvatar()`, bind the resolved Back accessory GLB (if present), tint `AvatarAccessoryTint` to `backColor`, and call `applyHairBackTuck(hairGroup, Boolean(backId))`.
  3. **Do NOT disable any hairstyle × Back accessory combinations in the UI**: all `23 × 6 = 138` pairs pass with `0` collisions under `BackTuck`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` `Reference_Body`, `0` `Reference_Head`/face/ear, and `0` `TShirt` inward hits across all `6` items on both Male and Female (`odd/artifacts/back-accessories-author-report.json`) |
| Full `23 × 6` hairstyle compatibility (`138` pairs) | `0` hits (`y > 0.05 m, d < 0.004 m`) across all `138/138` pairings (`15/15` non-long = `0` hits; `8/8` long at `BackTuck = 1.0` = `0` hits), plus `0` hits across Female & Male animation spot checks (`frames 25, 62, 123, 201` on `LongWavy` and `Braid`, `odd/artifacts/back-accessories-hair-23x6-audit.json`) |
| Decoded GLB roundtrips (Blender MCP) | All `11` Back GLBs pass exact 34-bone canonical rest matrices (`< 1e-4`), normalized weights (`1` `DEF-spine.003` on rigid items; `<= 3` `DEF-spine.003`..`DEF-spine` on `BackSuperheroCape_Cape`), `0` body/head/tshirt hits across decoded frames `1, 62, 123, 201` on Male and Female, `0` hits across all `48` pairs (`8` decoded long hair GLBs at `BackTuck = 1.0` × `6` decoded Female Back GLBs) (`odd/artifacts/back-accessories-export.json`) |
| Structural, morph & budget (`test-back-accessories.mjs`, `check-asset-budget.mjs`) | Valid Draco-compressed GLBs (`24.9 KB–32.2 KB` Back accessories; `101.4 KB–445.5 KB` `BackTuck` long hair GLBs, all `<= 1 MB`, glTF `POSITION.min[1] >= 0.20`), `0` animations/cameras/lights, neutral `#FFFFFF` `AvatarAccessoryTint` + `AvatarDetail`, and exact `extras.targetNames = ["BackTuck"]` with default `[0]` weight on all `8` long hair target submeshes |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
