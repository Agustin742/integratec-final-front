import { TUTOR_BOT_PHRASES } from '@/realtime';
import type { NpcView } from './npc-view';

/**
 * Text of the phrase an NPC is saying. The server syncs only the catalog index
 * (`phraseId`); the text comes from the shared `TUTOR_BOT_PHRASES` list.
 */
export function resolveNpcPhrase(npc: NpcView): string | undefined {
  if (npc.reaction !== 'phrase') return undefined;
  return TUTOR_BOT_PHRASES[npc.phraseId];
}
