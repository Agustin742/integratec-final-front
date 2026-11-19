import { describe, expect, test } from 'vitest';
import {
  AVATAR_SPEED_UNITS_PER_SECOND,
  CLASSROOM_LAYOUT,
  type ClassroomLayout,
} from '@/realtime';
import { INPUT_DEADZONE, isWalkable, stepAvatar, type Pose } from './index';

const layout = CLASSROOM_LAYOUT;
const r = layout.avatarRadius;
const start = (x: number, z: number): Pose => ({ x, z, rotation: 0 });

describe('isWalkable', () => {
  test('accepts the open floor and every spawn point', () => {
    expect(isWalkable(layout, 0, 0)).toBe(true);
    for (const spawn of layout.spawnPoints)
      expect(isWalkable(layout, spawn.x, spawn.z)).toBe(true);
  });

  test('allows the wall margin exactly at the avatar radius and no closer', () => {
    expect(isWalkable(layout, layout.bounds.maxX - r, 0)).toBe(true);
    expect(isWalkable(layout, layout.bounds.maxX - r + 0.01, 0)).toBe(false);
    expect(isWalkable(layout, 0, layout.bounds.minZ + r - 0.01)).toBe(false);
  });

  test('rejects points inside an obstacle inflated by the avatar radius', () => {
    const desk = layout.obstacles[0]!;
    const cx = (desk.minX + desk.maxX) / 2;
    expect(isWalkable(layout, cx, (desk.minZ + desk.maxZ) / 2)).toBe(false);
    expect(isWalkable(layout, cx, desk.maxZ + r - 0.01)).toBe(false);
    expect(isWalkable(layout, cx, desk.maxZ + r)).toBe(true);
  });
});

describe('stepAvatar', () => {
  test('moves at the fixed speed regardless of the input length', () => {
    const short = stepAvatar(layout, start(0, 0), { x: 0.1, z: 0 }, 0.1);
    const long = stepAvatar(layout, start(0, 0), { x: 50, z: 0 }, 0.1);
    expect(short.x).toBeCloseTo(AVATAR_SPEED_UNITS_PER_SECOND * 0.1);
    expect(long.x).toBeCloseTo(short.x);
  });

  test('moves diagonally at the same speed as on an axis', () => {
    const next = stepAvatar(layout, start(0, 0), { x: 1, z: 1 }, 0.1);
    expect(Math.hypot(next.x, next.z)).toBeCloseTo(
      AVATAR_SPEED_UNITS_PER_SECOND * 0.1,
    );
  });

  test('sets the rotation to atan2(x, z) of the input', () => {
    expect(
      stepAvatar(layout, start(0, 0), { x: 1, z: 0 }, 0.05).rotation,
    ).toBeCloseTo(Math.PI / 2);
    expect(
      stepAvatar(layout, start(0, 0), { x: 0, z: -1 }, 0.05).rotation,
    ).toBeCloseTo(Math.PI);
  });

  test('ignores input under the deadzone and keeps the pose', () => {
    const pose = { x: 1, z: 1, rotation: 0.7 };
    const tiny = INPUT_DEADZONE / 2;
    expect(stepAvatar(layout, pose, { x: tiny, z: 0 }, 0.1)).toBe(pose);
    expect(stepAvatar(layout, pose, { x: 0, z: 0 }, 0.1)).toBe(pose);
  });

  test.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns the same pose for an invalid dt (%s)',
    (dt) => {
      const pose = start(1, 1);
      expect(stepAvatar(layout, pose, { x: 1, z: 0 }, dt)).toBe(pose);
    },
  );

  test('returns the same pose for a non-finite input', () => {
    const pose = start(1, 1);
    expect(stepAvatar(layout, pose, { x: Number.NaN, z: 1 }, 0.1)).toBe(pose);
  });

  test('clamps to the walls', () => {
    const next = stepAvatar(layout, start(7.6, 0), { x: 1, z: 0 }, 1);
    expect(next.x).toBeCloseTo(layout.bounds.maxX - r);
    const back = stepAvatar(layout, start(0, -5.6), { x: 0, z: -1 }, 1);
    expect(back.z).toBeCloseTo(layout.bounds.minZ + r);
  });

  test('stops at an obstacle and slides along it', () => {
    const desk = layout.obstacles[0]!;
    const cx = (desk.minX + desk.maxX) / 2;
    const zNearDesk = desk.maxZ + r + 0.05;
    const next = stepAvatar(
      layout,
      start(cx - 1, zNearDesk),
      { x: 1, z: -1 },
      1,
    );
    expect(isWalkable(layout, next.x, next.z)).toBe(true);
    expect(next.z).toBeGreaterThanOrEqual(desk.maxZ + r - 1e-9);
    expect(next.x).toBeGreaterThan(cx - 1);
  });

  test('cannot tunnel through an obstacle with a huge dt', () => {
    const desk = layout.obstacles[0]!;
    const cx = (desk.minX + desk.maxX) / 2;
    const next = stepAvatar(
      layout,
      start(cx, desk.maxZ + r + 0.1),
      { x: 0, z: -1 },
      5,
    );
    expect(next.z).toBeGreaterThanOrEqual(desk.maxZ + r - 1e-9);
  });

  test('every stepped position stays walkable under pseudo-random input', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    let pose = start(0, 5);
    for (let i = 0; i < 3000; i++) {
      const angle = random() * Math.PI * 2;
      const dt = 0.005 + random() * 0.12;
      pose = stepAvatar(
        layout,
        pose,
        { x: Math.sin(angle), z: Math.cos(angle) },
        dt,
      );
      expect(isWalkable(layout, pose.x, pose.z)).toBe(true);
    }
  });

  test('works with a custom layout', () => {
    const small: ClassroomLayout = {
      bounds: { minX: 0, maxX: 2, minZ: 0, maxZ: 2 },
      avatarRadius: 0.5,
      obstacles: [],
      spawnPoints: [{ x: 1, z: 1 }],
    };
    expect(stepAvatar(small, start(1, 1), { x: 1, z: 0 }, 10).x).toBeCloseTo(
      1.5,
    );
  });
});
