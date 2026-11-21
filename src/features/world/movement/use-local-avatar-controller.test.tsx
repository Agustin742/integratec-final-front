import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { useLocalAvatarController } from './use-local-avatar-controller';

const spawn = { x: 0, z: 5, rotation: 0 };

afterEach(() => {
  document.body.innerHTML = '';
});

function press(code: string, type: 'keydown' | 'keyup' = 'keydown') {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent(type, { code, bubbles: true, cancelable: true }),
    );
  });
}

function setup(initial = { enabled: true, resetKey: 'room-1' }) {
  return renderHook(
    (props: { enabled: boolean; resetKey: string }) =>
      useLocalAvatarController({ layout: CLASSROOM_LAYOUT, spawn, ...props }),
    { initialProps: initial },
  );
}

describe('useLocalAvatarController', () => {
  test('keyboard drives the pose through step and exposes the intent', () => {
    const { result } = setup();
    press('KeyW');
    expect(result.current.getIntent().z).toBeLessThan(0);
    const out = result.current.step(1 / 60);
    expect(out.moving).toBe(true);
    expect(result.current.poseRef.current.z).toBeLessThan(spawn.z);
    expect(result.current.intentRef.current).toEqual(
      result.current.getIntent(),
    );
  });

  test('a key press cancels the destination', () => {
    const { result } = setup();
    expect(result.current.setDestination({ x: 6, z: 5 })).toBe(true);
    press('KeyW');
    press('KeyW', 'keyup');
    result.current.step(1 / 60);
    expect(result.current.getIntent()).toEqual({ x: 0, z: 0 });
  });

  test('setDestination returns false for an unreachable point', () => {
    const { result } = setup();
    expect(result.current.setDestination({ x: 50, z: 50 })).toBe(false);
    expect(result.current.step(1 / 60).moving).toBe(false);
  });

  test('blur clears held keys', () => {
    const { result } = setup();
    press('KeyD');
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.step(1 / 60).moving).toBe(false);
  });

  test('changing resetKey restores the spawn and drops input and destination', () => {
    const { result, rerender } = setup();
    press('KeyD');
    result.current.step(0.05);
    result.current.setDestination({ x: -6, z: 5 });
    rerender({ enabled: true, resetKey: 'room-2' });
    expect(result.current.poseRef.current).toEqual(spawn);
    expect(result.current.step(1 / 60).moving).toBe(false);
    expect(result.current.getIntent()).toEqual({ x: 0, z: 0 });
  });

  test('disabling clears input and destination', () => {
    const { result, rerender } = setup();
    result.current.setDestination({ x: -6, z: 5 });
    rerender({ enabled: false, resetKey: 'room-1' });
    expect(result.current.step(1 / 60).moving).toBe(false);
    press('KeyD');
    expect(result.current.getIntent()).toEqual({ x: 0, z: 0 });
  });
});

describe('useLocalAvatarController hasDestination', () => {
  test('reports an active destination until it is cleared', () => {
    const { result } = setup();
    expect(result.current.hasDestination()).toBe(false);
    expect(result.current.setDestination({ x: 6, z: 5 })).toBe(true);
    expect(result.current.hasDestination()).toBe(true);
    act(() => result.current.clearDestination());
    expect(result.current.hasDestination()).toBe(false);
  });
});
