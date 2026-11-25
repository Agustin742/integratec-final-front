import { Euler, Quaternion, type Mesh, type Object3D } from 'three';
import type { FaceMorph } from './call-emotes';
import { nodAngles } from './speaking-nod';

/** Joints of the canonical 34-joint avatar skeleton used for call motion. */
export const RIG_BONES = {
  chest: 'DEF-spine.003',
  head: 'DEF-spine.006',
} as const;

const BREATH_PERIOD_SECONDS = 4;
const BREATH_AMOUNT = 0.012;
const EXPRESSION_RATE = 6;
const MORPHS: readonly (FaceMorph | 'Blink')[] = [
  'Blink',
  'Happy',
  'Sad',
  'Angry',
];

export interface RigFrame {
  readonly dt: number;
  /** Smoothed voice level 0..1. */
  readonly level: number;
  /** False under reduced motion: no breathing and no nod. */
  readonly animated: boolean;
  /** Blink morph weight 0..1. */
  readonly blink: number;
}

export interface AvatarRig {
  setExpression(morph: FaceMorph | null): void;
  /** Call after the animation mixer has updated this frame. */
  update(frame: RigFrame): void;
}

/**
 * Procedural layer on top of the clips: breathing (chest scale), speaking nod
 * (head rotation), blink and eased face expressions (morph targets). Missing
 * bones or morphs are skipped, so partial avatars never throw.
 */
export function createAvatarRig(root: Object3D): AvatarRig {
  const chest = root.getObjectByName(RIG_BONES.chest);
  const head = root.getObjectByName(RIG_BONES.head);
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
      meshes.push(mesh);
    }
  });

  const weights: Record<FaceMorph, number> = { Happy: 0, Sad: 0, Angry: 0 };
  let target: FaceMorph | null = null;
  let seconds = 0;
  const nod = new Quaternion();
  const base = new Quaternion();
  const written = new Quaternion();
  let hasBase = false;
  const euler = new Euler();

  const write = (name: string, value: number) => {
    for (const mesh of meshes) {
      const index = mesh.morphTargetDictionary?.[name];
      if (index !== undefined && mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[index] = value;
      }
    }
  };

  return {
    setExpression(morph) {
      target = morph;
    },
    update({ dt, level, animated, blink }) {
      seconds += dt;
      if (chest) {
        chest.scale.y = animated
          ? 1 +
            BREATH_AMOUNT *
              Math.sin((seconds / BREATH_PERIOD_SECONDS) * Math.PI * 2)
          : 1;
      }
      if (head) {
        // The mixer may or may not write the head each frame. If the bone is
        // not what we left last frame, the mixer wrote it: that is the new base.
        if (!hasBase || !head.quaternion.equals(written)) {
          base.copy(head.quaternion);
          hasBase = true;
        }
        const { pitch, yaw } = nodAngles(level, seconds, !animated);
        head.quaternion.copy(base);
        if (pitch !== 0 || yaw !== 0) {
          euler.set(pitch, yaw, 0);
          head.quaternion.multiply(nod.setFromEuler(euler));
        }
        written.copy(head.quaternion);
      }
      const step = Math.min(1, dt * EXPRESSION_RATE);
      for (const name of MORPHS) {
        if (name === 'Blink') {
          write(name, Math.min(1, Math.max(0, blink)));
          continue;
        }
        weights[name] += ((target === name ? 1 : 0) - weights[name]) * step;
        write(name, weights[name]);
      }
    },
  };
}
