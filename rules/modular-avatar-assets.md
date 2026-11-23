# Modular Avatar 3D Assets

Define how modular 3D character bases, wearables, skeletons, expressions, animations, and materials are authored in Blender and exported as GLB files so parts combine cleanly without clipping, floating, or rig mismatches.

## Authority and scope

- Visual proportions, silhouette language, `:)` facial rules, HEX palette, roughness ranges, lighting, and IP rules live in [Art direction](./art-direction.md) and are not restated here.
- Product behavior, persistence, authorization, visibility, and fallback rules live in [Avatars and customization](./avatars-and-customization.md).
- World units, React Three Fiber scene rules, and FD8 budgets (`<= 1 MB` per avatar GLB, `<= 100` draw calls, `<= 200k` triangles, `<= 256 MB` GPU) live in [3D world and camera](./3d-world-and-camera.md).
- Runtime loader, composition code, and compression commands live in [3D assets](../docs/3d-assets.md).
- Planned asset coverage lives in the [asset wishlist](../docs/art/asset-wishlist.md); that checklist is planned art scope, not a backend API or catalog contract.

This document governs **technical 3D authoring and export compatibility** for modular characters and wearables. It does not define classroom props, the classroom pet, the tutor bot, or backend catalog schemas.

- **MUST (Incremental delivery):** Treat this rule as a compatibility contract applied **incrementally to each asset or slice when it is authored**, not as a requirement to deliver every body, animation clip, facial expression, or wearable slot at once. Contributors and AI agents **MUST** build only the requested slice per pull request and tick completed items in the [asset wishlist](../docs/art/asset-wishlist.md) as they merge.

## Coordinate system, scale, and rest pose

- **MUST:** Author and export every character base and wearable in `1 unit = 1 meter`, `+Y` up in glTF (Blender `+Z` up exported with glTF `+Y` up), facing `+Z` in glTF (`-Y` in Blender), with soles/feet grounded at `Y = 0` and the root armature/object origin at `(0, 0, 0)`. This matches the committed `male/body.glb` and `female/body.glb` baseline (`1.283 m` total height, eyes/mouth at `+Z`, root `rig` at identity transform).
- **MUST:** Apply all transforms (`location (0,0,0)`, `rotation (0,0,0)`, `scale (1,1,1)`) on every exported mesh and armature before exporting. Unapplied transforms corrupt `inverseBindMatrices` and cause scaled, rotated, or offset wearables.
- **MUST:** Keep every body base and wearable within the canonical rig in the **exact same T-pose rest pose** used by the canonical base rig (`male/body.glb` / `female/body.glb`).
- **MUST NOT:** Change the rest pose (for example switching from T-pose to A-pose) on an individual wearable or single body base without updating the canonical base rig and retargeting all animations together, because mismatched rest poses break `inverseBindMatrices` and cause rigid or twisted sleeves. If the team later approves a new v2 rig family from scratch, a neutral A-pose **MAY** be chosen for that entire family.

## Single canonical skeleton and binding

Different body anatomies (male vs. female torso, bust, hips, and face) belong to **mesh geometry**, not to incompatible skeletons.

### Canonical 34-bone skeleton

- **MUST:** All compatible character bases (male and female student bodies, and teacher bodies sharing the animation library) **MUST** use the male base's canonical 34-joint skeleton (`rig`), including `neutral_bone`, with identical joint names and parent hierarchy and matching rest transforms within floating-point export tolerance, not bitwise identity. The legacy female GLB has 41 joints: the shared 34-joint core plus 7 secondary joints; migration remains pending (see below).

