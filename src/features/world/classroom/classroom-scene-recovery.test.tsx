import { act, render, waitFor } from '@testing-library/react';
import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, expect, test, vi } from 'vitest';
import { clearAssetCache, setGlbLoaderForTests } from '../asset-cache';
import * as builder from './build-classroom-scene';
import { ClassroomScene } from './classroom-scene';

const frame = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: () => void }) => unknown) =>
    select(frame),
}));

vi.mock('./use-classroom-navigation', () => ({
  useClassroomNavigation: () => ({
    controller: {},
    marker: { object: new Group() },
  }),
}));
vi.mock('../npc/classroom-pet', () => ({ ClassroomPet: () => null }));
vi.mock('../npc/tutor-bot', () => ({ TutorBot: () => null }));
vi.mock('./classroom-door', () => ({ ClassroomDoor: () => null }));
vi.mock('./local-avatar', () => ({ LocalAvatar: () => null }));
vi.mock('./follow-camera', () => ({ FollowCamera: () => null }));
vi.mock('./proximity-tracker', () => ({ ProximityTracker: () => null }));
vi.mock('./interactable-highlight', () => ({
  InteractableHighlight: () => null,
}));

afterEach(() => {
  clearAssetCache({ disposeDecoders: true });
  setGlbLoaderForTests(null);
  vi.restoreAllMocks();
  frame.invalidate.mockReset();
});

test('invalidates immediately for independent failures while another module is pending', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const build = vi.spyOn(builder, 'buildClassroomScene');
  const rejectors = new Map<string, (reason: Error) => void>();
  setGlbLoaderForTests({
    loadAsync: (url: string) => {
      if (/\/(floor-tile|student-desk|board)\.glb$/.test(url)) {
        return new Promise<GLTF>((_resolve, reject) => {
          rejectors.set(url, reject);
        });
      }
      return Promise.resolve({ scene: new Group() } as GLTF);
    },
  });
  const mounted = render(<ClassroomScene scopeKey="pending-room" />);
  await waitFor(() => expect(rejectors.size).toBe(3));
  const scene = build.mock.results[0]!.value as builder.ClassroomScene;
  const seen: boolean[][] = [];
  frame.invalidate.mockImplementation(() => {
    seen.push(
      ['walkable-floor', 'student-desks'].map(
        (name) =>
          (
            (scene.root.getObjectByName(name) as Mesh)
              .material as MeshStandardMaterial
          ).visible,
      ),
    );
  });
  const rejectModule = async (module: string) => {
    const entry = [...rejectors].find(([url]) =>
      url.endsWith(`/${module}.glb`),
    )!;
    await act(async () => {
      entry[1](new Error('unavailable'));
    });
  };
  await rejectModule('floor-tile');
  expect(frame.invalidate).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([[true, false]]);
  await rejectModule('student-desk');
  expect(frame.invalidate).toHaveBeenCalledTimes(2);
  expect(seen).toEqual([
    [true, false],
    [true, true],
  ]);
  mounted.unmount();
});

test('the scene host recovers rejected essential modules and resets on classroom change', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const build = vi.spyOn(builder, 'buildClassroomScene');
  let fail = true;
  let floorOnly = false;
  setGlbLoaderForTests({
    loadAsync: async (url: string) => {
      if (
        (fail && /\/(floor-tile|student-desk)\.glb$/.test(url)) ||
        (floorOnly && url.endsWith('/floor-tile.glb'))
      )
        throw new Error('unavailable');
      return { scene: new Group() } as GLTF;
    },
  });
  const onAssetError = vi.fn();
  const mounted = render(
    <ClassroomScene scopeKey="room-a" onAssetError={onAssetError} />,
  );
  await waitFor(() => expect(onAssetError).toHaveBeenCalledTimes(2));
  const scene = build.mock.results[0]!.value as builder.ClassroomScene;
  const visible = (root: Group, name: string) =>
    ((root.getObjectByName(name) as Mesh).material as MeshStandardMaterial)
      .visible;
  expect(visible(scene.root, 'walkable-floor')).toBe(true);
  expect(visible(scene.root, 'student-desks')).toBe(true);
  expect(visible(scene.root, 'teacher-desk')).toBe(false);
  const oldFloor = scene.root.getObjectByName('walkable-floor') as Mesh;
  const dispose = vi.spyOn(
    oldFloor.material as MeshStandardMaterial,
    'dispose',
  );
  fail = false;
  mounted.rerender(
    <ClassroomScene scopeKey="room-b" onAssetError={onAssetError} />,
  );
  await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  const next = build.mock.results.at(-1)!.value as builder.ClassroomScene;
  expect(next).not.toBe(scene);
  expect(visible(next.root, 'walkable-floor')).toBe(false);
  expect(visible(next.root, 'student-desks')).toBe(false);
  // Returning to an earlier scope creates a new scene, not its old failures.
  floorOnly = true;
  mounted.rerender(
    <ClassroomScene scopeKey="room-a" onAssetError={onAssetError} />,
  );
  await waitFor(() => expect(onAssetError).toHaveBeenCalledTimes(3));
  const returned = build.mock.results.at(-1)!.value as builder.ClassroomScene;
  expect(visible(returned.root, 'walkable-floor')).toBe(true);
  expect(visible(returned.root, 'student-desks')).toBe(false);
  mounted.unmount();
});
