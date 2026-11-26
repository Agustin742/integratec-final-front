import { MathUtils, OrthographicCamera, Vector3 } from 'three';
import { CLASSROOM_LAYOUT } from '../../realtime/classroom-layout';

// World convention: 1 unit = 1 meter, Y up, ground at Y = 0.
// Features inside this reference framing must stay within these bounds.
export interface FramingBounds {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

export const WORLD_BOUNDS: FramingBounds = {
  min: [-3, 0, -2],
  max: [3, 2, 2],
};

/** Wall height of the placeholder classroom; also the framed room height. */
export const CLASSROOM_WALL_HEIGHT = 2.6;

/** The whole classroom (floor bounds from the shared layout, up to the wall top). */
export const CLASSROOM_BOUNDS: FramingBounds = {
  min: [CLASSROOM_LAYOUT.bounds.minX, 0, CLASSROOM_LAYOUT.bounds.minZ],
  max: [
    CLASSROOM_LAYOUT.bounds.maxX,
    CLASSROOM_WALL_HEIGHT,
    CLASSROOM_LAYOUT.bounds.maxZ,
  ],
};
export const CAMERA_ELEVATION = 35.264;

/** Distance from the look-at point to the camera; the direction never changes. */
const CAMERA_DISTANCE = 16;

export function frameCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
  bounds: FramingBounds = WORLD_BOUNDS,
): void {
  if (width <= 0 || height <= 0) return;
  // Look at the middle of the bounds from the fixed isometric direction; the
  // default bounds are centred on (0, 1, 0), so the reference framing is
  // unchanged.
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const centerZ = (bounds.min[2] + bounds.max[2]) / 2;
  const elevation = (CAMERA_ELEVATION * Math.PI) / 180;
  const horizontal = (CAMERA_DISTANCE * Math.cos(elevation)) / Math.sqrt(2);
  camera.position.set(
    centerX + horizontal,
    centerY + CAMERA_DISTANCE * Math.sin(elevation),
    centerZ + horizontal,
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(centerX, centerY, centerZ);
  camera.updateMatrixWorld(true);
  let halfWidth = 0;
  let halfHeight = 0;
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).applyMatrix4(
          camera.matrixWorldInverse,
        );
        halfWidth = Math.max(halfWidth, Math.abs(point.x));
        halfHeight = Math.max(halfHeight, Math.abs(point.y));
      }
  const aspect = width / height;
  const fittedHeight = Math.max(halfHeight, halfWidth / aspect) * 1.15;
  camera.top = fittedHeight;
  camera.bottom = -fittedHeight;
  camera.right = fittedHeight * aspect;
  camera.left = -camera.right;
  camera.near = 0.1;
  camera.far = 50;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

/**
 * Bounds of one standing avatar (meters, Y up, feet at 0) with room for hair
 * volume and swinging arms. Measured from the body and hair GLB position
 * accessors, not from a rendered check; widen them here if a part overflows.
 */
export const AVATAR_FRAME = {
  bottom: -0.05,
  top: 1.8,
  halfWidth: 0.8,
} as const;

/** Front view that fits the whole avatar, head to feet, in any host aspect. */
export function frameAvatarCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;
  const centerY = (AVATAR_FRAME.bottom + AVATAR_FRAME.top) / 2;
  camera.position.set(0, centerY, 10);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, centerY, 0);
  camera.updateMatrixWorld(true);
  const aspect = width / height;
  const halfHeight = (AVATAR_FRAME.top - AVATAR_FRAME.bottom) / 2;
  const fittedHeight =
    Math.max(halfHeight, AVATAR_FRAME.halfWidth / aspect) * 1.08;
  camera.top = fittedHeight;
  camera.bottom = -fittedHeight;
  camera.right = fittedHeight * aspect;
  camera.left = -camera.right;
  camera.near = 0.1;
  camera.far = 50;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

/**
 * Follow camera zoom: world units visible vertically (camera space) around the
 * avatar. The whole classroom needs about 16, so 8 shows roughly a third of
 * it. Tune this one number to zoom in or out.
 */
export const FOLLOW_VISIBLE_HEIGHT = 8;