| Region | Canonical bones (`rig`) | Primary use and rigid accessory anchor |
|---|---|---|
| Pelvis and hips | `DEF-spine`, `DEF-pelvis.L`, `DEF-pelvis.R` | Hips and glutes (female hip/glute silhouette weights here) |
| Torso and chest | `DEF-spine.001`, `DEF-spine.002`, `DEF-spine.003` | Waist, female bust silhouette (`DEF-spine.002`), upper back/backpacks/capes (`DEF-spine.003`) |
| Neck | `DEF-spine.004`, `DEF-spine.005` | Neck, scarves, necklaces, bow ties (`DEF-spine.004`) |
| Head | `DEF-spine.006` | Head, face, hairstyles, caps, helmets, headphones, glasses, masks, earrings |
| Arms and hands | `DEF-shoulder.L` / `DEF-shoulder.R`, `DEF-upper_arm.L` / `DEF-upper_arm.R`, `DEF-upper_arm.L.001` / `DEF-upper_arm.R.001`, `DEF-forearm.L` / `DEF-forearm.R`, `DEF-forearm.L.001` / `DEF-forearm.R.001`, `DEF-hand.L` / `DEF-hand.R` | Sleeves and hands; rigid hand items bind to `DEF-hand.R` or `DEF-hand.L` |
| Legs and feet | `DEF-thigh.L` / `DEF-thigh.R`, `DEF-thigh.L.001` / `DEF-thigh.R.001`, `DEF-shin.L` / `DEF-shin.R`, `DEF-shin.L.001` / `DEF-shin.R.001`, `DEF-foot.L` / `DEF-foot.R`, `DEF-toe.L` / `DEF-toe.R` | Bottoms, socks, and shoes |
| glTF neutral node | `neutral_bone` | Exporter neutral joint included in the canonical 34 |

- **MUST NOT:** Add body-specific secondary bones (such as `DEF-bust.L/R`, `DEF-glute.L/R`, or `DEF-hair_*`) to the canonical rig. Preserve the full female anatomy (bust, hips/glutes, waist, eyelashes) in the mesh geometry and weight it directly to `DEF-spine.002` / `DEF-spine.003` and `DEF-pelvis.L/R`.
- **MUST:** Preserve the female base's existing silhouette, anatomy, and proportions, including bust, waist, hips, and glutes. Never flatten, shrink, or reshape the body to reuse a garment; fit the clothing to the unchanged body instead.
- **Rationale:** A shared rig enables animation and binding reuse without missing-joint rejection; it does not guarantee garment fit across anatomies. Any future decision to introduce optional secondary bones requires updating this rule and every base body together.

### Skinning, rigid accessories, and reuse

- **MUST:** Limit every skinned mesh to at most **4 bone influences per vertex**, with normalized weights summing to `1.0` and zero unweighted vertices.
- **MUST NOT:** Export rigid accessories (glasses, caps, helmets, headphones, earrings, backpacks, guitars, hand items) as unskinned static meshes parented to the scene root. In the current runtime composer, root-parented static meshes remain frozen at the origin while the body animates.
- **MUST:** Until explicit bone-socket attachment is added to the runtime composer, export every rigid accessory as a `SkinnedMesh` weighted `100%` to its target canonical bone from the table above, using the exact same armature and rest pose.
- **MUST (Reuse first):** Start from the existing editable master garment when one exists; do not rebuild the same asset from scratch for each base body. Derive fitted variants only where needed, retaining the shared canonical rig, materials, and design. This reduces duplicate authoring and AI token expenditure without promising a quantified reuse percentage.
- **MUST:** Export an identical wearable once under `shared/` only after verifying its fit on both bodies. Otherwise derive the required `male/` and `female/` fitted exports from the master, including for accessories or footwear when necessary; a shared rig alone does not prove fit.
- **MUST:** Adapt garment volume around bust and hips, align shoulders, seams, sleeves, and cuffs to each body, and maintain skin clearance throughout available animations without changing the base anatomy.

## Split base body and region hiding

To support interchangeable tops, bottoms, and footwear without skin poking through clothing, new or refactored base bodies must provide a complete bare anatomy divided into semantic regions rather than baked-in pants or boots.

- **MUST:** Split every new or refactored `body.glb` into separate named sub-mesh objects using clean English semantic names:

| Sub-mesh name | Region covered | Hidden when covered by |
|---|---|---|
| `Body_Head` | Cranium, face shell, ears | Full-enclosure helmets only (optional) |
| `Body_Eyes` | Eyes (`:)` dot/oval geometry) | Never hidden (except opaque full-face visor) |
| `Body_Mouth` | Mouth stroke/mesh | Never hidden |
| `Body_Eyelashes` | Optional lashes (for example female base) | Never hidden |
| `Body_Neck` | Neck | High collars or scarves when fully enclosed |
| `Body_Torso` | Chest, abdomen, upper back | Tops only when the entire region is occluded, including neckline and hem |
| `Body_UpperArms` | Shoulders to elbows | Sleeves only when the entire region is occluded; short sleeves usually leave skin visible |
| `Body_Forearms` | Elbows to wrists | Sleeves only when the entire region is occluded, including cuffs |
| `Body_Hands` | Palms / mittens | Never hidden |
| `Body_UpperLegs` | Pelvis and thighs to knees | Bottoms only when the entire region is occluded; shorts and skirt hems usually expose skin |
| `Body_LowerLegs` | Knees to ankles | Bottoms only when the entire region is occluded; preserve skin below cropped hems |
| `Body_Feet` | Ankles and feet | Footwear only when the entire region is occluded; preserve exposed ankles, heels, or toes |

