# Legacy avatar bodies

This document describes the two base avatar bodies (`public/models/avatars/{male,female}/body.glb`). They are the only legacy avatar assets still shipped. The legacy per-body hairstyles, casual tops, accessories and school-uniform modules, plus the old `student-uniforms` Blender sources and `public/models/character.glb`, were removed once the modular catalog (shared hair, per-body tops, shared head/face accessories and back items) replaced them. Visual direction follows [Art direction](../../rules/art-direction.md) and [Avatars and customization](../../rules/avatars-and-customization.md).

## Delivered asset inventory

| Body | Rig | File |
|---|---|---|
| Male | `34` joints | `public/models/avatars/male/body.glb` |
| Female | `41` joints | `public/models/avatars/female/body.glb` |

Both bodies keep their built-in `Pants` and `boots` from the waist down, ship Draco-compressed within the `<= 1 MB` FD8 avatar budget (retiring the legacy `#91` exceptions), and include all `16` canonical animation clips plus `4` transition clips (see [avatar animations](avatar-animations.md) and [3D assets](../3d-assets.md)). Wearables bind to the matching canonical skeleton; see [modular avatar assets](../../rules/modular-avatar-assets.md).

## Verification

```sh
python -B scripts/ci/check_docs.py docs/art/student-uniforms.md AGENTS.md rules/git-workflow.md changelogs/tracker-alejo.md
python -B -m unittest scripts/ci/test_checks.py
git diff --check origin/develop
```
