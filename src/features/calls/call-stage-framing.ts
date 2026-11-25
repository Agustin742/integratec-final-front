/**
 * Head-and-shoulders window of every call tile: half of the visible height and
 * the world height it is centered on. The center sits above the chest so the
 * whole head has headroom for both bodies (crown near 1.8 m, shoulders near
 * 1.35 m).
 */
export const FRAME_HALF = 0.5;
export const FRAME_CENTER_Y = 1.52;

export function frameWindow(): {
  readonly bottom: number;
  readonly top: number;
} {
  return {
    bottom: FRAME_CENTER_Y - FRAME_HALF,
    top: FRAME_CENTER_Y + FRAME_HALF,
  };
}
