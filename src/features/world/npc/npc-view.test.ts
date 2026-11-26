import { describe, expect, test } from 'vitest';
import { CLASSROOM_LAYOUT, deriveNpcHomes } from '@/realtime';
import {
  PET_NPC_ID,
  TUTOR_BOT_NPC_ID,
  derivePetHome,
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

describe('derivePetHome', () => {
  test('sleeps on its bed cushion, the same spot the server picks as home', () => {
    const home = derivePetHome(CLASSROOM_LAYOUT);
    const server = deriveNpcHomes(CLASSROOM_LAYOUT).pet;
    expect(PET_NPC_ID).toBe('pet');
    expect(home.id).toBe(PET_NPC_ID);
    expect(home.x).toBeCloseTo(server.x, 5);
    expect(home.z).toBeCloseTo(server.z, 5);
    expect(home.rotation).toBeCloseTo(server.rotation, 5);
    expect(home.state).toBe('sleeping');
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
