import { describe, expect, it } from 'vitest';
import { roundedRectsPath, tileRadius } from './rounded-rects-path';

describe('roundedRectsPath', () => {
  it('draws one closed rounded subpath per rect', () => {
    const path = roundedRectsPath(
      [
        { x: 0, y: 0, size: 100 },
        { x: 110, y: 0, size: 100 },
      ],
      12,
    );
    expect(path.match(/M/g)).toHaveLength(2);
    expect(path.match(/Z/g)).toHaveLength(2);
    expect(path.match(/A 12 12/g)).toHaveLength(8);
    expect(path.startsWith('M 12 0')).toBe(true);
  });

  it('is empty without rects', () => {
    expect(roundedRectsPath([], 12)).toBe('');
  });
});

describe('tileRadius', () => {
  it('scales with the tile and stays within bounds', () => {
    expect(tileRadius(40)).toBe(8);
    expect(tileRadius(400)).toBe(20);
    expect(tileRadius(0)).toBe(8);
  });
});
