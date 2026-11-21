import type { ClassroomLayout } from '@/realtime';
import { isWalkable, type Direction } from './step-avatar';

/** A point on the floor plane the avatar walks through. */
export interface Waypoint {
  x: number;
  z: number;
}

/** Default grid cell edge, in metres. */
export const DEFAULT_CELL_SIZE = 0.25;

/** Distance between walkability samples when smoothing a path. */
const LINE_SAMPLE_STEP = 0.05;

/** Extra clearance used when smoothing so waypoints never graze an obstacle corner. */
const SMOOTHING_MARGIN = 0.02;

export interface FindPathOptions {
  /** Grid cell edge in metres (default {@link DEFAULT_CELL_SIZE}). */
  cellSize?: number;
}

interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  minX: number;
  minZ: number;
}

const SQRT2 = Math.SQRT2;
const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

const isPoint = (p: Waypoint): boolean =>
  Number.isFinite(p.x) && Number.isFinite(p.z);

/** Minimal binary min-heap keyed by priority. */
class MinHeap {
  private readonly items: { id: number; priority: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(id: number, priority: number): void {
    const items = this.items;
    items.push({ id, priority });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent]!.priority <= items[i]!.priority) break;
      [items[parent], items[i]] = [items[i]!, items[parent]!];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (
          left < items.length &&
          items[left]!.priority < items[smallest]!.priority
        )
          smallest = left;
        if (
          right < items.length &&
          items[right]!.priority < items[smallest]!.priority
        )
          smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i]!, items[smallest]!];
        i = smallest;
      }
    }
    return top.id;
  }
}

/** True when the straight segment a-b stays walkable, sampled at {@link LINE_SAMPLE_STEP}. */
function hasLineOfSight(
  layout: ClassroomLayout,
  a: Waypoint,
  b: Waypoint,
): boolean {
  const samples = Math.max(
    1,
    Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / LINE_SAMPLE_STEP),
  );
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (!isWalkable(layout, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t))
      return false;
  }
  return true;
}

/** Greedy line-of-sight smoothing: keeps only the corners the avatar really has to turn at. */
function smooth(layout: ClassroomLayout, points: Waypoint[]): Waypoint[] {
  const padded = {
    ...layout,
    avatarRadius: layout.avatarRadius + SMOOTHING_MARGIN,
  };
  const result: Waypoint[] = [];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = anchor + 1;
    for (let j = points.length - 1; j > anchor + 1; j--) {
      if (hasLineOfSight(padded, points[anchor]!, points[j]!)) {
        next = j;
        break;
      }
    }
    result.push(points[next]!);
    anchor = next;
  }
  return result;
}

/**
 * Plans a walkable route from `from` to `to` with grid A* over the layout bounds (8 neighbours,
 * no corner cutting, a cell is open when `isWalkable` holds at its centre), then smooths it.
 * Returns the waypoints to walk through (excluding `from`), the last one being exactly `to`.
 * Returns `null` when `to` is not walkable or cannot be reached. When `from` is not walkable
 * the search starts from the nearest walkable cell.
 */
