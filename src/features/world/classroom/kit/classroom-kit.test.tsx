import { StrictMode } from 'react';
import { waitFor } from '@testing-library/react';
import {
  BoxGeometry,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { clearAssetCache, setGlbLoaderForTests } from '../../asset-cache';
import * as builder from './build-batched-kit';
import { ClassroomKit } from './classroom-kit';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { buildClassroomScene } from '../build-classroom-scene';
import type { ClassroomKitModuleId } from './classroom-kit-manifest';
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
  it('recovers floor and desks from real loader failures without replacing a surviving board', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const scene = buildClassroomScene(CLASSROOM_LAYOUT);
    const failed = new Set<ClassroomKitModuleId>();
    const batch = vi.spyOn(builder, 'buildBatchedKit');
    setGlbLoaderForTests({
      loadAsync: (url: string) =>
        url.endsWith('board.glb')
          ? Promise.resolve(gltf())
          : Promise.reject(new Error('unavailable')),
    });
    const mounted = render(
      <ClassroomKit
        placements={[
          ...placements.slice(0, 1),
          { moduleId: 'floor-tile', position: [0, 0, 0], rotationY: 0 },
          { moduleId: 'student-desk', position: [0, 0, 0], rotationY: 0 },
        ]}
        onModuleError={(id) => {
          failed.add(id);
          scene.setFailedModules(failed);
        }}
      />,
    );
    await waitFor(() => expect(batch).toHaveBeenCalled());
    expect(failed).toEqual(new Set(['floor-tile', 'student-desk']));
    for (const name of ['walkable-floor', 'student-desks', 'desk-legs']) {
      const target = scene.root.getObjectByName(name) as Mesh;
      expect((target.material as MeshStandardMaterial).visible).toBe(true);
    }
    expect(
      (scene.root.getObjectByName('classroom-board')!.children[0] as Mesh)
        .material,
    ).toMatchObject({ visible: false });
    expect([...batch.mock.calls[0]![0].keys()]).toEqual(['board']);
    mounted.unmount();
    scene.dispose();
  });
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

  it('renders one batched group from the modules that loaded and survives StrictMode remounts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const disposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
    const spy = vi.spyOn(builder, 'buildBatchedKit');
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
    const results = spy.mock.results.map((r) => r.value as builder.BatchedKit);
    // Only the surviving module is in the batch.
    for (const [modules] of spy.mock.calls) {
      expect([...modules.keys()]).toEqual(['board']);
    }
    // Effect cleanup ran (StrictMode) yet every built group keeps its meshes.
    await waitFor(() => expect(disposeSpy).toHaveBeenCalled());
    for (const built of results) {
      expect(built.group.name).toBe('kit:batch');
      expect(built.group.children).toHaveLength(1);
      expect(built.group.userData).toEqual({ kitModuleIds: ['board'] });
    }
  });

  it('builds a single batch for all modules, not one per module', async () => {
    const spy = vi.spyOn(builder, 'buildBatchedKit');
    setGlbLoaderForTests({ loadAsync: () => Promise.resolve(gltf()) });

    render(<ClassroomKit placements={placements} />);

    await waitFor(() => expect(spy).toHaveBeenCalled());
    // Every build (React may repeat one in dev) carries both modules at once.
    for (const [modules] of spy.mock.calls) {
      expect([...modules.keys()].sort()).toEqual(['board', 'cabinet']);
    }
  });
});
