import { describe, expect, test } from 'vitest';
import type { ClassroomInteractable } from './classroom-interactables';
import {
  PROXIMITY_ENTER_RADIUS,
  PROXIMITY_EXIT_RADIUS,
  distanceToFootprint,
  selectProximityTarget,
} from './proximity';

function item(
  id: string,
  x: number,
  z: number,
  footprint: readonly [number, number] = [1, 1],
): ClassroomInteractable {
  return {
    id,
    type: 'shop',
    interactionClass: 'opens_panel',
    panelKey: 'shop',
    worldPosition: [x, 0, z],
    footprint,
    beaconHeight: 1,
  };
}

describe('distanceToFootprint', () => {
  test('is zero inside the footprint and measured to its edge outside', () => {
    const shop = item('a', 0, 0, [2, 1]);
    expect(distanceToFootprint({ x: 0.5, z: 0.2 }, shop)).toBe(0);
    expect(distanceToFootprint({ x: 3, z: 0 }, shop)).toBeCloseTo(2);
    expect(distanceToFootprint({ x: 2, z: 1.5 }, shop)).toBeCloseTo(
      Math.hypot(1, 1),
    );
  });
});

describe('selectProximityTarget', () => {
  test('has no target without an avatar position', () => {
    expect(
      selectProximityTarget({
        position: undefined,
        candidates: [item('a', 0, 0)],
      }),
    ).toBeUndefined();
  });

  test('has no target when nothing is within the enter radius', () => {
    const far = item('a', PROXIMITY_ENTER_RADIUS + 3, 0);
    expect(
      selectProximityTarget({ position: { x: 0, z: 0 }, candidates: [far] }),
    ).toBeUndefined();
  });

  test('nearest candidate wins', () => {
    const near = item('near', 1, 0);
    const nearer = item('nearer', 0, 0.2);
    expect(
      selectProximityTarget({
        position: { x: 0, z: 0 },
        candidates: [near, nearer],
      }),
    ).toBe('nearer');
  });

  test('ties are stable: the first candidate wins', () => {
    const a = item('a', 1, 0);
    const b = item('b', -1, 0);
    const pick = (candidates: ClassroomInteractable[]) =>
      selectProximityTarget({ position: { x: 0, z: 0 }, candidates });
    expect(pick([a, b])).toBe('a');
    expect(pick([b, a])).toBe('b');
  });

  test('a tie keeps the current target', () => {
    const a = item('a', 1, 0);
    const b = item('b', -1, 0);
    expect(
      selectProximityTarget({
        position: { x: 0, z: 0 },
        candidates: [a, b],
        currentId: 'b',
      }),
    ).toBe('b');
  });

  test('a candidate only slightly nearer does not steal the target', () => {
    const current = item('current', 1, 0);
    const slightly = item('slightly', -0.95, 0);
    expect(
      selectProximityTarget({
        position: { x: 0, z: 0 },
        candidates: [current, slightly],
        currentId: 'current',
      }),
    ).toBe('current');
  });

  test('candidates that are unavailable are not passed in and never selected', () => {
    // Availability is applied by the caller filtering the candidate list.
    expect(
      selectProximityTarget({ position: { x: 0, z: 0 }, candidates: [] }),
    ).toBeUndefined();
  });

  test('hysteresis: enters inside the enter radius, stays until the exit radius', () => {
    const shop = item('shop', 0, 0, [1, 1]);
    const at = (distance: number, currentId?: string) =>
      selectProximityTarget({
        position: { x: 0.5 + distance, z: 0 },
        candidates: [shop],
        currentId,
      });

    const between = (PROXIMITY_ENTER_RADIUS + PROXIMITY_EXIT_RADIUS) / 2;
    expect(PROXIMITY_ENTER_RADIUS).toBeLessThan(PROXIMITY_EXIT_RADIUS);
    expect(at(PROXIMITY_ENTER_RADIUS - 0.05)).toBe('shop');
    expect(at(between)).toBeUndefined();
    expect(at(between, 'shop')).toBe('shop');
    expect(at(PROXIMITY_EXIT_RADIUS + 0.05, 'shop')).toBeUndefined();
  });

  test('a current target that is no longer a candidate is dropped', () => {
    expect(
      selectProximityTarget({
        position: { x: 0, z: 0 },
        candidates: [item('b', 0, 0)],
        currentId: 'gone',
      }),
    ).toBe('b');
  });

  test('a non-finite position yields no target', () => {
    expect(
      selectProximityTarget({
        position: { x: Number.NaN, z: 0 },
        candidates: [item('a', 0, 0)],
      }),
    ).toBeUndefined();
  });
});
