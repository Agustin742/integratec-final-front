import { describe, expect, it } from 'vitest';
import { MAX_NOD_RADIANS, nodAngles } from './speaking-nod';

describe('nodAngles', () => {
  it('is still when silent or when motion is reduced', () => {
    expect(nodAngles(0, 1.3, false)).toEqual({ pitch: 0, yaw: 0 });
    expect(nodAngles(1, 1.3, true)).toEqual({ pitch: 0, yaw: 0 });
  });

  it('grows with the voice level and stays within the cap', () => {
    const quiet = Math.abs(nodAngles(0.2, 0.4, false).pitch);
    const loud = Math.abs(nodAngles(1, 0.4, false).pitch);
    expect(loud).toBeGreaterThan(quiet);
    for (let t = 0; t < 10; t += 0.1) {
      const { pitch, yaw } = nodAngles(1, t, false);
      expect(Math.abs(pitch)).toBeLessThanOrEqual(MAX_NOD_RADIANS);
      expect(Math.abs(yaw)).toBeLessThanOrEqual(MAX_NOD_RADIANS);
    }
  });

  it('clamps invalid levels', () => {
    expect(nodAngles(Number.NaN, 1, false)).toEqual({ pitch: 0, yaw: 0 });
    expect(nodAngles(-1, 0.4, false)).toEqual({ pitch: 0, yaw: 0 });
    expect(Math.abs(nodAngles(5, 0.4, false).pitch)).toBeLessThanOrEqual(
      MAX_NOD_RADIANS,
    );
  });
});
