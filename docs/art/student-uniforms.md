# Student uniform visual designs

**Both female skirt alternatives now end at the canonical anatomical knees. Animated fit remains partial, not approved.** Primary retains the ivory guardapolvo and navy tie; secondary retains the indigo sweater and cream polo, without a tie. Trousers, shoes, bodies and materials keep their existing designs.

The renewed S10–S11 Blender pass sampled the existing Idle/Walk/Sit actions on all six assemblies and regenerated the same modular paths. Seated primary coats still have side-front penetration after two bounded weighting corrections. Skirt hems also crease sharply when seated, with rear waist/coat overlap visible from the side. Secondary sleeves expose elbow skin in the seated view. These are **study exports, not integration-ready animated clothing**; do not interpret structural checks as visual fit approval. Earlier parent Chrome inspection applies to the previous static stage, not these regenerated exports.

## Quick inspection

1. Open the editable `uniform.blend` or the versioned front/three-quarter evidence below for the desired variant.
2. In the current local checkout only, use `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort` and open `http://127.0.0.1:4173/odd/previews/student-uniforms/`. The ignored inspector and dressed references are local verification aids, not versioned deliverables.
3. Parent Chrome inspection loaded and viewed all six selections with no model-load failure or horizontal overflow. An unrelated missing favicon was the only observed console error; the local inspector now supplies an inline icon. The renewed Blender motion study below remains partial.

## Delivered inventory

Each key below has an editable file at `assets/blender/avatars/student-uniforms/<key>/uniform.blend` and a dressed reference at `odd/previews/student-uniforms/<key>/dressed.glb`.

| Key | Three-quarter evidence | Front evidence |
|---|---|---|
| `male/primary-trousers` | [Render](../../assets/blender/avatars/student-uniforms/male/primary-trousers/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/male/primary-trousers/front.png) |
| `male/secondary-trousers` | [Render](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/front.png) |
| `female/primary-trousers` | [Render](../../assets/blender/avatars/student-uniforms/female/primary-trousers/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/female/primary-trousers/front.png) |
| `female/primary-skirt` | [Render](../../assets/blender/avatars/student-uniforms/female/primary-skirt/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/female/primary-skirt/front.png) |
| `female/secondary-trousers` | [Render](../../assets/blender/avatars/student-uniforms/female/secondary-trousers/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/female/secondary-trousers/front.png) |
| `female/secondary-skirt` | [Render](../../assets/blender/avatars/student-uniforms/female/secondary-skirt/rest.png) | [Front](../../assets/blender/avatars/student-uniforms/female/secondary-skirt/front.png) |

| Modular export directory | Files |
|---|---|
| `public/models/avatars/male/uniforms/primary-trousers/` | `coat-tie.glb`, `trousers.glb`, `shoes.glb` |
| `public/models/avatars/male/uniforms/secondary-trousers/` | `polo-sweater.glb`, `trousers.glb`, `shoes.glb` |
| `public/models/avatars/female/uniforms/primary-trousers/` | `coat-tie.glb`, `trousers.glb`, `shoes.glb` |
| `public/models/avatars/female/uniforms/primary-skirt/` | `coat-tie.glb`, `skirt.glb`, `shoes.glb` |
| `public/models/avatars/female/uniforms/secondary-trousers/` | `polo-sweater.glb`, `trousers.glb`, `shoes.glb` |
| `public/models/avatars/female/uniforms/secondary-skirt/` | `polo-sweater.glb`, `skirt.glb`, `shoes.glb` |

Every editable variant directory also retains `checks.json` and `export-checks.json`; [catalogue-checks.json](../../assets/blender/avatars/student-uniforms/catalogue-checks.json) summarizes all six. The inspector at `odd/previews/student-uniforms/index.html` is an ignored local technical viewer, not a wardrobe interface.

## Source, construction and reproduction

Read-only source: `D:/ALEJO/AleMart/Documents/GITHUB/IntegrarTec/ProyectoFinal/prueba-3d/odd/worktrees/avatar-customization`. Editable bases are `assets/blender/avatars/{male,female}-editable.blend`; canonical bodies are `public/models/avatars/{male,female}/body.glb`. The female assets use the actual female body, facial meshes and 41-joint rig, not a scaled male substitute. The male runtime rig has 34 joints; its editable authoring rig has 216 bones. The separately authorized external female GLB was unnecessary.

