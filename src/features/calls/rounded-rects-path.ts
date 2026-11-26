import type { TileRect } from './call-stage-layout';

/** Corner radius for a tile: about 8% of its side, kept between 8 and 20 px. */
export function tileRadius(size: number): number {
  return Math.min(20, Math.max(8, Math.round(size * 0.08)));
}

/**
 * SVG path of rounded squares. The avatar canvas draws square viewports, so a
 * CSS `clip-path: path()` built from this rounds their corners to match the
 * DOM tiles.
 */
export function roundedRectsPath(
  rects: readonly TileRect[],
  radius: number,
): string {
  const r = radius;
  return rects
    .map(({ x, y, size: s }) =>
      [
        `M ${x + r} ${y}`,
        `H ${x + s - r}`,
        `A ${r} ${r} 0 0 1 ${x + s} ${y + r}`,
        `V ${y + s - r}`,
        `A ${r} ${r} 0 0 1 ${x + s - r} ${y + s}`,
        `H ${x + r}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + s - r}`,
        `V ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        'Z',
      ].join(' '),
    )
    .join(' ');
}
