import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { evictRejectedGlbAsset, readCachedGlbAsset } from '../../asset-cache';
import { buildInstancedKitModule } from './build-instanced-kit-module';
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

class KitModuleBoundary extends Component<
  {
    readonly moduleId: ClassroomKitModuleId;
    readonly scopeKey?: string | undefined;
    readonly onModuleError?: ClassroomKitProps['onModuleError'];
    readonly children: ReactNode;
  },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    evictRejectedGlbAsset(
      getKitModuleUrl(this.props.moduleId),
      this.props.scopeKey,
    );
    this.props.onModuleError?.(this.props.moduleId, error);
  }

  render() {
    // Honest fallback: a failed module is skipped; the rest of the kit stays.
    return this.state.failed ? null : this.props.children;
  }
}

function KitModuleInstances({
  moduleId,
  placements,
  scopeKey,
}: {
  readonly moduleId: ClassroomKitModuleId;
  readonly placements: readonly KitPlacement[];
  readonly scopeKey?: string | undefined;
}) {
  const gltf = readCachedGlbAsset(getKitModuleUrl(moduleId), { scopeKey });
  const built = useMemo(
    () => buildInstancedKitModule(moduleId, gltf.scene, placements),
    [moduleId, gltf, placements],
  );
  useEffect(() => built.dispose, [built]);
  return <primitive object={built.group} />;
}

/**
 * Reads the GLBs needed by a placement list through the shared asset cache and
 * renders one instanced group per module. Each module has its own Suspense and
 * error boundary so one failing asset never breaks the scene.
 */
export function ClassroomKit({
  placements,
  scopeKey,
  onModuleError,
}: ClassroomKitProps) {
  const grouped = useMemo(
    () => groupPlacementsByModule(placements),
    [placements],
  );
  return (
    <>
      {[...grouped.entries()].map(([moduleId, modulePlacements]) => (
        <KitModuleBoundary
          key={`${scopeKey ?? ''}:${moduleId}`}
          moduleId={moduleId}
          scopeKey={scopeKey}
          onModuleError={onModuleError}
        >
          <Suspense fallback={null}>
            <KitModuleInstances
              moduleId={moduleId}
              placements={modulePlacements}
              scopeKey={scopeKey}
            />
          </Suspense>
        </KitModuleBoundary>
      ))}
    </>
  );
}
