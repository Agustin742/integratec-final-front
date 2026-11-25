# Basic modular T-shirt

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Upgraded visual polish preserves the 760-vertex short-sleeve shells and weights while adding a crew-neck ribbed collar ring, slim beveled short-sleeve hems, rounded left-chest pocket with top lip, and a slim pants-clearing bottom hem (`AvatarTopTint`). Wishlist remains unchecked until merge.

## Source and outputs

Derived only from the existing editable 760-vertex `Polo_Male_Shell` and `Polo_Female_Shell`, originally authored in [school-polo.blend](../../assets/blender/avatars/shared/top/school-polo.blend), available in the clean local school-polo review file. Shell geometry, shoulder/sleeve weights and hem are unchanged; collar, placket and button objects are omitted, not deleted from the polo. The inherited 40-vertex neckline is retained. No automated fitting loop or body reshaping was used.

- [Editable master](../../assets/blender/avatars/shared/top/basic-tshirt.blend): canonical 34-bone `TShirt_Master_Male` and `TShirt_Master_Female` scenes.
- [Male export](../../public/models/avatars/male/top-basic-tshirt.glb): 38,760 bytes.
- [Female export](../../public/models/avatars/female/top-basic-tshirt.glb): 38,784 bytes.
- [Structural test](../../scripts/assets/test-basic-tshirt.mjs).

Exports use strict active-scene selection of garment and canonical34 rig only, no animations, Draco generic precision 20, neutral white `AvatarTopTint`, roughness 0.85. The legacy `top-tshirt` was removed; this export replaces it. Existing bodies, lower halves, polo files and original open review file were never saved over. Geometry/weight SHA256 comparisons of source shells and body-reference meshes remained equal during authoring (local `odd/artifacts/basic-tshirt-author.json`). This is not a complete bytewise audit of every source datablock.

## Observed checks

| Check | Result |
| --- | --- |
| `node scripts/assets/test-basic-tshirt.mjs` | Exit 0; both canonical34, garment-only, zero clips; byte sizes above |
| `node scripts/assets/test-school-polo.mjs` | Exit 0; male 26,364 bytes, female 26,808 bytes |
| `node scripts/assets/check-asset-budget.mjs` | Exit 0; 26 within limits, three existing #91 exceptions |

These three commands produced no stderr. Strict TDD was explicitly selected by the parent for this unit. Parent-provided RED was exit 1, ENOENT missing male `top-basic-tshirt.glb`; GREEN is the observed structural pass above. The parent added this separate structural test before authoring; the worker preserved it unchanged.

Blender imported both final Draco GLBs into isolated decode scenes. Each decoded garment has 760 vertices, at most two positive influences per vertex, no unweighted vertices, maximum weight-sum error `2.9802322387695312e-08` (assertion `< 1e-4`). Local report: `odd/artifacts/basic-tshirt-verify.json`.

Twenty-four final-decoded garment pose renders cover start/mid/end of Idle (1/25/49), Walk (50/62/74), Sit (75/123/171), Wave (172/201/231), both bodies. RaiseHand is unavailable and skipped. This samples poses, not every animation interval or clearance intersection. No browser/mobile GPU, broad application suite, grayscale or final visual acceptance is claimed.

## Human review and evidence

Separate ignored viewer: `odd/previews/basic-tshirt-review.blend`. Select `REVIEW_BasicTShirt_Male` or `REVIEW_BasicTShirt_Female`; scrub frames 1–231 or press Space. Existing body animations are retained. Final decoded garments bind by canonical bone names to independent copies of the animated body rigs in this preview only (female retains her legacy41 body rig). Exported garments remain canonical34. All skin and existing pants/boots remain present; legacy upper garments are not copied into this viewer. Rig overlays are hidden. This viewer is not approval.

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/basic-tshirt/male-1280.png) |
| Female | [Preview](../assets/basic-tshirt/female-1280.png) |

Local pose images: `odd/previews/basic-tshirt-{male,female}-{Idle,Walk,Sit,Wave}-<frame>.png`. These are orthographic Blender renders, not responsive UI screenshots. Inspected frontal three-quarter torso, sleeve openings, hem and female Wave / male Sit samples. Remaining concerns: the large head obscures much of the neckline; rear neckline/shoulder clearance and all pose samples require parent/independent inspection. Visible faceting and underarm/hem fit need that visual disposition; no body modification or relaxed check was used to conceal concerns.

## Errors and correction

Blender MCP returned RuntimeError when hiding an isolated reference rig without specifying its view layer; fixed with an explicit preview view layer. Exported male file existed before this interruption. A second attempt returned TypeError: `BLENDER_EEVEE_NEXT` was unavailable; corrected to supported `BLENDER_EEVEE`. Incomplete isolated scenes remain only in the live session, not the saved master/viewer dependency sets.

Initial preview animation copying left garments in T-pose while bodies moved. Copying action slots alone did not resolve this. Final viewer uses the copied animated body rig directly by bone name; all 28 final renders were regenerated. This was a preview-binding correction, not repeated geometric fitting. An inspection also raised AttributeError because Blender ActionSlot has no `name` property; no asset was altered by that inspection.

## Parent review follow-up

The parent opened the saved viewer in Blender, selected `REVIEW_BasicTShirt_Female`, enabled material shading with hidden overlays, and started playback. Both scenes contain the reference bodies and exactly one visible decoded garment; the extra source garment is hidden in viewport and render. The load produced a library-file empty-scene warning; the two named review scenes were subsequently verified populated (10/9 mesh objects). The original polo viewer was not overwritten.

Four additional rear samples were rendered locally at frames 1 and 201 for both bodies, restoring camera/frame/render settings afterward. Parent inspection of female frame201 and male frame1 shows back coverage in those angles, shoulder folds and a scalloped hem; this is not exhaustive clearance proof. The parent also viewed female Sit123 successfully. The independent verifier reported all three Node checks, scoped documentation check (`passed (3 files)`), and read-only preservation checks passing. Several images were not discernible in that verifier's image interface; independent final visual acceptance remains pending, especially the head-obscured neckline and remaining seated/rear samples. Independent verdict: S1 structural pass; S2 scope/preservation pass; S3 partial (exact hierarchy/rest-transform and complete skin preservation not independently inspected in Blender); S4 pending visual acceptance. Eligible only for an unaccepted local checkpoint, not merge-ready completion. Runtime checks are N/A: this adds assets without catalog/loader integration. Rollback boundary is the new basic-T-shirt source, two new exports, standalone test, evidence directory and its documentation; retain all existing body, polo and legacy files. Do not infer a clean all-pose fit from the structural pass.

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md). Runtime region hiding, body migration, catalog and lower-body work remain outside this delivery.
