# Modular school polo

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Upgraded visual polish preserves the proven 760-vertex short-sleeve shells and weights while adding a full neckband with folded collar wings, 2-button center placket (`AvatarDetail`), pentagonal chest pocket with top lip, beveled short-sleeve cuffs, and a smooth tailored hem clearing the pants on both bodies. Wishlist remains unchecked until merge.

## Files

| File | Purpose |
| --- | --- |
| [`school-polo.blend`](../../assets/blender/avatars/shared/top/school-polo.blend) | Editable master with separate male/female fitting scenes and unchanged body references |
| [`male/top-school-polo.glb`](../../public/models/avatars/male/top-school-polo.glb) | Male fitted export, 46,372 bytes |
| [`female/top-school-polo.glb`](../../public/models/avatars/female/top-school-polo.glb) | Female fitted export, 46,764 bytes |
| [`test-school-polo.mjs`](../../scripts/assets/test-school-polo.mjs) | Structural check; does not prove visual fit |

Both runtime exports contain only skinned garment meshes and the canonical 34-joint skeleton, without animation clips, cameras, lights, or reference-body meshes. `AvatarTopTint` is neutral white for runtime recoloring; `AvatarDetail` contains the fixed dark button. Draco compression uses 20-bit generic attributes to preserve weight precision. There are no textures requiring KTX2 compression.

The existing body GLBs, anatomy, pants, boots, and animation clips are unchanged. The female reference keeps its legacy 41-joint rig: the wearable uses the shared 34-joint core by name; this work does not migrate her body. Existing hair/top runtime behavior and backend catalog options are not changed.

## Authoring and repair

The existing secondary school-uniform masters supplied the sweater shell, collar, polo insert, and button; the insert alone was not a complete shirt. Separate fitted variants were derived rather than rebuilding each design from scratch. The user-opened, unsaved Blender file was preserved in a local backup before creating isolated working scenes; its original file was not overwritten.

The initial sleeve/back-volume trimming and nearest-surface fitting produced unacceptable creases and were rejected. After the contributor explicitly requested repair, the garment shell was retopologized with one shared 760-vertex, 640-quad layout across both fitted variants, retaining the master collar, placket, button, and canonical rig. Smooth torso weights use only appropriate spine joints; sleeve weights use the matching upper-arm joints. The shoulder transition covers the existing shoulder contour. Following positive human feedback on the appearance and sleeve motion, the hem was extended slightly: 20 mm at the front/sides, with a smoothly tapered additional 6 mm at the rear center. Only the lowest two torso loops moved; sleeves, all other vertices, and skin weights are unchanged. Both authoring variants and animated review copies carry the adjustment. Both bodies remain unmodified. Nearest-surface projection and repeated cuts were not reused.

## Evidence and limits

- Structural checker: both exports have canonical joint names, garment-only skinned nodes, expected material names, no animation/cameras/lights, and remain below the 1 MB limit.
- Blender Draco roundtrip: 1,108 decoded vertices per garment; every vertex has 1–4 positive influences. Maximum weight-sum error is `6.26e-7` (male), `6.41e-7` (female). Default compression initially failed the `1e-4` check; increasing generic precision fixed that export issue without loosening the assertion.
- Start, midpoint and end samples of existing `Idle`, `Walk`, `Sit`, and `Wave` were rendered on both unchanged references (24 samples) using meshes decoded from the final exported GLBs, not merely the editable source. These are not exhaustive animation-interval tests. `RaiseHand` is unavailable in the existing library.
- The following are Blender orthographic rest renders, not browser screenshots or proof of responsive UI/runtime integration. Pose previews and inspection reports remain local under ignored `odd/`.
- No application code, API, catalog, dependency, or CI configuration changes. Full lint/typecheck/application tests/build/security/format/E2E and mobile GPU performance were not run for this asset-only change. Human visual approval and browser integration remain pending. The parent inspected the 24-sample contact sheet: the previous severe chest puckering, underarm web and long seated flap are absent in these views; the earlier slight waist-skin exposure prompted the minimal hem adjustment; frontal exported-GLB walking/seated samples and rear review views were checked again after the change. No all-poses clearance or final acceptance is claimed.

| Reference | 1280px render | 360px render |
| --- | --- | --- |
| Male | [Preview](../assets/school-polo/male-1280.png) | [Preview](../assets/school-polo/male-360.png) |
| Female | [Preview](../assets/school-polo/female-1280.png) | [Preview](../assets/school-polo/female-360.png) |

## Local human-review viewer

This session generated a separate, ignored `odd/previews/school-polo-review.blend`; it is a local viewing aid, not a committed production source. The original user-opened file and production assets were not overwritten. The review copy opens with materials, no rig overlays, and a framed three-quarter view.

- Select `REVIEW_Polo_Female` or `REVIEW_Polo_Male` in Blender's scene selector.
- Press **Space** over the viewport to play/pause, or scrub the timeline.
- Timeline at 24 fps: `Idle` frames 1–49, `Walk` 50–74, `Sit` 75–171, `Wave` 172–231; markers identify each section.
- Both the reference rig and polo rig play the same existing actions. Numeric evaluation confirmed approximately 0.179 m garment movement between sampled poses on both review copies; a viewport capture confirmed materials and hidden controls. No new animation was authored or exported into the garment GLBs.
- Inspect chest/shoulders, sleeve openings, and waistband in motion; preparation of this viewer is not approval of the asset.

## Recheck from the worktree root

```sh
node scripts/assets/test-school-polo.mjs
node scripts/assets/check-asset-budget.mjs
python -B scripts/ci/check_docs.py docs/art/school-polo.md docs/ai-usage.md changelogs/tracker-alejo.md
```

The existing three budget exceptions tracked in #91 remain unchanged. Rules: [modular authoring](../../rules/modular-avatar-assets.md), [pipeline](../3d-assets.md), and [art direction](../../rules/art-direction.md).
