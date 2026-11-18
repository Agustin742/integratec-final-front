import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { act, screen, waitFor } from '@testing-library/react';
import {
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import {
  DEFAULT_SCOPE,
  DRACO_DECODER_PATH,
  KTX2_TRANSCODER_PATH,
  clearAssetCache,
  configureKtx2RendererSupport,
  createConfiguredGltfLoader,
  disposeObject3D,
  getAssetCacheSize,
  loadGlbAsset,
  setGlbLoaderForTests,
} from './asset-cache';
import { GlbAsset } from './glb-asset';

function createSyntheticGltf(): {
  gltf: GLTF;
  geometry: BoxGeometry;
  material: MeshStandardMaterial;
  texture: Texture;
} {
  const geometry = new BoxGeometry(1, 1, 1);
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const mesh = new Mesh(geometry, material);
  const scene = new Group();
  scene.add(mesh);
  return {
    gltf: {
      scene,
      scenes: [scene],
      animations: [],
      cameras: [],
      asset: {},
    } as unknown as GLTF,
    geometry,
    material,
    texture,
  };
}

describe('asset-cache & GlbAsset', () => {
  afterEach(() => {
    clearAssetCache({ disposeDecoders: true });
    setGlbLoaderForTests(null);
    vi.restoreAllMocks();
  });

  it('configures GLTFLoader with same-origin Draco, KTX2, and meshopt decoders', () => {
    const fakeRenderer = {
      capabilities: { isWebGL2: true },
      extensions: { has: () => false, get: () => null },
    } as unknown as WebGLRenderer;
    configureKtx2RendererSupport(fakeRenderer);
    const loader = createConfiguredGltfLoader();
    expect(DRACO_DECODER_PATH).toBe('/decoders/draco/');
    expect(KTX2_TRANSCODER_PATH).toBe('/decoders/basis/');
    expect(loader.dracoLoader).toBeTruthy();
  });

  it('fetches and parses the same GLB URL only once across concurrent and repeated loads', async () => {
    const { gltf } = createSyntheticGltf();
    const loadAsync = vi.fn(async () => gltf);
    setGlbLoaderForTests({ loadAsync });

    const [first, second] = await Promise.all([
      loadGlbAsset('/models/desk.glb'),
      loadGlbAsset('/models/desk.glb'),
    ]);
    const third = await loadGlbAsset('/models/desk.glb');

    expect(loadAsync).toHaveBeenCalledTimes(1);
    expect(first).toBe(gltf);
    expect(second).toBe(gltf);
    expect(third).toBe(gltf);
    expect(getAssetCacheSize()).toBe(1);
  });

  it('allows explicit forceRetry after a transient rejection', async () => {
    const { gltf } = createSyntheticGltf();
    let attempt = 0;
    const loadAsync = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw new Error('Transient 503');
      }
      return gltf;
    });
    setGlbLoaderForTests({ loadAsync });

    await expect(loadGlbAsset('/models/transient.glb')).rejects.toThrow(
      'Transient 503',
    );
    expect(getAssetCacheSize()).toBe(1);

    const recovered = await loadGlbAsset('/models/transient.glb', {
      forceRetry: true,
    });
    expect(recovered).toBe(gltf);
    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  it('isolates a failing GLB behind a placeholder while keeping sibling scene content alive', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { gltf } = createSyntheticGltf();
    const loadAsync = vi.fn(async (url: string) => {
      if (url === '/models/broken.glb') {
        throw new Error('Corrupt GLB');
      }
      return gltf;
    });
    setGlbLoaderForTests({ loadAsync });

    await act(async () => {
      render(
        <div>
          <span data-testid="sibling-scene">Escena activa</span>
          <GlbAsset
            url="/models/broken.glb"
            errorFallback={
              <span data-testid="asset-placeholder">Placeholder</span>
            }
          />
          <GlbAsset url="/models/ok.glb" />
        </div>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('asset-placeholder')).toBeInTheDocument();
    });
    expect(loadAsync).toHaveBeenCalledWith('/models/ok.glb');
    expect(screen.getByTestId('sibling-scene')).toHaveTextContent(
      'Escena activa',
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('disposes only the cleared scopeKey and disposes geometries, materials, textures, and render targets', async () => {
    const assetA = createSyntheticGltf();
    const assetB = createSyntheticGltf();
    const disposeGeomA = vi.spyOn(assetA.geometry, 'dispose');
    const disposeMatA = vi.spyOn(assetA.material, 'dispose');
    const disposeTexA = vi.spyOn(assetA.texture, 'dispose');
    const disposeGeomB = vi.spyOn(assetB.geometry, 'dispose');

    setGlbLoaderForTests({
      loadAsync: vi.fn(async (url: string) =>
        url === '/models/a.glb' ? assetA.gltf : assetB.gltf,
      ),
    });

    await loadGlbAsset('/models/a.glb', { scopeKey: 'class-a' });
    await loadGlbAsset('/models/b.glb', { scopeKey: 'class-b' });
    expect(getAssetCacheSize()).toBe(2);

    clearAssetCache({ scopeKey: 'class-a' });
    expect(getAssetCacheSize('class-a')).toBe(0);
    expect(getAssetCacheSize('class-b')).toBe(1);
    expect(disposeGeomA).toHaveBeenCalledTimes(1);
    expect(disposeMatA).toHaveBeenCalledTimes(1);
    expect(disposeTexA).toHaveBeenCalledTimes(1);
    expect(disposeGeomB).not.toHaveBeenCalled();

    const renderTarget = new WebGLRenderTarget(64, 64);
    const rtDispose = vi.spyOn(renderTarget, 'dispose');
    disposeObject3D(renderTarget);
    expect(rtDispose).toHaveBeenCalledTimes(1);
  });

  it('executes Draco and Basis/KTX2 decoders without string code generation under strict CSP', async () => {
    const decodersDir = resolve(process.cwd(), 'public/decoders');
    const basisCode = readFileSync(
      resolve(decodersDir, 'basis/basis_transcoder.js'),
      'utf8',
    );
    const basisWasm = readFileSync(
      resolve(decodersDir, 'basis/basis_transcoder.wasm'),
    );
    const dracoCode = readFileSync(
      resolve(decodersDir, 'draco/draco_wasm_wrapper.js'),
      'utf8',
    );
    const dracoWasm = readFileSync(
      resolve(decodersDir, 'draco/draco_decoder.wasm'),
    );

    expect(basisCode).not.toMatch(/new\s+Function|\bnewFunc\b|\bFunction\s*\(/);
    expect(dracoCode).not.toMatch(/new\s+Function|\bnewFunc\b|\bFunction\s*\(/);

    const basisContext = vm.createContext(
      { console, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout },
      { codeGeneration: { strings: false, wasm: true } },
    );
    const BASIS = new vm.Script(`${basisCode}\n;BASIS;`).runInContext(
      basisContext,
    ) as (opts: { wasmBinary: Buffer }) => Promise<{
      initializeBasis: () => void;
      KTX2File: new (data: Uint8Array) => {
        isValid: () => boolean;
        close: () => void;
        delete: () => void;
      };
    }>;
    const basisModule = await BASIS({ wasmBinary: basisWasm });
    basisModule.initializeBasis();
    const ktx2File = new basisModule.KTX2File(new Uint8Array(16));
    expect(typeof ktx2File.isValid()).toBe('boolean');
    ktx2File.close();
    ktx2File.delete();

    const dracoContext = vm.createContext(
      { console, TextDecoder, TextEncoder, URL, setTimeout, clearTimeout },
      { codeGeneration: { strings: false, wasm: true } },
    );
    const DracoDecoderModule = new vm.Script(
      `${dracoCode}\n;DracoDecoderModule;`,
    ).runInContext(dracoContext) as (opts: { wasmBinary: Buffer }) => Promise<{
      Decoder: new () => unknown;
      destroy: (instance: unknown) => void;
    }>;
    const dracoModule = await DracoDecoderModule({ wasmBinary: dracoWasm });
    const dracoDecoder = new dracoModule.Decoder();
    dracoModule.destroy(dracoDecoder);
  });

  it('disposes cloned per-instance skeletons on GlbAsset unmount without disposing shared geometries or materials', async () => {
    const geometry = new BoxGeometry(1, 1, 1);
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const bone = new Bone();
    const cachedSkeleton = new Skeleton([bone]);
    const skinnedMesh = new SkinnedMesh(geometry, material);
    skinnedMesh.add(bone);
    skinnedMesh.bind(cachedSkeleton);
    const scene = new Group();
    scene.add(skinnedMesh);

    const gltf = {
      scene,
      scenes: [scene],
      animations: [],
      cameras: [],
      asset: {},
    } as unknown as GLTF;

    setGlbLoaderForTests({
      loadAsync: vi.fn(async () => gltf),
    });

    const skeletonProtoDispose = vi.spyOn(Skeleton.prototype, 'dispose');
    const geomDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');
    const texDispose = vi.spyOn(texture, 'dispose');

    let unmountView: (() => void) | undefined;
    await act(async () => {
      const rendered = render(
        <GlbAsset
          url="/models/rigged.glb"
          fallback={<span data-testid="rigged-loading">Loading</span>}
        />,
      );
      unmountView = rendered.unmount;
    });

    await waitFor(() => {
      expect(screen.queryByTestId('rigged-loading')).not.toBeInTheDocument();
    });

    skeletonProtoDispose.mockClear();
    unmountView?.();

    expect(skeletonProtoDispose).toHaveBeenCalledTimes(1);
    expect(skeletonProtoDispose.mock.instances[0]).toBeInstanceOf(Skeleton);
    expect(skeletonProtoDispose.mock.instances[0]).not.toBe(cachedSkeleton);
    expect(geomDispose).not.toHaveBeenCalled();
    expect(matDispose).not.toHaveBeenCalled();
    expect(texDispose).not.toHaveBeenCalled();
  });

  it('disposes previous decoders when createConfiguredGltfLoader replaces them and isolates DEFAULT_SCOPE cleanup', async () => {
    const dracoDispose = vi.spyOn(DRACOLoader.prototype, 'dispose');
    const ktx2Dispose = vi.spyOn(KTX2Loader.prototype, 'dispose');
    const detectSupport = vi.spyOn(KTX2Loader.prototype, 'detectSupport');

    const fakeRenderer = {
      capabilities: { isWebGL2: true },
      extensions: { has: () => false, get: () => null },
    } as unknown as WebGLRenderer;
    configureKtx2RendererSupport(fakeRenderer);

    createConfiguredGltfLoader();
    expect(dracoDispose).not.toHaveBeenCalled();
    expect(ktx2Dispose).not.toHaveBeenCalled();

    createConfiguredGltfLoader();
    expect(dracoDispose).toHaveBeenCalledTimes(1);
    expect(ktx2Dispose).toHaveBeenCalledTimes(1);

    const { gltf: defaultAsset } = createSyntheticGltf();
    const { gltf: scopedAsset } = createSyntheticGltf();
    setGlbLoaderForTests({
      loadAsync: vi.fn(async (url: string) =>
        url === '/models/default.glb' ? defaultAsset : scopedAsset,
      ),
    });

    await loadGlbAsset('/models/default.glb');
    await loadGlbAsset('/models/scoped.glb', { scopeKey: 'class-1' });
    clearAssetCache({ scopeKey: DEFAULT_SCOPE });

    expect(getAssetCacheSize(DEFAULT_SCOPE)).toBe(0);
    expect(getAssetCacheSize('class-1')).toBe(1);

    detectSupport.mockClear();
    createConfiguredGltfLoader();
    expect(detectSupport).toHaveBeenCalledWith(fakeRenderer);
  });

  it('evicts rejected entry on AssetErrorBoundary catch so remounting GlbAsset retries and recovers', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { gltf } = createSyntheticGltf();
    let attempts = 0;
    const loadAsync = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('Transient 503');
      }
      return gltf;
    });
    setGlbLoaderForTests({ loadAsync });

    let unmountFirst: (() => void) | undefined;
    await act(async () => {
      const rendered = render(
        <GlbAsset
          url="/models/flaky.glb"
          fallback={<span data-testid="flaky-loading">Loading</span>}
          errorFallback={<span data-testid="flaky-error">Fallback</span>}
        />,
      );
      unmountFirst = rendered.unmount;
    });

    await waitFor(() => {
      expect(screen.getByTestId('flaky-error')).toBeInTheDocument();
    });
    expect(loadAsync).toHaveBeenCalledTimes(1);
    expect(getAssetCacheSize()).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();

    unmountFirst?.();

    await act(async () => {
      render(
        <GlbAsset
          url="/models/flaky.glb"
          fallback={<span data-testid="flaky-loading">Loading</span>}
          errorFallback={<span data-testid="flaky-error">Fallback</span>}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('flaky-loading')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('flaky-error')).not.toBeInTheDocument();
    expect(loadAsync).toHaveBeenCalledTimes(2);
    expect(getAssetCacheSize()).toBe(1);
  });
});