export function findPath(
  layout: ClassroomLayout,
  from: Waypoint,
  to: Waypoint,
  options: FindPathOptions = {},
): Waypoint[] | null {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  if (!isPoint(from) || !isPoint(to) || !(cellSize > 0)) return null;
  if (!isWalkable(layout, to.x, to.z)) return null;

  const { bounds } = layout;
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
  const grid: Grid = {
    cols,
    rows,
    cellW: (bounds.maxX - bounds.minX) / cols,
    cellH: (bounds.maxZ - bounds.minZ) / rows,
    minX: bounds.minX,
    minZ: bounds.minZ,
  };
  const centreX = (col: number) => grid.minX + (col + 0.5) * grid.cellW;
  const centreZ = (row: number) => grid.minZ + (row + 0.5) * grid.cellH;
  const colOf = (x: number) =>
    Math.min(cols - 1, Math.max(0, Math.floor((x - grid.minX) / grid.cellW)));
  const rowOf = (z: number) =>
    Math.min(rows - 1, Math.max(0, Math.floor((z - grid.minZ) / grid.cellH)));

  const walkableCache = new Uint8Array(cols * rows); // 0 unknown, 1 open, 2 blocked
  const cellOpen = (id: number): boolean => {
    let state = walkableCache[id]!;
    if (state === 0) {
      state = isWalkable(layout, centreX(id % cols), centreZ((id / cols) | 0))
        ? 1
        : 2;
      walkableCache[id] = state;
    }
    return state === 1;
  };

  const goal = rowOf(to.z) * cols + colOf(to.x);
  let start: number;
  if (isWalkable(layout, from.x, from.z)) {
    start = rowOf(from.z) * cols + colOf(from.x);
  } else {
    start = -1;
    let best = Infinity;
    for (let id = 0; id < cols * rows; id++) {
      if (!cellOpen(id)) continue;
      const d = Math.hypot(
        centreX(id % cols) - from.x,
        centreZ((id / cols) | 0) - from.z,
      );
      if (d < best) {
        best = d;
        start = id;
      }
    }
    if (start < 0) return null;
  }
  if (start === goal) return [{ x: to.x, z: to.z }];

  // The cells holding the real endpoints are always open, even if their centre is not walkable.
  const open = (id: number) => id === start || id === goal || cellOpen(id);

  const goalCol = goal % cols;
  const goalRow = (goal / cols) | 0;
  const heuristic = (id: number): number => {
    const dx = Math.abs((id % cols) - goalCol);
    const dz = Math.abs(((id / cols) | 0) - goalRow);
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  };

  const cost = new Float64Array(cols * rows).fill(Infinity);
  const parent = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const heap = new MinHeap();
  cost[start] = 0;
  heap.push(start, heuristic(start));

  let found = false;
  while (heap.size > 0) {
    const current = heap.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    if (current === goal) {
      found = true;
      break;
    }
    const col = current % cols;
    const row = (current / cols) | 0;
    for (const [dc, dr, step] of NEIGHBOURS) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const id = nr * cols + nc;
      if (closed[id] || !open(id)) continue;
      // No corner cutting: a diagonal needs both orthogonal neighbours open.
      if (dc !== 0 && dr !== 0) {
        if (!open(row * cols + nc) || !open(nr * cols + col)) continue;
      }
      const next = cost[current]! + step;
      if (next < cost[id]!) {
        cost[id] = next;
        parent[id] = current;
        heap.push(id, next + heuristic(id));
      }
    }
  }
  if (!found) return null;

  const cells: Waypoint[] = [];
  for (let id = parent[goal]!; id !== -1 && id !== start; id = parent[id]!) {
    cells.push({ x: centreX(id % cols), z: centreZ((id / cols) | 0) });
  }
  cells.reverse();
  return smooth(layout, [
    { x: from.x, z: from.z },
    ...cells,
    { x: to.x, z: to.z },
  ]);
}

/** Result of one {@link directionToward} call. */
export interface PathFollow {
  /** Unit direction to the current waypoint; `{ x: 0, z: 0 }` once arrived. */
  direction: Direction;
  /** Waypoints still to walk, starting with the current target. Pass it back next frame. */
  remaining: Waypoint[];
  /** True only when the final waypoint is within the arrive radius. */
  arrived: boolean;
}

/**
 * Path follower step. Drops intermediate waypoints already within `arriveRadius`, then returns
 * the unit direction to the next one. Arrival is reported only when the pose is within
 * `arriveRadius` of the FINAL waypoint. Choose a radius of at least half the distance covered per
 * frame (`speed * dt / 2`) so a step cannot jump over the arrival disc.
 */
export function directionToward(
  pose: { x: number; z: number },
  waypoints: readonly Waypoint[],
  arriveRadius: number,
): PathFollow {
  let index = 0;
  while (index < waypoints.length) {
    const target = waypoints[index]!;
    // Negated comparison so a NaN pose never counts as reached.
    if (!(Math.hypot(target.x - pose.x, target.z - pose.z) <= arriveRadius))
      break;
    index++;
  }
  const remaining = waypoints.slice(index);
  const target = remaining[0];
  if (!target) {
    return { direction: { x: 0, z: 0 }, remaining, arrived: true };
  }
  const dx = target.x - pose.x;
  const dz = target.z - pose.z;
  const length = Math.hypot(dx, dz);
  return {
    direction: { x: dx / length, z: dz / length },
    remaining,
    arrived: false,
  };
}
