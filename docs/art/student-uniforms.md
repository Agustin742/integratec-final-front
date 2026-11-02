# Student uniform visual designs

**Six static design assemblies are generated and pass the worker's front/three-quarter Blender inspection.** Primary uses an ivory guardapolvo and navy tie; secondary uses an indigo sweater with a cream polo collar/inset, without a tie. Both have navy trousers and school shoes. Female skirt alternatives exist for both levels without removing the trouser options.

These are **design assets, not integration-ready animated clothing**. The current stage explicitly defers animated fit. Parent Chrome inspection confirmed all six variants load and render in the local inspector; no application or wardrobe integration was performed.

## Quick inspection

1. Open the editable `uniform.blend` or the versioned front/three-quarter evidence below for the desired variant.
2. In the current local checkout only, use `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort` and open `http://127.0.0.1:4173/odd/previews/student-uniforms/`. The ignored inspector and dressed references are local verification aids, not versioned deliverables.
3. Parent Chrome inspection loaded and viewed all six selections with no model-load failure or horizontal overflow. An unrelated missing favicon was the only observed console error; the local inspector now supplies an inline icon. Animated fit remains deferred.

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

The self-contained helper is `scripts/blender/student_uniforms.py`. In Blender's Python console, execute it with `exec(compile(path.read_text(), str(path), 'exec'))`, where `path` is its `pathlib.Path`. Call `build(source_checkout, destination_checkout, sex, level, bottom)` for the six combinations above, splitting each key into its body, level and bottom. Outputs must be new or this task's own manifested variants; the explicitly authorized previous male study may also be revised. The helper renders static views only; its historical motion utility is not invoked in this stage.

Construction uses new stitched torso/armhole/sleeve loops, tailored trouser volumes, gently pleated A-line skirts and shaped shoe lasts. No old outfit geometry is copied. Neck folds are tessellated before seating against the sole continuous sweater surface; corner-only fitting failed because the intervening broad faces cut into its curvature. Primary pockets and placket are coherent patches. Colors are original implementation choices, not a finalized institutional identity; there are no logos or insignia.

Anatomical meshes, materials, proportions and canonical rigs are unchanged. Original pants/boots remain unchanged but hidden in editable design scenes and omitted from dressed references so the new clothing can be inspected. No runtime body, hair/accessory catalog, app or wardrobe was migrated. Scene copies use `bpy.data.libraries.write`; the helper never opens/resets a main file or deletes pre-existing scenes/data. The original Cube/Camera/Light scene remains active. Open editable outputs in a separate Blender session rather than discarding unsaved work.

## Observed checks

- All 72 garment meshes across six assemblies are nonempty, finite, normalized and bound to their existing rigs. Every continuous top has one connected component.
- All 24 GLBs (18 modules and six dressed references) reimported into isolated Blender scenes. Joint names matched each canonical body: 34 male, 41 female. Maximum inverse-bind error: male `3.5762786865234375e-7`, female `1.1920928955078125e-6`; maximum exported weight-sum error `1.3431417755782604e-7`.
- Unchanged rigid facial/base primitives do not require vertex weights; every new garment primitive does. The audit was corrected to distinguish those cases after its initial `WEIGHTS_0` lookup failed on an unchanged rigid base primitive.
- Base coordinates, weights, mesh transforms, parent inverse transforms and rest bones remained unchanged during each build. Recorded editable/runtime source hashes remained unchanged for both bodies.
- All twelve front/three-quarter renders were inspected. No visible static body penetration or garment gaps were observed; skirts are readable alternatives. This is worker evidence, not parent approval or exhaustive collision proof.
- Appearance has no meaningful automated pre-implementation RED. No app suite/build was run. Parent Chrome rendering was checked for all six selections. Rear/underside acceptance, gameplay-scale/mobile/grayscale checks and motion are not claimed.

## Deferred animated fit and preserved evidence

The earlier continuous male primary [Sit frame 49](../../assets/blender/avatars/student-uniforms/male/primary-trousers/sit-49.png) shows bilateral thigh penetration through the coat and small elbow exposure. It was **not fixed or rerun** in this design-first stage. Its historical `pose-checks.json`, Idle/Walk/Sit renders and [previous failed-study evidence](../../assets/blender/avatars/student-uniforms/previous-study/rest.png) remain available; they are not acceptance evidence for the final static catalogue. Movement on all new variants remains unverified.

Exports retain canonical skin bindings, but dressed references contain no animation clips. They must not replace runtime body assets or be treated as approved static-only substitutes for future animated fit. No cloth simulation, new bones or shape-key animation pipeline was introduced. No Blender-specific skill was available or used; actual Blender MCP handled authoring/inspection, and the injected cognitive-doc-design skill guided documentation.

The visual-design stage covers all six variants and includes parent Chrome inspection. Review is organized as a feature-branch chain: shared generator and male designs first, then female alternatives and this complete inventory. The first unit retains its coherent generator despite exceeding the suggested source-review budget. No PR, push, integration readiness or animation acceptance is implied.
