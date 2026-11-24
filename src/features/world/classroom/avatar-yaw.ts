/** Convergence rate (1/s) of the displayed heading toward the authoritative one. */
export const TURN_RATE = 14;
/** Longest frame delta the turn integrates, so a stalled tab never snaps oddly. */
export const MAX_TURN_DT = 0.1;
/** Below this remaining angle (rad) a turn is considered finished. */
export const TURN_EPSILON = 0.001;

const TWO_PI = 2 * Math.PI;

/** Shortest signed angle difference wrapped into `[-Math.PI, Math.PI]`. */
export function shortestAngleDelta(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return 0;
  }
  const diff = (to - from + Math.PI) % TWO_PI;
  const wrapped = diff < 0 ? diff + TWO_PI : diff;
  return wrapped - Math.PI;
}

/** Wraps a heading into `[-Math.PI, Math.PI]` so it never grows unbounded. */
export function normalizeYaw(yaw: number): number {
  return Number.isFinite(yaw) ? shortestAngleDelta(0, yaw) : 0;
}

/**
 * Moves a displayed heading toward a target along the shortest path with
 * frame-rate-independent exponential damping. The result is normalized.
 */
export function dampYaw(
  current: number,
  target: number,
  dt: number,
  rate: number = TURN_RATE,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return current;
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const alpha = 1 - Math.exp(-rate * Math.min(dt, MAX_TURN_DT));
  return normalizeYaw(current + shortestAngleDelta(current, target) * alpha);
}
