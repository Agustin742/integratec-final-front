import type { ClassroomInteractable } from './classroom-interactables';

/**
 * Distance, in meters on the floor plane, at which an object becomes the
 * interaction target. Measured to the object's footprint edge, not its center,
 * so a wide board is reachable from either end. About 5 avatar radii (0.3):
 * close enough that "near the shop" reads true, far enough that walking along
 * the front wall (whose props sit 2.2 m apart) always passes a target.
 */
export const PROXIMITY_ENTER_RADIUS = 1.5;

/**
 * The current target is kept until the avatar is farther than this. The 0.5 m
 * gap is wider than the avatar's stop-and-turn jitter, so the prompt does not
 * flicker at the edge.
 */
export const PROXIMITY_EXIT_RADIUS = 2;

/** A rival must be this much nearer to take the target from the current one. */
export const PROXIMITY_SWITCH_MARGIN = 0.15;

export interface FloorPoint {
  readonly x: number;
  readonly z: number;
}

/** Distance on the XZ plane from `point` to the footprint rectangle (0 inside). */
export function distanceToFootprint(
  point: FloorPoint,
  interactable: ClassroomInteractable,
): number {
  const [cx, , cz] = interactable.worldPosition;
  const [width, depth] = interactable.footprint;
  const dx = Math.max(Math.abs(point.x - cx) - width / 2, 0);
  const dz = Math.max(Math.abs(point.z - cz) - depth / 2, 0);
  return Math.hypot(dx, dz);
}

export interface SelectProximityTargetInput {
  /** Local avatar position; no target without one. */
  readonly position: FloorPoint | undefined;
  /** Interactables the user could act on; unavailable ones are left out. */
  readonly candidates: readonly ClassroomInteractable[];
  /** Target chosen on the previous call, for hysteresis. */
  readonly currentId?: string | undefined;
}

/**
 * Picks the interactable the local avatar is next to. Pure: the caller keeps
 * `currentId` between frames. Nearest wins; ties go to the current target and
 * otherwise to the earlier candidate.
 */
export function selectProximityTarget({
  position,
  candidates,
  currentId,
}: SelectProximityTargetInput): string | undefined {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.z)
  ) {
    return undefined;
  }

  let nearest: { id: string; distance: number } | undefined;
  let current: { id: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = distanceToFootprint(position, candidate);
    if (candidate.id === currentId) current = { id: candidate.id, distance };
    if (
      distance <= PROXIMITY_ENTER_RADIUS &&
      (!nearest || distance < nearest.distance)
    ) {
      nearest = { id: candidate.id, distance };
    }
  }

  if (current && current.distance <= PROXIMITY_EXIT_RADIUS) {
    if (
      !nearest ||
      nearest.distance >= current.distance - PROXIMITY_SWITCH_MARGIN
    ) {
      return current.id;
    }
  }
  return nearest?.id;
}
