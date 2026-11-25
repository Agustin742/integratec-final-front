import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const disposeMaterial = vi.fn();
  const renderListsDispose = vi.fn();
  const rendererDispose = vi.fn();
  const render = vi.fn();
  const toDataURL = vi.fn(() => 'data:image/png;base64,OK');
  const clearAssetCache = vi.fn();
  const configureKtx2RendererSupport = vi.fn();
  const loadGlbAsset = vi.fn();
  let lost = false;
  const listeners = new Map<
    string,
    Array<(event: { preventDefault: () => void }) => void>
  >();

  const domElement = {
    addEventListener: vi.fn(
      (type: string, cb: (event: { preventDefault: () => void }) => void) => {
        const list = listeners.get(type) ?? [];
        list.push(cb);
        listeners.set(type, list);
      },
    ),
    toDataURL,
  };

  return {
    disposeMaterial,
    renderListsDispose,
    rendererDispose,
    render,
    toDataURL,
    clearAssetCache,
    configureKtx2RendererSupport,
    loadGlbAsset,
    domElement,
    setLost: (value: boolean) => {
      lost = value;
    },
    isLost: () => lost,
    emit: (type: string) => {
      for (const cb of listeners.get(type) ?? []) {
        cb({ preventDefault: () => {} });
      }
    },
    resetListeners: () => listeners.clear(),
  };
});

vi.mock('three', () => {
  class MockMaterial {
    color: unknown = null;
    clone() {
      return new MockMaterial();
    }
    dispose() {
      mocks.disposeMaterial();
    }
  }
  class MockMesh {
    material = new MockMaterial();
  }
  class MockGroup {
    private meshes = [new MockMesh()];
    clone() {
      return this;
    }
    traverse(fn: (node: unknown) => void) {
      for (const m of this.meshes) fn(m);
    }
  }
  class Box3 {
    setFromObject() {
      return this;
    }
    getCenter(v: Vector3) {
      return v;
    }
    getSize(v: Vector3) {
      v.x = 1;
      v.y = 1;
      v.z = 1;
      return v;
    }
  }
  class Vector3 {
    x = 0;
    y = 0;
    z = 0;
  }
  class Color {
    constructor(public hex: string) {}
  }
  class Scene {
    add = vi.fn();
    remove = vi.fn();
  }
  class AmbientLight {}
  class DirectionalLight {
    position = { set: vi.fn() };
  }
  class PerspectiveCamera {
    fov = 30;
    position = { set: vi.fn() };
    lookAt = vi.fn();
  }
  class WebGLRenderer {
    domElement = mocks.domElement;
    outputColorSpace = '';
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    setClearColor = vi.fn();
    render = mocks.render;
    renderLists = { dispose: mocks.renderListsDispose };
    dispose = mocks.rendererDispose;
    getContext() {
      return { isContextLost: mocks.isLost };
    }
  }
  return {
    AmbientLight,
    Box3,
    Color,
    DirectionalLight,
    Group: MockGroup,
    Mesh: MockMesh,
    MeshStandardMaterial: MockMaterial,
    PerspectiveCamera,
    SRGBColorSpace: 'srgb',
    Scene,
    Vector3,
    WebGLRenderer,
  };
});

vi.mock('@/features/world/asset-cache', () => ({
  clearAssetCache: mocks.clearAssetCache,
  configureKtx2RendererSupport: mocks.configureKtx2RendererSupport,
  loadGlbAsset: mocks.loadGlbAsset,
}));

import { Group } from 'three';
import {
  disposePreviewRenderer,
  renderGlbThumbnail,
} from './item-preview-renderer';

describe('item-preview-renderer', () => {
  beforeEach(() => {
    disposePreviewRenderer();
    mocks.resetListeners();
    mocks.setLost(false);
    mocks.disposeMaterial.mockClear();
    mocks.renderListsDispose.mockClear();
    mocks.rendererDispose.mockClear();
    mocks.render.mockReset();
    mocks.clearAssetCache.mockClear();
    mocks.configureKtx2RendererSupport.mockClear();
    mocks.loadGlbAsset.mockReset();
    mocks.loadGlbAsset.mockResolvedValue({
      scene: new Group(),
    });
  });

  it('configures KTX2, disposes cloned tinted materials, and clears asset cache', async () => {
    const src = await renderGlbThumbnail(
      '/models/avatars/male/a.glb',
      '#1E3A8A',
    );
    expect(src).toBe('data:image/png;base64,OK');
    expect(mocks.configureKtx2RendererSupport).toHaveBeenCalledTimes(1);
    expect(mocks.disposeMaterial).toHaveBeenCalledTimes(1);
    expect(mocks.renderListsDispose).toHaveBeenCalledTimes(1);
    expect(mocks.clearAssetCache).toHaveBeenCalledWith({
      scopeKey: 'shop-preview',
    });
  });

  it('still cleans render lists and cache when render throws', async () => {
    mocks.render.mockImplementationOnce(() => {
      throw new Error('gpu boom');
    });
    await expect(
      renderGlbThumbnail('/models/avatars/male/err.glb'),
    ).rejects.toThrow('gpu boom');
    expect(mocks.renderListsDispose).toHaveBeenCalledTimes(1);
    expect(mocks.clearAssetCache).toHaveBeenCalledWith({
      scopeKey: 'shop-preview',
    });
  });

  it('rejects without caching blank PNG on webglcontextlost and recovers cleanly', async () => {
    mocks.render.mockImplementationOnce(() => {
      mocks.emit('webglcontextlost');
    });
    await expect(
      renderGlbThumbnail('/models/avatars/male/lost.glb'),
    ).rejects.toThrow(/context lost/i);
    expect(mocks.rendererDispose).toHaveBeenCalledTimes(1);

    mocks.setLost(false);
    const retry = await renderGlbThumbnail('/models/avatars/male/lost.glb');
    expect(retry).toBe('data:image/png;base64,OK');
  });
});
