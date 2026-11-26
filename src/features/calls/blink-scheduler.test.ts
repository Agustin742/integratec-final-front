import { describe, expect, it } from 'vitest';
import { createBlinkScheduler } from './blink-scheduler';

describe('createBlinkScheduler', () => {
  it('stays open until the first interval elapses', () => {
    const blink = createBlinkScheduler({ random: () => 0 }); // 2s interval
    expect(blink.advance(1.9)).toBe(0);
  });

  it('closes then reopens during a blink', () => {
    const blink = createBlinkScheduler({ random: () => 0, blinkSeconds: 0.2 });
    blink.advance(2); // interval reached: blink starts
    expect(blink.advance(0.1)).toBeCloseTo(1, 5);
    expect(blink.advance(0.15)).toBe(0);
  });

  it('draws the next interval between 2 and 6 seconds', () => {
    const values = [0, 1, 0.5];
    let i = 0;
    const blink = createBlinkScheduler({
      random: () => values[i++ % 3] ?? 0,
      blinkSeconds: 0.2,
    });
    blink.advance(2.01); // first blink starts (interval 2)
    blink.advance(0.5); // finished; next interval draws random 1 => 6s
    expect(blink.advance(5.5)).toBe(0);
    expect(blink.advance(0.6)).toBeGreaterThan(0);
  });

  it('keeps the weight within 0..1', () => {
    const blink = createBlinkScheduler({ random: () => 0.3 });
    for (let t = 0; t < 600; t += 1) {
      const w = blink.advance(0.05);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });
});
