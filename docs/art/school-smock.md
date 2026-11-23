# Short school smock — modular asset checkpoint

**Human visual review approved; committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master include the accepted white + smoke-gray details + centered pointed tie design and the concentric closed spherical elbow-cap repair resolving bilateral seated elbow poke-through. Wishlist remains unchecked until merge.

## Files and review

- [Editable master](../../assets/blender/avatars/shared/top/school-smock.blend): `SchoolSmock_Master_Male` and `SchoolSmock_Master_Female` scenes (11 semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-school-smock.glb): 36,136 bytes.
- [Female export](../../public/models/avatars/female/top-school-smock.glb): 51,620 bytes.
- [Standalone structural test](../../scripts/assets/test-school-smock.mjs).
- [Sleeve outward-normals regression test](../../scripts/assets/test-school-smock-sleeve-normals.py).
- Ignored animated viewer: `odd/previews/school-smock-elbow-fixed-review.blend`, scenes `ELBOW_FIXED_SchoolSmock_Female` and `ELBOW_FIXED_SchoolSmock_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render | 360px Blender render |
| --- | --- | --- |
| Male | [Preview](../assets/school-smock/male-1280.png) | [Preview](../assets/school-smock/male-360.png) |
| Female | [Preview](../assets/school-smock/female-1280.png) | [Preview](../assets/school-smock/female-360.png) |

## Seated elbow root cause and concentric ball-joint cap repair

Read-only Blender MCP measurement established why both seated elbows failed under every continuous single-tube retessellation or weight-transfer attempt: in `Sit` (frames `75–171`), `DEF-forearm.{L,R}` rotates **149.88°** relative to `DEF-upper_arm.{L,R}.001` (**116.68°** swing bend + **120.65°** roll twist). Under Linear Blend Skinning (LBS), any continuous sleeve quad strip or blended weight ring bridging those two bones shrinks radially by $\cos(149.88^\circ / 2) \approx 0.26$ (`44 mm → 11.4 mm`), cutting straight through the 29 mm elbow skin.

The fix preserves the accepted torso, chest/bust, shoulders, and `|x| <= 0.225` boundary ring on `SchoolSmock_{Female,Male}_Shell` (`2,044` vertices / `2,560` polygons per shell) and replaces only the distal `L`/`R` sleeves with **concentric closed hemispherical elbow caps** centered on the exact elbow bone pivot (`DEF-forearm.{L,R}.head_local ≈ (±0.3121, -0.0236, 0.6802)`):

- **Upper-arm segment + closed cap** (`100% DEF-upper_arm.{L,R}.001`): cylindrical transition from `|x| = 0.225` → `0.258` → elbow pivot (`R = 0.0455 m`), closed distally into a smooth hemisphere (`phi = 0°..85°` + pole) nested inside the forearm sleeve.
- **Forearm closed cap + distal sleeve** (`100% DEF-forearm.{L,R}` on cap + `0.355`, `0.98/0.02` blend at `0.402`, `100% DEF-forearm.{L,R}.001` at `0.447`–`0.487`): closed hemisphere (`R = 0.0452 m`, `0.3 mm` concentric clearance inside `R_ua` to prevent coplanar Z-fighting) tapering cleanly to the wrist cuffs.

Because both caps are rotationally invariant spheres centered on the bone pivot, they keep full elbow coverage under the `149.88°` Sit bend+twist without pinching, skin exposure, or open pipe rims.

## Latest verification (post-fix)

| Check | Observed result |
| --- | --- |
| Live & viewer clearance (`12` frames × `2` genders × `2` elbows) | `0` exposed body arm vertices, `0` exposed body arm triangle samples (`Idle 1/25/49`, `Walk 50/62/74`, `Sit 75/123/171`, `Wave 172/201/231`); `min_outer_straight_clearance_mm = 5.257–5.432 mm`; `0` inward sleeve polygons; `494` pre-existing meshes preserved (`odd/artifacts/school-smock-elbow-fixed-report.json`) |
| Cycles shaded renders | `12` PNGs (`odd/previews/school-smock-elbow-fixed-{Female,Male}-{SitFront,SitSide,SitRear,Idle,Walk,Wave}.png`): inspected `Female-SitSide/Rear/Front/Idle/Walk/Wave` and `Male-SitSide/Rear` — zero skin punctures, zero hollow hole/dark notch at bent elbows, smooth straight sleeves in Idle/Walk/Wave |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`36,136 B`, `2,301` verts across `11` meshes, max `4` influences, max sum error `6.85e-7`) and `Female` (`51,620 B`, `4,472` verts across `11` meshes, max `4` influences, max sum error `6.71e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed arm verts/tris on decoded frames `1, 62, 123, 201` (`odd/artifacts/school-smock-elbow-fixed-export.json`) |
| Outward sleeve normals (`test-school-smock-sleeve-normals.py`) | `PASS` on both public GLBs via Blender MCP (`1,360` left / `1,360` right triangles per body, `0` inward, minimum dot `0.94127`) |
| Structural & budget (`test-school-smock.mjs`, `test-school-polo.mjs`, `test-basic-tshirt.mjs`) | `PASS` all three asset scripts (`<= 1 MB`, canonical 34, isolated Draco, zero clips, neutral `AvatarTopTint` + `AvatarDetail`) |

