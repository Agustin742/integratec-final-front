import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
