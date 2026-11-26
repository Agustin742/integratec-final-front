import { describe, expect, test } from 'vitest';
import {
  PET_ONE_SHOT_SECONDS,
  petProceduralFrame,
  petStaticMorphs,
} from './pet-procedural';

describe('petProceduralFrame', () => {
  test('idle breathes and blinks, never frozen in a pose', () => {
    const a = petProceduralFrame('idle', 0.4, false);
    const b = petProceduralFrame('idle', 2.0, false);
    expect(a.scaleY).not.toBe(b.scaleY);
    expect(Math.abs(a.scaleY - 1)).toBeLessThan(0.03);
    expect(petProceduralFrame('idle', 1, false).morphs.EyesClosed).toBe(0);
    const blink = Array.from(
      { length: 400 },
      (_, i) => petProceduralFrame('idle', i / 100, false).morphs.EyesClosed,
    );
    expect(Math.max(...blink)).toBeGreaterThan(0.9);
  });

  test('idle under reduced motion is the neutral rest pose', () => {
    expect(petProceduralFrame('idle', 3.9, true)).toEqual({
      offsetY: 0,
      pitch: 0,
      roll: 0,
      scaleY: 1,
      morphs: { EyesClosed: 0, EyesHappy: 0, Meow: 0, Happy: 0 },
    });
  });

  test('walk bobs and sways', () => {
    const frames = Array.from({ length: 40 }, (_, i) =>
      petProceduralFrame('walk', i / 40, false),
    );
    expect(Math.max(...frames.map((f) => f.offsetY))).toBeGreaterThan(0.005);
    expect(Math.min(...frames.map((f) => f.roll))).toBeLessThan(-0.01);
    expect(Math.max(...frames.map((f) => f.roll))).toBeGreaterThan(0.01);
    expect(frames.every((f) => f.offsetY >= 0)).toBe(true);
  });

  test('sleep breathes slowly with closed eyes', () => {
    const a = petProceduralFrame('sleep', 0, false);
    const b = petProceduralFrame('sleep', 0.9, false);
    expect(a.morphs.EyesClosed).toBe(1);
    expect(a.scaleY).not.toBe(b.scaleY);
  });

  test('meow pops and opens the mouth, then settles to idle', () => {
    const mid = petProceduralFrame('meow', 0.4, false);
    expect(mid.scaleY).toBeGreaterThan(1.02);
    const mouth = Array.from(
      { length: 100 },
      (_, i) => petProceduralFrame('meow', (i / 100) * 2, false).morphs.Meow,
    );
    expect(Math.max(...mouth)).toBeGreaterThan(0.8);
    const done = petProceduralFrame(
      'meow',
      PET_ONE_SHOT_SECONDS.meow + 0.1,
      false,
    );
    expect(done.morphs.Meow).toBe(0);
    expect(Math.abs(done.scaleY - 1)).toBeLessThan(0.03);
  });

  test('askForPets hops and wiggles with a smile, then settles', () => {
    const frames = Array.from({ length: 60 }, (_, i) =>
      petProceduralFrame('askForPets', (i / 60) * 3, false),
    );
    expect(Math.max(...frames.map((f) => f.offsetY))).toBeGreaterThan(0.02);
    expect(Math.max(...frames.map((f) => Math.abs(f.roll)))).toBeGreaterThan(
      0.02,
    );
    expect(frames[10]!.morphs.Happy).toBe(1);
    expect(frames[10]!.morphs.EyesHappy).toBe(1);
    const done = petProceduralFrame(
      'askForPets',
      PET_ONE_SHOT_SECONDS.askForPets + 0.1,
      false,
    );
    expect(done.morphs.Happy).toBe(0);
  });

  test('reduced motion keeps the body still but still shows the expression', () => {
    for (const motion of ['walk', 'sleep', 'meow', 'askForPets'] as const) {
      const f = petProceduralFrame(motion, 0.5, true);
      expect([f.offsetY, f.pitch, f.roll, f.scaleY]).toEqual([0, 0, 0, 1]);
    }
    expect(petProceduralFrame('sleep', 0.5, true).morphs.EyesClosed).toBe(1);
    expect(petProceduralFrame('askForPets', 0.5, true).morphs.Happy).toBe(1);
    expect(petProceduralFrame('meow', 0.5, true).morphs.Meow).toBeGreaterThan(
      0,
    );
  });
});

describe('petStaticMorphs', () => {
  test('fills the four morphs, defaulting to zero', () => {
    expect(petStaticMorphs({ EyesHappy: 1 })).toEqual({
      EyesClosed: 0,
      EyesHappy: 1,
      Meow: 0,
      Happy: 0,
    });
  });
});
