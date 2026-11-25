import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  TUTOR_BOT_NPC_ID,
  deriveTutorBotHome,
  findNpcView,
  type NpcView,
} from './npc-view';

describe('deriveTutorBotHome', () => {
  test('hovers idle in front of the bot station facing into the room', () => {
    const home = deriveTutorBotHome(CLASSROOM_LAYOUT);
    expect(home.id).toBe(TUTOR_BOT_NPC_ID);
    expect(home.x).toBeCloseTo(-5.611, 2);
    expect(home.z).toBeCloseTo(1.05, 2);
    expect(home.rotation).toBeCloseTo(Math.PI / 2, 5);
    expect(home.state).toBe('idle');
    expect(home.reaction).toBe('');
    expect(home.phraseId).toBe(-1);
  });
});

describe('findNpcView', () => {
  const bot: NpcView = {
    ...deriveTutorBotHome(CLASSROOM_LAYOUT),
    x: 1,
  };
  test('reads a Map or a record, and is undefined when absent', () => {
    expect(findNpcView(new Map([['tutorBot', bot]]), 'tutorBot')).toBe(bot);
    expect(findNpcView({ tutorBot: bot }, 'tutorBot')).toBe(bot);
    expect(findNpcView({}, 'tutorBot')).toBeUndefined();
    expect(findNpcView(undefined, 'tutorBot')).toBeUndefined();
  });
});
