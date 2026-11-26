import {
  PET_MORPH_NAMES,
  type PetMorphName,
  type PetMorphWeights,
  type PetMotion,
} from './pet-clips';

/** Length of the one-shot motions, matching the `Meow` / `AskForPets` clips. */
export const PET_ONE_SHOT_SECONDS = { meow: 2.67, askForPets: 3.42 } as const;

/** Seconds between idle blinks and how long the eyes stay shut. */
const BLINK_PERIOD = 4;
const BLINK_SECONDS = 0.22;
const BREATH_PERIOD = 3.2;
const SLEEP_BREATH_PERIOD = 3.5;
const TAU = Math.PI * 2;

export interface PetProceduralFrame {
  /** Extra height (m) on top of the rest lift. */
  readonly offsetY: number;
  /** Rotation about X (rad); negative raises the head. */
  readonly pitch: number;
  /** Rotation about Z (rad), side-to-side sway. */
  readonly roll: number;
  readonly scaleY: number;
  readonly morphs: PetMorphWeights;
}

/** All four morphs, zero unless given. */
export function petStaticMorphs(
  weights: Readonly<Partial<Record<PetMorphName, number>>> = {},
): PetMorphWeights {
  const out = {} as Record<PetMorphName, number>;
  for (const name of PET_MORPH_NAMES) out[name] = weights[name] ?? 0;
  return out;
}

const bell = (elapsed: number, duration: number): number =>
  Math.sin(Math.PI * Math.min(1, Math.max(0, elapsed / duration)));

/** 0..1 triangle pulse at the end of every blink period. */
function blinkWeight(elapsed: number): number {
  const t = elapsed % BLINK_PERIOD;
  const start = BLINK_PERIOD - BLINK_SECONDS;
  if (t < start) return 0;
  return 1 - Math.abs(((t - start) / BLINK_SECONDS) * 2 - 1);
}

const frame = (
  partial: Partial<Omit<PetProceduralFrame, 'morphs'>>,
  morphs: Partial<Record<PetMorphName, number>> = {},
): PetProceduralFrame => ({
  offsetY: partial.offsetY ?? 0,
  pitch: partial.pitch ?? 0,
  roll: partial.roll ?? 0,
  scaleY: partial.scaleY ?? 1,
  morphs: petStaticMorphs(morphs),
});

/**
 * Procedural motion for a cat whose GLB lacks the clip (and for idle, which
 * never has one): gentle breathing and blinking idle, a bobbing and swaying
 * walk, slow sleeping breaths, a pop with an open mouth for the meow and a
 * hop with a wiggle and a smile for askForPets. One-shots settle into idle
 * once their duration passes. With reduced motion the body stays still and
 * only the expression remains.
 */
export function petProceduralFrame(
  motion: PetMotion,
  elapsed: number,
  reducedMotion: boolean,
): PetProceduralFrame {
  if (motion === 'meow' || motion === 'askForPets') {
    if (elapsed >= PET_ONE_SHOT_SECONDS[motion]) {
      return petProceduralFrame('idle', elapsed, reducedMotion);
    }
  }
  if (reducedMotion) {
    switch (motion) {
      case 'sleep':
        return frame({}, { EyesClosed: 1 });
      case 'meow':
        return frame({}, { Meow: 0.6 });
      case 'askForPets':
        return frame({}, { Happy: 1, EyesHappy: 1 });
      default:
        return frame({});
    }
  }
  switch (motion) {
    case 'walk':
      return frame({
        offsetY: 0.012 * Math.abs(Math.sin(TAU * 2 * elapsed)),
        roll: 0.05 * Math.sin(TAU * 1 * elapsed),
      });
    case 'sleep':
      return frame(
        { scaleY: 1 + 0.03 * Math.sin((TAU * elapsed) / SLEEP_BREATH_PERIOD) },
        { EyesClosed: 1 },
      );
    case 'meow': {
      const pop = bell(elapsed, PET_ONE_SHOT_SECONDS.meow);
      const mouth = Math.abs(Math.sin((TAU * elapsed) / 1.33));
      return frame(
        { scaleY: 1 + 0.08 * pop, pitch: -0.2 * pop },
        { Meow: mouth * Math.min(1, pop * 3) },
      );
    }
    case 'askForPets': {
      const swell = bell(elapsed, PET_ONE_SHOT_SECONDS.askForPets);
      const envelope = Math.min(1, swell * 3);
      return frame(
        {
          offsetY: 0.05 * Math.abs(Math.sin(TAU * 0.8 * elapsed)) * envelope,
          roll: 0.08 * Math.sin(TAU * 2.5 * elapsed) * envelope,
        },
        { Happy: 1, EyesHappy: 1 },
      );
    }
    default:
      return frame(
        {
          scaleY: 1 + 0.012 * Math.sin((TAU * elapsed) / BREATH_PERIOD),
          roll: 0.01 * Math.sin((TAU * elapsed) / 5),
        },
        { EyesClosed: blinkWeight(elapsed) },
      );
  }
}
