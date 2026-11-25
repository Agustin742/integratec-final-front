import { act, waitFor } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  Vector3,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { clearAssetCache, setGlbLoaderForTests } from '../asset-cache';
import { ClassroomDoor } from './classroom-door';
import { DOOR_FADE_OPACITY } from './classroom-door-fade';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
  reduced: false,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = { invalidate: frame.invalidate };
    return select ? select(state) : state;
  },
}));
vi.mock('../use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => frame.reduced,
}));

const sourceMaterial = new MeshStandardMaterial();
function gltf(): GLTF {
  const scene = new Group();
  scene.add(new Mesh(new BoxGeometry(1, 2, 0.2), sourceMaterial));
  return {
    scene,
    scenes: [scene],
    animations: [],
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

const tick = (delta: number) => act(() => frame.callback?.({}, delta));

async function setup(pose: { x: number; z: number }) {
  const poseRef = { current: { ...pose, rotation: 0 } };
  let group: Group | undefined;
  render(
    <ClassroomDoor poseRef={poseRef} onReady={(built) => (group = built)} />,
  );
  await waitFor(() => expect(group).toBeDefined());
  let mesh!: Mesh;
  group!.traverse((node) => {
    if (node instanceof Mesh) mesh = node;
  });
  return { poseRef, group: group!, mesh };
}

beforeEach(() => {
  frame.callback = null;
  frame.reduced = false;
  frame.invalidate.mockClear();
  setGlbLoaderForTests({ loadAsync: () => Promise.resolve(gltf()) });
});
afterEach(() => {
  clearAssetCache({ disposeDecoders: true });
  setGlbLoaderForTests(null);
});

describe('ClassroomDoor', () => {
  it('draws its own material clone at the entrance gap, outside the batched kit', async () => {
    const { group, mesh } = await setup({ x: 5, z: -3 });
    expect(group.position.toArray()).toEqual([0, 0, 6]);
    expect(mesh.material).not.toBe(sourceMaterial);
    expect((mesh.material as MeshStandardMaterial).opacity).toBe(1);
  });

  it('fades smoothly while the local avatar is hidden by it and returns when clear', async () => {
    const { poseRef, mesh } = await setup({ x: -1, z: 5 });
    const material = mesh.material as MeshStandardMaterial;
    tick(0.05);
    expect(material.opacity).toBeLessThan(1);
    expect(material.opacity).toBeGreaterThan(DOOR_FADE_OPACITY);
    expect(material.transparent).toBe(true);
    expect(frame.invalidate).toHaveBeenCalled();
    tick(0.5);
    expect(material.opacity).toBe(DOOR_FADE_OPACITY);

    poseRef.current = { x: 5, z: -3, rotation: 0 };
    tick(0.5);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
  });

  it('switches instantly with reduced motion', async () => {
    frame.reduced = true;
    const { mesh } = await setup({ x: -1, z: 5 });
    tick(0.001);
    expect((mesh.material as MeshStandardMaterial).opacity).toBe(
      DOOR_FADE_OPACITY,
    );
  });

  it('never intercepts pointer rays, so the entrance proxy stays pickable while faded', async () => {
    const { group, mesh } = await setup({ x: -1, z: 5 });
    tick(0.5);
    group.updateMatrixWorld(true);
    const hits = new Raycaster(
      new Vector3(0, 1, 10),
      new Vector3(0, 0, -1),
    ).intersectObject(mesh, false);
    expect(hits).toHaveLength(0);
  });
});
