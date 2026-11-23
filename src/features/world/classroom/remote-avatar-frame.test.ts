import { Group } from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
  advanceRemoteAvatar,
  MAX_REMOTE_DT,
  REMOTE_ANGLE_EPSILON,
  REMOTE_ARRIVE_EPSILON,
  REMOTE_TELEPORT_DISTANCE,
  shortestAngleDelta,
} from './remote-avatar-frame';

describe('remote-avatar-frame', () => {
  test('shortestAngleDelta wraps cleanly across +-pi', () => {
    const delta = shortestAngleDelta(Math.PI - 0.1, -Math.PI + 0.1);
    expect(delta).toBeCloseTo(0.2, 6);

    const reverse = shortestAngleDelta(-Math.PI + 0.1, Math.PI - 0.1);
    expect(reverse).toBeCloseTo(-0.2, 6);
  });

  test('interpolates smoothly across frames and stops invalidating once settled', () => {
    const current = { x: 0, z: 0, rotation: Math.PI - 0.1 };
    const target = { x: 1.5, z: -1, rotation: -Math.PI + 0.1 };
    const avatar = new Group();
    const invalidate = vi.fn();

    const firstMoving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(firstMoving).toBe(true);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(avatar.position.x).toBeGreaterThan(0);
    expect(avatar.position.x).toBeLessThan(1.5);
    expect(avatar.position.z).toBeLessThan(0);
    expect(avatar.position.z).toBeGreaterThan(-1);

    // Advance enough ticks to converge completely.
    for (let i = 0; i < 40; i += 1) {
      advanceRemoteAvatar({ current, target, avatar, dt: 0.05, invalidate });
    }
    expect(current.x).toBeCloseTo(1.5, 4);
    expect(current.z).toBeCloseTo(-1, 4);
    expect(
      Math.abs(shortestAngleDelta(current.rotation, target.rotation)),
    ).toBeLessThanOrEqual(0.01);

    invalidate.mockClear();
    const settledMoving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(settledMoving).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });

  test('does not walk when only within arrival epsilon', () => {
    const current = { x: 1, z: 2, rotation: 0 };
    const target = {
      x: 1 + REMOTE_ARRIVE_EPSILON / 2,
      z: 2,
      rotation: 0.002,
    };
    const avatar = new Group();
    const invalidate = vi.fn();

    const moving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(moving).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    expect(avatar.position.x).toBe(target.x);
    expect(avatar.position.z).toBe(target.z);
  });

  test('snaps immediately without walking when jump exceeds teleport threshold', () => {
    const current = { x: -6, z: 5, rotation: 0 };
    const target = {
      x: -6 + REMOTE_TELEPORT_DISTANCE + 1,
      z: 5,
      rotation: 1.2,
    };
    const avatar = new Group();
    const invalidate = vi.fn();

    const moving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(moving).toBe(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(avatar.position.x).toBe(target.x);
    expect(avatar.position.z).toBe(target.z);
    expect(avatar.rotation.y).toBe(target.rotation);
  });

  test('ignores NaN and Infinity targets without mutating current or invalidating', () => {
    const avatar = new Group();
    const invalidate = vi.fn();

    for (const badTarget of [
      { x: Number.NaN, z: 1, rotation: 0 },
      { x: 1, z: Number.POSITIVE_INFINITY, rotation: 0 },
      { x: 1, z: 1, rotation: Number.NEGATIVE_INFINITY },
    ]) {
      const current = { x: 2, z: 3, rotation: 0.5 };
      const moving = advanceRemoteAvatar({
        current,
        target: badTarget,
        avatar,
        dt: 0.05,
        invalidate,
      });
      expect(moving).toBe(false);
      expect(current).toEqual({ x: 2, z: 3, rotation: 0.5 });
      expect(invalidate).not.toHaveBeenCalled();
    }
  });

  test('sanitizes non-finite current pose to target before interpolating', () => {
    const current = { x: Number.NaN, z: Number.POSITIVE_INFINITY, rotation: 0 };
    const target = { x: 1.5, z: -2, rotation: 0.8 };
    const avatar = new Group();
    const invalidate = vi.fn();

    const moving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(moving).toBe(false);
    expect(current).toEqual(target);
    expect(avatar.position.x).toBe(target.x);
    expect(avatar.position.z).toBe(target.z);
    expect(avatar.rotation.y).toBe(target.rotation);
    expect(invalidate).not.toHaveBeenCalled();
  });

  test('returns false without invalidating when dt is non-finite', () => {
    const avatar = new Group();
    const invalidate = vi.fn();

    for (const badDt of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const current = { x: 0, z: 0, rotation: 0 };
      const target = { x: 1, z: 0, rotation: 0 };
      const moving = advanceRemoteAvatar({
        current,
        target,
        avatar,
        dt: badDt,
        invalidate,
      });
      expect(moving).toBe(false);
      expect(current).toEqual({ x: 0, z: 0, rotation: 0 });
      expect(invalidate).not.toHaveBeenCalled();
    }
  });

  test('clamps dt <= 0 to zero without advancing pose', () => {
    const current = { x: 0, z: 0, rotation: 0 };
    const target = { x: 1, z: 0, rotation: 0 };
    const avatar = new Group();
    const invalidate = vi.fn();

    const movingZero = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0,
      invalidate,
    });
    expect(movingZero).toBe(true);
    expect(current).toEqual({ x: 0, z: 0, rotation: 0 });
    expect(invalidate).toHaveBeenCalledTimes(1);

    invalidate.mockClear();
    const movingNeg = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: -0.2,
      invalidate,
    });
    expect(movingNeg).toBe(true);
    expect(current).toEqual({ x: 0, z: 0, rotation: 0 });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  test('clamps oversized dt spikes to MAX_REMOTE_DT', () => {
    const target = { x: 2, z: 0, rotation: 1 };
    const spikedCurrent = { x: 0, z: 0, rotation: 0 };
    const clampedCurrent = { x: 0, z: 0, rotation: 0 };

    advanceRemoteAvatar({
      current: spikedCurrent,
      target,
      avatar: new Group(),
      dt: 5,
      invalidate: vi.fn(),
    });
    advanceRemoteAvatar({
      current: clampedCurrent,
      target,
      avatar: new Group(),
      dt: MAX_REMOTE_DT,
      invalidate: vi.fn(),
    });

    expect(spikedCurrent.x).toBeCloseTo(clampedCurrent.x, 10);
    expect(spikedCurrent.z).toBeCloseTo(clampedCurrent.z, 10);
    expect(spikedCurrent.rotation).toBeCloseTo(clampedCurrent.rotation, 10);
  });

  test('returns moving=false for pure in-place rotation while still invalidating until aligned', () => {
    const current = { x: 2, z: 3, rotation: 0 };
    const target = { x: 2, z: 3, rotation: Math.PI / 2 };
    const avatar = new Group();
    const invalidate = vi.fn();

    const moving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(moving).toBe(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(avatar.rotation.y).toBeGreaterThan(0);
    expect(avatar.rotation.y).toBeLessThan(Math.PI / 2);
  });

  test('snaps and stops without an extra invalidate on the exact arrival frame', () => {
    const current = {
      x: 1 - REMOTE_ARRIVE_EPSILON * 1.5,
      z: 0,
      rotation: -REMOTE_ANGLE_EPSILON * 1.2,
    };
    const target = { x: 1, z: 0, rotation: 0 };
    const avatar = new Group();
    const invalidate = vi.fn();

    const moving = advanceRemoteAvatar({
      current,
      target,
      avatar,
      dt: 0.05,
      invalidate,
    });
    expect(moving).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
    expect(current).toEqual(target);
    expect(avatar.position.x).toBe(target.x);
    expect(avatar.position.z).toBe(target.z);
    expect(avatar.rotation.y).toBe(target.rotation);
  });
});