The existing 760-vertex editable T-shirt shells supplied torso, shoulder roots and upper-arm fit. The initial build added distal sleeves, two collar leaves, a surface-following placket and three buttons. The short hem uses only waist-level loops, without a skirt or thigh panels. The single remaining correction transferred local body surface weights only on the x=.265/.310 connector rings of both arms and the bottom two waist rings. Geometry, cuff positions and shoulder roots are unchanged; this allowance is now exhausted. The long approach remains rejected; its allowance is exhausted.

## Latest saved-state verification after restart

The mirrored right extension used the left sleeve's face order, turning its 200 quads inward on both bodies. This deterministic orientation defect is separate from the exhausted weight-fitting correction. The new [public-GLB regression test](../../scripts/assets/test-school-smock-sleeve-normals.py) observed RED (exit 1: 400 inward triangles per right sleeve) before the fix and GREEN (exit 0) afterward. It checks triangle geometry, not double-sided material flags.

An independent read-only verifier subsequently confirmed:

| Saved artifact | Observed result |
| --- | --- |
| Both public GLBs | 400 outward, zero inward triangles per sleeve; minimum radial dots 0.9472474 male / 0.9498521 female |
| Structural test | PASS both exports at the current sizes above; canonical34, isolated skinned Draco garments, zero clips |
| Saved master | Explicit exit 0; each named master scene has 200 outward, zero inward faces per sleeve, 1,160 shell vertices / 1,040 polygons and a 34-bone rig |

The independent public-test wrappers returned PASS output but did not expose numeric exit codes; only the separate saved-master inspection exposed exit 0. The expected `Library file, loading empty scene` warning did not prevent inspecting the two named master scenes.

Blender restarted during the authoring workflow. The corrected master and exports are now confirmed on disk, but the corrected winding viewer/live-scene persistence remains unverified. Do not replay `odd/scripts/blender/school-smock-winding-fix.py`: some writes already applied. Resume live work only after reconnecting Blender MCP and reconciling the currently open file. Final post-winding coordinate/weight preservation and animated appearance still lack independent proof; no new correction renders or completed winding JSON report exist.

## Earlier weight-correction verification

| Check | Observed result |
| --- | --- |
| Structural RED | Previously exit1, missing male export; local `odd/artifacts/school-smock-final-red.txt` |
| Structural GREEN | Both variants pass canonical34 hierarchy/rest transforms, isolated skinned Draco meshes, neutral semantic export materials, zero animations/cameras/lights and budget |
| Existing T-shirt and polo tests | Both exit0, unchanged reported sizes |
| Asset budget | Exit0; 28 models within limits, three existing #91 exceptions |
| Final Draco decode | Male1,274 / female1,276 vertices across seven meshes each; max4 positive influences, zero unweighted, max weight-sum error7.43662e-7 |
| Rest/binding | Imported bone rest matrices match source canonical rig within1e-4; preview binds decoded garments directly to copied animated body rigs by name |
| Preservation |19 original review mesh geometry/topology/weight hashes unchanged; copied reference meshes match source. This is not a full material/rig/action audit |

