import type { Object3D } from 'three';
import type { Pose } from '../movement';
import { advanceRemoteAvatar } from '../classroom/remote-avatar-frame';

/** Forward pitch (rad) the bot leans into while it walks. */
export const BOT_LEAN_RADIANS = 0.12;

export interface AdvanceNpcOptions {
  /** Mutable pose owned by the NPC component; updated in place each frame. */
  current: Pose;
  target: Pose;
  group: Pick<Object3D, 'position' | 'rotation'>;
  dt: number;
  invalidate: () => void;
  /** Snaps to the synced pose instead of gliding. */
  reducedMotion: boolean;
}

/**
 * One frame of NPC interpolation toward the 20 Hz synced pose: exponential
 * glide for position and shortest-way yaw, a snap for far corrections and
 * with reduced motion. Returns whether the NPC is still travelling.
 */
export function advanceNpc({
  current,
  target,
  group,
  dt,
  invalidate,
  reducedMotion,
}: AdvanceNpcOptions): boolean {
  if (reducedMotion) {
    if (
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.z) ||
      !Number.isFinite(target.rotation)
    ) {
      return false;
    }
    const changed =
      current.x !== target.x ||
      current.z !== target.z ||
      current.rotation !== target.rotation;
    current.x = target.x;
    current.z = target.z;
    current.rotation = target.rotation;
    group.position.set(current.x, 0, current.z);
    group.rotation.y = current.rotation;
    if (changed) invalidate();
    return false;
  }
  return advanceRemoteAvatar({
    current,
    target,
    avatar: group,
    dt,
    invalidate,
  });
}
