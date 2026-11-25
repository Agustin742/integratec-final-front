import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ClassroomKitModuleId } from './classroom-kit-manifest';
import { threeMaterialAppearanceKey } from './kit-material-key';
import { groupPlacementsByModule, type KitPlacement } from './kit-placement';

export interface BatchedKit {
  readonly group: Group;
  readonly meshes: readonly Mesh[];
  /**
   * Disposes only the merged geometries the builder created. Cached GLTF
   * geometries and materials are never touched, and the group stays attached
   * so a StrictMode remount still renders it.
   */
  readonly dispose: () => void;
}

export const KIT_BATCH_GROUP_NAME = 'kit:batch';
export const kitBatchMeshName = (materialKey: string): string =>
  `${KIT_BATCH_GROUP_NAME}:${materialKey}`;

const UP = new Vector3(0, 1, 0);
const UNIT_SCALE = new Vector3(1, 1, 1);

export function placementMatrix(placement: KitPlacement): Matrix4 {
  const [x, y, z] = placement.position;
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(UP, placement.rotationY),
    UNIT_SCALE,
  );
}

function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && !(node instanceof SkinnedMesh))
      meshes.push(node);
  });
  return meshes;
}

type AnyAttribute = BufferAttribute | InterleavedBufferAttribute;

/** Copies an attribute into a plain Float32 one (de-quantizes, de-interleaves). */
function toFloat32(attribute: AnyAttribute): Float32BufferAttribute {
  const { count, itemSize } = attribute;
  const array = new Float32Array(count * itemSize);
  for (let i = 0; i < count; i += 1) {
    for (let c = 0; c < itemSize; c += 1) {
      array[i * itemSize + c] = attribute.getComponent(i, c);
    }
  }
  return new Float32BufferAttribute(array, itemSize);
}

/**
 * Clones a source geometry into a private, Float32-only, morph-free copy
 * transformed to world space. The cached source is never touched.
 */
function bakeGeometry(source: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    geometry.setAttribute(name, toFloat32(attribute));
  }
  if (source.index) geometry.setIndex(Array.from(source.index.array));
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * Makes a bucket of geometries merge-compatible: keep only attributes shared
 * by every geometry and make indexing uniform.
 */
function normalizeBucket(parts: BufferGeometry[]): BufferGeometry[] {
  const shared = Object.keys(parts[0]?.attributes ?? {}).filter((name) =>
    parts.every((part) => part.getAttribute(name) !== undefined),
  );
  const nonIndexed = parts.some((part) => part.index === null);
  return parts.map((part) => {
    for (const name of Object.keys(part.attributes)) {
      if (!shared.includes(name)) part.deleteAttribute(name);
    }
    if (nonIndexed && part.index) {
      const flat = part.toNonIndexed();
      part.dispose();
      return flat;
    }
    return part;
  });
}

/** Geometries merge together only when every attribute has the same item size. */
function layoutSignature(geometry: BufferGeometry): string {
  return Object.entries(geometry.attributes)
    .map(([name, attribute]) => `${name}:${String(attribute.itemSize)}`)
    .sort()
    .join('|');
}

function mergeBucket(parts: BufferGeometry[]): BufferGeometry[] {
  const bySignature = new Map<string, BufferGeometry[]>();
  for (const part of normalizeBucket(parts)) {
    const signature = layoutSignature(part);
    const list = bySignature.get(signature);
    if (list) list.push(part);
    else bySignature.set(signature, [part]);
  }
  const result: BufferGeometry[] = [];
  for (const group of bySignature.values()) {
    const merged = mergeGeometries(group, false);
    // A null merge is never expected after normalization; keep the parts
    // separate (more draw calls, still correct) instead of dropping geometry.
    if (merged) {
      for (const part of group) part.dispose();
      result.push(merged);
    } else {
      result.push(...group);
    }
  }
  return result;
}

interface Bucket {
  readonly key: string;
  /** Readable name of the first material in the bucket, used for the mesh name. */
  readonly label: string;
  readonly material: Material;
  readonly parts: BufferGeometry[];
  readonly moduleIds: Set<ClassroomKitModuleId>;
}

