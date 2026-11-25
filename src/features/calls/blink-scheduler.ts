export const BLINK_MIN_SECONDS = 2;
export const BLINK_MAX_SECONDS = 6;

export interface BlinkSchedulerOptions {
  readonly random?: () => number;
  /** Total time of one blink (close and reopen). */
  readonly blinkSeconds?: number;
}

export interface BlinkScheduler {
  /** Advances by `dt` seconds and returns the Blink morph weight (0..1). */
  advance(dt: number): number;
}

/** Frame-driven so it pauses with the render loop and is deterministic in tests. */
export function createBlinkScheduler({
  random = Math.random,
  blinkSeconds = 0.16,
}: BlinkSchedulerOptions = {}): BlinkScheduler {
  const nextInterval = () =>
    BLINK_MIN_SECONDS + random() * (BLINK_MAX_SECONDS - BLINK_MIN_SECONDS);
  let wait = nextInterval();
  let progress = -1; // -1: eyes open, waiting
  return {
    advance(dt) {
      let remaining = Math.max(0, dt);
      if (progress < 0) {
        if (remaining < wait) {
          wait -= remaining;
          return 0;
        }
        remaining -= wait;
        progress = 0;
      }
      progress += remaining;
      if (progress >= blinkSeconds) {
        progress = -1;
        wait = nextInterval();
        return 0;
      }
      return Math.sin((progress / blinkSeconds) * Math.PI);
    },
  };
}
