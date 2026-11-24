import { describe, expect, test } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import {
  advanceFollowTarget,
  applyFollowCamera,
  AVATAR_FRAME,
  CAMERA_ELEVATION,
  clampFollowTarget,
  FOLLOW_MIN_VISIBLE_WIDTH,
  FOLLOW_TARGET_HEIGHT,
  FOLLOW_VISIBLE_HEIGHT,
  followFrustum,
  type FollowStep,
  frameAvatarCamera,
  CLASSROOM_BOUNDS,
  CLASSROOM_WALL_HEIGHT,
  frameCamera,
  WORLD_BOUNDS,
} from './camera';
import { CLASSROOM_LAYOUT } from '@/realtime';

describe('fixed world framing', () => {
  test.each([
    [1280, 560],
    [360, 480],
    [480, 360],
  ])('fits target bounds at %sx%s without distortion', (width, height) => {
    const camera = new OrthographicCamera();
    frameCamera(camera, width, height);
    expect(
      (camera.right - camera.left) / (camera.top - camera.bottom),
    ).toBeCloseTo(width / height);
    for (const x of [WORLD_BOUNDS.min[0], WORLD_BOUNDS.max[0]])
      for (const y of [WORLD_BOUNDS.min[1], WORLD_BOUNDS.max[1]])
        for (const z of [WORLD_BOUNDS.min[2], WORLD_BOUNDS.max[2]]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(Math.abs(point.y)).toBeLessThan(1);
          expect(Math.abs(point.z)).toBeLessThan(1);
        }
  });
  test('uses a Y-up fixed isometric orientation in the agreed range', () => {
    const camera = new OrthographicCamera();
    frameCamera(camera, 360, 480);
    expect(CAMERA_ELEVATION).toBeGreaterThanOrEqual(30);
    expect(CAMERA_ELEVATION).toBeLessThanOrEqual(45);
    expect(camera.position.x).toBeCloseTo(camera.position.z);
    expect(camera.position.y).toBeGreaterThan(1);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
  });
  test('ignores a collapsed host without corrupting the projection', () => {
    const camera = new OrthographicCamera();
    frameCamera(camera, 360, 480);
    const before = camera.projectionMatrix.clone();
    frameCamera(camera, 0, 0);
    expect(camera.projectionMatrix.equals(before)).toBe(true);
  });
});

describe('classroom framing', () => {
  test('derives its bounds from the shared classroom layout', () => {
    const { bounds } = CLASSROOM_LAYOUT;
    expect(CLASSROOM_BOUNDS.min).toEqual([bounds.minX, 0, bounds.minZ]);
    expect(CLASSROOM_BOUNDS.max).toEqual([
      bounds.maxX,
      CLASSROOM_WALL_HEIGHT,
      bounds.maxZ,
    ]);
  });
  test.each([
    [1280, 560],
    [360, 480],
    [480, 360],
  ])('fits every corner of the room at %sx%s', (width, height) => {
    const camera = new OrthographicCamera();
    frameCamera(camera, width, height, CLASSROOM_BOUNDS);
    for (const x of [CLASSROOM_BOUNDS.min[0], CLASSROOM_BOUNDS.max[0]])
      for (const y of [CLASSROOM_BOUNDS.min[1], CLASSROOM_BOUNDS.max[1]])
        for (const z of [CLASSROOM_BOUNDS.min[2], CLASSROOM_BOUNDS.max[2]]) {
          const point = new Vector3(x, y, z).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(Math.abs(point.y)).toBeLessThan(1);
          expect(Math.abs(point.z)).toBeLessThan(1);
        }
  });
  test('keeps the isometric angles and a distance that contains the room', () => {
    const camera = new OrthographicCamera();
    frameCamera(camera, 360, 480, CLASSROOM_BOUNDS);
    expect(camera.position.x).toBeCloseTo(camera.position.z);
    const target = new Vector3(0, CLASSROOM_WALL_HEIGHT / 2, 0);
    const offset = camera.position.clone().sub(target);
    const elevation = Math.asin(offset.y / offset.length());
    expect((elevation * 180) / Math.PI).toBeCloseTo(CAMERA_ELEVATION);
    expect(camera.far).toBeGreaterThan(offset.length() + 10);
  });
  test('leaves the default framing on the reference bounds', () => {
    const explicit = new OrthographicCamera();
    const implicit = new OrthographicCamera();
    frameCamera(explicit, 360, 480, WORLD_BOUNDS);
    frameCamera(implicit, 360, 480);
    expect(explicit.projectionMatrix.equals(implicit.projectionMatrix)).toBe(
      true,
    );
    expect(explicit.position.equals(implicit.position)).toBe(true);
    expect(implicit.position.y).toBeCloseTo(
      1 + 16 * Math.sin((CAMERA_ELEVATION * Math.PI) / 180),
    );
  });
});

