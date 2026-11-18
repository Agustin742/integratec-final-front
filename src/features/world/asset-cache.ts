import {
  Material,
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

export interface GlbLoaderLike {
  loadAsync(url: string): Promise<GLTF>;
}

type CacheEntry =
  | { readonly status: 'pending'; readonly promise: Promise<GLTF> }
  | { readonly status: 'fulfilled'; readonly gltf: GLTF }
  | { readonly status: 'rejected'; readonly error: unknown };

const assetCache = new Map<string, CacheEntry>();
let sharedLoader: GlbLoaderLike | null = null;
let sharedDracoLoader: DRACOLoader | null = null;
let sharedKtx2Loader: KTX2Loader | null = null;

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
 * Recursively disposes geometries, materials, and textures on a Three.js
 * `Object3D` subtree, or a `WebGLRenderTarget` (`rules/3d-world-and-camera.md`).
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
  sharedDracoLoader = draco;

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(KTX2_TRANSCODER_PATH);
  if (renderer) {
    ktx2.detectSupport(renderer);
  }
  sharedKtx2Loader = ktx2;

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function configureKtx2RendererSupport(renderer: WebGLRenderer): void {
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
 * Fetches and parses a GLB asset at most once per cache lifetime. Concurrent
 * callers share the same in-flight promise.
 */
export function loadGlbAsset(url: string): Promise<GLTF> {
  const existing = assetCache.get(url);
  if (existing) {
    if (existing.status === 'pending') return existing.promise;
    if (existing.status === 'fulfilled') return Promise.resolve(existing.gltf);
    return Promise.reject(existing.error);
  }

  const promise = getLoader()
    .loadAsync(url)
    .then(
      (gltf) => {
        if (assetCache.get(url)?.status === 'pending') {
          assetCache.set(url, { status: 'fulfilled', gltf });
        }
        return gltf;
      },
      (error: unknown) => {
        if (assetCache.get(url)?.status === 'pending') {
          assetCache.set(url, { status: 'rejected', error });
        }
        throw error;
      },
    );

  assetCache.set(url, { status: 'pending', promise });
  return promise;
}

/**
 * Suspense-compatible reader for cached GLB assets. Throws the in-flight
 * promise while pending or the rejection error if loading failed.
 */
export function readCachedGlbAsset(url: string): GLTF {
  const existing = assetCache.get(url);
  if (!existing) {
    throw loadGlbAsset(url);
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
 * Disposes all cached GLTF scenes, geometries, materials, textures, and
 * decoders (`rules/3d-world-and-camera.md`). Called on classroom switch,
 * canvas unmount, and session logout.
 */
export function clearAssetCache(
  options: { disposeDecoders?: boolean } = {},
): void {
  for (const entry of assetCache.values()) {
    if (entry.status === 'fulfilled') {
      disposeObject3D(entry.gltf.scene);
    }
  }
  assetCache.clear();

  if (options.disposeDecoders) {
    sharedDracoLoader?.dispose();
    sharedDracoLoader = null;
    sharedKtx2Loader?.dispose();
    sharedKtx2Loader = null;
    sharedLoader = null;
  }
}

export function getAssetCacheSize(): number {
  return assetCache.size;
}
