import type { NpcView } from './npc-view';

/** The 11 clips baked into `tutor-bot.glb` (`docs/art/tutor-bot.md`). */
export const BOT_CLIP_NAMES = [
  'IdleHover',
  'Wave',
  'Talk',
  'Think',
  'Celebrate',
  'Encourage',
  'Face_Happy',
  'Face_Thinking',
  'Face_Talking',
  'Face_Surprised',
  'Face_Sleeping',
] as const;

export const BOT_IDLE_CLIP = 'IdleHover';
export const BOT_CROSSFADE_SECONDS = 0.25;

/** Clips that keep playing until the state changes; the rest play once. */
const LOOPING_CLIPS: ReadonlySet<string> = new Set([
  'IdleHover',
  'Talk',
  'Face_Sleeping',
]);

export interface BotClipPlan {
  readonly clip: string;
  readonly loop: boolean;
  /** 1 while the bot walks (forward lean), otherwise 0. */
  readonly lean: 0 | 1;
}

const plan = (clip: string, lean: 0 | 1 = 0): BotClipPlan => ({
  clip,
  loop: LOOPING_CLIPS.has(clip),
  lean,
});

const IDLE_PLAN = plan(BOT_IDLE_CLIP);

function isKnownClip(name: string): boolean {
  return (BOT_CLIP_NAMES as readonly string[]).includes(name);
}

/**
 * Pure mapping from the synced NPC state to the clip the bot plays:
 * idle/walking hover (walking also leans), emote plays the named clip,
 * sleeping shows the sleeping face, and a reaction speaks (`phrase`), waves
 * (`greet`) or ponders (`askForPets`). Unknown names fall back to `IdleHover`.
 */
export function planBotClip(
  npc: Pick<NpcView, 'state' | 'emote' | 'reaction'>,
): BotClipPlan {
  switch (npc.state) {
    case 'walking':
      return plan(BOT_IDLE_CLIP, 1);
    case 'emote':
      return isKnownClip(npc.emote) ? plan(npc.emote) : IDLE_PLAN;
    case 'sleeping':
      return plan('Face_Sleeping');
    case 'reacting':
      if (npc.reaction === 'phrase') return plan('Talk');
      if (npc.reaction === 'greet') return plan('Wave');
      if (npc.reaction === 'askForPets') return plan('Think');
      return IDLE_PLAN;
    default:
      return IDLE_PLAN;
  }
}

/**
 * Keeps the plan only when the loaded model really has the clip; otherwise
 * hovers, and returns null when there is nothing playable at all.
 */
export function resolvePlayableClip(
  wanted: BotClipPlan,
  available: readonly string[],
): BotClipPlan | null {
  if (available.includes(wanted.clip)) return wanted;
  if (available.includes(BOT_IDLE_CLIP)) {
    return { clip: BOT_IDLE_CLIP, loop: true, lean: 0 };
  }
  return null;
}

/** Blend length between clips; reduced motion switches instantly. */
export function botCrossfadeSeconds(reducedMotion: boolean): number {
  return reducedMotion ? 0 : BOT_CROSSFADE_SECONDS;
}