describe('avatar preview framing', () => {
  test.each([
    [224, 280],
    [160, 200],
    [360, 200],
  ])(
    'shows the whole avatar, head to feet, at %sx%s without distortion',
    (width, height) => {
      const camera = new OrthographicCamera();
      frameAvatarCamera(camera, width, height);
      expect(
        (camera.right - camera.left) / (camera.top - camera.bottom),
      ).toBeCloseTo(width / height);
      for (const x of [-AVATAR_FRAME.halfWidth, AVATAR_FRAME.halfWidth])
        for (const y of [AVATAR_FRAME.bottom, AVATAR_FRAME.top]) {
          const point = new Vector3(x, y, 0).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(1);
          expect(Math.abs(point.y)).toBeLessThan(1);
        }
    },
  );
  test('looks at the avatar from the front, upright and centered', () => {
    const camera = new OrthographicCamera();
    frameAvatarCamera(camera, 224, 280);
    expect(camera.position.x).toBeCloseTo(0);
    expect(camera.position.z).toBeGreaterThan(1);
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    const middle = new Vector3(
      0,
      (AVATAR_FRAME.bottom + AVATAR_FRAME.top) / 2,
      0,
    ).project(camera);
    expect(Math.abs(middle.x)).toBeLessThan(0.05);
    expect(Math.abs(middle.y)).toBeLessThan(0.05);
  });
  test('ignores a collapsed host without corrupting the projection', () => {
    const camera = new OrthographicCamera();
    frameAvatarCamera(camera, 224, 280);
    const before = camera.projectionMatrix.clone();
    frameAvatarCamera(camera, 0, 0);
    expect(camera.projectionMatrix.equals(before)).toBe(true);
  });
});

