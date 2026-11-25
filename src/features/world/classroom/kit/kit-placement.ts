import type { ClassroomKitModuleId } from './classroom-kit-manifest';

/** One instance of a kit module: world position (m) and yaw (radians). */
export interface KitPlacement {
  readonly moduleId: ClassroomKitModuleId;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
}

/** Groups placements by module, preserving first-seen module order. */
export function groupPlacementsByModule(
  placements: readonly KitPlacement[],
): Map<ClassroomKitModuleId, KitPlacement[]> {
  const grouped = new Map<ClassroomKitModuleId, KitPlacement[]>();
  for (const placement of placements) {
    const list = grouped.get(placement.moduleId);
    if (list) list.push(placement);
    else grouped.set(placement.moduleId, [placement]);
  }
  return grouped;
}
