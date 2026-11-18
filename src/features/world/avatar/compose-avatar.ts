import {
  Skeleton,
  SkinnedMesh,
  type Bone,
  type Material,
  type Object3D,
} from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  DEFAULT_CLOTHING_COLOR,
  DEFAULT_HAIR_COLOR,
  safeHexColor,
} from './avatar-parts';

export const HAIR_TINT_MATERIAL = 'AvatarHairTint';
export const TOP_TINT_MATERIAL = 'AvatarTopTint';

export type AvatarPartKind = 'hair' | 'top';

export interface ComposeAvatarInput {
  /** Loaded `gltf.scene` of the body; never mutated. */
  readonly body: Object3D;
  /** Loaded `gltf.scene` of each optional part; never mutated. */
  readonly hair?: Object3D | null;
  readonly top?: Object3D | null;
  readonly hairColor?: string;
  readonly clothingColor?: string;
}

export interface ComposedAvatar {
  /** Body clone with every attached part; drive it with one AnimationMixer. */
  readonly root: Object3D;
  /** Parts left out because their rig does not match the body's. */
  readonly skippedParts: readonly AvatarPartKind[];
  /** Releases only what this instance created; cached assets stay intact. */
  dispose(): void;
}

function skinnedMeshesOf(root: Object3D): SkinnedMesh[] {
  const meshes: SkinnedMesh[] = [];
  root.traverse((node) => {
    if (node instanceof SkinnedMesh) meshes.push(node);
  });
  return meshes;
}

function bonesByName(root: Object3D): Map<string, Bone> {
  const bones = new Map<string, Bone>();
  root.traverse((node) => {
    if ('isBone' in node && node.isBone) bones.set(node.name, node as Bone);
  });
  return bones;
}

/**
 * Builds a skeleton from the body's bones in the part's own joint order.
 * Returns `null` when any joint has no same-named bone in the body.
 */
function rebindSkeleton(
  mesh: SkinnedMesh,
  bodyBones: ReadonlyMap<string, Bone>,
): Skeleton | null {
  const bones: Bone[] = [];
  for (const joint of mesh.skeleton.bones) {
    const bone = bodyBones.get(joint.name);
    if (!bone) return null;
    bones.push(bone);
  }
  return new Skeleton(bones, mesh.skeleton.boneInverses);
}

/**
 * `SkeletonUtils.clone` shares materials with the asset cache, so tint
 * targets are cloned per instance before their color is written.
 */
function tintMaterials(
  mesh: SkinnedMesh,
  targetName: string,
  color: string,
  created: Material[],
): void {
  const tint = (material: Material): Material => {
    if (material.name !== targetName || !('color' in material)) return material;
    const copy = material.clone() as Material & {
      color: { set(value: string): void };
    };
    copy.color.set(color);
    created.push(copy);
    return copy;
  };
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map(tint)
    : tint(mesh.material);
}

/**
 * Composes a renderable avatar from already-loaded GLTF scenes: every part
 * skinned mesh is re-bound to the body clone's bones by name so a single
 * mixer on the body animates the whole avatar.
 */
export function composeAvatar({
  body,
  hair,
  top,
  hairColor,
  clothingColor,
}: ComposeAvatarInput): ComposedAvatar {
  const root = cloneSkeleton(body);
  const bodyBones = bonesByName(root);
  const createdMaterials: Material[] = [];
  const createdSkeletons: Skeleton[] = skinnedMeshesOf(root).map(
    (mesh) => mesh.skeleton,
  );
  const skippedParts: AvatarPartKind[] = [];

  const parts: ReadonlyArray<
    readonly [AvatarPartKind, Object3D | null | undefined, string, string]
  > = [
    [
      'hair',
      hair,
      HAIR_TINT_MATERIAL,
      safeHexColor(hairColor, DEFAULT_HAIR_COLOR),
    ],
    [
      'top',
      top,
      TOP_TINT_MATERIAL,
      safeHexColor(clothingColor, DEFAULT_CLOTHING_COLOR),
    ],
  ];

  for (const [kind, scene, materialName, color] of parts) {
    if (!scene) continue;
    const partClone = cloneSkeleton(scene);
    const meshes = skinnedMeshesOf(partClone);
    const skeletons = meshes.map((mesh) => rebindSkeleton(mesh, bodyBones));
    if (meshes.length === 0 || skeletons.some((skeleton) => !skeleton)) {
      skippedParts.push(kind);
      skinnedMeshesOf(partClone).forEach((mesh) => mesh.skeleton.dispose());
      continue;
    }
    meshes.forEach((mesh, index) => {
      const skeleton = skeletons[index] as Skeleton;
      mesh.skeleton.dispose();
      mesh.bind(skeleton, mesh.bindMatrix);
      tintMaterials(mesh, materialName, color, createdMaterials);
      createdSkeletons.push(skeleton);
      root.add(mesh);
    });
  }

  return {
    root,
    skippedParts,
    dispose() {
      createdMaterials.forEach((material) => material.dispose());
      createdSkeletons.forEach((skeleton) => skeleton.dispose());
    },
  };
}