- **MUST:** Hide a region only when clothing completely occludes it throughout the tested poses. Never hide whole arms for short sleeves, whole thighs for shorts/skirts, or whole feet for partial footwear if any skin remains exposed. Keep partially covered regions visible or split them into coverage-safe subregions with clean English names (for example `Body_UpperArms_Proximal`). Preserve complete skin geometry; do not delete skin to solve clipping. Check hems and boundaries for holes during motion.
- **MUST NOT:** Ship meshes with Blender default names (`Cube.003`, `Roundcube`, `Sphere.001`) or non-English names (`cuerpo`, `pantalones`, `ojos`).
- **SHOULD:** Keep clean tucked seam margins at region boundaries (neck, elbow, wrist, waist, knee, ankle) so exposing adjacent bare skin (such as t-shirt + shorts + flip-flops) never reveals hollow gaps during bending animations.
- **SHOULD:** Respect a consistent inner-to-outer clearance order to prevent Z-fighting across stacked wearables:
  1. Base skin (`Body_*`)
  2. Base garments (`top`, `bottom`, `shoes`)
  3. Overlayers and hair (`hair`, `neck`, `back` straps/capes)
  4. Face and head accessories (`face`, `head`)
  5. Hand-held items (`hand`)

## Wearable slot conventions

Wearable slots align with the categories in the [asset wishlist](../docs/art/asset-wishlist.md) and apply whenever an item in that slot is authored. Folder scopes below are defaults subject to the reuse-first fit check: any slot may need fitted variants, and identical exports may be shared only after fit is verified on both bodies.

| Slot | Filename pattern | Folder scope | Attachment | Key constraints |
|---|---|---|---|---|
| `skin` | *(material variant)* | Base `body.glb` | `AvatarSkin` material color | No separate GLB per skin tone. |
| `hair` | `hair-<id>.glb` | `shared/` | Skinned to `DEF-spine.006` (+ `DEF-spine.003` if resting over shoulders) | Tintable via `AvatarHairTint`; must not obscure eyes. |
| `top` | `top-<id>.glb` | `<bodyId>/` | Skinned across torso, shoulders, and arms | Primary color via `AvatarTopTint` when tintable. |
| `bottom` | `bottom-<id>.glb` | `<bodyId>/` | Skinned across pelvis, thighs, and shins | Primary color via `AvatarBottomTint` when tintable. |
| `shoes` | `shoes-<id>.glb` | `shared/` *(or `<bodyId>/` only if shape differs)* | Skinned to shins, feet, and toes | Hide only fully occluded foot subregions; preserve visible skin with partial footwear. |
| `head` | `head-<id>.glb` | `shared/` | 100% rigid-skinned to `DEF-spine.006` | Readable from elevated 40°/45° camera; must not cover eyes. |
| `face` | `face-<id>.glb` | `shared/` | 100% rigid-skinned to `DEF-spine.006` | Clean forward clearance from face plane; zero Z-fighting. |
| `back` | `back-<id>.glb` | `shared/` | 100% rigid-skinned to `DEF-spine.003` (or skinned for capes) | Straps must clear both male and female chest silhouettes. |
| `hand` | `hand-<id>.glb` | `shared/` | 100% rigid-skinned to `DEF-hand.R` or `DEF-hand.L` | Oriented to natural hand grip in rest pose. |
| `neck` | `neck-<id>.glb` | `shared/` | Earrings rigid to `DEF-spine.006`; bow tie rigid to `DEF-spine.004`; scarves/necklaces skinned across neck and chest | Clear standard shirt and smock collars without clipping. |

- **MUST:** Use lowercase English `kebab-case` IDs (for example `top-school-smock.glb`, `bottom-bermuda-shorts.glb`, `face-round-glasses.glb`, `hand-pencil.glb`).
- **MUST:** Store editable `.blend` sources under `assets/blender/avatars/` (canonical base rig and bodies under `assets/blender/avatars/base/`, wearables under `assets/blender/avatars/<shared|male|female>/<slot>/`) and runtime `.glb` exports under `public/models/avatars/`.

