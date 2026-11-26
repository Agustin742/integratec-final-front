import { describe, expect, test } from 'vitest';
import {
  PET_CLIP_NAMES,
  PET_SLEEP_LIFT,
  petCrossfadeSeconds,
  petRestLift,
  planPetClip,
  resolvePetPlan,
} from './pet-clips';

const plan = (
  state: Parameters<typeof planPetClip>[0]['state'],
  emote = '',
  reaction: Parameters<typeof planPetClip>[0]['reaction'] = '',
) => planPetClip({ state, emote, reaction });

describe('planPetClip', () => {
  test('ships the four clips the cat GLB carries', () => {
    expect([...PET_CLIP_NAMES]).toEqual([
      'Walk',
      'Sleep',
      'Meow',
      'AskForPets',
    ]);
  });

  test('walking loops Walk', () => {
    expect(plan('walking')).toMatchObject({
      motion: 'walk',
      clip: 'Walk',
      loop: true,
    });
  });

  test('idle has no clip: the rest pose plus a procedural idle', () => {
    expect(plan('idle')).toMatchObject({
      motion: 'idle',
      clip: null,
      loop: false,
    });
  });

  test('sleeping loops Sleep with closed eyes', () => {
    expect(plan('sleeping')).toMatchObject({
      motion: 'sleep',
      clip: 'Sleep',
      loop: true,
      morphs: { EyesClosed: 1 },
    });
  });

  test('emotes play their clip once', () => {
    expect(plan('emote', 'Meow')).toMatchObject({
      motion: 'meow',
      clip: 'Meow',
      loop: false,
    });
    expect(plan('emote', 'AskForPets')).toMatchObject({
      motion: 'askForPets',
      clip: 'AskForPets',
      loop: false,
    });
  });

  test('an unknown emote stays idle', () => {
    expect(plan('emote', 'Moonwalk')).toMatchObject({
      motion: 'idle',
      clip: null,
    });
  });

  test('a greet reaction meows happily, askForPets asks with a smile', () => {
    expect(plan('reacting', '', 'greet')).toMatchObject({
      motion: 'meow',
      clip: 'Meow',
      loop: false,
      morphs: { EyesHappy: 1 },
    });
    expect(plan('reacting', '', 'askForPets')).toMatchObject({
      motion: 'askForPets',
      clip: 'AskForPets',
      loop: false,
      morphs: { Happy: 1 },
    });
  });

  test('reactions the cat does not know stay idle', () => {
    expect(plan('reacting', '', 'phrase').motion).toBe('idle');
    expect(plan('reacting').motion).toBe('idle');
  });
});

describe('resolvePetPlan', () => {
  test('uses the clip when the GLB has it, resolved by name', () => {
    const resolved = resolvePetPlan(plan('walking'), ['Sleep', 'Walk', 'Meow']);
    expect(resolved).toMatchObject({ source: 'clip', clip: 'Walk' });
  });

  test('falls back to procedural motion when the clip is missing', () => {
    expect(resolvePetPlan(plan('walking'), [])).toMatchObject({
      source: 'procedural',
      motion: 'walk',
    });
    expect(resolvePetPlan(plan('sleeping'), ['Walk'])).toMatchObject({
      source: 'procedural',
      motion: 'sleep',
      morphs: { EyesClosed: 1 },
    });
  });

  test('idle is always procedural', () => {
    expect(resolvePetPlan(plan('idle'), [...PET_CLIP_NAMES])).toMatchObject({
      source: 'procedural',
      motion: 'idle',
    });
  });
});

describe('petRestLift / petCrossfadeSeconds', () => {
  test('only sleeping lifts the cat onto the bed cushion', () => {
    expect(petRestLift('sleep')).toBe(PET_SLEEP_LIFT);
    expect(petRestLift('idle')).toBe(0);
    expect(petRestLift('walk')).toBe(0);
  });

  test('reduced motion switches clips instantly', () => {
    expect(petCrossfadeSeconds(true)).toBe(0);
    expect(petCrossfadeSeconds(false)).toBeGreaterThan(0);
  });
});
