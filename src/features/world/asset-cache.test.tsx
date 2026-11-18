import { act, screen, waitFor } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import {
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
});
