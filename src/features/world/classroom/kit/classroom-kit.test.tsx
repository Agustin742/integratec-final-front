import { StrictMode } from 'react';
import { waitFor } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { clearAssetCache, setGlbLoaderForTests } from '../../asset-cache';
import * as builder from './build-instanced-kit-module';
import { ClassroomKit } from './classroom-kit';
import type { KitPlacement } from './kit-placement';

function gltf(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

const placements: KitPlacement[] = [
  { moduleId: 'board', position: [0, 0, 0], rotationY: 0 },
  { moduleId: 'cabinet', position: [2, 0, 0], rotationY: 0 },
];

describe('ClassroomKit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearAssetCache({ disposeDecoders: true });
    setGlbLoaderForTests(null);
    vi.restoreAllMocks();
  });

  it('skips a failing module, keeps the rest and reports the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loadAsync = vi.fn((url: string) =>
      url.endsWith('cabinet.glb')
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(gltf()),
    );
    setGlbLoaderForTests({ loadAsync });
    const onModuleError = vi.fn();

    render(
      <ClassroomKit placements={placements} onModuleError={onModuleError} />,
    );

    await waitFor(() => expect(onModuleError).toHaveBeenCalledOnce());
    expect(onModuleError.mock.calls[0]?.[0]).toBe('cabinet');
    expect(loadAsync).toHaveBeenCalledWith(
      '/models/scenes/classroom/furniture/board.glb',
    );
  });

  it('builds the surviving module and keeps its instances across StrictMode remounts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const disposeSpy = vi.spyOn(InstancedMesh.prototype, 'dispose');
    const spy = vi.spyOn(builder, 'buildInstancedKitModule');
    setGlbLoaderForTests({
      loadAsync: (url: string) =>
        url.endsWith('cabinet.glb')
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(gltf()),
    });

    render(
      <StrictMode>
        <ClassroomKit placements={placements} />
      </StrictMode>,
    );

    await waitFor(() => expect(spy).toHaveBeenCalled());
    const results = spy.mock.results.map(
      (r) => r.value as builder.InstancedKitModule,
    );
    expect(spy.mock.calls.every(([id]) => id === 'board')).toBe(true);
    // Effect cleanup ran (StrictMode) yet every built group keeps its meshes.
    await waitFor(() => expect(disposeSpy).toHaveBeenCalled());
    await waitFor(() => {
      for (const built of results) {
        expect(built.group.name).toBe('kit:board');
        expect(built.group.children).toHaveLength(1);
      }
    });
  });
});
