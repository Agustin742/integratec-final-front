import { OrthographicCamera, Vector3 } from 'three';

// World convention: 1 unit = 1 meter, Y up, ground at Y = 0.
// Features inside this reference framing must stay within these bounds.
export const WORLD_BOUNDS = { min: [-3, 0, -2], max: [3, 2, 2] } as const;
export const CAMERA_ELEVATION = 35.264;

export function frameCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;
  const elevation = (CAMERA_ELEVATION * Math.PI) / 180;
  const horizontal = (16 * Math.cos(elevation)) / Math.sqrt(2);
  camera.position.set(horizontal, 1 + 16 * Math.sin(elevation), horizontal);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld(true);
  let halfWidth = 0;
  let halfHeight = 0;
  for (const x of [WORLD_BOUNDS.min[0], WORLD_BOUNDS.max[0]])
    for (const y of [WORLD_BOUNDS.min[1], WORLD_BOUNDS.max[1]])
      for (const z of [WORLD_BOUNDS.min[2], WORLD_BOUNDS.max[2]]) {
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
