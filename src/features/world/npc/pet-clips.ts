import type { NpcView } from './npc-view';

/** The four clips baked into `body.glb` (`docs/art/classroom-pet.md`). */
export const PET_CLIP_NAMES = ['Walk', 'Sleep', 'Meow', 'AskForPets'] as const;
export type PetClipName = (typeof PET_CLIP_NAMES)[number];

/** Facial morph targets of the cat (`Pet_Eyes`, `Pet_Mouth`). */
export const PET_MORPH_NAMES = [
  'EyesClosed',
  'EyesHappy',
  'Meow',
  'Happy',
] as const;
export type PetMorphName = (typeof PET_MORPH_NAMES)[number];
export type PetMorphWeights = Readonly<Record<PetMorphName, number>>;

/** What the cat is doing; the clip (when it exists) and the fallback both follow it. */
export type PetMotion = 'idle' | 'walk' | 'sleep' | 'meow' | 'askForPets';

export const PET_CROSSFADE_SECONDS = 0.25;
/** Height of the bed cushion the curled `Sleep` pose rests on. */
export const PET_SLEEP_LIFT = 0.17;

export interface PetPlan {
  readonly motion: PetMotion;
  /** Clip to play by name; null when the motion has no clip (idle). */
  readonly clip: PetClipName | null;
  readonly loop: boolean;
  /** Static facial expression held while the motion plays. */
  readonly morphs: Readonly<Partial<Record<PetMorphName, number>>>;
}

export interface PetResolvedPlan extends PetPlan {
  /** `clip` plays the GLB clip; `procedural` moves the model in code. */
  readonly source: 'clip' | 'procedural';
}

const IDLE: PetPlan = { motion: 'idle', clip: null, loop: false, morphs: {} };

const MEOW: PetPlan = {
  motion: 'meow',
  clip: 'Meow',
  loop: false,
  morphs: {},
};
const ASK: PetPlan = {
  motion: 'askForPets',
  clip: 'AskForPets',
  loop: false,
  morphs: {},
};

/**
 * Pure mapping from the synced NPC state to the cat's motion: walking trots,
 * sleeping curls up with closed eyes, emotes play their clip once, a greet
 * meows happily and an askForPets reaction asks with a smile. The GLB has no
 * idle clip, so idle (and anything unknown) is a procedural idle on the rest
 * pose.
 */
export function planPetClip(
  npc: Pick<NpcView, 'state' | 'emote' | 'reaction'>,
): PetPlan {
  switch (npc.state) {
    case 'walking':
      return { motion: 'walk', clip: 'Walk', loop: true, morphs: {} };
    case 'sleeping':
      return {
        motion: 'sleep',
        clip: 'Sleep',
        loop: true,
        morphs: { EyesClosed: 1 },
      };
    case 'emote':
      if (npc.emote === 'Meow') return MEOW;
      if (npc.emote === 'AskForPets') return ASK;
      return IDLE;
    case 'reacting':
      if (npc.reaction === 'greet') {
        return { ...MEOW, morphs: { EyesHappy: 1 } };
      }
      if (npc.reaction === 'askForPets') {
        return { ...ASK, morphs: { Happy: 1 } };
      }
      return IDLE;
    default:
      return IDLE;
  }
}

/**
 * Resolves the clip by name against what the loaded GLB really has: a missing
 * clip (or idle, which never has one) switches to the procedural fallback so
 * a model without clips still reads correctly.
 */
export function resolvePetPlan(
  plan: PetPlan,
  available: readonly string[],
): PetResolvedPlan {
  const hasClip = plan.clip !== null && available.includes(plan.clip);
  return { ...plan, source: hasClip ? 'clip' : 'procedural' };
}

/** Vertical lift of the whole cat for a motion (sleeping rests on the cushion). */
export function petRestLift(motion: PetMotion): number {
  return motion === 'sleep' ? PET_SLEEP_LIFT : 0;
}

/** Blend length between clips; reduced motion switches instantly. */
export function petCrossfadeSeconds(reducedMotion: boolean): number {
  return reducedMotion ? 0 : PET_CROSSFADE_SECONDS;
}
