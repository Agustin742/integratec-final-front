import {
  Material,
  SkinnedMesh,
  Texture,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import {
  GLTFLoader,
  type GLTF,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

export const DRACO_DECODER_PATH = '/decoders/draco/';
export const KTX2_TRANSCODER_PATH = '/decoders/basis/';
export const DEFAULT_SCOPE = '__default__';

export interface GlbLoaderLike {
  loadAsync(url: string): Promise<GLTF>;
}

type CacheEntry =
  | {
      readonly scopeKey: string;
      readonly status: 'pending';
      promise?: Promise<GLTF>;
    }
  | {
      readonly scopeKey: string;
      readonly status: 'fulfilled';
      readonly gltf: GLTF;
    }
  | {
      readonly scopeKey: string;
      readonly status: 'rejected';
      readonly error: unknown;
    };

const assetCache = new Map<string, CacheEntry>();
let sharedLoader: GlbLoaderLike | null = null;
let sharedDracoLoader: DRACOLoader | null = null;
let sharedKtx2Loader: KTX2Loader | null = null;
let activeRenderer: WebGLRenderer | null = null;

function toCacheKey(url: string, scopeKey = DEFAULT_SCOPE): string {
  return `${scopeKey}::${url}`;
}

function isDisposable(value: unknown): value is { dispose: () => void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dispose' in value &&
    typeof (value as { dispose?: unknown }).dispose === 'function'
  );
}

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture || isDisposable(value)) {
      value.dispose();
    }
  }
  material.dispose();
}

/**
 * Recursively disposes geometries, materials, textures, and skeletons on a
 * Three.js `Object3D` subtree, or a `WebGLRenderTarget`
 * (`rules/3d-world-and-camera.md`).
 */
export function disposeObject3D(
  target: Object3D | WebGLRenderTarget | null | undefined,
): void {
  if (!target) return;
  if (target instanceof WebGLRenderTarget) {
    target.dispose();
    return;
  }

  target.traverse((node) => {
    const candidate = node as Object3D & {
      geometry?: unknown;
      material?: unknown;
    };
    if (node instanceof SkinnedMesh && node.skeleton) {
      node.skeleton.dispose();
    }
    if (isDisposable(candidate.geometry)) {
      candidate.geometry.dispose();
    }
    if (Array.isArray(candidate.material)) {
      for (const item of candidate.material) {
        if (item instanceof Material) {
          disposeMaterial(item);
        } else if (isDisposable(item)) {
          item.dispose();
        }
      }
    } else if (candidate.material instanceof Material) {
      disposeMaterial(candidate.material);
    } else if (isDisposable(candidate.material)) {
      candidate.material.dispose();
    }
  });
}

/**
 * Creates a `GLTFLoader` configured with same-origin Draco, KTX2/Basis, and
 * meshopt decoders.
 */
