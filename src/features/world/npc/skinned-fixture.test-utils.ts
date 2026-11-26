import {
  AnimationClip,
  Bone,
  BufferAttribute,
  BufferGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

function part(): BufferGeometry {
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
  );
  geo.setAttribute(
    'normal',
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3),
  );
  geo.setAttribute('skinIndex', new BufferAttribute(new Uint16Array(12), 4));
  geo.setAttribute(
    'skinWeight',
    new BufferAttribute(
      new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]),
      4,
    ),
  );
  geo.setIndex([0, 1, 2]);
  return geo;
}

/**
 * A skinned GLB stand-in: `parts` skinned primitives that all share one
 * material and one skeleton, plus a face mesh with a morph target.
 */
export function skinnedGltf(
  parts: number,
  clips: readonly string[] = [],
): GLTF {
  const scene = new Group();
  const hips = new Bone();
  hips.name = 'Hips';
  scene.add(hips);
  scene.updateMatrixWorld(true);
  const material = new MeshStandardMaterial({ name: 'Shared' });
  const addSkinned = (name: string, morph: boolean) => {
    const geometry = part();
    if (morph) {
      geometry.morphAttributes.position = [
        new BufferAttribute(new Float32Array(9), 3),
      ];
    }
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = name;
    if (morph) {
      mesh.morphTargetDictionary = { Blink: 0 };
      mesh.morphTargetInfluences = [0];
    }
    scene.add(mesh);
    mesh.bind(new Skeleton([hips]), mesh.matrixWorld);
  };
  for (let i = 0; i < parts; i += 1) addSkinned(`Part_${String(i)}`, false);
  addSkinned('Face', true);
  return {
    scene,
    scenes: [scene],
    animations: clips.map((name) => new AnimationClip(name, 1, [])),
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

/** Skinned meshes under a node. */
export function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  root.traverse((node) => {
    if ((node as SkinnedMesh).isSkinnedMesh) found.push(node as SkinnedMesh);
  });
  return found;
}
