import type { ClassroomLayout } from '@/realtime';

/** Height of every desk top above the floor, in meters. */
export const DESK_HEIGHT = 0.75;

/**
 * The shared layout has no ids or kinds on its obstacles. By its documented
 * convention (`CLASSROOM_LAYOUT` in `contracts.generated.ts`) the first one is
 * the teacher desk and the rest are student desks; revisit when per-classroom
 * layouts (#79) carry explicit kinds.
 */
export const TEACHER_DESK_INDEX = 0;

export interface DeskFootprint {
  readonly kind: 'teacher' | 'student';
  /** Index of the layout obstacle this desk visualizes. */
  readonly index: number;
  readonly centerX: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
}

/** One desk per layout obstacle, so the visuals match the collisions exactly. */
export function deriveDesks(layout: ClassroomLayout): DeskFootprint[] {
  return layout.obstacles.map((box, index) => ({
    kind: index === TEACHER_DESK_INDEX ? 'teacher' : 'student',
    index,
    centerX: (box.minX + box.maxX) / 2,
    centerZ: (box.minZ + box.maxZ) / 2,
    width: box.maxX - box.minX,
    depth: box.maxZ - box.minZ,
  }));
}
