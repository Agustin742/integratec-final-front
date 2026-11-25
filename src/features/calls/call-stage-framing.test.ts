import { describe, expect, it } from 'vitest';
import { FRAME_CENTER_Y, FRAME_HALF, frameWindow } from './call-stage-framing';

// Standing avatars of both bodies: shoulders near 1.35 m, crown near 1.8 m.
const SHOULDER_Y = 1.35;
const CROWN_Y = 1.82;

describe('call stage framing', () => {
  it('keeps the whole head and shoulders in view', () => {
    const { bottom, top } = frameWindow();
    expect(bottom).toBeLessThan(SHOULDER_Y);
    expect(top).toBeGreaterThan(CROWN_Y);
  });

  it('leaves headroom above the crown', () => {
    expect(frameWindow().top - CROWN_Y).toBeGreaterThanOrEqual(0.1);
  });

  it('is centered in a square window', () => {
    expect(FRAME_HALF).toBeGreaterThan(0);
    expect(frameWindow().top + frameWindow().bottom).toBeCloseTo(
      2 * FRAME_CENTER_Y,
    );
  });
});
