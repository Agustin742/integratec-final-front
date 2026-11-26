import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  type Material,
  type Object3D,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { describe, expect, it } from 'vitest';
import { mergeSkinnedByMaterial } from './merge-skinned-by-material';

function geometry(
  vertices: number,
  options: { uv?: boolean; morph?: boolean } = {},
): BufferGeometry {
  const geo = new BufferGeometry();
  const position = new Float32Array(vertices * 3);
  for (let i = 0; i < position.length; i += 1) position[i] = i * 0.01;
  geo.setAttribute('position', new BufferAttribute(position, 3));
  geo.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array(vertices * 3).fill(1), 3),
  );
  if (options.uv) {
    geo.setAttribute(
      'uv',
      new BufferAttribute(new Float32Array(vertices * 2), 2),
    );
  }
  const joints = new Uint16Array(vertices * 4);
  const weights = new Float32Array(vertices * 4);
  for (let v = 0; v < vertices; v += 1) {
    joints[v * 4] = v % 2;
    weights[v * 4] = 1;
  }
  geo.setAttribute('skinIndex', new BufferAttribute(joints, 4));
  geo.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  const index: number[] = [];
  for (let v = 0; v + 2 < vertices; v += 1) index.push(v, v + 1, v + 2);
  geo.setIndex(index);
  if (options.morph) {
    geo.morphAttributes.position = [
      new BufferAttribute(new Float32Array(vertices * 3), 3),
    ];
  }
  return geo;
}

interface PartSpec {
  readonly name: string;
  readonly material: Material;
  readonly vertices?: number;
  readonly uv?: boolean;
  readonly morph?: string;
}

/** A source-like scene: every mesh gets its own skeleton once cloned, like the loader's. */
function buildModel(parts: readonly PartSpec[]): Group {
  const root = new Group();
  const hips = new Bone();
  hips.name = 'Hips';
  const spine = new Bone();
  spine.name = 'Spine';
  spine.position.y = 1;
  hips.add(spine);
  root.add(hips);
  root.updateMatrixWorld(true);
  for (const part of parts) {
    const holder = new Group();
    holder.name = `${part.name}-node`;
    const mesh = new SkinnedMesh(
      geometry(part.vertices ?? 4, {
        uv: part.uv === true,
        morph: part.morph !== undefined,
      }),
      part.material,
    );
    mesh.name = part.name;
    if (part.morph) {
      mesh.morphTargetDictionary = { [part.morph]: 0 };
      mesh.morphTargetInfluences = [0];
    }
    holder.add(mesh);
    root.add(holder);
    mesh.bind(new Skeleton([hips, spine]), mesh.matrixWorld);
  }
  return root;
}

function skinned(root: Object3D): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  root.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) found.push(node as SkinnedMesh);
  });
  return found;
}

const shell = new MeshStandardMaterial({ name: 'Shell' });
const accent = new MeshStandardMaterial({ name: 'Accent' });
const glow = new MeshStandardMaterial({ name: 'Glow' });

