import { useEffect, useMemo, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { evictRejectedGlbAsset, loadGlbAsset } from '../../asset-cache';
import { buildBatchedKit } from './build-batched-kit';
import {
  getKitModuleUrl,
  type ClassroomKitModuleId,
} from './classroom-kit-manifest';
import { groupPlacementsByModule, type KitPlacement } from './kit-placement';

export interface ClassroomKitProps {
  readonly placements: readonly KitPlacement[];
  readonly scopeKey?: string;
  readonly onModuleError?: (
    moduleId: ClassroomKitModuleId,
    error: unknown,
  ) => void;
}

type LoadedModules = ReadonlyMap<ClassroomKitModuleId, Object3D>;

/**
 * Loads every module through the shared asset cache. Each module has its own
 * error capture: a failed module is reported, evicted from the cache so a
 * remount retries, and simply left out of the batch (honest per-module
 * fallback). Returns `null` until the first load settles.
 */
function useKitModules(
  moduleIds: readonly ClassroomKitModuleId[],
  scopeKey: string | undefined,
  onModuleError: ClassroomKitProps['onModuleError'],
): LoadedModules | null {
  const [modules, setModules] = useState<LoadedModules | null>(null);
  const onErrorRef = useRef(onModuleError);
  useEffect(() => {
    onErrorRef.current = onModuleError;
  }, [onModuleError]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      moduleIds.map((moduleId) =>
        loadGlbAsset(getKitModuleUrl(moduleId), { scopeKey }).then(
          (gltf) => [moduleId, gltf.scene] as const,
          (error: unknown) => {
            if (!cancelled) {
              evictRejectedGlbAsset(getKitModuleUrl(moduleId), scopeKey);
              onErrorRef.current?.(moduleId, error);
            }
            return null;
          },
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const loaded = new Map<ClassroomKitModuleId, Object3D>();
      for (const entry of results) {
        if (entry) loaded.set(entry[0], entry[1]);
      }
      setModules(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleIds, scopeKey]);

  return modules;
}

/**
 * Reads the GLBs needed by a placement list through the shared asset cache and
 * renders the whole kit as one static batch (one draw call per material). The
 * batch is built once every module settled; modules that failed are skipped.
 */
export function ClassroomKit({
  placements,
  scopeKey,
  onModuleError,
}: ClassroomKitProps) {
  const idsKey = useMemo(
    () => [...groupPlacementsByModule(placements).keys()].join('|'),
    [placements],
  );
  const moduleIds = useMemo(
    () => (idsKey ? (idsKey.split('|') as ClassroomKitModuleId[]) : []),
    [idsKey],
  );
  const modules = useKitModules(moduleIds, scopeKey, onModuleError);
  const built = useMemo(
    () => (modules ? buildBatchedKit(modules, placements) : null),
    [modules, placements],
  );
  // Disposing releases GPU buffers only; the group stays attached and the
  // geometry data stays in memory, so a StrictMode remount re-uploads it.
  useEffect(() => built?.dispose, [built]);
  return built ? <primitive object={built.group} /> : null;
}
