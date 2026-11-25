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
