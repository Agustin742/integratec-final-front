import { describe, expect, test } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import {
  advanceFollowTarget,
  applyFollowCamera,
  AVATAR_FRAME,
  CAMERA_ELEVATION,
  FOLLOW_EPSILON,
  FOLLOW_MIN_VISIBLE_WIDTH,
  FOLLOW_TARGET_HEIGHT,
  FOLLOW_VISIBLE_HEIGHT,
  followFrustum,
  type FollowStep,
  frameAvatarCamera,
  CLASSROOM_BOUNDS,
  CLASSROOM_WALL_HEIGHT,
  frameCamera,
  MAX_FOLLOW_DT,
  WORLD_BOUNDS,
  framePreviewCamera,
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

  test.each([
    { x: -8, z: -6 },
    { x: 8, z: 6 },
    { x: 8, z: -6 },
    { x: -8, z: 6 },
  ])('centers the avatar on screen at the room edge %j', (avatar) => {
    const camera = new OrthographicCamera();
    applyFollowCamera(camera, 360, 640, avatar);
    const point = new Vector3(avatar.x, FOLLOW_TARGET_HEIGHT, avatar.z).project(
      camera,
    );
    expect(Math.abs(point.x)).toBeLessThan(1e-6);
    expect(Math.abs(point.y)).toBeLessThan(1e-6);
  });

  test('ignores a collapsed host without corrupting the projection', () => {
    const camera = new OrthographicCamera();
    applyFollowCamera(camera, 1280, 720, { x: 0, z: 0 });
    const before = camera.projectionMatrix.clone();
    applyFollowCamera(camera, 0, 0, { x: 4, z: 4 });
    expect(camera.projectionMatrix.equals(before)).toBe(true);
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

  test.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'ignores non-positive or non-finite dt (%s) without corrupting coordinates',
    (dt) => {
      const unsettled = advanceFollowTarget(
        { x: 1, z: -1 },
        { x: 4, z: -2 },
        dt,
        false,
      );
      expect(unsettled).toEqual({ x: 1, z: -1, settled: false });

      const settled = advanceFollowTarget(
        { x: 4, z: -2 + FOLLOW_EPSILON * 0.5 },
        { x: 4, z: -2 },
        dt,
        false,
      );
      expect(settled).toEqual({
        x: 4,
        z: -2 + FOLLOW_EPSILON * 0.5,
        settled: true,
      });
    },
  );

  test('clamps large frame deltas to MAX_FOLLOW_DT', () => {
    const clamped = advanceFollowTarget(
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      5,
      false,
    );
    const exact = advanceFollowTarget(
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      MAX_FOLLOW_DT,
      false,
    );
    expect(clamped).toEqual(exact);
  });

  test.each([
    [0, 720],
    [1280, 0],
    [-10, 720],
    [Number.NaN, 720],
  ])(
    'returns a finite fallback frustum when viewport (%s, %s) is invalid',
    (width, height) => {
      const frustum = followFrustum(width, height);
      expect(Number.isFinite(frustum.halfWidth)).toBe(true);
      expect(Number.isFinite(frustum.halfHeight)).toBe(true);
      expect(frustum.halfWidth).toBeGreaterThan(0);
      expect(frustum.halfHeight).toBeGreaterThan(0);
    },
  );
});

describe('framePreviewCamera', () => {
  test('looks at the scene from the front, only slightly from above', () => {
    const camera = new OrthographicCamera();
    framePreviewCamera(camera, 640, 360);
    const direction = camera.getWorldDirection(new Vector3());

    expect(camera.position.x).toBe(0);
    expect(camera.position.z).toBeGreaterThan(0);
    expect(direction.z).toBeLessThan(-0.95);
    expect(direction.y).toBeLessThan(0);
  });

  test.each([
    [640, 360],
    [320, 240],
    [1200, 400],
  ])('fits the character and its sides in %ix%i', (width, height) => {
    const camera = new OrthographicCamera();
    framePreviewCamera(camera, width, height);

    for (const point of [
      new Vector3(-2.4, 0, 0),
      new Vector3(2.4, 0, 0),
      new Vector3(0, 2.3, 0),
      new Vector3(0, -0.2, 0),
    ]) {
      const projected = point.project(camera);
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(1);
    }
  });
});
