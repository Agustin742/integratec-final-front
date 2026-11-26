import { describe, expect, it } from 'vitest';
import { computeStageLayout, MAX_STAGE_TILES } from './call-stage-layout';

describe('computeStageLayout', () => {
  it('gives a single participant one big square tile', () => {
    const layout = computeStageLayout({
      width: 800,
      height: 400,
      count: 1,
      gap: 8,
    });
    expect(layout.cols).toBe(1);
    expect(layout.rows).toBe(1);
    expect(layout.tile).toBe(400);
    expect(layout.rects).toEqual([{ x: 200, y: 0, size: 400 }]);
  });

  it('places two tiles side by side in a wide container', () => {
    const layout = computeStageLayout({
      width: 1000,
      height: 400,
      count: 2,
      gap: 10,
    });
    expect([layout.cols, layout.rows]).toEqual([2, 1]);
    expect(layout.tile).toBe(400);
  });

  it('stacks two tiles in a tall container', () => {
    const layout = computeStageLayout({
      width: 400,
      height: 1000,
      count: 2,
      gap: 10,
    });
    expect([layout.cols, layout.rows]).toEqual([1, 2]);
    expect(layout.tile).toBe(400);
  });

  it('never overflows the container and keeps tiles square for 1..12', () => {
    for (const [width, height] of [
      [1280, 720],
      [360, 640],
      [640, 360],
      [200, 200],
    ] as const) {
      for (let count = 1; count <= MAX_STAGE_TILES; count += 1) {
        const layout = computeStageLayout({ width, height, count, gap: 8 });
        expect(layout.rects).toHaveLength(count);
        expect(layout.cols * layout.rows).toBeGreaterThanOrEqual(count);
        for (const rect of layout.rects) {
          expect(rect.size).toBe(layout.tile);
          expect(rect.x).toBeGreaterThanOrEqual(0);
          expect(rect.y).toBeGreaterThanOrEqual(0);
          expect(rect.x + rect.size).toBeLessThanOrEqual(width);
          expect(rect.y + rect.size).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it('maximizes the tile size among column counts', () => {
    const layout = computeStageLayout({
      width: 1280,
      height: 720,
      count: 4,
      gap: 0,
    });
    expect([layout.cols, layout.rows]).toEqual([2, 2]);
    expect(layout.tile).toBe(360);
    const six = computeStageLayout({
      width: 1280,
      height: 720,
      count: 6,
      gap: 0,
    });
    expect(six.tile).toBe(360);
  });

  it('centers an incomplete last row', () => {
    const layout = computeStageLayout({
      width: 300,
      height: 200,
      count: 3,
      gap: 0,
    });
    // 2 cols x 2 rows of 100px; the third tile is centered under the first row.
    expect([layout.cols, layout.rows]).toEqual([2, 2]);
    const [a, b, c] = layout.rects;
    expect(a?.y).toBe(b?.y);
    expect(c?.y).toBe((a?.y ?? 0) + 100);
    expect((c?.x ?? 0) + 50).toBe(((a?.x ?? 0) + (b?.x ?? 0) + 100) / 2 + 0);
  });

  it('returns an empty layout for no space or no participants', () => {
    expect(
      computeStageLayout({ width: 0, height: 300, count: 3, gap: 8 }).rects,
    ).toEqual([]);
    expect(
      computeStageLayout({ width: 300, height: 300, count: 0, gap: 8 }).rects,
    ).toEqual([]);
  });

  it('clamps the participant count to the maximum', () => {
    const layout = computeStageLayout({
      width: 900,
      height: 900,
      count: 40,
      gap: 4,
    });
    expect(layout.rects).toHaveLength(MAX_STAGE_TILES);
  });
});