Export isolation selected only the canonical34 rig and seven garment meshes in a new active scene. Generic Draco precision is20 bits. The female preview retains its original legacy41 body rig; the exported garment has34 joints. No body migration, body hiding, pants/boots edits, runtime integration or commits occurred. Master scenes contain garment and canonical rig only, without body references. Source materials use private names to avoid modifying originals; exported material names are `AvatarTopTint` and `AvatarDetail`.

## Visual disposition and remaining work

Ten decoded-export720px Blender renders were inspected: Rest1 and Walk62 frontal three-quarter; Sit123 side and rear; Wave201 frontal three-quarter, both bodies. Local names are `odd/previews/school-smock-final-decoded-<Male|Female>-<Rest|Walk|Sit|Rear|Wave>.png`.

Front views show a short white buttoned garment and bending long sleeves. Human feedback said it read as a long-sleeve polo. The selected direction uses open lapels, two low pockets, front overlap and defined wrist cuffs. The human later explicitly added centered, pointed smoke-gray ties for both variants, replacing the earlier no-tie choice. These design details exist only in separate ignored previews, not these production exports. The head hides much of the collar. The earlier cuff-at-elbow interpretation was incorrect: independent measurement places the cuff10.6mm from the wrist, with matching binding transforms. The visible holes are elbow skin penetrating the connector. The authorized per-vertex barycentric surface-weight transfer was applied once, using region-constrained triangles and at most four normalized influences. Corrected decoded Sit123 side/rear still shows elbow skin on both bodies and small female rear-waist gaps. Walk62 looks plausible but does not resolve seated failure. That weight correction did not move geometry, relocate cuffs or inflate the sleeve. A later distinct right-face winding correction changed orientation only; it does not establish that the earlier animated clearance failures are resolved. The correction allowance is exhausted; structural GREEN does not establish visual acceptance.

Separate ignored design previews include front/detail, Walk, Sit, rear and grayscale renders; the latest readability version uses physical pocket mouths, lifted lapels, a broader overlap and wrist bands. An earlier diagnostic color viewer used slate-blue fabric with lighter details. The human clarified that only the details should contrast: the current ignored `odd/previews/school-smock-white-smoke-review.blend` contains `WHITE_SchoolSmock_Female` and `WHITE_SchoolSmock_Male`, with white shell/front overlap and medium smoke-gray lapels, pockets and wrist cuffs. Exact material-value assertions pass on ten garment objects per body; copied/source geometry and weight hashes remain equal. This is a material-only preview choice, not a production export update or readability/fit acceptance. The primary export material is tint-ready, but this smock is not integrated into the web catalog or color selector. Independent readability review found front/detail improvement, but elevated female pockets remain compressed and the collar partly head-occluded. Its once-only technical check validated female detail weights before male evaluation failed on a missing dependency graph; prior-shell comparison did not complete and was not retried.

Permanent final 1280/360px evidence, continuous clearance, post-winding visual inspection and final fit acceptance remain pending. These local renders are Blender evidence, not browser/mobile UI or GPU performance proof. No all-frame clearance claim is made.

## Pointed tie preview

The latest ignored `odd/previews/school-smock-tie-corrected-review.blend` adds a separate pointed tie to each white/smoke-gray preview. Each tie uses the same material datablock as its respective lapel; collar, pockets and cuffs retain matching smoke-gray shader values. The white front overlap remains separate. These are preview additions, not production export updates.

The initial female blade intersected the curved front between sparse samples. One tie-only surface-following correction changed the female tie, not the body, shell, male tie or existing fitting. A REST interior probe observed 63/252 buried samples before the correction (minimum -7.73 mm), then 0/42,280 afterward (minimum +4.22 mm). The male tie remained at 0/252. These sampled checks do not prove continuous-surface or all-animation clearance. Six Cycles images show the corrected female Front/Detail/Elevated/Walk62/Sit123 and unchanged Male Front. Parent inspection found the pointed ties continuous in the viewed front/detail images; independent visual review also found the corrected pointed ties readable in those samples. Independent saved-library verification failed with exit 1 in the verifier's own clearance probe (`tessellate_polygon` indices were treated as coordinate vectors). The final static checks were not reached, and no retry ran. Exact saved material equality, weights, binding, NLA, hashes and sampled clearance therefore remain independently unverified; the results below are author-side evidence, not an independent pass.

