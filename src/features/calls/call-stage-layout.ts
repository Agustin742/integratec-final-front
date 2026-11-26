export const MAX_STAGE_TILES = 12;

export interface StageLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly count: number;
  readonly gap: number;
}

export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface StageLayout {
  readonly cols: number;
  readonly rows: number;
  readonly tile: number;
  readonly rects: readonly TileRect[];
}

const EMPTY: StageLayout = { cols: 0, rows: 0, tile: 0, rects: [] };

/**
 * Square tiles of the largest size that fit the stage. Every column count is
 * tried; ties prefer the squarer grid. Rects are centered in the container,
 * and an incomplete last row is centered under the others.
 */
export function computeStageLayout({
  width,
  height,
  count,
  gap,
}: StageLayoutInput): StageLayout {
  const n = Math.min(Math.floor(count), MAX_STAGE_TILES);
  if (!(width > 0) || !(height > 0) || !(n > 0)) return EMPTY;

  let best: { cols: number; rows: number; tile: number } | null = null;
  for (let cols = 1; cols <= n; cols += 1) {
    const rows = Math.ceil(n / cols);
    const tile = Math.floor(
      Math.min(
        (width - (cols - 1) * gap) / cols,
        (height - (rows - 1) * gap) / rows,
      ),
    );
    if (
      tile > 0 &&
      (!best ||
        tile > best.tile ||
        (tile === best.tile &&
          Math.abs(cols - rows) < Math.abs(best.cols - best.rows)))
    ) {
      best = { cols, rows, tile };
    }
  }
  if (!best) return EMPTY;

  const { cols, rows, tile } = best;
  const gridWidth = cols * tile + (cols - 1) * gap;
  const gridHeight = rows * tile + (rows - 1) * gap;
  const left = Math.floor((width - gridWidth) / 2);
  const top = Math.floor((height - gridHeight) / 2);
  const rects: TileRect[] = [];
  for (let i = 0; i < n; i += 1) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const rowWidth = inRow * tile + (inRow - 1) * gap;
    const rowLeft = left + Math.floor((gridWidth - rowWidth) / 2);
    rects.push({
      x: rowLeft + (i - row * cols) * (tile + gap),
      y: top + row * (tile + gap),
      size: tile,
    });
  }
  return { cols, rows, tile, rects };
}
