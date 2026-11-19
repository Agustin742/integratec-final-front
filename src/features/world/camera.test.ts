import { describe, expect, test } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import {
  AVATAR_FRAME,
  CAMERA_ELEVATION,
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
