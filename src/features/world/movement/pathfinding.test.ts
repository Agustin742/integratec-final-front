import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT, type ClassroomLayout } from '@/realtime';
import { directionToward, findPath, isWalkable, stepAvatar } from './index';

const layout = CLASSROOM_LAYOUT;

interface Point {
  x: number;
  z: number;
}

/** Samples the straight segment and reports whether it stays walkable. */
const segmentWalkable = (a: Point, b: Point) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.02));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!isWalkable(layout, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))
      return false;
  }
  return true;
};

const expectWalkablePath = (from: Point, path: Point[]) => {
  let prev = from;
  for (const p of path) {
    expect(segmentWalkable(prev, p)).toBe(true);
    prev = p;
  }
};

describe('findPath', () => {
  test('returns a single straight waypoint when the way is clear', () => {
    expect(findPath(layout, { x: 0, z: 5 }, { x: 4, z: 5 })).toEqual([
      { x: 4, z: 5 },
    ]);
  });

  test('ends exactly at the target', () => {
    const to = { x: 3.37, z: -3.11 };
    const path = findPath(layout, { x: -6, z: 5 }, to);
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual(to);
  });

  test('routes around a student desk without crossing it', () => {
    // Desk at x -4.5, z 0.4 (half 0.8 x 0.4): start south of it, target north of it.
    const from = { x: -4.5, z: 1.5 };
    const to = { x: -4.5, z: -0.7 };
    expect(segmentWalkable(from, to)).toBe(false);
    const path = findPath(layout, from, to)!;
    expect(path.length).toBeGreaterThan(1);
    expectWalkablePath(from, path);
  });

  test('returns null when the target is not walkable', () => {
    const desk = layout.obstacles[1]!;
    const inside = {
      x: (desk.minX + desk.maxX) / 2,
      z: (desk.minZ + desk.maxZ) / 2,
    };
    expect(findPath(layout, { x: 0, z: 5 }, inside)).toBeNull();
    expect(findPath(layout, { x: 0, z: 5 }, { x: 100, z: 0 })).toBeNull();
    expect(
      findPath(layout, { x: 0, z: 5 }, { x: Number.NaN, z: 0 }),
    ).toBeNull();
  });

  test('returns null when the target is enclosed', () => {
    const ring: ClassroomLayout = {
      bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
      avatarRadius: 0.3,
      obstacles: [
        { minX: 3, maxX: 3.5, minZ: 3, maxZ: 7 },
        { minX: 6.5, maxX: 7, minZ: 3, maxZ: 7 },
        { minX: 3, maxX: 7, minZ: 3, maxZ: 3.5 },
        { minX: 3, maxX: 7, minZ: 6.5, maxZ: 7 },
      ],
      spawnPoints: [{ x: 1, z: 1 }],
    };
    expect(isWalkable(ring, 5, 5)).toBe(true);
    expect(findPath(ring, { x: 1, z: 1 }, { x: 5, z: 5 })).toBeNull();
    expect(findPath(ring, { x: 1, z: 1 }, { x: 9, z: 9 })).not.toBeNull();
  });

  test('starts from the nearest walkable cell when the origin is not walkable', () => {
    const desk = layout.obstacles[1]!;
    const inside = {
      x: (desk.minX + desk.maxX) / 2,
      z: (desk.minZ + desk.maxZ) / 2,
    };
    const path = findPath(layout, inside, { x: 0, z: 5 });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 0, z: 5 });
  });

  test('keeps every waypoint segment walkable across many targets', () => {
    const from = { x: 0, z: 5 };
    for (const x of [-7, -3, 0, 3, 7])
      for (const z of [-5.5, -3, -0.7, 1.5, 4]) {
        const path = findPath(layout, from, { x, z });
        if (!isWalkable(layout, x, z)) {
          expect(path).toBeNull();
          continue;
        }
        expect(path).not.toBeNull();
        expectWalkablePath(from, path!);
      }
  });

  test('honours a custom cell size', () => {
    const path = findPath(
      layout,
      { x: -6, z: 5 },
      { x: 6, z: -5.5 },
      { cellSize: 0.5 },
    );
    expect(path).not.toBeNull();
  });
});

describe('directionToward', () => {
  test('points at the first waypoint with unit length', () => {
    const result = directionToward({ x: 0, z: 0 }, [{ x: 3, z: 4 }], 0.1);
    expect(result.arrived).toBe(false);
    expect(result.direction.x).toBeCloseTo(0.6);
    expect(result.direction.z).toBeCloseTo(0.8);
    expect(result.remaining).toEqual([{ x: 3, z: 4 }]);
  });

  test('advances past reached intermediate waypoints without arriving', () => {
    const result = directionToward(
      { x: 1, z: 0 },
      [
        { x: 1.05, z: 0 },
        { x: 1, z: 3 },
      ],
      0.1,
    );
    expect(result.arrived).toBe(false);
    expect(result.remaining).toEqual([{ x: 1, z: 3 }]);
    expect(result.direction).toEqual({ x: 0, z: 1 });
  });

  test('arrives only when the final waypoint is within the radius', () => {
    const final = { x: 2, z: 2 };
    expect(directionToward({ x: 2.2, z: 2 }, [final], 0.1).arrived).toBe(false);
    const done = directionToward({ x: 2.05, z: 2 }, [final], 0.1);
    expect(done.arrived).toBe(true);
    expect(done.direction).toEqual({ x: 0, z: 0 });
    expect(done.remaining).toEqual([]);
  });

  test('an empty path counts as arrived with no direction', () => {
    expect(directionToward({ x: 0, z: 0 }, [], 0.1)).toEqual({
      direction: { x: 0, z: 0 },
      remaining: [],
      arrived: true,
    });
  });

  test('walking a planned path with stepAvatar arrives at the target, never early', () => {
    const to = { x: 4.5, z: -0.9 };
    let pose = { x: -4.5, z: 5, rotation: 0 };
    let remaining = findPath(layout, pose, to)!;
    expect(remaining).not.toBeNull();
    const radius = 0.08;
    let arrivedAt = -1;
    for (let frame = 0; frame < 2000; frame++) {
      const result = directionToward(pose, remaining, radius);
      remaining = result.remaining;
      if (result.arrived) {
        arrivedAt = frame;
        break;
      }
      pose = stepAvatar(layout, pose, result.direction, 1 / 60);
    }
    expect(arrivedAt).toBeGreaterThan(0);
    expect(Math.hypot(pose.x - to.x, pose.z - to.z)).toBeLessThanOrEqual(
      radius,
    );
  });
});
