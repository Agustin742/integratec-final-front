import { describe, expect, test } from 'vitest';
import {
  TURN_RATE,
  dampYaw,
  normalizeYaw,
  shortestAngleDelta,
} from './avatar-yaw';

const deg = (value: number) => (value * Math.PI) / 180;

describe('normalizeYaw', () => {
  test('keeps angles inside [-pi, pi]', () => {
    expect(normalizeYaw(0)).toBe(0);
    expect(normalizeYaw(deg(190))).toBeCloseTo(deg(-170), 10);
    expect(normalizeYaw(deg(-190))).toBeCloseTo(deg(170), 10);
    expect(normalizeYaw(deg(720 + 30))).toBeCloseTo(deg(30), 10);
  });

  test('falls back to 0 for non-finite input', () => {
    expect(normalizeYaw(Number.NaN)).toBe(0);
  });
});

describe('dampYaw', () => {
  test('turns the short way across the +-pi seam', () => {
    const next = dampYaw(deg(170), deg(-170), 1 / 60);
    // 170 -> -170 is a 20 degree turn through 180, never 340 the long way.
    expect(shortestAngleDelta(deg(170), next)).toBeGreaterThan(0);
    expect(shortestAngleDelta(deg(170), next)).toBeLessThan(deg(20));
  });

  test('is frame-rate independent', () => {
    const target = 1.2;
    const oneStep = dampYaw(0, target, 1 / 30);
    const twoSteps = dampYaw(dampYaw(0, target, 1 / 60), target, 1 / 60);
    expect(twoSteps).toBeCloseTo(oneStep, 10);
  });

  test('converges on the target and never overshoots', () => {
    let yaw = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      const next = dampYaw(yaw, 2, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(yaw);
      expect(next).toBeLessThanOrEqual(2);
      yaw = next;
    }
    expect(yaw).toBeCloseTo(2, 3);
  });

  test('stays normalized however long it runs', () => {
    let yaw = 0;
    for (let frame = 0; frame < 2000; frame += 1) {
      yaw = dampYaw(yaw, frame % 2 === 0 ? 3 : -3, 1 / 60);
      expect(Math.abs(yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  test('ignores a stalled frame longer than the clamp and bad input', () => {
    expect(dampYaw(0, 1, 5)).toBeCloseTo(dampYaw(0, 1, 0.1), 10);
    expect(dampYaw(0.4, 1, 0)).toBe(0.4);
    expect(dampYaw(0.4, 1, Number.NaN)).toBe(0.4);
    expect(dampYaw(0.4, Number.NaN, 1 / 60)).toBe(0.4);
  });

  test('uses a quick but visible turn rate', () => {
    expect(TURN_RATE).toBeGreaterThanOrEqual(12);
    expect(TURN_RATE).toBeLessThanOrEqual(15);
  });

  test('hides a diagonal flicker between two headings', () => {
    let yaw = Math.PI / 4;
    let min = Infinity;
    let max = -Infinity;
    for (let frame = 0; frame < 120; frame += 1) {
      const target = frame % 2 === 0 ? Math.PI / 4 : -Math.PI / 4;
      yaw = dampYaw(yaw, target, 1 / 60);
      if (frame > 30) {
        min = Math.min(min, yaw);
        max = Math.max(max, yaw);
      }
    }
    // Raw input swings by pi/2 per frame; the displayed heading barely moves.
    expect(max - min).toBeLessThan(0.2);
  });
});