## Animations and facial expressions

- **MUST:** Export animation clips **only** in the canonical `body.glb` (or a dedicated shared animation library if adopted later). Wearable `.glb` files **MUST** contain zero animation tracks.
- **MUST:** Whenever an animation from the [asset wishlist](../docs/art/asset-wishlist.md) is authored, use these canonical English `PascalCase` clip names:
  - Movement and posture: `Idle`, `Walk`, `Run`, `Sit`, `SitWrite`
  - Shared gestures and reactions: `RaiseHand`, `Wave`, `Cheer`, `Clap`, `Think`, `Nod`, `ShakeHead`, `Sad`, `Dance`
  - Teacher actions: `TeacherExplain`, `TeacherPoint`
- **MUST (Clip migration):** When migrating legacy `Yes`, `No`, and `Celebrate` names to proposed `Nod`, `ShakeHead`, and `Cheer`, explicitly record and verify the intended mappings (`Yes` → `Nod`, `No` → `ShakeHead`, `Celebrate` → `Cheer`) and update callers in the same migration. These are naming candidates, not proof that the animation contents are equivalent; inspect and adapt each clip before adopting its new name. Until then, preserve existing caller/clip compatibility.
- **SHOULD:** Author facial expressions incrementally as named shape keys (morph targets) on the facial feature meshes (`Body_Eyes`, `Body_Mouth`, `Body_Eyelashes`) using canonical English names: `Blink`, `Happy`, `Surprised`, `Thoughtful`, `Sad`, `Wink`, `Focused`.
- **MUST:** Preserve the simplified `:)` facial language in [Art direction](./art-direction.md), avoid complex facial bone rigs, and ensure no morph target sinks behind `Body_Head`.

## Materials, tinting, and budgets

- **MUST:** Use clean English semantic material names without `.001` suffixes:
  - `AvatarSkin` — all bare skin sub-meshes (`Body_*`).
  - `AvatarHairTint` — tintable primary hair material.
  - `AvatarTopTint`, `AvatarBottomTint`, `AvatarShoesTint`, `AvatarAccessoryTint` — runtime-tintable primary wearable materials.
  - `AvatarDetail`, `AvatarFaceLine`, `AvatarEye` — non-tinted fixed details (buttons, soles, `#382F3F` facial strokes).
- **MUST:** Set tintable materials to a neutral white/very light base albedo (`#FFFFFF`) so runtime color overrides reproduce palette HEX values accurately (per [3D assets](../docs/3d-assets.md)).
- **MUST:** Follow the matte/softly satin roughness ranges and near-zero `metalness` in [Art direction](./art-direction.md), and verify sRGB albedo values in Three.js so models do not render near-black.
- **MUST:** Keep every exported `.glb` within the FD8 budget (`<= 1 MB` per avatar GLB, verified with `pnpm assets:check`) with zero unapproved exceptions. Keep stylized low-poly geometry lean (avoid 10k+ vertex footwear or trousers like legacy baseline meshes) and apply the compression pipeline in [3D assets](../docs/3d-assets.md) before committing.

## Blender and Blender MCP authoring guardrails

When authoring or iterating on modular character assets in Blender (manually or via the Blender MCP):

- **MUST:** Organize master `.blend` files into clean collections (`00_Armature`, `01_BodyBase_Male`, `01_BodyBase_Female`, `02_Wearable_<slot>_<id>`, `99_PreviewCameraLights`) and lock the base reference body collections as non-selectable while modeling wearables so base geometry is never accidentally altered or joined.
- **MUST:** Exclude or remove the bone-display `Icosphere` generated by Blender's glTF importer before computing bounds, rendering previews, or exporting.
- **MUST:** Export wearables with strict isolation (`use_selection=True` and `use_active_scene=True`), selecting only the armature and the target wearable mesh(es), with `export_animations=False` and zero lights, cameras, or base-body meshes included.
- **MUST:** Keep offline Blender scripts, temporary preview renders, and inspection JSON reports inside untracked `odd/` only. Never commit `odd/` files or temporary PNG/JSON artifacts under `assets/blender/` or `public/models/`.
- **SHOULD:** Follow a silhouette-first visual iteration loop when working with an AI agent:
  1. Block out the primary volume and silhouette first; add medium details only after the silhouette reads cleanly.
  2. Render a quick check from the elevated isometric angle (40° elevation, 45° azimuth) plus a grayscale view into `odd/previews/` before refining.
  3. Pose-test the asset on the target body across the extreme clips currently present in the base rig (at minimum `Idle`, `Walk`, `Sit`, and `RaiseHand` once available) — testing `shared/` items on **both** `male` and `female` bodies — and reject any rigid T-pose sleeves, skin clipping, or floating rigid accessories.
  4. Inspect the exported `.glb` metadata (mesh names, exact 34-bone joint list, material names, 0 animations on wearables, morph targets, and compressed byte size `<= 1 MB`) before committing.

