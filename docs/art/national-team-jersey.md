# National team jersey — modular asset candidate

**Approved by human visual review and committed locally on `feat/91-modular-avatar-assets` (not yet pushed, merged, or integrated into the runtime catalog).** Both production GLBs and the editable master reuse the short-sleeve T-shirt shell (`760` vertices) on the unchanged existing male and female bodies, adding a tailored athletic hem (`Hem`), contrasting short-sleeve cuffs (`SleeveCuff_L`, `SleeveCuff_R`), a sporty V-neck collar (`VCollar`), 3 vertical front and 3 vertical rear team stripes (`Stripes`), an original left-chest shield crest (`Crest`), and stylized rear block numerals `"10"` (`BackNumber`). Wishlist remains unchecked until merge.

## Files and previews

- [Editable master](../../assets/blender/avatars/shared/top/national-team-jersey.blend): `NationalTeamJersey_Master_Male` and `NationalTeamJersey_Master_Female` scenes (`8` semantic garment meshes + canonical 34-bone `rig` each).
- [Male export](../../public/models/avatars/male/top-national-team-jersey.glb): `60,964` bytes.
- [Female export](../../public/models/avatars/female/top-national-team-jersey.glb): `60,528` bytes.
- [Standalone structural test](../../scripts/assets/test-national-team-jersey.mjs).
- Ignored animated viewer: `odd/previews/seasonal-tops-review.blend`, scenes `REVIEW_NationalTeamJersey_Female` and `REVIEW_NationalTeamJersey_Male` (scrub Idle `1–49`, Walk `50–74`, Sit `75–171`, Wave `172–231`).

| Variant | 1280px Blender render |
| --- | --- |
| Male | [Preview](../assets/national-team-jersey/male-1280.png) |
| Female | [Preview](../assets/national-team-jersey/female-1280.png) |

## Design and reuse

- Reuses the canonical `760`-vertex short-sleeve torso shell from `REVIEW_BasicTShirt_{Male,Female}` without modifying existing `male/body.glb`, `female/body.glb`, legacy `pants`/`boots`, or any previously exported top.
- `AvatarTopTint` is neutral white (`#FFFFFF`, roughness `0.85`, metallic `0.0`) on `NationalTeamJersey_{Male,Female}_{Shell,Hem,BackNumber}` so runtime tinting reproduces palette colors accurately (previewed in sky blue `#75B7DA`) while keeping rear numerals readable against the center cream stripe.
- `AvatarDetail` (`#FFF9EB` pale cream, roughness `0.85`, metallic `0.0`) covers `VCollar`, `SleeveCuff_L`/`SleeveCuff_R`, `Stripes`, and the original beveled `Crest` shield (no real-world brand or federation insignia).
- Surface-projected/sampled details (`Hem`, `SleeveCuff_{L,R}`, `Stripes`, `Crest`, `BackNumber`) receive barycentric skin weights (`<= 3` canonical bones, normalized to `1.0`) from the shell; `VCollar` binds `100%` to `DEF-spine.003`.

## Verification

| Check | Observed result |
| --- | --- |
| Authoring clearance (`1, 25, 62, 123, 201`) | `0` torso/upper-arm poke and `0` `VCollar`-head collisions against `Reference_Head` across both genders (`odd/artifacts/seasonal-tops-author-report.json`) |
| Decoded GLB roundtrip (Blender MCP) | `Male` (`60,964 B`, `4,868` verts across `8` meshes, max `3` influences, max sum error `5.36e-7`) and `Female` (`60,528 B`, `4,906` verts across `8` meshes, max `3` influences, max sum error `5.14e-7`); canonical `34`-bone rest matrices within `1e-4`; `0` exposed torso verts on frames `1, 62, 123, 201` (`odd/artifacts/seasonal-tops-export.json`) |
| Structural & budget (`test-national-team-jersey.mjs`, `check-asset-budget.mjs`) | Canonical 34-bone hierarchy/rest transforms, isolated skinned Draco meshes (`20`-bit generic quantization), zero animations/cameras/lights, neutral `AvatarTopTint`, and `<= 1 MB` budget |

Rules: [modular assets](../../rules/modular-avatar-assets.md), [art direction](../../rules/art-direction.md).
