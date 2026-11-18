import { act, screen, waitFor } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  WebGLRenderTarget,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import {
  DRACO_DECODER_PATH,
  KTX2_TRANSCODER_PATH,
  clearAssetCache,
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

  it('configures GLTFLoader with same-origin Draco and KTX2 decoder paths', () => {
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

  it('isolates a failing GLB behind a placeholder without breaking sibling scene content', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { gltf } = createSyntheticGltf();

    setGlbLoaderForTests({
      loadAsync: vi.fn(async (url: string) => {
        if (url === '/models/broken.glb') {
          throw new Error('Corrupt GLB');
        }
        return gltf;
      }),
    });

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
    expect(screen.getByTestId('sibling-scene')).toHaveTextContent(
      'Escena activa',
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('disposes geometries, materials, textures, and render targets when clearing the cache', async () => {
    const { gltf, geometry, material, texture } = createSyntheticGltf();
    const geomDispose = vi.spyOn(geometry, 'dispose');
    const matDispose = vi.spyOn(material, 'dispose');
    const texDispose = vi.spyOn(texture, 'dispose');

    setGlbLoaderForTests({ loadAsync: vi.fn(async () => gltf) });
    await loadGlbAsset('/models/chair.glb');
    expect(getAssetCacheSize()).toBe(1);

    clearAssetCache();
    expect(getAssetCacheSize()).toBe(0);
    expect(geomDispose).toHaveBeenCalledTimes(1);
    expect(matDispose).toHaveBeenCalledTimes(1);
    expect(texDispose).toHaveBeenCalledTimes(1);

    const renderTarget = new WebGLRenderTarget(64, 64);
    const rtDispose = vi.spyOn(renderTarget, 'dispose');
    disposeObject3D(renderTarget);
    expect(rtDispose).toHaveBeenCalledTimes(1);
  });
});