describe('follow camera', () => {
  const sizes = [
    [1280, 720],
    [360, 640],
    [1920, 400],
  ] as const;
  const corners = (bounds: typeof CLASSROOM_BOUNDS) => {
    const out: Vector3[] = [];
    for (const x of [bounds.min[0], bounds.max[0]])
      for (const y of [bounds.min[1], bounds.max[1]])
        for (const z of [bounds.min[2], bounds.max[2]])
          out.push(new Vector3(x, y, z));
    return out;
  };

  test('shows a fixed fraction of the room, with a minimum visible width', () => {
    const wide = followFrustum(1280, 720);
    expect(wide.halfHeight * 2).toBeCloseTo(FOLLOW_VISIBLE_HEIGHT);
    expect(wide.halfWidth / wide.halfHeight).toBeCloseTo(1280 / 720);
    const narrow = followFrustum(360, 640);
    expect(narrow.halfWidth * 2).toBeCloseTo(FOLLOW_MIN_VISIBLE_WIDTH);
    expect(narrow.halfHeight).toBeGreaterThan(wide.halfHeight);
    // Closer than the whole-room framing.
    const whole = new OrthographicCamera();
    frameCamera(whole, 1280, 720, CLASSROOM_BOUNDS);
    expect(wide.halfHeight).toBeLessThan(whole.top * 0.7);
  });

  test('keeps the isometric angles and the projection type while following', () => {
    const camera = new OrthographicCamera();
    applyFollowCamera(camera, 1280, 720, { x: 3, z: -2 });
    const target = new Vector3(3, FOLLOW_TARGET_HEIGHT, -2);
    const offset = camera.position.clone().sub(target);
    expect(offset.x).toBeCloseTo(offset.z);
    expect((Math.asin(offset.y / offset.length()) * 180) / Math.PI).toBeCloseTo(
      CAMERA_ELEVATION,
    );
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    expect(camera.zoom).toBe(1);
    const middle = target.clone().project(camera);
    expect(Math.abs(middle.x)).toBeLessThan(1e-6);
    expect(Math.abs(middle.y)).toBeLessThan(1e-6);
  });

  test('ignores a collapsed host without corrupting the projection', () => {
    const camera = new OrthographicCamera();
    applyFollowCamera(camera, 1280, 720, { x: 0, z: 0 });
    const before = camera.projectionMatrix.clone();
    applyFollowCamera(camera, 0, 0, { x: 4, z: 4 });
    expect(camera.projectionMatrix.equals(before)).toBe(true);
  });

  test('follows the avatar when it is away from every edge', () => {
    const frustum = followFrustum(1280, 720);
    const target = clampFollowTarget({ x: 0.5, z: 0.25 }, frustum);
    expect(target.x).toBeCloseTo(0.5);
    expect(target.z).toBeCloseTo(0.25);
  });

  test.each(sizes)(
    'never shows outside the room at any edge or corner (%sx%s)',
    (width, height) => {
      const frustum = followFrustum(width, height);
      const { bounds } = CLASSROOM_LAYOUT;
      const edges = [
        { x: bounds.minX, z: bounds.minZ },
        { x: bounds.maxX, z: bounds.minZ },
        { x: bounds.minX, z: bounds.maxZ },
        { x: bounds.maxX, z: bounds.maxZ },
        { x: 0, z: bounds.minZ },
        { x: 0, z: bounds.maxZ },
        { x: bounds.minX, z: 0 },
        { x: bounds.maxX, z: 0 },
      ];
      for (const avatar of edges) {
        const camera = new OrthographicCamera();
        const target = clampFollowTarget(avatar, frustum);
        applyFollowCamera(camera, width, height, target);
        const projected = corners(CLASSROOM_BOUNDS).map((p) =>
          p.project(camera),
        );
        const xs = projected.map((p) => p.x);
        const ys = projected.map((p) => p.y);
        // Axes the room fills must have the viewport inside the room's extent.
        const roomWiderThanView = Math.max(...xs) - Math.min(...xs) >= 2;
        const roomTallerThanView = Math.max(...ys) - Math.min(...ys) >= 2;
        if (roomWiderThanView) {
          expect(Math.min(...xs)).toBeLessThanOrEqual(-1 + 1e-6);
          expect(Math.max(...xs)).toBeGreaterThanOrEqual(1 - 1e-6);
        }
        if (roomTallerThanView) {
          expect(Math.min(...ys)).toBeLessThanOrEqual(-1 + 1e-6);
          expect(Math.max(...ys)).toBeGreaterThanOrEqual(1 - 1e-6);
        }
        // The avatar stays on screen even when the camera is clamped.
        const feet = new Vector3(avatar.x, 0, avatar.z).project(camera);
        expect(Math.abs(feet.x)).toBeLessThanOrEqual(1 + 1e-6);
        expect(Math.abs(feet.y)).toBeLessThanOrEqual(1 + 1e-6);
      }
    },
  );

  test('centers on an axis when the viewport is larger than the room', () => {
    const huge = { halfWidth: 40, halfHeight: 40 };
    const a = clampFollowTarget({ x: 7, z: 5 }, huge);
    const b = clampFollowTarget({ x: -7, z: -5 }, huge);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.z).toBeCloseTo(b.z);
    // Centered on the room's view (x equals z: no sideways shift).
    expect(a.x).toBeCloseTo(a.z);
  });

  test('damps toward the target and reports when it has settled', () => {
    let current: FollowStep = { x: 0, z: 0, settled: false };
    const desired = { x: 4, z: -2 };
    const first = advanceFollowTarget(current, desired, 1 / 60, false);
    expect(first.settled).toBe(false);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(4);
    current = first;
    let steps = 0;
    while (!current.settled && steps < 1000) {
      current = advanceFollowTarget(current, desired, 1 / 60, false);
      steps += 1;
    }
    expect(current.settled).toBe(true);
    expect(current.x).toBe(4);
    expect(current.z).toBe(-2);
    expect(steps).toBeGreaterThan(5);
  });

  test('damping is frame-rate independent', () => {
    const desired = { x: 5, z: 0 };
    let slow = { x: 0, z: 0 };
    slow = advanceFollowTarget(slow, desired, 1 / 30, false);
    let fast = { x: 0, z: 0 };
    fast = advanceFollowTarget(fast, desired, 1 / 60, false);
    fast = advanceFollowTarget(fast, desired, 1 / 60, false);
    expect(slow.x).toBeCloseTo(fast.x, 5);
  });

  test('follows instantly, without smoothing, under reduced motion', () => {
    const next = advanceFollowTarget(
      { x: 0, z: 0 },
      { x: 4, z: -2 },
      1 / 60,
      true,
    );
    expect(next).toEqual({ x: 4, z: -2, settled: true });
  });
});
