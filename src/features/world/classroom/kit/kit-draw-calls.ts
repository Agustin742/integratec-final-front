import type { Object3D } from 'three';
import { groupPlacementsByModule, type KitPlacement } from './kit-placement';

/**
 * Estimated draw calls for a placement set: one per `InstancedMesh`, i.e. per
 * source mesh of each distinct module in use. `meshCounts` maps module id to
 * its source mesh count.
 */
export function estimateKitDrawCalls(
  placements: readonly KitPlacement[],
  meshCounts: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const moduleId of groupPlacementsByModule(placements).keys()) {
    total += meshCounts[moduleId] ?? 1;
  }
  return total;
}

/** Counts the `InstancedMesh` objects (draw calls) under built kit groups. */
export function countInstancedDrawCalls(root: Object3D): number {
  let count = 0;
  root.traverse((node) => {
    if ((node as { isInstancedMesh?: boolean }).isInstancedMesh) count += 1;
  });
  return count;
}
