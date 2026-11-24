import type { Object3D } from 'three';
import type { Pose } from '../movement';
import type { StepResult } from '../movement';
import { TURN_EPSILON, dampYaw, shortestAngleDelta } from './avatar-yaw';

/** Body clips present in both avatar GLBs. */
export const IDLE_CLIP = 'Idle';
export const WALK_CLIP = 'Walk';
export const RUN_CLIP = 'Run';

/** Clip that matches the movement state. */
export function animationFor(
  moving: boolean,
): typeof IDLE_CLIP | typeof RUN_CLIP {
  return moving ? RUN_CLIP : IDLE_CLIP;
}

const CLIP_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  [RUN_CLIP]: [RUN_CLIP, WALK_CLIP, IDLE_CLIP],
  [WALK_CLIP]: [WALK_CLIP, IDLE_CLIP],
};

/**
 * Picks the clip a body can actually play: `Run` falls back to `Walk`, then
 * `Idle`; `Walk` to `Idle`. Returns `null` when nothing usable exists.
 */
export function resolveClip(
  requested: string | undefined,
  available: readonly string[],
): string | null {
  if (!requested) return null;
  const chain = CLIP_FALLBACKS[requested] ?? [requested];
  return chain.find((name) => available.includes(name)) ?? null;
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
  /** Snaps the heading instead of turning (`prefers-reduced-motion`). */
  reducedMotion?: boolean;
}

/**
 * One `useFrame` tick: advances the controller and mutates the scene objects
 * directly, so moving never touches React state. Asks for another frame only
 * while moving or turning; an idle, settled avatar costs no renders. Returns whether it moved.
 */
export function advanceLocalAvatar({
  controller,
  avatar,
  marker,
  dt,
  invalidate,
  reducedMotion = false,
}: AdvanceLocalAvatarOptions): boolean {
  const { pose, moving } = controller.step(dt);
  // The pose heading is authoritative (sent to the server); the group shows a
  // damped copy of it, so the object's own yaw is the displayed one.
  const displayed = avatar.rotation.y;
  placeAvatar(avatar, pose);
  let turning = false;
  if (!reducedMotion && Number.isFinite(displayed)) {
    const next = dampYaw(displayed, pose.rotation, dt);
    const remaining = Math.abs(shortestAngleDelta(next, pose.rotation));
    turning = remaining > TURN_EPSILON;
    avatar.rotation.y = turning ? next : pose.rotation;
  }
  marker.visible = controller.hasDestination();
  if (moving || turning) invalidate();
  return moving;
}