The self-contained helper is `scripts/blender/student_uniforms.py`. In Blender's Python console, execute it with `exec(compile(path.read_text(), str(path), 'exec'))`, where `path` is its `pathlib.Path`. Call `build(source_checkout, destination_checkout, sex, level, bottom)` for the six combinations above, splitting each key into its body, level and bottom. Outputs must be new or this task's own manifested variants; the explicitly authorized previous male study may also be revised. `build()` still renders static views. For the renewed motion pass, load `scripts/blender/student_uniforms_motion.py` the same way, call `revise(destination_checkout, sex, variant)` once per variant, then `verify(destination_checkout, sex, variant, export=True)` and `audit_exports(destination_checkout, source_checkout, sex, variant)`. `regression_checks(destination_checkout, source_checkout)` exercises the public garment builder. These functions retain appended scenes; do not repeatedly invoke `revise()` against an already revised file as a new correction.

Construction uses new stitched torso/armhole/sleeve loops, tailored trouser volumes, gently pleated A-line skirts and shaped shoe lasts. No old outfit geometry is copied. Neck folds are tessellated before seating against the sole continuous sweater surface; corner-only fitting failed because the intervening broad faces cut into its curvature. Primary pockets and placket are coherent patches. Colors are original implementation choices, not a finalized institutional identity; there are no logos or insignia.

Anatomical meshes, materials, proportions and canonical rigs are unchanged. Original pants/boots remain unchanged but hidden in editable design scenes and omitted from dressed references so the new clothing can be inspected. This asset unit does not migrate a runtime body, hair/accessory catalog, app or wardrobe. Scene copies use `bpy.data.libraries.write`; the helper never opens/resets a main file or deletes pre-existing scenes/data. The original Cube/Camera/Light scene remains active. Open editable outputs in a separate Blender session rather than discarding unsaved work.

## Historical static-stage checks

These observations describe the completed original design stage, not approval of the renewed motion study.

- All 72 garment meshes across six assemblies are nonempty, finite, normalized and bound to their existing rigs. Every continuous top has one connected component.
- All 24 GLBs (18 modules and six dressed references) reimported into isolated Blender scenes. Joint names matched each canonical body: 34 male, 41 female. Maximum inverse-bind error: male `3.5762786865234375e-7`, female `1.1920928955078125e-6`; maximum exported weight-sum error `1.3431417755782604e-7`.
- Unchanged rigid facial/base primitives do not require vertex weights; every new garment primitive does. The audit was corrected to distinguish those cases after its initial `WEIGHTS_0` lookup failed on an unchanged rigid base primitive.
- Base coordinates, weights, mesh transforms, parent inverse transforms and rest bones remained unchanged during each build. Recorded editable/runtime source hashes remained unchanged for both bodies.
- All twelve front/three-quarter renders were inspected. No visible static body penetration or garment gaps were observed; skirts are readable alternatives. This is worker evidence, not parent approval or exhaustive collision proof.
- Appearance has no meaningful automated pre-implementation RED. No app suite/build was run. Parent Chrome rendering was checked for all six selections. Rear/underside acceptance, gameplay-scale/mobile/grayscale checks and motion are not claimed.

## Renewed knee-length and motion study (S6–S7, S10–S11)

Baseline: `0295a99c0cebc8ff342db409c16ae7c6f175ba9a`. Actual Blender MCP reproduced the long female skirt and seated male coat failure before edits. The female knee reference is the mean world-space height of `DEF-shin.L` and `DEF-shin.R` heads: `0.2651351392`, not the subdivided `.001` shin joints or the floor. Only the lowest skirt row moved from `0.17` to that height; waist, pleat widths and other rest geometry remain unchanged. The knee assertion failed before correction and passed for both revised alternatives. Builder regressions preserve rest geometry, source bases, normalized weights and upper-panel weights; shortening is idempotent.

