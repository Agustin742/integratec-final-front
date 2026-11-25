import {
  Matrix4,
  Mesh,
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
export const ACCESSORY_TINT_MATERIAL = 'AvatarAccessoryTint';
export const DETAIL_MATERIAL = 'AvatarDetail';
/** Translucent lenses and visors; drawn after the opaque parts. */
export const GLASS_MATERIAL = 'AvatarGlass';

const GLASS_RENDER_ORDER = 1;

export type AvatarPartKind = 'hair' | 'top' | 'head' | 'face' | 'back';

export interface AvatarPartInput {
  readonly key: AvatarPartKind;
  /** Loaded `gltf.scene` of the part; never mutated. */
  readonly scene: Object3D;
  /** `#RRGGBB` per material name; invalid values leave the material alone. */
  readonly tints?: Readonly<Record<string, string>>;
  /** Node names (meshes or groups) to hide on the composed clone. */
  readonly hiddenMeshes?: readonly string[];
  /** Morph target influences by name, for example `BackTuck`. */
  readonly morphs?: Readonly<Record<string, number>>;
}

export interface ComposeAvatarInput {
  /** Loaded `gltf.scene` of the body; never mutated. */
  readonly body: Object3D;
  /** Any number of parts, attached in order. */
  readonly parts?: readonly AvatarPartInput[];
  /** Shorthand for a hair part tinted with `hairColor`. */
  readonly hair?: Object3D | null;
  /** Shorthand for a top part tinted with `clothingColor`. */
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

/** Meshes without skin weights, such as rigid hair bands or glasses. */
function staticMeshesOf(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && !(node instanceof SkinnedMesh))
      meshes.push(node);
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

type ColoredMaterial = Material & { color: { set(value: string): void } };

/**
 * `SkeletonUtils.clone` shares materials with the asset cache, so any
 * material that needs a change is cloned per instance first.
 */
function prepareMaterials(
  mesh: Mesh,
  tints: Readonly<Record<string, string>>,
  created: Material[],
): void {
  const prepare = (material: Material): Material => {
    const tint = Object.hasOwn(tints, material.name)
      ? tints[material.name]
      : undefined;
    const tinted =
      tint !== undefined &&
      'color' in material &&
      safeHexColor(tint, '') !== '';
    const glass = material.name === GLASS_MATERIAL;
    if (!tinted && !glass) return material;
    const copy = material.clone();
    if (tinted) (copy as ColoredMaterial).color.set(tint);
    if (glass) {
      copy.transparent = true;
      copy.depthWrite = false;
    }
    created.push(copy);
    return copy;
  };
  const prepared = Array.isArray(mesh.material)
    ? mesh.material.map(prepare)
    : prepare(mesh.material);
  mesh.material = prepared;
  const list = Array.isArray(prepared) ? prepared : [prepared];
  if (list.some((material) => material.name === GLASS_MATERIAL)) {
    mesh.renderOrder = Math.max(mesh.renderOrder, GLASS_RENDER_ORDER);
  }
}

function hideNodes(root: Object3D, names: readonly string[]): void {
  root.traverse((node) => {
    if (!names.includes(node.name)) return;
    // The subtree is hidden node by node: parts are re-parented mesh by
    // mesh, which would otherwise drop a hidden ancestor's visibility.
    node.traverse((child) => {
      child.visible = false;
    });
  });
}

function applyMorphs(
  meshes: readonly Mesh[],
  morphs: Readonly<Record<string, number>>,
): void {
  for (const mesh of meshes) {
    const dictionary = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dictionary || !influences) continue;
    for (const [name, value] of Object.entries(morphs)) {
      const index = dictionary[name];
      if (index !== undefined) influences[index] = value;
    }
  }
}

function legacyParts({
  hair,
  top,
  hairColor,
  clothingColor,
}: ComposeAvatarInput): AvatarPartInput[] {
  const parts: AvatarPartInput[] = [];
  if (hair) {
    parts.push({
      key: 'hair',
      scene: hair,
      tints: {
        [HAIR_TINT_MATERIAL]: safeHexColor(hairColor, DEFAULT_HAIR_COLOR),
      },
    });
  }
  if (top) {
    parts.push({
      key: 'top',
      scene: top,
      tints: {
        [TOP_TINT_MATERIAL]: safeHexColor(
          clothingColor,
          DEFAULT_CLOTHING_COLOR,
        ),
      },
    });
  }
  return parts;
}

/**
 * Composes a renderable avatar from already-loaded GLTF scenes: every part
 * mesh, skinned or static, is carried onto the body clone with its authored
 * placement; skinned meshes are re-bound to the body's bones by name so a
 * single mixer on the body animates the whole avatar.
 */
export function composeAvatar(input: ComposeAvatarInput): ComposedAvatar {
  const { body } = input;
  const root = cloneSkeleton(body);
  root.updateMatrixWorld(true);
  const bodyBones = bonesByName(root);
  const createdMaterials: Material[] = [];
  const createdSkeletons: Skeleton[] = skinnedMeshesOf(root).map(
    (mesh) => mesh.skeleton,
  );
  const skippedParts: AvatarPartKind[] = [];

  const parts = [...legacyParts(input), ...(input.parts ?? [])];

  for (const part of parts) {
    const partClone = cloneSkeleton(part.scene);
    const skinned = skinnedMeshesOf(partClone);
    const statics = staticMeshesOf(partClone);
    const skeletons = skinned.map((mesh) => rebindSkeleton(mesh, bodyBones));
    if (
      skinned.length + statics.length === 0 ||
      skeletons.some((skeleton) => skeleton === null)
    ) {
      skippedParts.push(part.key);
      skinned.forEach((mesh) => mesh.skeleton.dispose());
      continue;
    }
    if (part.hiddenMeshes?.length) hideNodes(partClone, part.hiddenMeshes);
    // Bake each mesh's authored world placement before re-parenting: a mesh
    // nested under a transform group keeps its place instead of collapsing
    // onto the body root's frame.
    partClone.updateMatrixWorld(true);
    const intoRoot = new Matrix4().copy(root.matrixWorld).invert();
    const placement = new Matrix4();
    const meshes = [...skinned, ...statics];
    for (const mesh of meshes) {
      placement.copy(intoRoot).multiply(mesh.matrixWorld);
      placement.decompose(mesh.position, mesh.quaternion, mesh.scale);
    }
    skinned.forEach((mesh, index) => {
      const skeleton = skeletons[index] as Skeleton;
      mesh.skeleton.dispose();
      mesh.bind(skeleton, mesh.bindMatrix);
      createdSkeletons.push(skeleton);
    });
    for (const mesh of meshes) {
      prepareMaterials(mesh, part.tints ?? {}, createdMaterials);
    }
    if (part.morphs) applyMorphs(meshes, part.morphs);
    root.add(...meshes);
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
