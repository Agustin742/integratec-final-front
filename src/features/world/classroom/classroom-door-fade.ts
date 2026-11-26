import { CLASSROOM_LAYOUT } from '@/realtime';
import { CAMERA_ELEVATION } from '../camera';

/** Opacity of the door while it hides the local avatar. */
export const DOOR_FADE_OPACITY = 0.15;
/** Time to cross the whole opacity range. */
export const DOOR_FADE_SECONDS = 0.2;
/** Extra room around the door so the fade starts just before the avatar disappears. */
const FADE_MARGIN = 0.3;
/** Sampled heights of the avatar body: chest and head top. */
const AVATAR_SAMPLE_HEIGHTS = [0.9, 1.7] as const;

export interface OccluderBox {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly maxY: number;
}

/**
 * `door.glb` is 1.44 x 2.30 x 0.24 m with a wall-flush pivot, centred in the
 * back-wall entrance gap on the outer side of the wall
 * (`docs/art/classroom-interactive.md`).
 */
export const DOOR_WIDTH = 1.44;
export const DOOR_HEIGHT = 2.3;
export const DOOR_DEPTH = 0.24;
export const DOOR_OCCLUDER_BOX: OccluderBox = {
  minX: -DOOR_WIDTH / 2,
  maxX: DOOR_WIDTH / 2,
  minZ: CLASSROOM_LAYOUT.bounds.maxZ,
  maxZ: CLASSROOM_LAYOUT.bounds.maxZ + DOOR_DEPTH,
  maxY: DOOR_HEIGHT,
};

/** Direction from the scene towards the fixed isometric camera (+x, +y, +z). */
const elevation = (CAMERA_ELEVATION * Math.PI) / 180;
const HORIZONTAL = Math.cos(elevation) / Math.SQRT2;
const VERTICAL = Math.sin(elevation);

/**
 * True when the box sits between the camera and the avatar: a sight line from
 * the avatar's chest or head towards the camera crosses the box (grown by a
 * small margin). Pure and local; the camera direction never changes.
 */
export function shouldFadeOccluder(
  avatar: { readonly x: number; readonly z: number },
  box: OccluderBox,
): boolean {
  const minX = box.minX - FADE_MARGIN;
  const maxX = box.maxX + FADE_MARGIN;
  const minZ = box.minZ - FADE_MARGIN;
  const maxZ = box.maxZ + FADE_MARGIN;
  return AVATAR_SAMPLE_HEIGHTS.some((height) => {
    // Slab test along avatar + t * (HORIZONTAL, VERTICAL, HORIZONTAL), t >= 0.
    const tx0 = (minX - avatar.x) / HORIZONTAL;
    const tx1 = (maxX - avatar.x) / HORIZONTAL;
    const tz0 = (minZ - avatar.z) / HORIZONTAL;
    const tz1 = (maxZ - avatar.z) / HORIZONTAL;
    const ty0 = (0 - height) / VERTICAL;
    const ty1 = (box.maxY - height) / VERTICAL;
    const enter = Math.max(
      Math.min(tx0, tx1),
      Math.min(tz0, tz1),
      Math.min(ty0, ty1),
      0,
    );
    const exit = Math.min(
      Math.max(tx0, tx1),
      Math.max(tz0, tz1),
      Math.max(ty0, ty1),
    );
    return enter <= exit;
  });
}

/** Moves `current` towards `target` at a constant rate; instant with reduced motion. */
export function nextFadeOpacity(
  current: number,
  target: number,
  deltaSeconds: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return target;
  const step = (deltaSeconds / DOOR_FADE_SECONDS) * (1 - DOOR_FADE_OPACITY);
  if (current < target) return Math.min(target, current + step);
  return Math.max(target, current - step);
}
