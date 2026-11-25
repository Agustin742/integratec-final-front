import { act, render, screen } from '@testing-library/react';
import {
  AnimationAction,
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
import { AVATAR_CROSSFADE_SECONDS, AvatarModel } from './avatar-model';

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
  let current = matches;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return current;
      },
      addEventListener: (_event: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_event: string, listener: () => void) => {
        listeners.delete(listener);
      },
    })),
  );
  return {
    set(next: boolean) {
      current = next;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
  };
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
  describe('clip changes', () => {
    it('keeps one mixer and crossfades between Idle and Run', async () => {
      useLoader([], ['Idle', 'Walk', 'Run']);
      mockReducedMotion(false);
      const uncacheRoot = vi.spyOn(AnimationMixer.prototype, 'uncacheRoot');
      const crossFade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
      const view = await mount(
        <AvatarModel avatar={avatar} animation="Idle" />,
      );
      expect(crossFade).not.toHaveBeenCalled();

      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Run" />);
      });
      expect(crossFade).toHaveBeenCalledTimes(1);
      expect(crossFade.mock.calls[0]?.[1]).toBe(AVATAR_CROSSFADE_SECONDS);
      expect(crossFade.mock.calls[0]?.[2]).toBe(false);
      expect(uncacheRoot).not.toHaveBeenCalled();

      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Idle" />);
      });
      expect(crossFade).toHaveBeenCalledTimes(2);
      expect(uncacheRoot).not.toHaveBeenCalled();

      view.unmount();
      expect(uncacheRoot).toHaveBeenCalledTimes(1);
    });

    it('keeps the demand loop alive while a crossfade runs', async () => {
      useLoader([], ['Idle', 'Run']);
      mockReducedMotion(false);
      const view = await mount(
        <AvatarModel avatar={avatar} animation="Idle" />,
      );
      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Run" />);
      });
      frame.invalidate.mockClear();
      act(() => tick(0.1));
      expect(frame.invalidate).toHaveBeenCalledTimes(1);
    });

    it('plays Walk when the body has no Run, and Idle when it has neither', async () => {
      useLoader([], ['Idle', 'Walk']);
      mockReducedMotion(false);
      const crossFade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
      const view = await mount(<AvatarModel avatar={avatar} animation="Run" />);
      const update = vi.spyOn(AnimationMixer.prototype, 'update');
      act(() => tick(0.1));
      expect(update).toHaveBeenCalledWith(0.1);
      expect(crossFade).not.toHaveBeenCalled();
      view.unmount();
    });

    it('switches without blending under prefers-reduced-motion', async () => {
      useLoader([], ['Idle', 'Run']);
      mockReducedMotion(true);
      const crossFade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
      const update = vi.spyOn(AnimationMixer.prototype, 'update');
      const view = await mount(
        <AvatarModel avatar={avatar} animation="Idle" />,
      );
      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Run" />);
      });
      expect(crossFade).not.toHaveBeenCalled();
      update.mockClear();
      frame.invalidate.mockClear();
      act(() => tick(0.1));
      expect(update).not.toHaveBeenCalled();
      expect(frame.invalidate).not.toHaveBeenCalled();
    });

    it('falls back to Idle when the body only provides Idle across Idle/Walk/Run changes', async () => {
      useLoader([], ['Idle']);
      mockReducedMotion(false);
      const crossFade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
      const stopAllAction = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
      const update = vi.spyOn(AnimationMixer.prototype, 'update');
      const view = await mount(
        <AvatarModel avatar={avatar} animation="Idle" />,
      );
      stopAllAction.mockClear();

      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Run" />);
      });
      await act(async () => {
        view.rerender(<AvatarModel avatar={avatar} animation="Walk" />);
      });

      expect(crossFade).not.toHaveBeenCalled();
      expect(stopAllAction).not.toHaveBeenCalled();
      frame.invalidate.mockClear();
      act(() => tick(0.1));
      expect(update).toHaveBeenCalledWith(0.1);
      expect(frame.invalidate).toHaveBeenCalledTimes(1);
    });

    it('handles live reducedMotion toggling by snapping on enable and invalidating on disable', async () => {
      useLoader([], ['Idle']);
      const motion = mockReducedMotion(false);
      const stopAllAction = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
      const update = vi.spyOn(AnimationMixer.prototype, 'update');
      const reset = vi.spyOn(AnimationAction.prototype, 'reset');
      const play = vi.spyOn(AnimationAction.prototype, 'play');

      await mount(<AvatarModel avatar={avatar} animation="Idle" />);
      stopAllAction.mockClear();
      update.mockClear();
      reset.mockClear();
      play.mockClear();
      frame.invalidate.mockClear();

      motion.set(true);
      expect(stopAllAction).toHaveBeenCalledTimes(1);
      expect(reset).toHaveBeenCalled();
      expect(play).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith(0);
      expect(frame.invalidate).toHaveBeenCalledTimes(1);

      update.mockClear();
      frame.invalidate.mockClear();
      act(() => tick(0.1));
      expect(update).not.toHaveBeenCalled();
      expect(frame.invalidate).not.toHaveBeenCalled();

      motion.set(false);
      expect(frame.invalidate).toHaveBeenCalledTimes(1);
      act(() => tick(0.1));
      expect(update).toHaveBeenCalledWith(0.1);
      expect(frame.invalidate).toHaveBeenCalledTimes(2);
    });
  });

  it('reports the composed root and merges clips from the fallback body', async () => {
    const MALE_BODY = '/models/avatars/male/body.glb';
    setGlbLoaderForTests({
      loadAsync: vi.fn(async (url: string) =>
        makeGltf(
          url === BODY
            ? ['Idle', 'Wave']
            : url === MALE_BODY
              ? ['Idle', 'Happy']
              : [],
        ),
      ),
    });
    const onReady = vi.fn();
    await mount(
      <AvatarModel
        avatar={avatar}
        fallbackClipsUrl={MALE_BODY}
        onReady={onReady}
      />,
    );
    const info = onReady.mock.calls.at(-1)?.[0];
    expect(info.root).toBe(lastComposed().root);
    expect([...info.clipNames].sort()).toEqual(['Happy', 'Idle', 'Wave']);
  });

  it('keeps rendering when the fallback clips fail to load', async () => {
    const MALE_BODY = '/models/avatars/male/body.glb';
    useLoader([MALE_BODY], ['Idle']);
    const onReady = vi.fn();
    await mount(
      <AvatarModel
        avatar={avatar}
        fallbackClipsUrl={MALE_BODY}
        onReady={onReady}
      />,
    );
    expect(onReady.mock.calls.at(-1)?.[0].clipNames).toEqual(['Idle']);
  });
});
