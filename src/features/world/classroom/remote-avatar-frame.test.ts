import { Group } from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
  advanceRemoteAvatar,
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
});
