import { describe, expect, it } from 'vitest';
import { EMOTE_DURATION_SECONDS, emoteMorph, planEmote } from './call-emotes';

const MALE = [
  'Idle',
  'Wave',
  'Think',
  'ThinkStart',
  'Celebrate',
  'Happy',
  'Sad',
  'Angry',
];
const FEMALE_OWN = ['Idle', 'Wave', 'Think', 'Celebrate'];

describe('planEmote', () => {
  it('plays the matching clip when the body has it', () => {
    expect(planEmote('wave', MALE, false)).toEqual({
      clip: 'Wave',
      morph: null,
      seconds: EMOTE_DURATION_SECONDS.wave,
    });
    expect(planEmote('sad', MALE, false)?.clip).toBe('Sad');
    expect(planEmote('angry', MALE, false)?.morph).toBe('Angry');
    expect(planEmote('celebrate', MALE, false)?.morph).toBe('Happy');
  });

  it('uses the shared male clips for a female body missing Happy/Sad/Angry', () => {
    const merged = [...FEMALE_OWN, 'Happy', 'Sad', 'Angry'];
    expect(planEmote('happy', merged, false)?.clip).toBe('Happy');
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

  it('is face morph only under reduced motion', () => {
    const plan = planEmote('happy', MALE, true);
    expect(plan?.clip).toBeNull();
    expect(plan?.morph).toBe('Happy');
  });

  it('ignores unknown emotes', () => {
    expect(planEmote('', MALE, false)).toBeNull();
    expect(planEmote('dance', MALE, false)).toBeNull();
  });
});

describe('emoteMorph', () => {
  it('maps face emotes and nothing else', () => {
    expect(emoteMorph('happy')).toBe('Happy');
    expect(emoteMorph('wave')).toBeNull();
  });
});
