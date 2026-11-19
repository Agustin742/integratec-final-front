import type { Object3D } from 'three';
import type { Pose } from '../movement';
import type { StepResult } from '../movement';

/** Body clips present in both avatar GLBs. */
export const IDLE_CLIP = 'Idle';
export const WALK_CLIP = 'Walk';

/** Clip that matches the movement state. */
export function animationFor(
  moving: boolean,
): typeof IDLE_CLIP | typeof WALK_CLIP {
  return moving ? WALK_CLIP : IDLE_CLIP;
}

/** Writes a pose onto an object standing on the floor plane. */
export function placeAvatar(
  target: Pick<Object3D, 'position' | 'rotation'>,
  pose: Pose,
): void {
  target.position.set(pose.x, 0, pose.z);
  target.rotation.y = pose.rotation;
}

export interface FrameController {
  step: (dtSeconds: number) => StepResult;
  hasDestination: () => boolean;
}

export interface AdvanceLocalAvatarOptions {
  controller: FrameController;
  avatar: Pick<Object3D, 'position' | 'rotation'>;
  marker: Pick<Object3D, 'visible'>;
  dt: number;
  invalidate: () => void;
}

/**
 * One `useFrame` tick: advances the controller and mutates the scene objects
 * directly, so moving never touches React state. Asks for another frame only
 * while moving; an idle avatar costs no renders. Returns whether it moved.
 */
export function advanceLocalAvatar({
  controller,
  avatar,
  marker,
  dt,
  invalidate,
}: AdvanceLocalAvatarOptions): boolean {
  const { pose, moving } = controller.step(dt);
  placeAvatar(avatar, pose);
  marker.visible = controller.hasDestination();
  if (moving) invalidate();
  return moving;
}
