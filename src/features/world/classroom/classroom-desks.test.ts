import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  DESK_HEIGHT,
  TEACHER_DESK_INDEX,
  deriveDesks,
} from './classroom-desks';

describe('deriveDesks', () => {
  const desks = deriveDesks(CLASSROOM_LAYOUT);

  test('yields one desk per layout obstacle, in obstacle order', () => {
    expect(desks).toHaveLength(CLASSROOM_LAYOUT.obstacles.length);
    desks.forEach((desk, index) => expect(desk.index).toBe(index));
  });

  test('footprints equal the obstacle boxes exactly', () => {
    desks.forEach((desk, index) => {
      const box = CLASSROOM_LAYOUT.obstacles[index]!;
      expect(desk.centerX - desk.width / 2).toBeCloseTo(box.minX);
      expect(desk.centerX + desk.width / 2).toBeCloseTo(box.maxX);
      expect(desk.centerZ - desk.depth / 2).toBeCloseTo(box.minZ);
      expect(desk.centerZ + desk.depth / 2).toBeCloseTo(box.maxZ);
    });
  });

  test('the first obstacle is the teacher desk and the rest are student desks', () => {
    expect(TEACHER_DESK_INDEX).toBe(0);
    expect(desks[0]!.kind).toBe('teacher');
    expect(desks.slice(1).every((desk) => desk.kind === 'student')).toBe(true);
  });

  test('uses a realistic desk height', () => {
    expect(DESK_HEIGHT).toBeCloseTo(0.75);
  });
});
