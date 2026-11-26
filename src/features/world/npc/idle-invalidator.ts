/**
 * The 3D stage renders on demand (`frameloop="demand"`). A purely cosmetic
 * idle loop (the tutor bot hovering, Michi sleeping or breathing) must not
 * turn it into a display-rate render loop, so idle motion asks for frames
 * at a capped cadence instead of invalidating on every rendered frame.
 */
export const IDLE_FRAME_INTERVAL_MS = 1000 / 15;

export interface IdleInvalidator {
  /** Schedules at most one pending invalidation per interval. */
  request(): void;
  /** Cancels any pending invalidation; call on unmount. */
  dispose(): void;
}

export function createIdleInvalidator(
  invalidate: () => void,
  intervalMs: number = IDLE_FRAME_INTERVAL_MS,
): IdleInvalidator {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    request() {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        invalidate();
      }, intervalMs);
    },
    dispose() {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
    },
  };
}
