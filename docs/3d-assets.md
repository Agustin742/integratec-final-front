# 3D Asset Pipeline & Budget (FD8)

This guide defines how GLB/glTF assets are compressed, loaded, cached, disposed, and checked against the FD8 performance budget (`rules/3d-world-and-camera.md`).

## Runtime Loader & Same-Origin Decoders

- **Loaders**: `createConfiguredGltfLoader()` in `src/features/world/asset-cache.ts` configures `GLTFLoader` with:
  - `DRACOLoader` reading from `/decoders/draco/` (`public/decoders/draco/`).
  - `KTX2Loader` reading from `/decoders/basis/` (`public/decoders/basis/`).
  - `MeshoptDecoder` bundled from `three/examples/jsm/libs/meshopt_decoder.module.js`.
- **CSP compatibility**: `src/config/security-headers.ts` allows `'wasm-unsafe-eval'` in `script-src` and `blob:` in `worker-src` so same-origin Draco and KTX2 WebAssembly decoders run without enabling JavaScript `eval()`.
- **Caching & isolation**: `loadGlbAsset()` / `readCachedGlbAsset()` deduplicate fetches and parses per URL. `<GlbAsset />` (`src/features/world/glb-asset.tsx`) wraps each asset in its own `Suspense` and error boundary so a failing GLB renders a placeholder without breaking the rest of the scene.
- **Disposal**: `disposeObject3D()` and `clearAssetCache()` release geometries, materials, textures, and skeletons when `WorldCanvas` unmounts, when `scopeKey` (classroom) changes, or when `ClassroomWorkspace` runs its `SessionController` logout cleanup (which also disposes shared Draco/KTX2 decoders). Individual `WebGLRenderTarget` instances are disposed via `disposeObject3D(renderTarget)`.

## Authoring & Compression Pipeline

All production `.glb` assets under `public/models/` should be compressed before committing:

```bash
# Geometry compression (Draco or meshopt) + KTX2/BasisU texture compression
npx @gltf-transform/cli optimize input.glb output.glb \
  --compress draco \
  --texture-compress ktx2
```

For manual texture-only compression with Khronos KTX-Software (`toktx`):

```bash
toktx --t2 --uastc 2 --zcmp 18 output.ktx2 input.png
```

Target conventions (`rules/3d-world-and-camera.md`):

- World units: `1 unit = 1 meter`, `Y` up, ground plane at `Y = 0`.
- Keep draw calls `<= 100`, triangles `<= 200k`, and GPU memory `<= 256 MB` (runtime measurement deferred to F17).

## Budget Check (`pnpm assets:check`)

`pnpm assets:check` runs `scripts/assets/check-asset-budget.mjs` against `public/models/` and is wired into `.github/workflows/ci.yml`:

| Category             | Limit (FD8)                   | Scope                                                                                               |
| -------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| Avatar GLB           | `<= 1 MB` (`1,048,576` bytes) | Individual avatar/character `.glb` files (excluding scene files)                                    |
| Full classroom scene | `<= 8 MB` (`8,388,608` bytes) | Scene `.glb` files (`scenes/` path or `classroom*` / `scene*` filename prefix) and total scene size |

The script prints a per-file report and exits with code `1` if any file exceeds its limit.

## Recording a Budget Exception

Per `rules/documentation-and-decisions.md` and `rules/3d-world-and-camera.md`, any asset that must temporarily or permanently exceed the FD8 table requires a recorded exception before merging:

1. **Scope**: exact file path(s) and measured size vs. budget.
2. **Reason**: why compression/simplification cannot meet the limit without breaking functionality or readability.
3. **Approving team decision**: PR/issue link with explicit team sign-off.
4. **Review condition**: milestone or condition under which the exception will be re-evaluated or removed.

### Recorded Exceptions

| Asset path                              | Size vs. FD8 budget                 | Reason                                                     | Approving team decision                                                                | Review condition                                                                                      |
| --------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `public/models/avatars/female/body.glb` | `3.63 MB` (`3,804,416` B) vs `1 MB` | Pre-existing uncompressed avatar GLB predating issue `#25` | Issue `#25` / PR `#90` (exact byte ceiling in `scripts/assets/check-asset-budget.mjs`) | Issue `#91` — compress below `1 MB` and remove this entry and `BUDGET_EXCEPTIONS` entry once resolved |
| `public/models/avatars/male/body.glb`   | `2.61 MB` (`2,740,644` B) vs `1 MB` | Pre-existing uncompressed avatar GLB predating issue `#25` | Issue `#25` / PR `#90` (exact byte ceiling in `scripts/assets/check-asset-budget.mjs`) | Issue `#91` — compress below `1 MB` and remove this entry and `BUDGET_EXCEPTIONS` entry once resolved |
| `public/models/character.glb`           | `2.58 MB` (`2,707,884` B) vs `1 MB` | Pre-existing uncompressed avatar GLB predating issue `#25` | Issue `#25` / PR `#90` (exact byte ceiling in `scripts/assets/check-asset-budget.mjs`) | Issue `#91` — compress below `1 MB` and remove this entry and `BUDGET_EXCEPTIONS` entry once resolved |
