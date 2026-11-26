import { describe, expect, test } from 'vitest';
import {
  BOT_CLIP_NAMES,
  BOT_CROSSFADE_SECONDS,
  botCrossfadeSeconds,
  planBotClip,
  resolvePlayableClip,
} from './tutor-bot-clips';
import type { NpcView } from './npc-view';

const base: NpcView = {
  id: 'tutorBot',
  x: 0,
  z: 0,
  rotation: 0,
  state: 'idle',
  emote: '',
  reaction: '',
  phraseId: -1,
  reactionSeq: 0,
  reactingSessionId: '',
};
const view = (patch: Partial<NpcView>): NpcView => ({ ...base, ...patch });

describe('planBotClip', () => {
  test.each([
    [{ state: 'idle' }, { clip: 'IdleHover', loop: true, lean: 0 }],
    [{ state: 'walking' }, { clip: 'IdleHover', loop: true, lean: 1 }],
    [
      { state: 'emote', emote: 'Wave' },
      { clip: 'Wave', loop: false, lean: 0 },
    ],
    [
      { state: 'emote', emote: 'Celebrate' },
      { clip: 'Celebrate', loop: false, lean: 0 },
    ],
    [
      { state: 'emote', emote: 'Talk' },
      { clip: 'Talk', loop: true, lean: 0 },
    ],
    [{ state: 'sleeping' }, { clip: 'Face_Sleeping', loop: true, lean: 0 }],
    [
      { state: 'reacting', reaction: 'phrase', phraseId: 3 },
      { clip: 'Talk', loop: true, lean: 0 },
    ],
    [
      { state: 'reacting', reaction: 'greet' },
      { clip: 'Wave', loop: false, lean: 0 },
    ],
    [
      { state: 'reacting', reaction: 'askForPets' },
      { clip: 'Think', loop: false, lean: 0 },
    ],
  ] as const)('maps %j to %j', (patch, expected) => {
    expect(planBotClip(view(patch))).toEqual(expected);
  });

  test('falls back to IdleHover for unknown or empty emotes', () => {
    expect(planBotClip(view({ state: 'emote', emote: 'Moonwalk' }))).toEqual({
      clip: 'IdleHover',
      loop: true,
      lean: 0,
    });
    expect(planBotClip(view({ state: 'emote', emote: '' })).clip).toBe(
      'IdleHover',
    );
    expect(planBotClip(view({ state: 'reacting', reaction: '' })).clip).toBe(
      'IdleHover',
    );
  });

  test('never throws on an unexpected state', () => {
    const odd = view({ state: 'dancing' as never });
    expect(planBotClip(odd).clip).toBe('IdleHover');
  });

  test('only names real clips from the GLB', () => {
    expect(BOT_CLIP_NAMES).toHaveLength(11);
    expect(BOT_CLIP_NAMES).toContain('IdleHover');
  });
});

describe('resolvePlayableClip', () => {
  const available = ['IdleHover', 'Wave'];
  test('keeps a clip the model has', () => {
    const plan = { clip: 'Wave', loop: false, lean: 0 } as const;
    expect(resolvePlayableClip(plan, available)).toEqual(plan);
  });
  test('falls back to a looping IdleHover when the clip is missing', () => {
    expect(
      resolvePlayableClip({ clip: 'Think', loop: false, lean: 0 }, available),
    ).toEqual({ clip: 'IdleHover', loop: true, lean: 0 });
  });
  test('returns null when even IdleHover is missing', () => {
    expect(
      resolvePlayableClip({ clip: 'Wave', loop: false, lean: 0 }, []),
    ).toBeNull();
  });
});

describe('botCrossfadeSeconds', () => {
  test('blends for 0.25 s, instantly with reduced motion', () => {
    expect(BOT_CROSSFADE_SECONDS).toBe(0.25);
    expect(botCrossfadeSeconds(false)).toBe(0.25);
    expect(botCrossfadeSeconds(true)).toBe(0);
  });
});