describe('mergeSkinnedByMaterial', () => {
  it('merges the skinned primitives that share a material into one mesh', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Head', material: shell },
        { name: 'Torso', material: shell },
        { name: 'Arms', material: accent },
        { name: 'Hands', material: shell },
      ]),
    );

    const created = mergeSkinnedByMaterial(model);

    const meshes = skinned(model);
    expect(meshes).toHaveLength(2);
    expect(created).toHaveLength(1);
    const merged = meshes.find((mesh) => mesh.material === shell)!;
    expect(merged.geometry.getAttribute('position').count).toBe(12);
    expect(merged.geometry.getIndex()!.count).toBe(3 * 2 * 3);
    expect(merged.geometry.getAttribute('skinIndex').count).toBe(12);
    expect(merged.geometry.getAttribute('skinWeight').count).toBe(12);
  });

  it('keeps the skeleton binding: same bones, same bind matrix', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Head', material: shell },
        { name: 'Torso', material: shell },
      ]),
    );
    const [first] = skinned(model);
    const bones = first!.skeleton.bones;
    const bindMatrix = first!.bindMatrix.clone();

    mergeSkinnedByMaterial(model);

    const [merged] = skinned(model);
    expect(skinned(model)).toHaveLength(1);
    expect(merged!.skeleton.bones).toHaveLength(2);
    expect(merged!.skeleton.bones).toEqual(bones);
    expect(merged!.skeleton.bones[0]!.name).toBe('Hips');
    expect(merged!.bindMatrix.equals(bindMatrix)).toBe(true);
    // Bone names still resolve under the model, so clips keep binding.
    expect(model.getObjectByName('Spine')).toBe(merged!.skeleton.bones[1]);
  });

  it('keeps meshes with morph targets separate so their influences keep working', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Face_Happy', material: glow, morph: 'Blink' },
        { name: 'Face_Talking', material: glow, morph: 'MouthTalk' },
        { name: 'Head', material: glow },
        { name: 'Torso', material: glow },
      ]),
    );

    mergeSkinnedByMaterial(model);

    const meshes = skinned(model);
    expect(meshes).toHaveLength(3);
    for (const name of ['Face_Happy', 'Face_Talking']) {
      const mesh = model.getObjectByName(name) as SkinnedMesh;
      expect(mesh.isSkinnedMesh).toBe(true);
      expect(mesh.morphTargetInfluences).toEqual([0]);
      expect(mesh.geometry.morphAttributes.position).toHaveLength(1);
    }
    expect(meshes.filter((mesh) => !mesh.morphTargetDictionary)).toHaveLength(
      1,
    );
  });

  it('leaves a lone primitive per material untouched', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Head', material: shell },
        { name: 'Arms', material: accent },
      ]),
    );
    const before = skinned(model);

    const created = mergeSkinnedByMaterial(model);

    expect(created).toHaveLength(0);
    expect(skinned(model)).toEqual(before);
  });

  it('merges parts that differ only by an unused uv attribute', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Ears', material: accent, uv: true },
        { name: 'Nose', material: accent },
      ]),
    );

    mergeSkinnedByMaterial(model);

    const [merged] = skinned(model);
    expect(skinned(model)).toHaveLength(1);
    expect(merged!.geometry.getAttribute('position').count).toBe(8);
    expect(merged!.geometry.getAttribute('uv')).toBeUndefined();
  });

  it('keeps parts apart when the material really samples a texture', () => {
    const textured = new MeshStandardMaterial({ name: 'Coat' });
    textured.map = new Texture();
    const model = cloneSkeleton(
      buildModel([
        { name: 'Ears', material: textured, uv: true },
        { name: 'Nose', material: textured },
      ]),
    );

    mergeSkinnedByMaterial(model);

    expect(skinned(model)).toHaveLength(2);
  });

  it('does not merge meshes bound to different bones', () => {
    const model = buildModel([
      { name: 'Head', material: shell },
      { name: 'Torso', material: shell },
    ]);
    const [, second] = skinned(model);
    const other = new Bone();
    second!.bind(new Skeleton([other, other]), second!.matrixWorld);

    mergeSkinnedByMaterial(model);

    expect(skinned(model)).toHaveLength(2);
  });

  it('is idempotent', () => {
    const model = cloneSkeleton(
      buildModel([
        { name: 'Head', material: shell },
        { name: 'Torso', material: shell },
      ]),
    );
    mergeSkinnedByMaterial(model);

    expect(mergeSkinnedByMaterial(model)).toHaveLength(0);
    expect(skinned(model)).toHaveLength(1);
  });

  it('never mutates the cached source geometries', () => {
    const source = buildModel([
      { name: 'Head', material: shell },
      { name: 'Torso', material: shell },
    ]);
    const originals = skinned(source).map((mesh) => mesh.geometry);
    const model = cloneSkeleton(source);

    const [merged] = mergeSkinnedByMaterial(model);

    expect(originals).not.toContain(merged!.geometry);
    expect(
      originals.every((geo) => geo.getAttribute('position').count === 4),
    ).toBe(true);
    expect(skinned(source)).toHaveLength(2);
  });
});
