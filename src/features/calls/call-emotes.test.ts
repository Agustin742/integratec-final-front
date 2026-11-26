import { describe, expect, it } from 'vitest';
import { EMOTE_DURATION_SECONDS, emoteMorph, planEmote } from './call-emotes';

// Clip names shipped in the body GLBs. Happy/Angry are face-only.
const MALE = [
  'Idle',
  'Wave',
  'Think',
  'ThinkStart',
  'Cheer',
  'Sad',
  'Happy',
  'Angry',
  'RaiseHand',
  'Clap',
  'Nod',
  'ShakeHead',
  'Dance',
  'TeacherExplain',
  'TeacherPoint',
];
const FEMALE_OWN = [
  'Idle',
  'Wave',
  'Think',
  'Cheer',
  'Sad',
  'RaiseHand',
  'Clap',
  'Nod',
  'ShakeHead',
  'Dance',
  'TeacherExplain',
  'TeacherPoint',
];

describe('planEmote', () => {
  it('plays the matching clip when the body has it', () => {
    expect(planEmote('wave', MALE, false)).toEqual({
      clip: 'Wave',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS.wave,
    });
    expect(planEmote('angry', MALE, false)?.morph).toBe('Angry');
    expect(planEmote('celebrate', MALE, false)?.morph).toBe('Happy');
  });

  // Happy, Sad and Angry clips in the GLBs only animate face morph weights;
  // playing one as the body clip drops Idle and leaves the skeleton in T-pose.
  it('keeps the body on Idle for face-only emotes even when their clips exist', () => {
    for (const emote of ['happy', 'angry']) {
      expect(planEmote(emote, MALE, false)?.clip).toBeNull();
    }
    expect(planEmote('angry', MALE, false)?.morph).toBe('Angry');
  });

  it('plays the body clips shipped in the GLBs: Cheer for celebrate, Sad for sad', () => {
    expect(planEmote('celebrate', MALE, false)?.clip).toBe('Cheer');
    expect(planEmote('sad', MALE, false)).toMatchObject({
      clip: 'Sad',
      morph: 'Sad',
    });
  });

  it('falls back to the face morph only when no clip exists anywhere', () => {
    const plan = planEmote('happy', FEMALE_OWN, false);
    expect(plan?.clip).toBeNull();
    expect(plan?.morph).toBe('Happy');
  });

  it('prefers Think and falls back to ThinkStart', () => {
    expect(planEmote('think', ['Idle', 'ThinkStart'], false)?.clip).toBe(
      'ThinkStart',
    );
    expect(planEmote('think', MALE, false)?.clip).toBe('Think');
  });

  it('plays all 7 newly wired expressive character clips', () => {
    expect(planEmote('raise-hand', FEMALE_OWN, false)).toEqual({
      clip: 'RaiseHand',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS['raise-hand'],
    });
    expect(planEmote('clap', MALE, false)).toEqual({
      clip: 'Clap',
      morph: 'Happy',
      seconds: EMOTE_DURATION_SECONDS.clap,
    });
    expect(planEmote('nod', FEMALE_OWN, false)).toEqual({
      clip: 'Nod',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS.nod,
    });
    expect(planEmote('shake-head', MALE, false)).toEqual({
      clip: 'ShakeHead',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS['shake-head'],
    });
    expect(planEmote('dance', FEMALE_OWN, false)).toEqual({
      clip: 'Dance',
      morph: 'Happy',
      seconds: EMOTE_DURATION_SECONDS.dance,
    });
    expect(planEmote('explain', MALE, false)).toEqual({
      clip: 'TeacherExplain',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS.explain,
    });
    expect(planEmote('point', FEMALE_OWN, false)).toEqual({
      clip: 'TeacherPoint',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS.point,
    });
  });

  it('is face morph only under reduced motion', () => {
    const plan = planEmote('happy', MALE, true);
    expect(plan?.clip).toBeNull();
    expect(plan?.morph).toBe('Happy');
    expect(planEmote('dance', MALE, true)).toEqual({
      clip: null,
      morph: 'Happy',
      seconds: EMOTE_DURATION_SECONDS.dance,
    });
    expect(planEmote('raise-hand', MALE, true)).toEqual({
      clip: null,
      morph: null,
      seconds: EMOTE_DURATION_SECONDS['raise-hand'],
    });
  });

  it('ignores unknown emotes', () => {
    expect(planEmote('', MALE, false)).toBeNull();
    expect(planEmote('backflip', MALE, false)).toBeNull();
  });
});

describe('emoteMorph', () => {
  it('maps face emotes and nothing else', () => {
    expect(emoteMorph('happy')).toBe('Happy');
    expect(emoteMorph('wave')).toBeNull();
  });
});
