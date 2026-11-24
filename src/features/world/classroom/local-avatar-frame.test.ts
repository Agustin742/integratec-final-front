import { Group, Mesh } from 'three';
import { describe, expect, test, vi } from 'vitest';
import {
  advanceLocalAvatar,
  animationFor,
  placeAvatar,
  resolveClip,
} from './local-avatar-frame';

function setup(step: {
  moving: boolean;
  hasDestination?: boolean;
  settled?: boolean;
}) {
  const pose = { x: 2, z: -3, rotation: 1.25 };
  const controller = {
    step: vi.fn(() => ({ pose, moving: step.moving, arrived: false })),
    hasDestination: vi.fn(() => step.hasDestination ?? false),
  };
  const avatar = new Group();
  // A settled avatar already shows the authoritative heading.
  if (step.settled ?? true) avatar.rotation.y = pose.rotation;
  const marker = new Mesh();
  marker.visible = true;
  const invalidate = vi.fn();
  const run = (dt = 1 / 60, reducedMotion = false) =>
    advanceLocalAvatar({
      controller,
      avatar,
      marker,
      dt,
      invalidate,
      reducedMotion,
    });
  return { controller, avatar, marker, invalidate, run, pose };
}

describe('animationFor', () => {
  test('runs while moving and idles otherwise', () => {
    expect(animationFor(true)).toBe('Run');
    expect(animationFor(false)).toBe('Idle');
  });
});

describe('resolveClip', () => {
  test('uses the requested clip when the body has it', () => {
    expect(resolveClip('Run', ['Idle', 'Walk', 'Run'])).toBe('Run');
  });

  test('falls back Run -> Walk -> Idle', () => {
    expect(resolveClip('Run', ['Idle', 'Walk'])).toBe('Walk');
    expect(resolveClip('Run', ['Idle'])).toBe('Idle');
    expect(resolveClip('Walk', ['Idle'])).toBe('Idle');
  });

  test('is null when nothing usable exists', () => {
    expect(resolveClip('Run', [])).toBeNull();
    expect(resolveClip('Idle', ['Walk'])).toBeNull();
    expect(resolveClip(undefined, ['Idle'])).toBeNull();
  });

  test('keeps unknown clip names exact', () => {
    expect(resolveClip('Wave', ['Wave', 'Idle'])).toBe('Wave');
    expect(resolveClip('Wave', ['Idle'])).toBeNull();
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
  });

  test('turns toward the authoritative heading instead of snapping', () => {
    const { run, avatar, pose } = setup({ moving: true, settled: false });
    run(1 / 60);
    expect(avatar.rotation.y).toBeGreaterThan(0);
    expect(avatar.rotation.y).toBeLessThan(pose.rotation);
    for (let frame = 0; frame < 120; frame += 1) run(1 / 60);
    expect(avatar.rotation.y).toBeCloseTo(pose.rotation, 3);
    // The authoritative pose sent to the server is never touched.
    expect(pose.rotation).toBe(1.25);
  });

  test('snaps the heading under reduced motion', () => {
    const { run, avatar } = setup({ moving: true, settled: false });
    run(1 / 60, true);
    expect(avatar.rotation.y).toBe(1.25);
  });

  test('keeps asking for frames while a turn is in progress, even when stopped', () => {
    const { run, invalidate, avatar, pose } = setup({
      moving: false,
      settled: false,
    });
    run(1 / 60);
    expect(invalidate).toHaveBeenCalled();
    for (let frame = 0; frame < 300; frame += 1) run(1 / 60);
    expect(avatar.rotation.y).toBe(pose.rotation);
    invalidate.mockClear();
    run(1 / 60);
    expect(invalidate).not.toHaveBeenCalled();
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