/**
 * Smallest world width kept visible, so narrow and mobile viewports still show
 * enough floor around the avatar to anticipate movement.
 */
export const FOLLOW_MIN_VISIBLE_WIDTH = 9;

/** Height of the point the follow camera looks at (about avatar mid-body). */
export const FOLLOW_TARGET_HEIGHT = 0.9;

/** Follow smoothing rate (1/s) for `MathUtils.damp`; higher is snappier. */
export const FOLLOW_DAMPING = 6;

/** Maximum frame delta (seconds) accepted by follow damping so tab stalls never overshoot. */
export const MAX_FOLLOW_DT = 0.1;

/** Distance (meters) under which the damped target counts as settled. */
export const FOLLOW_EPSILON = 0.001;
export const FOLLOW_SETTLE_DISTANCE = FOLLOW_EPSILON;

export interface FollowPoint {
  readonly x: number;
  readonly z: number;
}

export interface FollowFrustum {
  readonly halfWidth: number;
  readonly halfHeight: number;
}

/** Half extents of the visible area for a viewport, in camera-space units. */
export function followFrustum(width: number, height: number): FollowFrustum {
  if (!(width > 0 && height > 0)) {
    return {
      halfWidth: FOLLOW_MIN_VISIBLE_WIDTH / 2,
      halfHeight: FOLLOW_VISIBLE_HEIGHT / 2,
    };
  }
  const aspect = width / height;
  const halfHeight =
    Math.max(FOLLOW_VISIBLE_HEIGHT, FOLLOW_MIN_VISIBLE_WIDTH / aspect) / 2;
  return { halfWidth: halfHeight * aspect, halfHeight };
}

const ELEVATION_RAD = (CAMERA_ELEVATION * Math.PI) / 180;
const SIN_ELEVATION = Math.sin(ELEVATION_RAD);
const COS_ELEVATION = Math.cos(ELEVATION_RAD);

export interface FollowStep extends FollowPoint {
  /** True when the target reached its destination; no more frames are needed. */
  readonly settled: boolean;
}

/**
 * One frame of the follow smoothing: frame-rate independent damping toward
 * `desired`, or an instant jump when `reducedMotion` is set.
 */
export function advanceFollowTarget(
  current: FollowPoint,
  desired: FollowPoint,
  dt: number,
  reducedMotion: boolean,
): FollowStep {
  if (reducedMotion) return { x: desired.x, z: desired.z, settled: true };
  if (!Number.isFinite(dt) || dt <= 0) {
    return {
      x: current.x,
      z: current.z,
      settled:
        Math.abs(desired.x - current.x) <= FOLLOW_EPSILON &&
        Math.abs(desired.z - current.z) <= FOLLOW_EPSILON,
    };
  }
  const clampedDt = Math.min(dt, MAX_FOLLOW_DT);
  const x = MathUtils.damp(current.x, desired.x, FOLLOW_DAMPING, clampedDt);
  const z = MathUtils.damp(current.z, desired.z, FOLLOW_DAMPING, clampedDt);
  if (Math.hypot(desired.x - x, desired.z - z) < FOLLOW_EPSILON)
    return { x: desired.x, z: desired.z, settled: true };
  return { x, z, settled: false };
}

/**
 * Places the isometric camera on `target` (same direction and projection as
 * the whole-room framing) with the closer fixed follow zoom.
 */
export function applyFollowCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
  target: FollowPoint,
): void {
  if (!(width > 0 && height > 0)) return;
  const horizontal = (CAMERA_DISTANCE * COS_ELEVATION) / Math.SQRT2;
  camera.position.set(
    target.x + horizontal,
    FOLLOW_TARGET_HEIGHT + CAMERA_DISTANCE * SIN_ELEVATION,
    target.z + horizontal,
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(target.x, FOLLOW_TARGET_HEIGHT, target.z);
  camera.updateMatrixWorld(true);
  const { halfWidth, halfHeight } = followFrustum(width, height);
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.right = halfWidth;
  camera.left = -halfWidth;
  camera.near = 0.1;
  camera.far = 50;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}
