import {
  BufferGeometry,
  SkinnedMesh,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UV_ATTRIBUTES = ['uv', 'uv1', 'uv2', 'uv3'];

function hasTexture(material: Material): boolean {
  return Object.values(material).some(
    (value) => (value as { isTexture?: boolean } | null)?.isTexture === true,
  );
}

function hasMorphTargets(mesh: SkinnedMesh): boolean {
  return (
    Object.keys(mesh.geometry.morphAttributes).length > 0 ||
    (mesh.morphTargetInfluences?.length ?? 0) > 0
  );
}

type Attribute = BufferAttribute | InterleavedBufferAttribute;

/**
 * The geometry as it is drawn: a material without any texture never samples
 * uv, so parts that differ only by an unused uv set can still be merged. The
 * returned geometry shares the source buffers (nothing is copied or mutated).
 */
function drawnGeometry(mesh: SkinnedMesh, textured: boolean): BufferGeometry {
  if (textured) return mesh.geometry;
  const names = Object.keys(mesh.geometry.attributes);
  if (!names.some((name) => UV_ATTRIBUTES.includes(name))) return mesh.geometry;
  const view = new BufferGeometry();
  const index = mesh.geometry.getIndex();
  if (index) view.setIndex(index);
  for (const name of names) {
    if (UV_ATTRIBUTES.includes(name)) continue;
    view.setAttribute(name, mesh.geometry.getAttribute(name) as Attribute);
  }
  return view;
}

function describeAttribute(name: string, attribute: Attribute): string {
  return `${name}:${String(attribute.itemSize)}:${attribute.array.constructor.name}:${String(attribute.normalized)}`;
}

/** Meshes with the same key can be drawn as one without changing the picture. */
function mergeKey(mesh: SkinnedMesh, geometry: BufferGeometry): string {
  const material = mesh.material as Material;
  const attributes = Object.keys(geometry.attributes)
    .sort()
    .map((name) => describeAttribute(name, geometry.getAttribute(name)));
  return [
    material.uuid,
    mesh.bindMode,
    mesh.skeleton.bones.map((bone) => bone.uuid).join(','),
    mesh.skeleton.boneInverses
      .map((matrix) => matrix.elements.join(','))
      .join(';'),
    mesh.bindMatrix.elements.join(','),
    mesh.matrixWorld.elements.join(','),
    geometry.getIndex() ? 'indexed' : 'plain',
    attributes.join('|'),
  ].join('#');
}

interface Candidate {
  readonly mesh: SkinnedMesh;
  readonly geometry: BufferGeometry;
}

/**
 * Cuts the draw calls of a cloned skinned model (`SkeletonUtils.clone`): the
 * primitives that share a material, the same bones and bind pose are merged
 * into one `SkinnedMesh` (one geometry, one draw call), bound to the cloned
 * skeleton so animation clips keep driving them by bone name.
 *
 * Left untouched: meshes with morph targets (clips address their weights by
 * node name and index), array-material meshes, and any group that cannot be
 * merged cleanly. Source geometries are shared with the cached GLB and are
 * never mutated; the merged geometries are new and are returned so the owner
 * can dispose them. Call it before the raycast/culling flags are set.
 */
export function mergeSkinnedByMaterial(root: Object3D): SkinnedMesh[] {
  root.updateMatrixWorld(true);
  const groups = new Map<string, Candidate[]>();
  root.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isSkinnedMesh || Array.isArray(mesh.material)) return;
    if (hasMorphTargets(mesh)) return;
    const geometry = drawnGeometry(mesh, hasTexture(mesh.material as Material));
    const key = mergeKey(mesh, geometry);
    const members = groups.get(key);
    if (members) members.push({ mesh, geometry });
    else groups.set(key, [{ mesh, geometry }]);
  });

  const created: SkinnedMesh[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const merged = mergeGeometries(members.map((member) => member.geometry));
    if (!merged) continue;
    const [first] = members as [Candidate, ...Candidate[]];
    const material = first.mesh.material as Material;
    const result = new SkinnedMesh(merged, material);
    result.name = `${material.name || 'material'}-merged`;
    result.bindMode = first.mesh.bindMode;
    result.castShadow = first.mesh.castShadow;
    result.receiveShadow = first.mesh.receiveShadow;
    result.renderOrder = first.mesh.renderOrder;
    result.bind(first.mesh.skeleton, first.mesh.bindMatrix);
    first.mesh.parent?.add(result);
    for (const member of members) member.mesh.removeFromParent();
    created.push(result);
  }
  return created;
}
