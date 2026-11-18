import { act, render, screen } from '@testing-library/react';
import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  VectorKeyframeTrack,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import {
  clearAssetCache,
  getAssetCacheSize,
  setGlbLoaderForTests,
} from '../asset-cache';
import type { ComposedAvatar } from './compose-avatar';
import { AvatarModel } from './avatar-model';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
}));
const composed = vi.hoisted(() => [] as unknown[]);

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
}));
vi.mock('./compose-avatar', async (original) => {
  const actual = await original<typeof import('./compose-avatar')>();
  return {
    ...actual,
    composeAvatar: vi.fn(
      (input: Parameters<typeof actual.composeAvatar>[0]) => {
        const result = actual.composeAvatar(input);
        const dispose = vi.fn(result.dispose);
        const tracked = { ...result, dispose, input };
        composed.push(tracked);
        return tracked;
      },
    ),
  };
});

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};
const BODY = '/models/avatars/female/body.glb';
const HAIR = '/models/avatars/female/hair-afro.glb';
const TOP = '/models/avatars/female/top-tshirt.glb';

function makeGltf(clips: readonly string[] = []): GLTF {
  const scene = new Group();
  const root = new Bone();
  root.name = 'root';
  const mesh = new SkinnedMesh(
    new BufferGeometry(),
    new MeshStandardMaterial({ name: 'AvatarHairTint' }),
  );
  scene.add(root, mesh);
  scene.updateMatrixWorld(true);
  mesh.bind(new Skeleton([root]));
  const animations = clips.map(
    (name) =>
      new AnimationClip(name, 1, [
        new VectorKeyframeTrack('root.position', [0, 1], [0, 0, 0, 0, 1, 0]),
      ]),
  );
  return {
    scene,
    scenes: [scene],
    animations,
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

function useLoader(
  failing: readonly string[] = [],
  clips: readonly string[] = [],
) {
  const loadAsync = vi.fn(async (url: string) => {
    if (failing.includes(url)) throw new Error(`failed ${url}`);
    return makeGltf(url === BODY ? clips : []);
  });
  setGlbLoaderForTests({ loadAsync });
  return loadAsync;
}

const lastComposed = () =>
  composed[composed.length - 1] as ComposedAvatar & {
    input: { hair?: unknown; top?: unknown; hairColor?: string };
  };

async function mount(ui: React.ReactElement) {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(ui);
  });
  return view;
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('AvatarModel', () => {
  beforeEach(() => {
    composed.length = 0;
    frame.callback = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    clearAssetCache({ disposeDecoders: true });
    setGlbLoaderForTests(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests the body, hair and top files for the configuration', async () => {
    const loadAsync = useLoader();
    await mount(<AvatarModel avatar={avatar} />);
    expect(loadAsync.mock.calls.map(([url]) => url).sort()).toEqual(
      [BODY, HAIR, TOP].sort(),
    );
    expect(lastComposed().input.hairColor).toBe('#AF6D63');
  });

  it('renders the body without a part that fails to load', async () => {
    useLoader([HAIR]);
    const onPartsSkipped = vi.fn();
    await mount(
      <AvatarModel avatar={avatar} onPartsSkipped={onPartsSkipped} />,
    );
    expect(lastComposed().input.hair).toBeUndefined();
    expect(lastComposed().input.top).toBeTruthy();
    expect(onPartsSkipped).toHaveBeenCalledWith(['hair']);
  });

  it('shows the error fallback, reports it and evicts the rejected body', async () => {
    useLoader([BODY]);
    const onBodyError = vi.fn();
    await mount(
      <AvatarModel
        avatar={avatar}
        onBodyError={onBodyError}
        errorFallback={<span>no body</span>}
      />,
    );
    expect(screen.getByText('no body')).toBeInTheDocument();
    expect(onBodyError).toHaveBeenCalledTimes(1);
    expect(composed).toHaveLength(0);
    // hair and top stay cached; the rejected body entry is gone.
    expect(getAssetCacheSize()).toBe(2);
  });

  it('disposes the composed avatar on unmount', async () => {
    useLoader();
    const view = await mount(<AvatarModel avatar={avatar} />);
    const first = lastComposed();
    expect(first.dispose).not.toHaveBeenCalled();
    view.unmount();
    expect(first.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes the previous composition when the configuration changes', async () => {
    useLoader();
    const view = await mount(<AvatarModel avatar={avatar} />);
    const first = lastComposed();
    await act(async () => {
      view.rerender(
        <AvatarModel avatar={{ ...avatar, clothingColor: '#F2C85C' }} />,
      );
    });
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(lastComposed()).not.toBe(first);
    expect(lastComposed().dispose).not.toHaveBeenCalled();
  });

  it('advances the named clip every frame', async () => {
    useLoader([], ['Idle', 'Walk']);
    mockReducedMotion(false);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    act(() => frame.callback?.({}, 0.1));
    expect(update).toHaveBeenCalledWith(0.1);
  });

  it('stays static when the clip does not exist', async () => {
    useLoader([], ['Walk']);
    mockReducedMotion(false);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    act(() => frame.callback?.({}, 0.1));
    expect(update).not.toHaveBeenCalled();
  });

  it('does not animate under prefers-reduced-motion', async () => {
    useLoader([], ['Idle']);
    mockReducedMotion(true);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    act(() => frame.callback?.({}, 0.1));
    expect(update).not.toHaveBeenCalled();
  });
});
