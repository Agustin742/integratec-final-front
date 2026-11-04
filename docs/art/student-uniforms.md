# Modular avatar and school uniform 3D assets

This document describes the modular male and female 3D avatar assets (`public/models/avatars/`) and the editable Blender sources for the student uniforms (`assets/blender/avatars/student-uniforms/`), their technical structure, and how to verify them. Visual direction follows [Art direction](../../rules/art-direction.md) and [Avatars and customization](../../rules/avatars-and-customization.md).

## Delivered asset inventory

### 1. Editable Blender uniform sources (`assets/blender/avatars/student-uniforms/`)

Each school uniform variant retains its editable Blender source file (`uniform.blend`) and exports a single upper-body runtime module (`coat-tie.glb` or `polo-sweater.glb`) worn over the unmodified base body (`Pants` and `boots`):

| Variant | Editable Blender source | Runtime upper-body module |
|---|---|---|
| `male/primary-trousers` | [`assets/blender/avatars/student-uniforms/male/primary-trousers/uniform.blend`](../../assets/blender/avatars/student-uniforms/male/primary-trousers/uniform.blend) | [`public/models/avatars/male/uniforms/primary-trousers/coat-tie.glb`](../../public/models/avatars/male/uniforms/primary-trousers/coat-tie.glb) |
| `male/secondary-trousers` | [`assets/blender/avatars/student-uniforms/male/secondary-trousers/uniform.blend`](../../assets/blender/avatars/student-uniforms/male/secondary-trousers/uniform.blend) | [`public/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb`](../../public/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb) |
| `female/primary-trousers` | [`assets/blender/avatars/student-uniforms/female/primary-trousers/uniform.blend`](../../assets/blender/avatars/student-uniforms/female/primary-trousers/uniform.blend) | [`public/models/avatars/female/uniforms/primary-trousers/coat-tie.glb`](../../public/models/avatars/female/uniforms/primary-trousers/coat-tie.glb) |
| `female/secondary-trousers` | [`assets/blender/avatars/student-uniforms/female/secondary-trousers/uniform.blend`](../../assets/blender/avatars/student-uniforms/female/secondary-trousers/uniform.blend) | [`public/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb`](../../public/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb) |

### 2. Modular runtime `.glb` assets (`public/models/avatars/`)

Both `male/body.glb` (`34`-joint runtime rig) and `female/body.glb` (`41`-joint runtime rig) keep their built-in `Pants` and `boots` from the waist down. Modular hairstyles, upper-body tops/uniforms, and accessories bind to the corresponding canonical skeleton:

| Body | Category | Delivered `.glb` files |
|---|---|---|
| Female (`41` joints) | Body | `female/body.glb` |
| Female (`41` joints) | Hairstyles | `female/hair-afro.glb`, `female/hair-original.glb` |
| Female (`41` joints) | Casual tops | `female/top-hoodie.glb`, `female/top-tank.glb`, `female/top-tshirt.glb` |
| Female (`41` joints) | School uniforms | `female/uniforms/primary-trousers/coat-tie.glb`, `female/uniforms/secondary-trousers/polo-sweater.glb` |
| Female (`41` joints) | Accessories | `female/accessory-cap.glb`, `female/accessory-earrings.glb`, `female/accessory-glasses.glb`, `female/accessory-headphones.glb` |
| Male (`34` joints) | Body | `male/body.glb` |
| Male (`34` joints) | Hairstyles | `male/hair-afro.glb`, `male/hair-dreads.glb` |
| Male (`34` joints) | Casual tops | `male/top-hoodie.glb`, `male/top-tank.glb` |
| Male (`34` joints) | School uniforms | `male/uniforms/primary-trousers/coat-tie.glb`, `male/uniforms/secondary-trousers/polo-sweater.glb` |
| Male (`34` joints) | Accessories | `male/accessory-backpack.glb`, `male/accessory-cap.glb`, `male/accessory-headphones.glb`, `male/accessory-round-glasses.glb`, `male/accessory-square-glasses.glb` |

## Design and technical decisions

- **Upper-body uniform modules over base legs:** Primary (`coat-tie.glb`, ivory smock with navy tie) and secondary (`polo-sweater.glb`, indigo V-neck sweater over cream polo collar) school uniforms are authored as single-file upper-body `top` modules so the base avatar's `Pants` and `boots` remain intact without mesh replacement or hiding.
- **Distinct female anatomy and rig:** Female assets use the dedicated female body mesh, facial geometry, and `41`-joint skeleton rather than a rescaled male mesh.
- **Curated asset set:** Twelve unaligned candidate `.glb` exports (whose sleeves remained in a rigid T-pose or whose hair meshes clipped into the head) were excluded after Blender lineup inspection so only verified modules ship under `public/models/avatars/`.
- **Repository hygiene:** Temporary Blender test renders (`*.png`), JSON check reports (`*.json`), and local agent work plans live exclusively under the gitignored `odd/` directory.

## Verification and limitations

1. **Documentation and link validation:**
   ```sh
   python -B scripts/ci/check_docs.py docs/art/student-uniforms.md AGENTS.md rules/git-workflow.md changelogs/tracker-alejo.md
   python -B -m unittest scripts/ci/test_checks.py
   git diff --check origin/develop
   ```
2. **Skeleton and skinning verification in Blender:**
   - All exported `.glb` modules import cleanly into Blender (`Khronos glTF Blender I/O`, glTF 2.0) and match their canonical body joint sets (`34` joints for male, `41` joints for female) with normalized vertex weights and matching inverse-bind matrices (within `1.2e-6`).
   - Both `male/body.glb` and `female/body.glb` include the `Idle`, `Walk`, and `Sit` animation clips.
3. **Known limitations:**
   - Linear bone-weight skinning on the longer lower panels of the primary smock (`coat-tie.glb`) exhibits minor mesh intersection in deep seated (`Sit`) poses; standing (`Idle`) and walking (`Walk`) poses deform cleanly.
   - This delivery provides the 3D `.glb` and `.blend` assets only; browser wardrobe UI and runtime loader integration belong to their separate feature slice.
