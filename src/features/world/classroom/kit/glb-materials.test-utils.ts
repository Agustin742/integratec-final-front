import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  materialAppearanceKey,
  type MaterialAppearance,
} from './kit-material-key';

/**
 * Test helper: distinct material names referenced by the primitives of a
 * public GLB, read from its JSON chunk. Each distinct name is one batched
 * draw call once the kit is merged by material.
 */
export function glbMaterialNames(url: string): string[] {
  const buffer = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
    materials?: { name?: string }[];
    meshes: { primitives: { material?: number }[] }[];
  };
  const names = new Set<string>();
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      const material = json.materials?.[primitive.material ?? -1];
      names.add(material?.name ?? `#${String(primitive.material)}`);
    }
  }
  return [...names];
}

interface SkinnedGltfJson {
  materials?: Record<string, unknown>[];
  meshes: {
    primitives: {
      material?: number;
      attributes: Record<string, number>;
      targets?: unknown[];
    }[];
  }[];
}

function readGlbJson(url: string): SkinnedGltfJson {
  const buffer = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(
    buffer.toString('utf8', 20, 20 + jsonLength),
  ) as SkinnedGltfJson;
}

function materialHasTexture(material: Record<string, unknown> | undefined) {
  return JSON.stringify(material ?? {}).includes('"index"');
}

/**
 * Test helper: draw calls of a skinned NPC GLB before and after
 * `mergeSkinnedByMaterial`, read from its JSON chunk. Primitives with morph
 * targets stay one draw call each; the rest collapse per material and
 * attribute set (uv ignored when the material has no texture).
 */
export function glbSkinnedDrawCalls(url: string): {
  before: number;
  after: number;
} {
  const json = readGlbJson(url);
  let before = 0;
  let morph = 0;
  const merged = new Set<string>();
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      before += 1;
      if (primitive.targets?.length) {
        morph += 1;
        continue;
      }
      const material = json.materials?.[primitive.material ?? -1];
      const textured = materialHasTexture(material);
      const attributes = Object.keys(primitive.attributes)
        .filter((name) => textured || !name.startsWith('TEXCOORD'))
        .sort()
        .join(',');
      merged.add(`${String(primitive.material)}|${attributes}`);
    }
  }
  return { before, after: merged.size + morph };
}

/**
 * Test helper: draw calls of the kit once batched by material, following the
 * runtime rule of `buildBatchedKit` primitive by primitive. Named standard
 * materials without textures share a bucket by appearance
 * (`materialAppearanceKey`); other named materials share by type and name;
 * unnamed ones are never shared. Reads the JSON chunk of a public GLB.
 */
export function glbMaterialKeys(url: string): string[] {
  const json = readGlbJson(url);
  const keys = new Set<string>();
  json.meshes.forEach((mesh, meshIndex) => {
    for (const primitive of mesh.primitives) {
      const material = json.materials?.[primitive.material ?? -1] as
        GltfMaterial | undefined;
      if (!material?.name) {
        keys.add(
          `#${url}:${String(meshIndex)}:${String(primitive.material ?? 'none')}`,
        );
        continue;
      }
      const type = gltfMaterialType(material);
      const comparable =
        type === 'MeshStandardMaterial' &&
        !materialHasTexture(material as Record<string, unknown>);
      keys.add(
        comparable
          ? `${type}|${materialAppearanceKey(gltfAppearance(material, primitive))}`
          : `${type}:${material.name}`,
      );
    }
  });
  return [...keys];
}

interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    roughnessFactor?: number;
    metallicFactor?: number;
  };
  emissiveFactor?: number[];
  alphaMode?: string;
  alphaCutoff?: number;
  doubleSided?: boolean;
  extensions?: Record<string, unknown>;
}

/** The three.js material class `GLTFLoader` builds for a glTF material. */
function gltfMaterialType(material: GltfMaterial): string {
  const extensions = Object.keys(material.extensions ?? {});
  if (extensions.includes('KHR_materials_unlit')) return 'MeshBasicMaterial';
  const physical = extensions.some(
    (name) =>
      name.startsWith('KHR_materials_') &&
      name !== 'KHR_materials_emissive_strength',
  );
  return physical ? 'MeshPhysicalMaterial' : 'MeshStandardMaterial';
}

function gltfAppearance(
  material: GltfMaterial,
  primitive: { attributes: Record<string, number> },
): MaterialAppearance {
  const pbr = material.pbrMetallicRoughness ?? {};
  const [r = 1, g = 1, b = 1, a = 1] = pbr.baseColorFactor ?? [];
  const [er = 0, eg = 0, eb = 0] = material.emissiveFactor ?? [];
  return {
    color: [r, g, b],
    roughness: pbr.roughnessFactor ?? 1,
    metalness: pbr.metallicFactor ?? 1,
    emissive: [er, eg, eb],
    opacity: a,
    transparent: material.alphaMode === 'BLEND',
    doubleSided: material.doubleSided === true,
    vertexColors: primitive.attributes.COLOR_0 !== undefined,
    alphaTest:
      material.alphaMode === 'MASK' ? (material.alphaCutoff ?? 0.5) : 0,
    flatShading: primitive.attributes.NORMAL === undefined,
  };
}

/** Test helper: axis-aligned bounds of a public GLB's POSITION accessors. */
export function glbBounds(url: string): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const buffer = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
    accessors: { min: number[]; max: number[] }[];
    meshes: { primitives: { attributes: Record<string, number> }[] }[];
  };
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes) {
    for (const primitive of mesh.primitives) {
      const accessor = json.accessors[primitive.attributes.POSITION ?? -1];
      if (!accessor) continue;
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i]!, accessor.min[i]!);
        max[i] = Math.max(max[i]!, accessor.max[i]!);
      }
    }
  }
  return { min, max };
}
