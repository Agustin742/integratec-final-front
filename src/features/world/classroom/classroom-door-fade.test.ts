import { describe, expect, it } from 'vitest';
import {
  DOOR_FADE_OPACITY,
  DOOR_OCCLUDER_BOX,
  nextFadeOpacity,
  shouldFadeOccluder,
} from './classroom-door-fade';

const box = DOOR_OCCLUDER_BOX;

describe('shouldFadeOccluder', () => {
  it('fades when the avatar stands on the camera line behind the door (spawn row)', () => {
    // Camera looks from +x,+z: an avatar at (x - 1, z = 5) is hidden by a door at z = 6.
    expect(shouldFadeOccluder({ x: -1, z: 5 }, box)).toBe(true);
    expect(shouldFadeOccluder({ x: -0.4, z: 5.4 }, box)).toBe(true);
  });

  it('fades when the avatar is right next to the door', () => {
    expect(shouldFadeOccluder({ x: 0, z: 5.7 }, box)).toBe(true);
    expect(shouldFadeOccluder({ x: 0.9, z: 5.7 }, box)).toBe(true);
  });

  it('stays opaque when the avatar is beside the door line of sight', () => {
    expect(shouldFadeOccluder({ x: 3, z: 5 }, box)).toBe(false);
    expect(shouldFadeOccluder({ x: -3.5, z: 5 }, box)).toBe(false);
  });

  it('stays opaque when the sight line passes above the door', () => {
    // Too deep in the room: the ray reaches the door wall higher than 2.3 m.
    expect(shouldFadeOccluder({ x: -2, z: 4 }, box)).toBe(false);
    expect(shouldFadeOccluder({ x: -1, z: 2 }, box)).toBe(false);
  });

  it('stays opaque across the room', () => {
    expect(shouldFadeOccluder({ x: 5, z: -3 }, box)).toBe(false);
    expect(shouldFadeOccluder({ x: -6, z: 1 }, box)).toBe(false);
  });
});

describe('nextFadeOpacity', () => {
  it('moves toward the target over about 200 ms and never overshoots', () => {
    let value = 1;
    for (let i = 0; i < 6; i += 1) {
      value = nextFadeOpacity(value, DOOR_FADE_OPACITY, 1 / 30, false);
    }
    expect(value).toBeCloseTo(DOOR_FADE_OPACITY, 6);
    const half = nextFadeOpacity(1, DOOR_FADE_OPACITY, 0.1, false);
    expect(half).toBeGreaterThan(DOOR_FADE_OPACITY);
    expect(half).toBeLessThan(1);
  });

  it('returns to opaque the same way', () => {
    expect(nextFadeOpacity(DOOR_FADE_OPACITY, 1, 1, false)).toBe(1);
  });

  it('switches instantly with reduced motion', () => {
    expect(nextFadeOpacity(1, DOOR_FADE_OPACITY, 0.001, true)).toBe(
      DOOR_FADE_OPACITY,
    );
    expect(nextFadeOpacity(DOOR_FADE_OPACITY, 1, 0.001, true)).toBe(1);
  });
});
