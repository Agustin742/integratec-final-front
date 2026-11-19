import { describe, expect, test, vi } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  ARRIVE_RADIUS,
  LocalAvatarController,
  MAX_FRAME_SECONDS,
} from './local-avatar-controller';
import { isWalkable, type Pose } from './index';

const layout = CLASSROOM_LAYOUT;
const spawn: Pose = { x: 0, z: 5, rotation: 0 };
const DT = 1 / 60;

function make(onIntentChange?: (i: { x: number; z: number }) => void) {
  return new LocalAvatarController({ layout, spawn, onIntentChange });
}

describe('LocalAvatarController', () => {
  test('starts at the spawn pose, idle, with zero intent', () => {
    const c = make();
    expect(c.pose).toEqual(spawn);
    expect(c.intent).toEqual({ x: 0, z: 0 });
    expect(c.step(DT)).toMatchObject({ moving: false, arrived: false });
    expect(c.pose.x).toBe(spawn.x);
  });

  test('keyboard direction moves the avatar and is the reported intent', () => {
    const c = make();
    c.setKeyboardDirection({ x: 0, z: -1 });
    const result = c.step(DT);
    expect(result.moving).toBe(true);
    expect(c.pose.z).toBeLessThan(spawn.z);
    expect(c.intent).toEqual({ x: 0, z: -1 });
  });

  test('an unreachable or unwalkable destination returns false and changes nothing', () => {
    const c = make();
    expect(c.setDestination({ x: 100, z: 100 })).toBe(false);
    const desk = layout.obstacles[0]!;
    expect(
      c.setDestination({
        x: (desk.minX + desk.maxX) / 2,
        z: (desk.minZ + desk.maxZ) / 2,
      }),
    ).toBe(false);
    expect(c.hasDestination).toBe(false);
    expect(c.step(DT)).toMatchObject({ moving: false, arrived: false });
    expect(c.pose).toEqual(spawn);
  });

  test('a failed setDestination keeps an existing valid destination', () => {
    const c = make();
    expect(c.setDestination({ x: 3, z: 5 })).toBe(true);
    expect(c.setDestination({ x: 100, z: 100 })).toBe(false);
    expect(c.hasDestination).toBe(true);
  });

  test('walks to a destination, reporting arrival only on the final step', () => {
    const c = make();
    const target = { x: 4, z: 3.5 };
    expect(c.setDestination(target)).toBe(true);
    let arrivals = 0;
    let steps = 0;
    for (; steps < 1200; steps++) {
      const result = c.step(DT);
      expect(isWalkable(layout, c.pose.x, c.pose.z)).toBe(true);
      if (result.arrived) {
        arrivals++;
        break;
      }
      expect(c.hasDestination).toBe(true);
    }
    expect(arrivals).toBe(1);
    expect(steps).toBeGreaterThan(10);
    expect(
      Math.hypot(c.pose.x - target.x, c.pose.z - target.z),
    ).toBeLessThanOrEqual(ARRIVE_RADIUS + 0.001);
    expect(c.hasDestination).toBe(false);
    expect(c.intent).toEqual({ x: 0, z: 0 });
    expect(c.step(DT)).toMatchObject({ moving: false, arrived: false });
  });

  test('routes around obstacles and every stepped pose stays walkable', () => {
    const c = make();
    expect(c.setDestination({ x: 0, z: -3.2 })).toBe(true);
    let arrived = false;
    for (let i = 0; i < 2400 && !arrived; i++) {
      arrived = c.step(DT).arrived;
      expect(isWalkable(layout, c.pose.x, c.pose.z)).toBe(true);
    }
    expect(arrived).toBe(true);
  });

  test('a keyboard direction cancels the destination and takes precedence', () => {
    const c = make();
    c.setDestination({ x: 6, z: 5 });
    c.step(DT);
    c.setKeyboardDirection({ x: -1, z: 0 });
    expect(c.hasDestination).toBe(false);
    c.step(DT);
    expect(c.intent).toEqual({ x: -1, z: 0 });
    c.setKeyboardDirection({ x: 0, z: 0 });
    c.step(DT);
    expect(c.intent).toEqual({ x: 0, z: 0 });
  });

  test('a destination set while keys are held loses to the keyboard', () => {
    const c = make();
    c.setKeyboardDirection({ x: -1, z: 0 });
    c.setDestination({ x: 6, z: 5 });
    c.step(DT);
    expect(c.intent).toEqual({ x: -1, z: 0 });
  });

  test('clearDestination stops path following', () => {
    const c = make();
    c.setDestination({ x: 6, z: 5 });
    c.step(DT);
    c.clearDestination();
    const before = { ...c.pose };
    expect(c.step(DT).moving).toBe(false);
    expect(c.pose).toEqual(before);
    expect(c.intent).toEqual({ x: 0, z: 0 });
  });

  test('reset clears keys and destination and restores the spawn', () => {
    const c = make();
    c.setKeyboardDirection({ x: 1, z: 0 });
    c.step(DT);
    c.setDestination({ x: 6, z: 5 });
    c.reset(spawn);
    expect(c.pose).toEqual(spawn);
    expect(c.hasDestination).toBe(false);
    expect(c.step(DT).moving).toBe(false);
    expect(c.intent).toEqual({ x: 0, z: 0 });
  });

  test('caps oversized frame deltas so the arrive radius stays valid', () => {
    const c = make();
    c.setKeyboardDirection({ x: 1, z: 0 });
    c.step(10);
    expect(c.pose.x).toBeLessThanOrEqual(
      spawn.x + 3 * MAX_FRAME_SECONDS + 1e-9,
    );
  });

  test('onIntentChange fires only when the intent changes', () => {
    const onIntentChange = vi.fn();
    const c = make(onIntentChange);
    c.step(DT);
    c.step(DT);
    expect(onIntentChange).not.toHaveBeenCalled();
    c.setKeyboardDirection({ x: 1, z: 0 });
    c.step(DT);
    c.step(DT);
    expect(onIntentChange).toHaveBeenCalledTimes(1);
    expect(onIntentChange).toHaveBeenLastCalledWith({ x: 1, z: 0 });
    c.setKeyboardDirection({ x: 0, z: 0 });
    c.step(DT);
    expect(onIntentChange).toHaveBeenCalledTimes(2);
    expect(onIntentChange).toHaveBeenLastCalledWith({ x: 0, z: 0 });
  });

  test('reset reports the intent returning to zero', () => {
    const onIntentChange = vi.fn();
    const c = make(onIntentChange);
    c.setKeyboardDirection({ x: 1, z: 0 });
    c.step(DT);
    c.reset(spawn);
    expect(onIntentChange).toHaveBeenLastCalledWith({ x: 0, z: 0 });
  });
});