## Acceptance checklist

Check every item that applies to the assets included in the pull request:

- [ ] Transforms applied (`scale 1`, `rotation 0`), feet grounded at `Y = 0`, facing `+Z` in glTF, origin at `(0,0,0)`.
- [ ] Uses the single canonical 34-bone skeleton and exact T-pose rest pose (no body-specific extra bones).
- [ ] Rigid accessories are `100%` weighted to their target canonical bone (never root-parented static meshes).
- [ ] Every skinned vertex has `<= 4` normalized weights and deforms cleanly across the available extreme poses (`Idle`, `Walk`, `Sit`, and `RaiseHand` when present).
- [ ] Existing editable master reused; only necessary fitted variants derived, retaining rig, materials, and design.
- [ ] Female base silhouette, anatomy, and proportions unchanged in rest and tested poses, including after any weight migration.
- [ ] Shoulder/seam alignment, sleeves, cuffs, bust/hip clearance, and footwear fit verified across available poses; no clipping or holes at exposed skin, sleeves, or hems.
- [ ] Only fully occluded body regions hidden; visible skin retained and complete skin geometry preserved.
- [ ] `shared/` items visually verified on **both** `male` and `female` bodies.
- [ ] New or refactored base bodies split into semantic English `Body_*` sub-meshes (no `Cube.003` or Spanish names).
- [ ] Wearable `.glb` contains zero animation clips, zero lights/cameras, zero reference-body meshes, and no importer `Icosphere`.
- [ ] Material names match the semantic contract (`AvatarSkin`, `Avatar*Tint`, `AvatarDetail`) and render matte with accurate sRGB color.
- [ ] Silhouette and accessories read clearly at isometric gameplay scale and in grayscale.
- [ ] Compressed `.glb` passes `pnpm assets:check` (`<= 1 MB`) with no unapproved exceptions; `.blend` saved under `assets/blender/avatars/` and temporary artifacts kept in `odd/`.

## Boundaries and migration notes

- **Product and API contracts remain separate:** Adding a `.glb` under `public/models/avatars/` does not modify backend validation, `AvatarDto`, or shop/inventory contracts; those require explicit coordination under [Avatars and customization](./avatars-and-customization.md) and [API contracts](./api-contracts.md).
- **Current runtime versus authoring contract:** The current composer supports hair/top composition and their two tint channels (`AvatarHairTint`, `AvatarTopTint`), with no `Body_*` region hiding. It does not yet provide a shared-folder resolver or all-slot tint support. The folder, expanded slot/material, and coverage conventions above are authoring targets, not delivered runtime features. A future runtime slice must explicitly resolve shared versus fitted assets, apply item-specific coverage-safe hiding, and support the corresponding slot/tint channels before those capabilities can be claimed; this documentation change implements none of them.
- **Pending female rig migration:** Before deleting any of the 7 secondary joints from the legacy 41-joint female rig, reassign their vertex influences to appropriate canonical joints and normalize weights (at most 4 per vertex, none unweighted). Compare rest and animated appearance against the original female base, preserving anatomy and silhouette, then remove secondary joints and re-export/retest bindings and available extreme poses. Do not treat bone deletion alone as a migration or claim that this migration is complete.
- **Legacy baseline assets:** The existing `public/models/avatars/{male,female}/body.glb` files (`34`/`41` Rigify joints, baked `Pants` and `boots`, over-budget exceptions tracked in `#91`, documented in [student uniforms](../docs/art/student-uniforms.md)) predate this rule. New or refactored base bodies and wearables **MUST** follow this rule and retire those `#91` exceptions as legacy files are replaced.
