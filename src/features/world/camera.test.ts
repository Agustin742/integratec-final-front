import { describe, expect, test } from 'vitest';
import { OrthographicCamera, Vector3 } from 'three';
import {
  AVATAR_FRAME,
  CAMERA_ELEVATION,
  frameAvatarCamera,
  frameCamera,
  WORLD_BOUNDS,
} from './camera';

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
