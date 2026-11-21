import {
  AVATAR_SPEED_UNITS_PER_SECOND,
  type ClassroomLayout,
} from '@/realtime';

/** Avatar placement on the floor plane. `rotation` is `atan2(x, z)` of the last non-zero input. */
export interface Pose {
  x: number;
  z: number;
  /** Facing angle in radians. */
  rotation: number;
}

/** A movement intent on the floor plane (the `AvatarInput` shape). Need not be normalized. */
export interface Direction {
  x: number;
  z: number;
}

/** Inputs shorter than this count as "stop" (analog sticks never rest at exactly zero). */
export const INPUT_DEADZONE = 0.05;

/**
 * Longest distance covered between two collision checks. It is far below the thinnest obstacle
 * (inflated by the avatar radius), so no step size can carry an avatar through an obstacle.
 */
const MAX_SUBSTEP = 0.05;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Whether an avatar centre may stand at (x, z): inside the walls and clear of every obstacle.
 * Mirrors the server `isWalkable` (apps/realtime), so local prediction and authority agree.
 */
export function isWalkable(
  layout: ClassroomLayout,
  x: number,
  z: number,
): boolean {
  const { bounds, avatarRadius: r, obstacles } = layout;
  if (x < bounds.minX + r || x > bounds.maxX - r) return false;
  if (z < bounds.minZ + r || z > bounds.maxZ - r) return false;
  return !obstacles.some(
    (o) => x > o.minX - r && x < o.maxX + r && z > o.minZ - r && z < o.maxZ + r,
  );
}

/**
 * Advances an avatar by one step, mirroring the server `stepAvatar`. The direction is normalized
 * and the speed is fixed, so a longer input vector never moves faster. The step is cut into short
 * sub-steps and each axis is tried on its own: the avatar is clamped to the walls, stops at
 * obstacles and slides along them. Returns the same `pose` object when nothing moves (invalid
 * `dtSeconds` or input under the deadzone).
 */
export function stepAvatar(
  layout: ClassroomLayout,
  pose: Pose,
  input: Direction,
  dtSeconds: number,
): Pose {
  // A step that is not a positive, finite duration would move backwards, produce NaN or never end.
  if (!(dtSeconds > 0) || !Number.isFinite(dtSeconds)) return pose;
  const length = Math.hypot(input.x, input.z);
  if (!(length >= INPUT_DEADZONE)) return pose;

  const dirX = input.x / length;
  const dirZ = input.z / length;
  const distance = AVATAR_SPEED_UNITS_PER_SECOND * dtSeconds;
  const substeps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const stepX = (dirX * distance) / substeps;
  const stepZ = (dirZ * distance) / substeps;
  const { bounds, avatarRadius: r } = layout;

  let { x, z } = pose;
  for (let i = 0; i < substeps; i++) {
    const nextX = clamp(x + stepX, bounds.minX + r, bounds.maxX - r);
    if (isWalkable(layout, nextX, z)) x = nextX;
    const nextZ = clamp(z + stepZ, bounds.minZ + r, bounds.maxZ - r);
    if (isWalkable(layout, x, nextZ)) z = nextZ;
  }
  return { x, z, rotation: Math.atan2(dirX, dirZ) };
}