export function createConfiguredGltfLoader(
  renderer?: WebGLRenderer,
): GLTFLoader {
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  sharedDracoLoader?.dispose();
  sharedDracoLoader = draco;

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(KTX2_TRANSCODER_PATH);
  const effectiveRenderer = renderer ?? activeRenderer;
  if (effectiveRenderer) {
    ktx2.detectSupport(effectiveRenderer);
  }
  sharedKtx2Loader?.dispose();
  sharedKtx2Loader = ktx2;

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function configureKtx2RendererSupport(renderer: WebGLRenderer): void {
  activeRenderer = renderer;
  sharedKtx2Loader?.detectSupport(renderer);
}

/**
 * Overrides the shared GLB loader (for deterministic tests).
 * Pass `null` to restore the default `GLTFLoader`.
 */
export function setGlbLoaderForTests(loader: GlbLoaderLike | null): void {
  sharedLoader = loader;
}

function getLoader(): GlbLoaderLike {
  if (!sharedLoader) {
    sharedLoader = createConfiguredGltfLoader();
  }
  return sharedLoader;
}

/**
 * Fetches and parses a GLB asset at most once per `scopeKey`. Concurrent
 * callers share the same in-flight promise; rejected entries remain cached
 * until evicted via `evictRejectedGlbAsset`, retried with `forceRetry: true`,
 * or cleared via `clearAssetCache`.
 */
export function loadGlbAsset(
  url: string,
  options: { readonly scopeKey?: string; readonly forceRetry?: boolean } = {},
): Promise<GLTF> {
  const scopeKey = options.scopeKey ?? DEFAULT_SCOPE;
  const cacheKey = toCacheKey(url, scopeKey);
  const existing = assetCache.get(cacheKey);
  if (existing) {
    if (existing.status === 'pending') {
      if (existing.promise) return existing.promise;
    } else if (existing.status === 'fulfilled') {
      return Promise.resolve(existing.gltf);
    } else {
      if (!options.forceRetry) {
        return Promise.reject(existing.error);
      }
      assetCache.delete(cacheKey);
    }
  }

  const entry: CacheEntry = { scopeKey, status: 'pending' };
  const promise = getLoader()
    .loadAsync(url)
    .then(
      (gltf) => {
        if (assetCache.get(cacheKey) === entry) {
          assetCache.set(cacheKey, { scopeKey, status: 'fulfilled', gltf });
        } else {
          disposeObject3D(gltf.scene);
        }
        return gltf;
      },
      (error: unknown) => {
        if (assetCache.get(cacheKey) === entry) {
          assetCache.set(cacheKey, { scopeKey, status: 'rejected', error });
        }
        throw error;
      },
    );

  entry.promise = promise;
  assetCache.set(cacheKey, entry);
  return promise;
}

/**
 * Suspense-compatible reader for cached GLB assets. Throws the in-flight
 * promise while pending or the rejection error if loading failed.
 */
export function readCachedGlbAsset(
  url: string,
  options: { readonly scopeKey?: string } = {},
): GLTF {
  const scopeKey = options.scopeKey ?? DEFAULT_SCOPE;
  const existing = assetCache.get(toCacheKey(url, scopeKey));
  if (!existing) {
    throw loadGlbAsset(url, { scopeKey });
  }
  if (existing.status === 'pending') {
    throw existing.promise;
  }
  if (existing.status === 'rejected') {
    throw existing.error;
  }
  return existing.gltf;
}

/**
 * Evicts a cached entry only when its status is `'rejected'` so unmounting and
 * remounting `<GlbAsset />` performs a fresh fetch after transient failures.
 */
export function evictRejectedGlbAsset(
  url: string,
  scopeKey = DEFAULT_SCOPE,
): boolean {
  const cacheKey = toCacheKey(url, scopeKey);
  const existing = assetCache.get(cacheKey);
  if (existing?.status !== 'rejected') {
    return false;
  }
  assetCache.delete(cacheKey);
  return true;
}

/**
 * Disposes cached GLTF scenes, geometries, materials, textures, and skeletons
 * (`rules/3d-world-and-camera.md`). When `scopeKey` is provided, only entries
 * for that scope are disposed so sibling canvases or newer scopes stay intact.
 */
export function clearAssetCache(
  options: {
    readonly scopeKey?: string;
    readonly disposeDecoders?: boolean;
  } = {},
): void {
  for (const [key, entry] of assetCache.entries()) {
    if (options.scopeKey !== undefined && entry.scopeKey !== options.scopeKey) {
      continue;
    }
    if (entry.status === 'fulfilled') {
      disposeObject3D(entry.gltf.scene);
    }
    assetCache.delete(key);
  }

  if (options.disposeDecoders) {
    sharedDracoLoader?.dispose();
    sharedDracoLoader = null;
    sharedKtx2Loader?.dispose();
    sharedKtx2Loader = null;
    sharedLoader = null;
    activeRenderer = null;
  }
}

export function getAssetCacheSize(scopeKey?: string): number {
  if (scopeKey === undefined) {
    return assetCache.size;
  }
  let count = 0;
  for (const entry of assetCache.values()) {
    if (entry.scopeKey === scopeKey) count += 1;
  }
  return count;
}
