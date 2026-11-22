import { Group, Mesh } from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
  advanceLocalAvatar,
  animationFor,
  placeAvatar,
} from './local-avatar-frame';

function setup(step: { moving: boolean; hasDestination?: boolean }) {
  const pose = { x: 2, z: -3, rotation: 1.25 };
  const controller = {
    step: vi.fn(() => ({ pose, moving: step.moving, arrived: false })),
    hasDestination: vi.fn(() => step.hasDestination ?? false),
  };
  const avatar = new Group();
  const marker = new Mesh();
  marker.visible = true;
  const invalidate = vi.fn();
  const run = (dt = 1 / 60) =>
    advanceLocalAvatar({ controller, avatar, marker, dt, invalidate });
  return { controller, avatar, marker, invalidate, run, pose };
}

describe('animationFor', () => {
  test('walks while moving and idles otherwise', () => {
    expect(animationFor(true)).toBe('Walk');
    expect(animationFor(false)).toBe('Idle');
  });
});

describe('placeAvatar', () => {
  test('writes the pose on the floor plane and the heading around y', () => {
    const avatar = new Group();
    placeAvatar(avatar, { x: 1, z: 4, rotation: 0.5 });
    expect(avatar.position.toArray()).toEqual([1, 0, 4]);
    expect(avatar.rotation.y).toBe(0.5);
  });
});

describe('advanceLocalAvatar', () => {
  test('steps the controller with the frame delta and writes the pose to the object', () => {
    const { run, controller, avatar } = setup({ moving: true });
    run(0.016);
    expect(controller.step).toHaveBeenCalledWith(0.016);
    expect(avatar.position.toArray()).toEqual([2, 0, -3]);
    expect(avatar.rotation.y).toBe(1.25);
  });

  test('asks for another frame only while moving', () => {
    const moving = setup({ moving: true });
    expect(moving.run()).toBe(true);
    expect(moving.invalidate).toHaveBeenCalledTimes(1);

    const idle = setup({ moving: false });
    expect(idle.run()).toBe(false);
    expect(idle.invalidate).not.toHaveBeenCalled();
  });

  test('shows the marker only while a destination is active', () => {
    const active = setup({ moving: true, hasDestination: true });
    active.run();
    expect(active.marker.visible).toBe(true);

    const done = setup({ moving: false, hasDestination: false });
    done.run();
    expect(done.marker.visible).toBe(false);
  });
});
