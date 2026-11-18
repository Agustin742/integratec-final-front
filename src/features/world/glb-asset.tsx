import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { SkinnedMesh } from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { evictRejectedGlbAsset, readCachedGlbAsset } from './asset-cache';

export interface GlbAssetProps {
  readonly url: string;
  readonly scopeKey?: string;
  readonly fallback?: ReactNode;
  readonly errorFallback?: ReactNode;
  readonly onError?: (error: unknown) => void;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
}

class AssetErrorBoundary extends Component<
  {
    readonly url: string;
    readonly scopeKey?: string;
    readonly fallback: ReactNode;
    readonly onError?: (error: unknown) => void;
    readonly children: ReactNode;
  },
  { readonly failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    evictRejectedGlbAsset(this.props.url, this.props.scopeKey);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function DefaultAssetPlaceholder({
  position,
  rotation,
  scale,
}: Pick<GlbAssetProps, 'position' | 'rotation' | 'scale'>) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh name="glb-asset-placeholder" position={[0, 0.4, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#E9C99B" roughness={0.95} />
      </mesh>
    </group>
  );
}

function LoadedGlbModel({
  url,
  scopeKey,
  position,
  rotation,
  scale,
}: Pick<
  GlbAssetProps,
  'url' | 'scopeKey' | 'position' | 'rotation' | 'scale'
>) {
  const gltf = readCachedGlbAsset(url, { scopeKey });
  // Use SkeletonUtils.clone so SkinnedMesh bones rebind per instance while
  // sharing cached geometries and materials.
  const instance = useMemo(() => cloneSkeleton(gltf.scene), [gltf]);
  useEffect(() => {
    return () => {
      instance.traverse((node) => {
        if (node instanceof SkinnedMesh && node.skeleton) {
          node.skeleton.dispose();
        }
      });
    };
  }, [instance]);
  return (
    <primitive
      object={instance}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

/**
 * Renders a cached GLB asset inside its own Suspense + error boundary so a
 * single failing asset shows a placeholder without breaking the rest of the
 * 3D scene (`rules/3d-world-and-camera.md`).
 */
export function GlbAsset({
  url,
  scopeKey,
  fallback = null,
  errorFallback,
  onError,
  position,
  rotation,
  scale,
}: GlbAssetProps) {
  const resolvedErrorFallback = errorFallback ?? (
    <DefaultAssetPlaceholder
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );

  return (
    <AssetErrorBoundary
      key={`${scopeKey ?? ''}:${url}`}
      url={url}
      scopeKey={scopeKey}
      fallback={resolvedErrorFallback}
      onError={onError}
    >
      <Suspense fallback={fallback}>
        <LoadedGlbModel
          url={url}
          scopeKey={scopeKey}
          position={position}
          rotation={rotation}
          scale={scale}
        />
      </Suspense>
    </AssetErrorBoundary>
  );
}
