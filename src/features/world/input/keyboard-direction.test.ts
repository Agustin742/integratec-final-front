import { OrthographicCamera, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { frameCamera } from '../camera';
import {
  createKeyboardState,
  isMovementKey,
  screenToWorldDirection,
} from './keyboard-direction';

const SQRT1_2 = Math.SQRT1_2;

describe('screenToWorldDirection', () => {
  test('matches the isometric camera: screen-up is away from the camera on the ground', () => {
    const camera = new OrthographicCamera();
    frameCamera(camera, 800, 600);
    const toTarget = new Vector3(0, 1, 0).sub(camera.position);
    toTarget.y = 0;
    toTarget.normalize();
    const up = screenToWorldDirection({ x: 0, y: 1 });
    expect(up.x).toBeCloseTo(toTarget.x);
    expect(up.z).toBeCloseTo(toTarget.z);
    const camRight = new Vector3(1, 0, 0).transformDirection(
      camera.matrixWorld,
    );
    const right = screenToWorldDirection({ x: 1, y: 0 });
    expect(right.x).toBeCloseTo(camRight.x);
    expect(right.z).toBeCloseTo(camRight.z);
  });

  test('maps the four screen directions to world axes at azimuth 45 degrees', () => {
    expect(screenToWorldDirection({ x: 0, y: 1 })).toEqual({
      x: expect.closeTo(-SQRT1_2) as number,
      z: expect.closeTo(-SQRT1_2) as number,
    });
    const right = screenToWorldDirection({ x: 1, y: 0 });
    expect(right.x).toBeCloseTo(SQRT1_2);
    expect(right.z).toBeCloseTo(-SQRT1_2);
    const down = screenToWorldDirection({ x: 0, y: -1 });
    expect(down.x).toBeCloseTo(SQRT1_2);
    expect(down.z).toBeCloseTo(SQRT1_2);
    const left = screenToWorldDirection({ x: -1, y: 0 });
    expect(left.x).toBeCloseTo(-SQRT1_2);
    expect(left.z).toBeCloseTo(SQRT1_2);
  });

  test('normalizes diagonals and returns zero for no input', () => {
    const diagonal = screenToWorldDirection({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    expect(diagonal.x).toBeCloseTo(0);
    expect(diagonal.z).toBeCloseTo(-1);
    expect(screenToWorldDirection({ x: 0, y: 0 })).toEqual({ x: 0, z: 0 });
  });
});

describe('createKeyboardState', () => {
  test.each([
    ['KeyW', 'ArrowUp'],
    ['KeyS', 'ArrowDown'],
    ['KeyA', 'ArrowLeft'],
    ['KeyD', 'ArrowRight'],
  ])('%s and %s are movement keys with the same effect', (wasd, arrow) => {
    expect(isMovementKey(wasd)).toBe(true);
    expect(isMovementKey(arrow)).toBe(true);
    const a = createKeyboardState();
    const b = createKeyboardState();
    a.press(wasd);
    b.press(arrow);
    expect(a.direction()).toEqual(b.direction());
  });

  test('ignores other keys', () => {
    const state = createKeyboardState();
    expect(isMovementKey('KeyQ')).toBe(false);
    expect(state.press('KeyQ')).toBe(false);
    expect(state.direction()).toEqual({ x: 0, z: 0 });
  });

  test('opposite keys cancel and releasing restores the remaining key', () => {
    const state = createKeyboardState();
    state.press('KeyW');
    state.press('KeyS');
    expect(state.direction()).toEqual({ x: 0, z: 0 });
    state.release('KeyS');
    expect(state.direction().z).toBeCloseTo(-SQRT1_2);
  });

  test('diagonal combinations are unit length', () => {
    const state = createKeyboardState();
    state.press('KeyW');
    state.press('KeyA');
    const d = state.direction();
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1);
    expect(d.x).toBeCloseTo(-1);
  });

  test('clear drops every held key', () => {
    const state = createKeyboardState();
    state.press('KeyW');
    state.press('ArrowRight');
    state.clear();
    expect(state.direction()).toEqual({ x: 0, z: 0 });
    expect(state.hasHeldKeys()).toBe(false);
  });
});
