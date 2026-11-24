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
  invalidate: vi.fn(),
  frameloop: 'demand' as 'demand' | 'never',
}));
const composed = vi.hoisted(() => [] as unknown[]);

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = { invalidate: frame.invalidate, frameloop: frame.frameloop };
    return select ? select(state) : state;
  },
}));

/** What R3F hands to a `useFrame` callback: the root state with `invalidate`. */
const tick = (delta: number) =>
  frame.callback?.({ invalidate: frame.invalidate }, delta);
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
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};
const BODY = '/models/avatars/female/body.glb';
const HAIR = '/models/avatars/shared/hair-afro.glb';
const TOP = '/models/avatars/female/top-basic-tshirt.glb';

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

interface InputPart {
  readonly key: string;
  readonly scene: unknown;
  readonly tints?: Record<string, string>;
  readonly hiddenMeshes?: readonly string[];
  readonly morphs?: Record<string, number>;
}

const partOf = (key: string) =>
  lastComposed().input.parts.find((part) => part.key === key);

const lastComposed = () =>
  composed[composed.length - 1] as ComposedAvatar & {
    input: { parts: readonly InputPart[] };
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
    frame.frameloop = 'demand';
    frame.invalidate.mockClear();
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
    expect(partOf('hair')?.tints).toEqual({ AvatarHairTint: '#AF6D63' });
    expect(partOf('top')?.tints).toEqual({ AvatarTopTint: '#75B7DA' });
  });

  it('renders the body without a part that fails to load', async () => {
    useLoader([HAIR]);
    const onPartsSkipped = vi.fn();
    await mount(
      <AvatarModel avatar={avatar} onPartsSkipped={onPartsSkipped} />,
    );
    expect(partOf('hair')).toBeUndefined();
    expect(partOf('top')).toBeTruthy();
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

  it('retries a failed part after remount when the body loads', async () => {
    const loadAsync = useLoader([HAIR]);
    const view = await mount(<AvatarModel avatar={avatar} />);
    view.unmount();
    await mount(<AvatarModel avatar={avatar} />);
    expect(loadAsync.mock.calls.filter(([url]) => url === HAIR)).toHaveLength(
      2,
    );
  });

  it('retries a failed part after remount when the body also fails', async () => {
    const loadAsync = useLoader([BODY, HAIR]);
    const view = await mount(
      <AvatarModel avatar={avatar} errorFallback={<span>no body</span>} />,
    );
    expect(screen.getByText('no body')).toBeInTheDocument();
    view.unmount();
    await mount(<AvatarModel avatar={avatar} />);
    expect(loadAsync.mock.calls.filter(([url]) => url === HAIR)).toHaveLength(
      2,
    );
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

  it('advances the named clip every frame and keeps the demand loop alive', async () => {
    useLoader([], ['Idle', 'Walk']);
    mockReducedMotion(false);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    frame.invalidate.mockClear();
    act(() => tick(0.1));
    expect(update).toHaveBeenCalledWith(0.1);
    expect(frame.invalidate).toHaveBeenCalledTimes(1);
  });

  it('requests a frame when the loop resumes from never to demand', async () => {
    useLoader([], ['Idle']);
    mockReducedMotion(false);
    frame.frameloop = 'never';
    const view = await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    frame.invalidate.mockClear();
    frame.frameloop = 'demand';
    await act(async () => {
      view.rerender(<AvatarModel avatar={{ ...avatar }} animation="Idle" />);
    });
    expect(frame.invalidate).toHaveBeenCalled();
  });

  it('stays static when the clip does not exist', async () => {
    useLoader([], ['Walk']);
    mockReducedMotion(false);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    frame.invalidate.mockClear();
    act(() => tick(0.1));
    expect(update).not.toHaveBeenCalled();
    expect(frame.invalidate).not.toHaveBeenCalled();
  });

  it('poses the first frame once and never advances under prefers-reduced-motion', async () => {
    useLoader([], ['Idle']);
    mockReducedMotion(true);
    const update = vi.spyOn(AnimationMixer.prototype, 'update');
    await mount(<AvatarModel avatar={avatar} animation="Idle" />);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(0);
    frame.invalidate.mockClear();
    act(() => tick(0.1));
    expect(update).toHaveBeenCalledTimes(1);
    expect(frame.invalidate).not.toHaveBeenCalled();
  });
  describe('equipped accessories', () => {
    const SHARED = '/models/avatars/shared';

    it('requests and tints each equipped head, face and back item', async () => {
      const loadAsync = useLoader();
      await mount(
        <AvatarModel
          avatar={avatar}
          equipped={{
            head: 'head_crown',
            face: 'face_sunglasses',
            back: 'back_backpack',
          }}
        />,
      );
      expect(loadAsync.mock.calls.map(([url]) => url).sort()).toEqual(
        [
          BODY,
          HAIR,
          TOP,
          `${SHARED}/head-crown.glb`,
          `${SHARED}/face-sunglasses.glb`,
          '/models/avatars/female/back-backpack.glb',
        ].sort(),
      );
      expect(partOf('head')?.tints).toEqual({ AvatarAccessoryTint: '#F7D86B' });
      expect(partOf('face')?.tints).toEqual({ AvatarAccessoryTint: '#353849' });
      expect(partOf('back')?.tints).toEqual({ AvatarAccessoryTint: '#62CFC7' });
    });

    it('ignores unknown codes and codes sitting in the wrong slot', async () => {
      const loadAsync = useLoader();
      await mount(
        <AvatarModel
          avatar={avatar}
          equipped={{ head: 'nope', face: 'head_crown', back: null }}
        />,
      );
      expect(loadAsync).toHaveBeenCalledTimes(3);
      expect(partOf('head')).toBeUndefined();
      expect(partOf('face')).toBeUndefined();
    });

    it('hides the hair parts a crown-covering hat would poke through', async () => {
      useLoader();
      await mount(
        <AvatarModel avatar={avatar} equipped={{ head: 'head_beanie' }} />,
      );
      expect(partOf('hair')?.hiddenMeshes).toEqual(['HairAfro_Cloud']);
    });

    it('swaps the afro for the fitted one under a headband', async () => {
      const loadAsync = useLoader();
      await mount(
        <AvatarModel avatar={avatar} equipped={{ head: 'head_headband' }} />,
      );
      const urls = loadAsync.mock.calls.map(([url]) => url);
      expect(urls).toContain(`${SHARED}/hair-afro-with-headband.glb`);
      expect(urls).not.toContain(HAIR);
      expect(partOf('head')?.hiddenMeshes).toEqual([
        'HeadHeadband_Band',
        'HeadHeadband_Trim',
      ]);
    });

    it('tucks long hair when a back item is worn', async () => {
      useLoader();
      const longHair: Avatar = {
        ...avatar,
        bodyId: 'male',
        hairId: 'dreads',
        topId: 'hoodie',
      };
      await mount(
        <AvatarModel avatar={longHair} equipped={{ back: 'back_wings' }} />,
      );
      expect(partOf('hair')?.morphs).toEqual({ BackTuck: 1 });
    });

    it('renders without an accessory that fails to load', async () => {
      useLoader([`${SHARED}/face-sunglasses.glb`]);
      const onPartsSkipped = vi.fn();
      await mount(
        <AvatarModel
          avatar={avatar}
          equipped={{ head: 'head_crown', face: 'face_sunglasses' }}
          onPartsSkipped={onPartsSkipped}
        />,
      );
      expect(partOf('face')).toBeUndefined();
      expect(partOf('head')).toBeTruthy();
      expect(onPartsSkipped).toHaveBeenCalledWith(['face']);
    });

    it('re-composes and disposes the old composition when equipment changes', async () => {
      useLoader();
      const view = await mount(
        <AvatarModel avatar={avatar} equipped={{ head: 'head_crown' }} />,
      );
      const first = lastComposed();
      await act(async () => {
        view.rerender(
          <AvatarModel avatar={avatar} equipped={{ head: 'head_cap' }} />,
        );
      });
      expect(first.dispose).toHaveBeenCalledTimes(1);
      expect(partOf('head')?.tints).toEqual({ AvatarAccessoryTint: '#75B7DA' });
    });

    it('keeps the composition when an equal equipment object arrives', async () => {
      useLoader();
      const view = await mount(
        <AvatarModel avatar={avatar} equipped={{ head: 'head_crown' }} />,
      );
      const first = lastComposed();
      await act(async () => {
        view.rerender(
          <AvatarModel avatar={avatar} equipped={{ head: 'head_crown' }} />,
        );
      });
      expect(first.dispose).not.toHaveBeenCalled();
      expect(lastComposed()).toBe(first);
    });
  });
});
