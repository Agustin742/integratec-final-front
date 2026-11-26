import { deriveNpcHomes, type ClassroomLayout } from '@/realtime';
import { deriveClassroomPropSpecs } from '../classroom/classroom-interactables';

/** Server NPC ids (`ClassroomState.npcs` keys). */
export const TUTOR_BOT_NPC_ID = 'tutorBot';
export const PET_NPC_ID = 'pet';

export type NpcState = 'idle' | 'walking' | 'emote' | 'sleeping' | 'reacting';
export type NpcReaction = '' | 'greet' | 'askForPets' | 'phrase';

/**
 * Client-side view of one synced NPC (`Npc` in the room schema). The scene
 * renders from this shape only, so the realtime layer maps its state into it
 * and never leaks generated schema types into the 3D world.
 */
export interface NpcView {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Yaw in radians. */
  readonly rotation: number;
  readonly state: NpcState;
  /** Clip or emote name, empty when none. */
  readonly emote: string;
  readonly reaction: NpcReaction;
  /** Phrase catalog id, -1 when none. */
  readonly phraseId: number;
  /** Increments for every new reaction, so a repeat can re-trigger. */
  readonly reactionSeq: number;
  readonly reactingSessionId: string;
}

/** A phrase an NPC is saying; shown in a bubble until it fades or is replaced. */
export interface NpcSpeech {
  readonly npcId: string;
  readonly text: string;
  /** `NpcView.reactionSeq` that triggered it. */
  readonly seq: number;
}

/** How long a phrase bubble stays visible. */
export const NPC_SPEECH_VISIBLE_MS = 5000;

export type NpcViews =
  ReadonlyMap<string, NpcView> | Readonly<Record<string, NpcView>>;

/** Reads one NPC out of a Map or a plain record. */
export function findNpcView(
  npcs: NpcViews | undefined,
  id: string,
): NpcView | undefined {
  if (!npcs) return undefined;
  return npcs instanceof Map
    ? npcs.get(id)
    : (npcs as Readonly<Record<string, NpcView>>)[id];
}

/**
 * Where the bot rests while no synced state is available: hovering in front
 * of its station (the same spot the back picks as its home), facing the room.
 */
export function deriveTutorBotHome(layout: ClassroomLayout): NpcView {
  const spec = deriveClassroomPropSpecs(layout).tutorBot;
  return {
    id: TUTOR_BOT_NPC_ID,
    x: spec.position[0],
    z: spec.position[2],
    rotation: spec.rotationY ?? 0,
    state: 'idle',
    emote: '',
    reaction: '',
    phraseId: -1,
    reactionSeq: 0,
    reactingSessionId: '',
  };
}

/**
 * Where Michi rests while no synced state is available: asleep on the cushion
 * of its bed, the same spot the server picks as its home.
 */
export function derivePetHome(layout: ClassroomLayout): NpcView {
  const home = deriveNpcHomes(layout).pet;
  return {
    id: PET_NPC_ID,
    x: home.x,
    z: home.z,
    rotation: home.rotation,
    state: 'sleeping',
    emote: '',
    reaction: '',
    phraseId: -1,
    reactionSeq: 0,
    reactingSessionId: '',
  };
}
