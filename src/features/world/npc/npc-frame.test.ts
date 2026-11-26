import { describe, expect, test, vi } from 'vitest';
import { Group } from 'three';
import { advanceNpc, BOT_LEAN_RADIANS } from './npc-frame';

function setup() {
  return {
    group: new Group(),
    current: { x: 0, z: 0, rotation: 0 },
    invalidate: vi.fn(),
  };
}

describe('advanceNpc', () => {
  test('glides toward the synced position and reports it is still moving', () => {
    const { group, current, invalidate } = setup();
    const moving = advanceNpc({
      current,
      target: { x: 1, z: 0, rotation: 0 },
      group,
      dt: 1 / 60,
      invalidate,
      reducedMotion: false,
    });
    expect(moving).toBe(true);
    expect(group.position.x).toBeGreaterThan(0);
    expect(group.position.x).toBeLessThan(1);
    expect(invalidate).toHaveBeenCalled();
  });

  test('turns along the shortest way', () => {
    const { group, current, invalidate } = setup();
    current.rotation = Math.PI - 0.1;
    advanceNpc({
      current,
      target: { x: 0, z: 0, rotation: -Math.PI + 0.1 },
      group,
      dt: 1 / 60,
      invalidate,
      reducedMotion: false,
    });
    expect(current.rotation).toBeGreaterThan(Math.PI - 0.1);
  });

  test('arrives exactly and stops moving', () => {
    const { group, current, invalidate } = setup();
    let moving = true;
    for (let i = 0; i < 240 && moving; i += 1) {
      moving = advanceNpc({
        current,
        target: { x: 0.5, z: 0.5, rotation: 1 },
        group,
        dt: 1 / 60,
        invalidate,
        reducedMotion: false,
      });
    }
    expect(moving).toBe(false);
    expect(group.position.x).toBe(0.5);
    expect(group.position.z).toBe(0.5);
    expect(group.rotation.y).toBe(1);
  });

  test('snaps straight to the target with reduced motion', () => {
    const { group, current, invalidate } = setup();
    const moving = advanceNpc({
      current,
      target: { x: 2, z: -1, rotation: 0.5 },
      group,
      dt: 1 / 60,
      invalidate,
      reducedMotion: true,
    });
    expect(moving).toBe(false);
    expect(group.position.x).toBe(2);
    expect(group.position.z).toBe(-1);
    expect(group.rotation.y).toBe(0.5);
  });

  test('ignores a non-finite target', () => {
    const { group, current, invalidate } = setup();
    expect(
      advanceNpc({
        current,
        target: { x: Number.NaN, z: 0, rotation: 0 },
        group,
        dt: 1 / 60,
        invalidate,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(group.position.x).toBe(0);
  });

  test('exposes a small forward lean for walking', () => {
    expect(BOT_LEAN_RADIANS).toBeGreaterThan(0);
    expect(BOT_LEAN_RADIANS).toBeLessThan(0.3);
  });
});