The worker recorded 462 pre-existing mesh fingerprints unchanged, normalized height-varying canonical torso weights, input file hashes unchanged, and white shader values preserved. Historical preservation is not independently proven by these claims. Existing sleeve and rear-waist failures remain visible and are not corrected by the tie work. No commits or final garment approval.

## Correction evidence

Local `odd/artifacts/school-smock-final-correction.json` records unchanged geometry hashes and restricted changed-weight indices. All240target vertices per body were processed; the reported male233changed count reflects seven already processed before an interrupted assertion. Initial transfer rejected a nearest triangle with insufficient permitted regional weight. Candidate triangles were then constrained to majority matching regional influence before completing the same transfer; no geometry or visual-fit iteration occurred.19 original live mesh hashes remain equal.

Before views remain `school-smock-final-decoded-*`; corrected export views are `odd/previews/school-smock-final-corrected-decoded-<Male|Female>-<Rest|Walk|Sit|Rear|Wave>.png`. Corrected Walk62, Sit123 side and rear were inspected on both bodies. Corrected rest/Wave renders were generated but are not additional acceptance proof. `odd/artifacts/school-smock-final-corrected-checks.json` contains final decoded measurements. Final decoded bones match canonical rest matrices within1e-4. No permanent finished-asset evidence was produced because clearance still fails.

## Seated-elbow repair rejected

**The localized retessellation candidate failed and must not replace the existing preview.** The human limited this resumption to both elbows when seated; waist/lower body and the accepted Idle, Walk and Wave appearance are outside the repair scope.

A corrected diagnostic selected the actual 1,160-vertex shells and 2,710-vertex bodies in `TIE_CORRECTED_SchoolSmock_Female/Male`, rather than the pants/lapel selected by the earlier failed inspection. The elbow bone chain is continuous. Specific seated sleeve triangle interiors cut the skin by about 2.5–3.1 mm while their vertices remain outside. This demonstrates a geometric contact defect, not broken bones or a misplaced wrist cuff.

| Check | Observed author result |
| --- | --- |
| Baseline contact regression | 12 seated records fail; 36 nonseated records pass sampled assertions |
| One curved conforming-retessellation candidate | 2,280 vertices per shell; new vertices follow the curved rest skin, not merely the old planar facets |
| Same contact assertions after the change | All 12 seated records still fail; 20 nonseated records also fail; no GREEN |
| Shaded images | 12 Cycles views; female seated side and male seated rear still show skin punctures |
| Preservation | Author reports unchanged original shell vertices/weights, outside-patch faces, non-shell meshes, rig rest/binding and material identity; new weights normalized, at most four influences, none unweighted |
| Export/decode | Not performed for the failed candidate; no decoded candidate exists |

The rejected copy is `odd/previews/school-smock-elbow-candidate.blend`, scenes `ELBOW_CANDIDATE_SchoolSmock_Female/Male`. Local contact, preservation and image-hash reports are under `odd/artifacts/school-smock-elbow-*.json`; these ignored artifacts are not delivered assets. Local signed nearest-surface distances are diagnostic values, not established penetration depths. Independent rejection/preservation review is pending; author preservation assertions are not independent proof.

The previous tie-corrected preview, production master and GLBs were not overwritten by this unit. No body, rig, waist, lower-body or accepted design changes were applied, and no commits were made. The single geometric candidate allowance is consumed; no automatic modeling retry, weight/inflation loop, hidden skin or final acceptance is authorized. A different repair approach still needs an evidenced technical handoff; increasing tessellation alone did not resolve deformation.

## Errors and ownership limits

Prior authoring first hit an undefined execution variable, then a missing semantic material assertion; these were corrected before the completed initial build. Its material initialization may have changed an existing shared material if present: no pre-authoring material baseline exists, so material preservation cannot be asserted. This resumed unit copied materials for export, temporarily reserved semantic names and restored original names; it did not attempt to overwrite unknown original material values. Original dirty `basic-tshirt-review.blend` was neither saved nor opened over. Master and viewer were written only to previously absent destinations with `libraries.write`.

S1–S3: authorized short fallback exported with accepted white + smoke-gray details + centered pointed tie and concentric closed spherical elbow-cap repair (all 12 sampled frames pass zero exposed arm vertices/triangles). S4: human visual review approved and local commit authorized (not pushed). Wishlist remains unchecked until merge.

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
