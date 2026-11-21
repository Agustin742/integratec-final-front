import type { Object3D } from 'three';
import type { Pose } from '../movement';
import { placeAvatar } from './local-avatar-frame';

/** Convergence rate (1/s) tuned for 20 Hz Colyseus state patches. */
export const REMOTE_INTERPOLATION_RATE = 12;
export const REMOTE_ARRIVE_EPSILON = 0.005;
export const REMOTE_ANGLE_EPSILON = 0.01;
/** Large server corrections snap directly instead of gliding through desks. */
export const REMOTE_TELEPORT_DISTANCE = 4;
export const MAX_REMOTE_DT = 0.1;

/** Shortest signed angle difference wrapped into `[-Math.PI, Math.PI]`. */
export function shortestAngleDelta(from: number, to: number): number {
  const diff = (to - from + Math.PI) % (2 * Math.PI);
  const wrapped = diff < 0 ? diff + 2 * Math.PI : diff;
  return wrapped - Math.PI;
}

export interface AdvanceRemoteAvatarOptions {
  /** Mutable pose ref owned by `RemoteAvatar`; mutated in place each frame. */
  current: Pose;
  target: Pose;
  avatar: Pick<Object3D, 'position' | 'rotation'>;
  dt: number;
  invalidate: () => void;
}

/**
 * Interpolates a remote avatar's scene group toward the latest server-accepted
 * pose without touching React state per frame. Returns whether the avatar is
 * still walking so the caller can toggle `Walk`/`Idle` only on transitions.
 */
export function advanceRemoteAvatar({
  current,
  target,
  avatar,
  dt,
  invalidate,
}: AdvanceRemoteAvatarOptions): boolean {
  const dx = target.x - current.x;
  const dz = target.z - current.z;
  const dist = Math.hypot(dx, dz);
  const angleDelta = shortestAngleDelta(current.rotation, target.rotation);

  if (dist > REMOTE_TELEPORT_DISTANCE) {
    current.x = target.x;
    current.z = target.z;
    current.rotation = target.rotation;
    placeAvatar(avatar, current);
    invalidate();
    return false;
  }

  if (
    dist <= REMOTE_ARRIVE_EPSILON &&
    Math.abs(angleDelta) <= REMOTE_ANGLE_EPSILON
  ) {
    current.x = target.x;
    current.z = target.z;
    current.rotation = target.rotation;
    placeAvatar(avatar, current);
    return false;
  }

  const clampedDt = Math.min(Math.max(dt, 0), MAX_REMOTE_DT);
  const alpha = 1 - Math.exp(-REMOTE_INTERPOLATION_RATE * clampedDt);

  current.x += dx * alpha;
  current.z += dz * alpha;
  current.rotation += angleDelta * alpha;

  const remainingDist = Math.hypot(target.x - current.x, target.z - current.z);
  const remainingAngle = Math.abs(
    shortestAngleDelta(current.rotation, target.rotation),
  );
  if (
    remainingDist <= REMOTE_ARRIVE_EPSILON &&
    remainingAngle <= REMOTE_ANGLE_EPSILON
  ) {
    current.x = target.x;
    current.z = target.z;
    current.rotation = target.rotation;
  }

  placeAvatar(avatar, current);
  invalidate();
  return dist > REMOTE_ARRIVE_EPSILON;
}
