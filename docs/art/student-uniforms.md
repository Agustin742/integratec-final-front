# Student uniform visual designs

**The wardrobe offers the two upper-body school uniforms (`coat-tie.glb` and `polo-sweater.glb`) over the unmodified base body (`Pants` and `boots`).** Primary retains the ivory guardapolvo and navy tie; secondary retains the indigo sweater and cream polo, without a tie.

## Wardrobe selection

The wardrobe offers **Uniforme primaria** (`coat-tie.glb`) and **Uniforme secundaria** (`polo-sweater.glb`) under **Prenda** for both bodies, as upper-body `top` garments only. Both `male/body.glb` and `female/body.glb` keep their original base `Pants` and `boots` from the waist down; nothing hides them and no trousers, skirt or shoe module is loaded. Catalogue and loader details are in [avatar-wardrobe.md](./avatar-wardrobe.md).

## Delivered inventory

Each variant below retains its editable Blender source file (`uniform.blend`) and its exported upper-body runtime module (`coat-tie.glb` or `polo-sweater.glb`):

| Variant | Editable Blender source | Runtime upper-body module |
|---|---|---|
| `male/primary-trousers` | `assets/blender/avatars/student-uniforms/male/primary-trousers/uniform.blend` | `public/models/avatars/male/uniforms/primary-trousers/coat-tie.glb` |
| `male/secondary-trousers` | `assets/blender/avatars/student-uniforms/male/secondary-trousers/uniform.blend` | `public/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb` |
| `female/primary-trousers` | `assets/blender/avatars/student-uniforms/female/primary-trousers/uniform.blend` | `public/models/avatars/female/uniforms/primary-trousers/coat-tie.glb` |
| `female/secondary-trousers` | `assets/blender/avatars/student-uniforms/female/secondary-trousers/uniform.blend` | `public/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb` |

All temporary Blender test renders (`*.png`), JSON check reports (`*.json`), study exports, and local Blender authoring scripts (`odd/scripts/blender/student_uniforms*.py`) live exclusively under the gitignored `odd/` directory and are never committed to the repository.

## Source, construction and reproduction

Read-only source: `D:/ALEJO/AleMart/Documents/GITHUB/IntegrarTec/ProyectoFinal/prueba-3d/odd/worktrees/avatar-customization`. Editable bases are `assets/blender/avatars/{male,female}-editable.blend`; canonical bodies are `public/models/avatars/{male,female}/body.glb`. The female assets use the actual female body, facial meshes and 41-joint rig, not a scaled male substitute. The male runtime rig has 34 joints; its editable authoring rig has 216 bones.

The local, untracked authoring helpers are `odd/scripts/blender/student_uniforms.py` and `odd/scripts/blender/student_uniforms_motion.py`. In Blender's Python console, execute them with `exec(compile(path.read_text(), str(path), 'exec'))`, where `path` is their `pathlib.Path`.

Construction uses stitched torso/armhole/sleeve loops, folded collars tessellated before seating against the continuous garment surface, and primary pockets/placket as coherent patches. Colors are original implementation choices without external logos or insignia. Anatomical meshes, materials, proportions, base `Pants` and `boots`, and canonical rigs remain unchanged. Scene copies use `bpy.data.libraries.write`; the helpers never open/reset a main file or delete pre-existing scenes/data.

## Verification and limitations

- All exported upper-body modules (`coat-tie.glb` and `polo-sweater.glb`) reimport cleanly and match each canonical body's joint set (`34` male, `41` female) with normalized skin weights and inverse-bind matrices within `1.2e-6`.
- Simple linear bone-weight skinning on long lower coat panels has known seated (`Sit`) deformation limitations; the runtime wardrobe uses the upper-body uniform modules over the canonical base body for `Idle` and `Walk` navigation in reception.
