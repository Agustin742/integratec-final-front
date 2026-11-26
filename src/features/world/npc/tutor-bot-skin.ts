/**
 * Tutor bot skins (`docs/art/tutor-bot-skins.md`): split-body wearables bound
 * to the bot skeleton by bone name, hiding the base meshes they replace.
 */
import { Skeleton, type Bone, type Object3D, type SkinnedMesh } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toTutorBotSkin } from '@/realtime/contracts.generated';

const TORSO = ['Bot_Torso'] as const;
const LONG_SLEEVES = ['Bot_Torso', 'Bot_UpperArms', 'Bot_Forearms'] as const;

/** Base meshes a skin may hide; they must stay separate when merging. */
export const BOT_HIDEABLE_MESHES: ReadonlySet<string> = new Set(LONG_SLEEVES);

const HIDDEN_BY_SKIN = {
  boca: TORSO,
  seleccion: TORSO,
  folklore: TORSO,
  guardapolvo: LONG_SLEEVES,
  scientist: LONG_SLEEVES,
  graduate: LONG_SLEEVES,
  gamer: LONG_SLEEVES,
} as const;

export interface BotSkinPlan {
  readonly url: string;
  readonly hidden: readonly string[];
}

/** `null` for the default bot, which includes any unknown value. */
export function planBotSkin(value: string): BotSkinPlan | null {
  const skin = toTutorBotSkin(value);
  if (skin === 'none') return null;
  return {
    url: `/models/bot/skins/skin-${skin}.glb`,
    hidden: HIDDEN_BY_SKIN[skin],
  };
}

function collect(root: Object3D) {
  const bones = new Map<string, Bone>();
  const meshes: SkinnedMesh[] = [];
  root.traverse((node) => {
    if ((node as Bone).isBone) bones.set(node.name, node as Bone);
    if ((node as SkinnedMesh).isSkinnedMesh) meshes.push(node as SkinnedMesh);
  });
  return { bones, meshes };
}

/**
 * Dresses `model` in a clone of `skinScene` (geometries and materials stay
 * shared with the cached file). Returns the function that restores the bot,
 * or `null`, changing nothing, when the skin does not fit this skeleton.
 */
export function wearBotSkin(
  model: Object3D,
  skinScene: Object3D,
  hidden: readonly string[],
): (() => void) | null {
  const rig = collect(model).bones;
  const copy = cloneSkeleton(skinScene);
  copy.updateMatrixWorld(true);
  const { meshes } = collect(copy);
  const fits =
    meshes.length > 0 &&
    meshes.every((mesh) =>
      mesh.skeleton.bones.every((bone) => rig.has(bone.name)),
    );
  if (!fits) return null;

  const skeletons = meshes.map((mesh) => {
    const skeleton = new Skeleton(
      mesh.skeleton.bones.map((bone) => rig.get(bone.name)!),
      mesh.skeleton.boneInverses,
    );
    mesh.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.bind(skeleton, mesh.bindMatrix);
    // Same rules as the base model: never culled, never picked.
    mesh.frustumCulled = false;
    mesh.raycast = () => undefined;
    model.add(mesh);
    return skeleton;
  });

  const covered = hidden.flatMap((name) => model.getObjectByName(name) ?? []);
  for (const node of covered) node.visible = false;

  return () => {
    for (const mesh of meshes) mesh.removeFromParent();
    for (const skeleton of skeletons) skeleton.dispose();
    for (const node of covered) node.visible = true;
  };
}
