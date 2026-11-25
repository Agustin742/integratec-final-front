/** Cap for any head rotation, so loud audio never looks like head banging. */
export const MAX_NOD_RADIANS = 0.1;

/**
 * Subtle head motion for a speaking avatar: a quick pitch nod plus a slower
 * sideways drift, both scaled by the smoothed voice level (0..1).
 */
export function nodAngles(
  level: number,
  seconds: number,
  reducedMotion: boolean,
): { pitch: number; yaw: number } {
  const amount = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
  if (reducedMotion || amount === 0) return { pitch: 0, yaw: 0 };
  return {
    pitch: MAX_NOD_RADIANS * amount * Math.sin(seconds * 9),
    yaw: MAX_NOD_RADIANS * 0.4 * amount * Math.sin(seconds * 3.1),
  };
}
