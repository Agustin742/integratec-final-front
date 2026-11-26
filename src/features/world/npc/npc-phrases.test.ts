import { describe, expect, test } from 'vitest';
import { TUTOR_BOT_PHRASES } from '@/realtime';
import { TUTOR_BOT_NPC_ID, type NpcView } from './npc-view';
import { resolveNpcPhrase } from './npc-phrases';

const bot = (patch: Partial<NpcView>): NpcView => ({
  id: TUTOR_BOT_NPC_ID,
  x: 0,
  z: 0,
  rotation: 0,
  state: 'idle',
  emote: '',
  reaction: '',
  phraseId: -1,
  reactionSeq: 0,
  reactingSessionId: '',
  ...patch,
});

describe('resolveNpcPhrase', () => {
  test('reads the synced phrase id from the shared catalog', () => {
    expect(resolveNpcPhrase(bot({ reaction: 'phrase', phraseId: 2 }))).toBe(
      TUTOR_BOT_PHRASES[2],
    );
  });

  test('is undefined without a phrase reaction or with an unknown id', () => {
    expect(resolveNpcPhrase(bot({ reaction: 'greet', phraseId: 2 }))).toBe(
      undefined,
    );
    expect(resolveNpcPhrase(bot({ reaction: 'phrase', phraseId: -1 }))).toBe(
      undefined,
    );
    expect(
      resolveNpcPhrase(
        bot({ reaction: 'phrase', phraseId: TUTOR_BOT_PHRASES.length }),
      ),
    ).toBe(undefined);
  });
});