The first weighting correction (maximum thigh contribution `0.85`) flipped the male front hem upward in Sit49; its images remain under `male/primary-trousers/motion-attempt-1/`. The second (`0.45`, formerly `0.18`) reduces that flip but leaves visible side-front penetration. No third correction, cloth simulation, new rig or silhouette redesign was attempted. Pockets and placket receive the same lower-panel weight field as the coat.

Every assembly has `motion-checks.json`, `motion-after/` renders and a contact sheet. The 18 sheet cells, left-to-right/top-to-bottom, are: rest front/side/three-quarter; Idle25 front/side/three-quarter; Idle1/49 three-quarter; Walk13 front/side/three-quarter; Walk1/25 three-quarter; Sit49 front/side/three-quarter; Sit1/97 three-quarter.

| Assembly | Inspected contact sheet | Visual disposition |
|---|---|---|
| Male primary trousers | [Sheet](../../assets/blender/avatars/student-uniforms/male/primary-trousers/motion-after/contact-sheet.png) | Sit49 coat penetration persists |
| Male secondary trousers | [Sheet](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/motion-after/contact-sheet.png) | Seated elbow exposure; not approved |
| Female primary trousers | [Sheet](../../assets/blender/avatars/student-uniforms/female/primary-trousers/motion-after/contact-sheet.png) | Sit49 coat penetration persists |
| Female secondary trousers | [Sheet](../../assets/blender/avatars/student-uniforms/female/secondary-trousers/motion-after/contact-sheet.png) | Seated elbow exposure; not approved |
| Female primary skirt | [Sheet](../../assets/blender/avatars/student-uniforms/female/primary-skirt/motion-after/contact-sheet.png) | Knee length observed; seated hem crease/rear overlap |
| Female secondary skirt | [Sheet](../../assets/blender/avatars/student-uniforms/female/secondary-skirt/motion-after/contact-sheet.png) | Knee length observed; seated hem crease/elbow exposure |

Structural evidence: 171 integer frames per assembly (Idle1–49, Walk1–25, Sit1–97), including clip boundaries and all integer keyframes, remain finite: 1,026 sampled poses total. Midpoints have front/side/three-quarter renders; boundaries have three-quarter renders. All 24 GLBs reimported in separate Blender scenes; canonical joints remain 34 male/41 female, maximum inverse-bind error `1.1920928955078125e-6`, normalized exported weights within `1e-5`. Exact source-base coordinates, topology, weights, material colors/roughness/metalness and transforms match fresh source imports in REST at frame0. An initial cross-source fingerprint check compared animated frame1 facial transforms against REST and failed; aligning both to REST/frame0 corrected the check, not the bodies. See `motion-base-preservation.json`, `motion-regressions.json` and `motion-reimports.json` in the asset root. Per-variant source hashes/rest-bind snapshots remained unchanged.

Visual checks inspected all six sheets plus full-size knee/seated examples. These are finite sampled views, not continuous-motion, collision or physics approval. App tests/typecheck/browser integration were not run for this asset-only unit; parent T6 owns wardrobe assembly. No source files or original scenes were edited, opened or reset. Added inspection scenes remain in Blender, with `Scene` restored active.

## Historical design-stage limitations

The earlier continuous male primary [Sit frame 49](../../assets/blender/avatars/student-uniforms/male/primary-trousers/sit-49.png) remains historical evidence, separate from the renewed `motion-before/` reproductions and `motion-after/` study. The [previous failed-study evidence](../../assets/blender/avatars/student-uniforms/previous-study/rest.png) is retained; neither proves current fit acceptance.

Exports retain canonical skin bindings, but dressed references contain no animation clips. They must not replace runtime body assets or be treated as approved static-only substitutes for future animated fit. No cloth simulation, new bones or shape-key animation pipeline was introduced. No Blender-specific skill was available or used; actual Blender MCP handled authoring/inspection, and the injected cognitive-doc-design skill guided documentation.

The visual-design stage covers all six variants and includes parent Chrome inspection. Review is organized as a feature-branch chain: shared generator and male designs first, then female alternatives and this complete inventory. The first unit retains its coherent generator despite exceeding the suggested source-review budget. No PR, push, integration readiness or animation acceptance is implied.
