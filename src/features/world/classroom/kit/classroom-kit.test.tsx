import { waitFor } from '@testing-library/react';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { clearAssetCache, setGlbLoaderForTests } from '../../asset-cache';
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
});
