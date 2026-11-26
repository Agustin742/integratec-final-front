import type { CallEmote } from '@/realtime/call-contracts.generated';

export type EmoteName = CallEmote;
export type FaceMorph = 'Happy' | 'Sad' | 'Angry';

export interface EmotePlan {
  /** Body clip to play, or `null` for a face-only emote. */
  readonly clip: string | null;
  readonly morph: FaceMorph | null;
  /** How long the emote stays before the avatar returns to idle. */
  readonly seconds: number;
}

/**
 * Body clips per emote. Happy and Angry have none: their GLB clips only
 * animate face morph weights, and playing one as the body clip would replace
 * Idle and leave the skeleton in its bind (T) pose. The face morph shows them.
 */
const CLIPS: Readonly<Record<EmoteName, readonly string[]>> = {
  wave: ['Wave'],
  happy: [],
  sad: ['Sad'],
  angry: [],
  think: ['Think', 'ThinkStart'],
  celebrate: ['Cheer', 'Celebrate'],
  'raise-hand': ['RaiseHand'],
  clap: ['Clap'],
  nod: ['Nod'],
  'shake-head': ['ShakeHead'],
  dance: ['Dance'],
  explain: ['TeacherExplain'],
  point: ['TeacherPoint'],
};

const MORPHS: Readonly<Record<EmoteName, FaceMorph | null>> = {
  wave: null,
  happy: 'Happy',
  sad: 'Sad',
  angry: 'Angry',
  think: null,
  celebrate: 'Happy',
  'raise-hand': null,
  clap: 'Happy',
  nod: null,
  'shake-head': null,
  dance: 'Happy',
  explain: null,
  point: null,
};

/** Clip lengths are not exposed by the avatar, so each emote holds a fixed time. */
export const EMOTE_DURATION_SECONDS: Readonly<Record<EmoteName, number>> = {
  wave: 2.4,
  happy: 2.6,
  sad: 2.8,
  angry: 2.6,
  think: 3,
  celebrate: 2.8,
  'raise-hand': 2.5,
  clap: 3,
  nod: 1.5,
  'shake-head': 1.7,
  dance: 4,
  explain: 3.5,
  point: 2,
};

function isEmote(value: string): value is EmoteName {
  return Object.hasOwn(CLIPS, value);
}

export function emoteMorph(emote: string): FaceMorph | null {
  return isEmote(emote) ? MORPHS[emote] : null;
}

/**
 * Chooses how to show an emote. `available` is every clip the avatar can play
 * (its own plus the fallback body clips when configured); with no clip at all,
 * or under reduced motion, only the face morph runs.
 */
export function planEmote(
  emote: string,
  available: readonly string[],
  reducedMotion: boolean,
): EmotePlan | null {
  if (!isEmote(emote)) return null;
  const clip = reducedMotion
    ? null
    : (CLIPS[emote].find((name) => available.includes(name)) ?? null);
  return { clip, morph: MORPHS[emote], seconds: EMOTE_DURATION_SECONDS[emote] };
}
