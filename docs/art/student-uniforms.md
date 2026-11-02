# Male school uniform visual designs

Two male static designs are delivered on the unchanged existing body: primary-school ivory guardapolvo with navy tie/trousers, and secondary-school indigo sweater with cream polo collar/inset and navy trousers. Both include new school shoes. These are visual-design assets, not integration-ready animated clothing; female variants follow in the next feature-chain slice.

## Inspect the designs

| Design | Editable scene | Evidence |
|---|---|---|
| Primary | `assets/blender/avatars/student-uniforms/male/primary-trousers/uniform.blend` | [Three-quarter](../../assets/blender/avatars/student-uniforms/male/primary-trousers/rest.png), [front](../../assets/blender/avatars/student-uniforms/male/primary-trousers/front.png) |
| Secondary | `assets/blender/avatars/student-uniforms/male/secondary-trousers/uniform.blend` | [Three-quarter](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/rest.png), [front](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/front.png) |

Open editable scenes in a separate Blender session without discarding unsaved work. Modular GLBs live under `public/models/avatars/male/uniforms/<variant>/`: `coat-tie.glb` or `polo-sweater.glb`, plus `trousers.glb` and `shoes.glb`. Evidence directories retain `checks.json` and `export-checks.json` beside each editable.

## Source and reproduction

Read-only source is the existing `prueba-3d/odd/worktrees/avatar-customization` checkout. The helper `scripts/blender/student_uniforms.py` imports the canonical `public/models/avatars/male/body.glb`, retaining its anatomical meshes, materials, proportions, weights and 34-joint rig; it does not substitute the 216-bone editable rig.

In Blender's Python console, set `path` to the helper's `pathlib.Path`, execute `exec(compile(path.read_text(), str(path), 'exec'))`, then call `build(source_checkout, destination_checkout, 'male', level, 'trousers')` for `level` equal to `primary` or `secondary`. Outputs must be new or the helper's own manifested design outputs. No old garment geometry is copied. The helper preserves the active original scene, never opens/resets a main file or deletes pre-existing scenes, and writes editable copies with `bpy.data.libraries.write`.

## Verification and limitations

- Worker front/three-quarter Blender inspection, finite/nonempty rig-bound meshes, normalized weights and export/reimport checks passed. Canonical joints and inverse binds matched; source hashes and base snapshots stayed unchanged.
- Parent observed both selections loading and rendering in the isolated local Chrome inspector. Syntax compilation, documentation links and whitespace checks passed. No application code, wardrobe, hair, accessories, source assets or dependencies were changed.
- The ignored inspector and dressed references under `odd/previews/student-uniforms/` are local-only verification aids, not versioned deliverables. Generated Blender screenshots and numerical checks are versioned beside the editables.
- The [historical seated primary failure](../../assets/blender/avatars/student-uniforms/male/primary-trousers/sit-49.png) remains unresolved: thighs penetrate the coat and some elbow skin is exposed. The user explicitly deferred animated fit; secondary motion is unverified. GLB references contain no clips; skin bindings alone do not establish animation acceptance.
- No gameplay-scale, mobile, rear/underside, grayscale or integration readiness is claimed. Colors are design choices without logos or finalized institutional identity. No Blender-specific skill was available or used; actual Blender MCP performed authoring and inspection.

## Review boundary

This first feature-chain unit includes the shared generator, both male designs, their evidence and this guide. The next unit supplies female trouser/skirt variants and the complete catalogue inventory. No PR or push is included; generator size is retained as a coherent unit rather than compressed to meet a line budget.
