import type { Object3D } from 'three';
import { groupPlacementsByModule, type KitPlacement } from './kit-placement';

/**
 * Estimated draw calls for a placement set once the kit is batched by
 * material: one per distinct material name across the modules in use.
 * `materialNames` maps a module id to the material names its GLB references.
 */
export function estimateKitDrawCalls(
  placements: readonly KitPlacement[],
  materialNames: Readonly<Record<string, readonly string[]>>,
): number {
  const distinct = new Set<string>();
  for (const moduleId of groupPlacementsByModule(placements).keys()) {
    for (const name of materialNames[moduleId] ?? []) distinct.add(name);
  }
  return distinct.size;
}

/** Counts the batched meshes (draw calls) under a built kit group. */
export function countBatchedDrawCalls(root: Object3D): number {
  let count = 0;
  root.traverse((node) => {
    if ((node as { isMesh?: boolean }).isMesh) count += 1;
  });
  return count;
}