const materialLabel = (material: Material): string =>
  material.name
    ? `${material.type}:${material.name}`
    : `${material.type}:#${material.uuid}`;

/**
 * GlTF files each carry their own material objects, so identity is useless
 * across modules. Named materials that look the same (same colour, finish and
 * transparency) are one material even under different names, because each GLB
 * family ships its own copy of the palette; the first instance wins. Unnamed
 * materials are only shared when they are the same object.
 */
function materialKey(material: Material): string {
  if (!material.name) return materialLabel(material);
  const appearance = threeMaterialAppearanceKey(material);
  return appearance
    ? `${material.type}|${appearance}`
    : `${material.type}:${material.name}`;
}

/**
 * Statically batches every placed kit module by material: each source mesh
 * geometry is baked to world space (`placement * meshMatrixInScene`) and all
 * geometry sharing a material is merged into ONE mesh, so draw calls ~ the
 * number of distinct materials. The kit is static after mount, which makes a
 * plain merged `Mesh` simpler and more robust than `BatchedMesh` (no instance
 * limits, no per-instance bookkeeping, works with any material). Cached
 * geometries and materials are shared/read only, never cloned or mutated.
 */
export function buildBatchedKit(
  modules: ReadonlyMap<ClassroomKitModuleId, Object3D>,
  placements: readonly KitPlacement[],
): BatchedKit {
  const buckets = new Map<string, Bucket>();
  const passthrough: Mesh[] = [];

  for (const [moduleId, modulePlacements] of groupPlacementsByModule(
    placements,
  )) {
    const scene = modules.get(moduleId);
    if (!scene) continue;
    scene.updateWorldMatrix(true, true);
    const sceneInverse = scene.matrixWorld.clone().invert();
    const placementMatrices = modulePlacements.map(placementMatrix);

    for (const source of collectMeshes(scene)) {
      const local = sceneInverse.clone().multiply(source.matrixWorld);

      if (Array.isArray(source.material)) {
        // Multi-material meshes cannot be merged by material key; render them
        // as they are (shared geometry/material) rather than dropping them.
        for (const matrix of placementMatrices) {
          const mesh = new Mesh(source.geometry, source.material);
          mesh.applyMatrix4(matrix.clone().multiply(local));
          mesh.userData = { kitModuleIds: [moduleId] };
          passthrough.push(mesh);
        }
        continue;
      }

      const key = materialKey(source.material);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          key,
          label: materialLabel(source.material),
          material: source.material,
          parts: [],
          moduleIds: new Set(),
        };
        buckets.set(key, bucket);
      }
      bucket.moduleIds.add(moduleId);
      for (const matrix of placementMatrices) {
        bucket.parts.push(
          bakeGeometry(source.geometry, matrix.clone().multiply(local)),
        );
      }
    }
  }

  const group = new Group();
  group.name = KIT_BATCH_GROUP_NAME;
  const meshes: Mesh[] = [];
  const owned: BufferGeometry[] = [];
  const allModuleIds = new Set<ClassroomKitModuleId>();

  for (const bucket of buckets.values()) {
    const kitModuleIds = [...bucket.moduleIds].sort();
    for (const id of kitModuleIds) allModuleIds.add(id);
    for (const geometry of mergeBucket(bucket.parts)) {
      const mesh = new Mesh(geometry, bucket.material);
      mesh.name = kitBatchMeshName(bucket.label);
      mesh.userData = { kitModuleIds };
      // Static: the room never moves, so skip per-frame matrix updates.
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      meshes.push(mesh);
      owned.push(geometry);
    }
  }
  for (const mesh of passthrough) {
    mesh.name = `${KIT_BATCH_GROUP_NAME}:multi-material`;
    group.add(mesh);
    meshes.push(mesh);
    for (const id of mesh.userData.kitModuleIds as ClassroomKitModuleId[]) {
      allModuleIds.add(id);
    }
  }
  group.userData = { kitModuleIds: [...allModuleIds].sort() };

  return {
    group,
    meshes,
    dispose: () => {
      for (const geometry of owned) geometry.dispose();
    },
  };
}
