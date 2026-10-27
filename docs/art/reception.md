# Reception asset study

An original, warm reception diorama authored in Blender for the [room foundation](../decisions/rendering-and-authoring.md). This is an asset study, not a playable room or a completed web integration. Visual direction comes from [Art direction](../../rules/art-direction.md).

## Files and inspection

| File | Purpose |
|---|---|
| [reception.blend](../../assets/blender/reception.blend) | Separate source scene `ITReception_Scene`, materials, studio camera/lights and the original avatar as a scale reference. |
| [reception.glb](../../public/models/rooms/reception.glb) | Room geometry/materials only: 144 mesh nodes, one scene; no avatar, animations, cameras or lights. |
| [author_reception.py](../../scripts/blender/author_reception.py) | Reproducible authoring recipe, output guards, export validation and camera framing. |

Open the source in a separate Blender window if another unsaved scene is open. The connected authoring run restored the original active scene and left its file path unchanged; the original `character.glb` was not edited.

Local review images are in `odd/artifacts/reception/desktop.png`, `mobile.png` and `grayscale.png`. They are deliberately untracked. The mobile image is a whole-room overview, not proof that the eventual gameplay camera is usable on a phone.

## Composition and proposed scale

The room combines a beveled tiled plinth, two cutaway walls, a framed open portal, an L-shaped counter with bell and stationery, cushioned waiting seat, noticeboard, window/display shelves, broad-leaf planter and pendant accents. Cream, warm wood and coral are a reception proposal from art direction, not a newly finalized product-wide palette.

| Measurement | Proposed value |
|---|---|
| Module M | 4/3 Blender units; one unit is one meter in the source scene. |
| Avatar reference | 2 units tall, existing imported Idle pose; feet on the floor. |
| Portal | 2 units clear width, approximately 2.92 units clear height. |
| Central lane | 2.8 units wide; prop AABBs checked against the proposed lane. |
| Floor footprint | Approximately 10.8 × 9.45 units. |

These are asset layout measurements, not a navigation or physics contract. The export has no collision bodies or interaction implementation. Exact gameplay scale, camera follow, performance and interaction distance remain to be validated.

## Rebuilding safely

The recipe runs in the connected Blender UI in Object mode. Use a fresh authoring session with no `ITReception_` data and with all five output paths absent. It refuses existing outputs or an occupied namespace rather than deleting user data. Do not remove or overwrite an existing study merely to rerun the command; preserve it and decide on a separate revision first.

From Blender's Python console, substitute your actual checkout path:

```python
from pathlib import Path
import runpy
project_root = Path(r"C:\path\to\integratec-final-front")
recipe = runpy.run_path(str(project_root / "scripts/blender/author_reception.py"))
evidence = recipe["build"](project_root)
print(evidence)
```

The recipe imports the existing avatar only for reference renders. Its approved Git blob hash is `fa08fdeacfef59a2c53a2c32cd7f58dfed56cbe3`. Blender's generated bone-display `Icosphere` is hidden and excluded from reference scale calculations; it is not part of the avatar design. The source contains no autorun script handlers added by this recipe. Rendering and export use only the isolated authoring scene; no factory reset, user-preference change or original-scene deletion is performed.

## Observed checks and limitations

- The first real export failed its scope check: Blender selected-object export included the original scene's `Cube`. The corrected export explicitly restricts the active scene and contains only the 144 authored mesh nodes.
- Initial renders exposed an importer helper covering the avatar and cropped portrait framing. After correction, desktop, portrait and grayscale renders were inspected: the actual avatar is visible, the complete room fits, and the main furniture remains distinguishable in grayscale.
- The reference uses the seven source avatar meshes, is 2 units tall and has minimum Z = 0. The original GLB hash remained unchanged.
- Syntax and actual Blender execution are checked separately. Aesthetic composition has no meaningful automated RED/GREEN; runtime export guards did expose the scope defect before correction. Do not represent these renders as automated art approval.
- The corrected scene was finalized from the preserved partial run. A fresh end-to-end invocation of the corrected recipe has not been observed; the overwrite guard intentionally prevents rebuilding over these outputs.
- Web material parity, gameplay-scale mobile readability, collision behavior and performance remain unverified. The web bootstrap still lacks its independent verification; this asset does not close that task.
