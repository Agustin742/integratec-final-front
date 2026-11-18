import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { readCachedGlbAsset } from './asset-cache';

export interface GlbAssetProps {
  readonly url: string;
  readonly fallback?: ReactNode;
  readonly errorFallback?: ReactNode;
  readonly onError?: (error: unknown) => void;
  readonly position?: readonly [number, number, number];
  readonly rotation?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
}

class AssetErrorBoundary extends Component<
  {
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
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function DefaultAssetPlaceholder() {
  return (
    <mesh name="glb-asset-placeholder">
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshStandardMaterial color="#E9C99B" roughness={0.95} />
    </mesh>
  );
}

function LoadedGlbModel({
  url,
  position,
  rotation,
  scale,
}: Pick<GlbAssetProps, 'url' | 'position' | 'rotation' | 'scale'>) {
  const gltf = readCachedGlbAsset(url);
  // Clone scene graph per instance while sharing cached geometries/materials.
  const instance = useMemo(() => gltf.scene.clone(true), [gltf]);
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
  fallback = null,
  errorFallback = <DefaultAssetPlaceholder />,
  onError,
  position,
  rotation,
  scale,
}: GlbAssetProps) {
  return (
    <AssetErrorBoundary key={url} fallback={errorFallback} onError={onError}>
      <Suspense fallback={fallback}>
        <LoadedGlbModel
          url={url}
          position={position}
          rotation={rotation}
          scale={scale}
        />
      </Suspense>
    </AssetErrorBoundary>
  );
}
