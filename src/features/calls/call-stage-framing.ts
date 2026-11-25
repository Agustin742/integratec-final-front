import { Box3, Vector3, type Object3D } from 'three';
import { RIG_BONES } from './call-avatar-rig';

/** Orthographic window of one tile, in world meters, relative to its slot. */
export interface StageFrame {
  readonly centerX: number;
  readonly centerY: number;
  /** Half of the visible height (the window is square). */
  readonly half: number;
}

/** Used until the model has loaded, and for the placeholder capsule. */
export const DEFAULT_FRAME: StageFrame = {
  centerX: 0,
  centerY: 0.95,
  half: 0.48,
};

/** Smallest head height accepted from a measurement (meters). */
const MIN_HEAD_HEIGHT = 0.12;
/** Visible height below the head joint, in head heights: neck and shoulders (stylized big-head body: head 0.79-1.32 m). */
const BELOW_HEAD = 0.6;
/** Headroom above the crown, in head heights. */
const HEADROOM = 0.2;

/**
 * Head-and-shoulders window from two measurements of the loaded model: the
 * world height of the head bone (neck/head joint) and the top of the model.
 * Everything scales with the measured head, so tall, short and child bodies
 * all get the head in the upper part with small headroom and the shoulders in
 * view, without any assumed body height.
 */
export function computeFrame(input: {
  readonly headY: number;
  readonly topY: number;
  readonly headX?: number;
}): StageFrame {
  const head = Math.max(input.topY - input.headY, MIN_HEAD_HEIGHT);
  const bottom = input.headY - BELOW_HEAD * head;
  const top = input.headY + head * (1 + HEADROOM);
  return {
    centerX: input.headX ?? 0,
    centerY: (top + bottom) / 2,
    half: (top - bottom) / 2,
  };
}

const headWorld = new Vector3();
const bounds = new Box3();

/**
 * Measures a loaded avatar in place (call it once the model is in the scene)
 * and returns its framing relative to the slot at `slotX`. `null` when the
 * head bone is missing, so the default framing stays.
 */
export function measureFrame(root: Object3D, slotX: number): StageFrame | null {
  const head = root.getObjectByName(RIG_BONES.head);
  if (!head) return null;
  root.updateWorldMatrix(true, true);
  head.getWorldPosition(headWorld);
  bounds.setFromObject(root);
  if (bounds.isEmpty()) return null;
  return computeFrame({
    headY: headWorld.y,
    topY: bounds.max.y,
    headX: headWorld.x - slotX,
  });
}
