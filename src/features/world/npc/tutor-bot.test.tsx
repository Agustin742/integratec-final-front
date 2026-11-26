import { act, waitFor } from '@testing-library/react';
import {
  AnimationAction,
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Raycaster,
  Vector3,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import {
  clearAssetCache,
  getAssetCacheSize,
  setGlbLoaderForTests,
} from '../asset-cache';
import { createNpcLivePositions } from '../classroom/npc-live-position';
import type { NpcView } from './npc-view';
import { skinnedGltf, skinnedMeshes } from './skinned-fixture.test-utils';
import { TutorBot, type TutorBotHandle } from './tutor-bot';

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
    const state = { invalidate: frame.invalidate, frameloop: 'demand' };
    return select ? select(state) : state;
  },
}));
vi.mock('../use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => frame.reduced,
}));

const CLIPS = [
  'IdleHover',
  'Wave',
  'Talk',
  'Think',
  'Celebrate',
  'Encourage',
  'Face_Happy',
  'Face_Thinking',
  'Face_Talking',
  'Face_Surprised',
  'Face_Sleeping',
];

function gltf(): GLTF {
  const scene = new Group();
  scene.add(
    new Mesh(new BoxGeometry(0.5, 0.8, 0.3), new MeshStandardMaterial()),
  );
  return {
    scene,
    scenes: [scene],
    animations: CLIPS.map((name) => new AnimationClip(name, 1, [])),
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

const home: NpcView = {
  id: 'tutorBot',
  x: -5.6,
  z: 1.05,
  rotation: Math.PI / 2,
  state: 'idle',
  emote: '',
  reaction: '',
  phraseId: -1,
  reactionSeq: 0,
  reactingSessionId: '',
};
const view = (patch: Partial<NpcView>): NpcView => ({ ...home, ...patch });

const tick = (delta: number) => act(() => frame.callback?.({ camera }, delta));
const camera = new OrthographicCamera();

async function setup(npc: NpcView, props: Record<string, unknown> = {}) {
  let handle: TutorBotHandle | undefined;
  const positions = createNpcLivePositions();
  const ui = render(
    <TutorBot
      npc={npc}
      positions={positions}
      onReady={(built) => (handle = built)}
      {...props}
    />,
  );
  await waitFor(() => expect(handle).toBeDefined());
  return { ui, handle: handle!, positions };
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
  vi.useRealTimers();
});

describe('TutorBot model', () => {
  it('merges the skinned parts of one material but keeps the morph face apart', async () => {
    setGlbLoaderForTests({
      loadAsync: () => Promise.resolve(skinnedGltf(3, CLIPS)),
    });
    const { handle } = await setup(home);
    const meshes = skinnedMeshes(handle.group);
    expect(meshes).toHaveLength(2);
    expect(meshes.filter((mesh) => mesh.morphTargetDictionary)).toHaveLength(1);
    // Clips still bind: the shared bone resolves by name under the bot.
    expect(handle.group.getObjectByName('Hips')).toBeDefined();
    expect(handle.group.userData.activeClip).toBe('IdleHover');
  });

  it('stands at the synced spot, tagged as the tutor-bot interactable with a pickable proxy', async () => {
    const { handle } = await setup(home);
    expect(handle.group.position.x).toBeCloseTo(-5.6);
    expect(handle.group.position.z).toBeCloseTo(1.05);
    expect(handle.group.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(handle.group.userData.placeholder).toBe('tutor-bot');

    handle.group.updateMatrixWorld(true);
    const hits = new Raycaster(
      new Vector3(-5.6, 5, 1.05),
      new Vector3(0, -1, 0),
    ).intersectObject(handle.group, true);
    expect(hits.length).toBeGreaterThan(0);
    // Only the invisible proxy takes rays; the skinned model stays out of picking.
    expect(hits.every((hit) => hit.object.name === 'tutor-bot-proxy')).toBe(
      true,
    );
  });

  it('plays IdleHover, switches to the emote clip and falls back for unknown names', async () => {
    const { ui, handle } = await setup(home);
    expect(handle.group.userData.activeClip).toBe('IdleHover');

    ui.rerender(
      <TutorBot
        npc={view({ state: 'emote', emote: 'Celebrate', reactionSeq: 1 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('Celebrate');

    ui.rerender(<TutorBot npc={view({ state: 'emote', emote: 'Moonwalk' })} />);
    expect(handle.group.userData.activeClip).toBe('IdleHover');

    ui.rerender(<TutorBot npc={view({ state: 'sleeping' })} />);
    expect(handle.group.userData.activeClip).toBe('Face_Sleeping');

    ui.rerender(
      <TutorBot
        npc={view({ state: 'reacting', reaction: 'phrase', phraseId: 2 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('Talk');
  });
});

describe('TutorBot one-shot clips', () => {
  it('settles into IdleHover without a crossfade when a one-shot ends under reduced motion', async () => {
    frame.reduced = true;
    const fade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
    const { ui, handle } = await setup(home);
    ui.rerender(
      <TutorBot
        npc={view({ state: 'emote', emote: 'Wave', reactionSeq: 1 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('Wave');
    tick(2);
    expect(handle.group.userData.activeClip).toBe('IdleHover');
    expect(fade).not.toHaveBeenCalled();
    fade.mockRestore();
  });

  it('still blends back to IdleHover when motion is allowed', async () => {
    const fade = vi.spyOn(AnimationAction.prototype, 'crossFadeTo');
    const { ui, handle } = await setup(home);
    ui.rerender(
      <TutorBot
        npc={view({ state: 'emote', emote: 'Wave', reactionSeq: 1 })}
      />,
    );
    tick(2);
    expect(handle.group.userData.activeClip).toBe('IdleHover');
    expect(fade).toHaveBeenCalledWith(expect.anything(), 0.25, false);
    fade.mockRestore();
  });
});

describe('TutorBot motion', () => {
  it('glides toward the synced position and publishes its live position', async () => {
    const { ui, handle, positions } = await setup(home);
    ui.rerender(
      <TutorBot
        npc={view({ x: -4.6, state: 'walking' })}
        positions={positions}
      />,
    );
    frame.invalidate.mockClear();
    tick(1 / 60);
    expect(handle.group.position.x).toBeGreaterThan(-5.6);
    expect(handle.group.position.x).toBeLessThan(-4.6);
    expect(positions.get('tutorBot')).toEqual({
      x: handle.group.position.x,
      z: handle.group.position.z,
    });
    expect(frame.invalidate).toHaveBeenCalled();

    for (let i = 0; i < 240; i += 1) tick(1 / 60);
    expect(handle.group.position.x).toBeCloseTo(-4.6, 5);
  });

  it('snaps to the synced position with reduced motion', async () => {
    frame.reduced = true;
    const { ui, handle, positions } = await setup(home);
    ui.rerender(<TutorBot npc={view({ x: 0, z: 0 })} positions={positions} />);
    tick(1 / 60);
    expect(handle.group.position.x).toBe(0);
    expect(handle.group.position.z).toBe(0);
  });
});

describe('TutorBot phrase bubble', () => {
  it('shows the phrase for about five seconds and re-triggers on a new reactionSeq', async () => {
    vi.useFakeTimers();
    const onSpeech = vi.fn();
    const phrase = (seq: number, text: string) => (
      <TutorBot
        npc={view({
          state: 'reacting',
          reaction: 'phrase',
          phraseId: seq,
          reactionSeq: seq,
        })}
        phraseText={text}
        onSpeech={onSpeech}
      />
    );
    const ui = render(phrase(1, 'La fotosintesis usa luz'));
    expect(onSpeech).toHaveBeenLastCalledWith({
      npcId: 'tutorBot',
      text: 'La fotosintesis usa luz',
      seq: 1,
    });

    act(() => vi.advanceTimersByTime(3000));
    ui.rerender(phrase(2, 'El agua hierve a 100 grados'));
    expect(onSpeech).toHaveBeenLastCalledWith({
      npcId: 'tutorBot',
      text: 'El agua hierve a 100 grados',
      seq: 2,
    });

    // The first phrase's timer must not hide the second one.
    act(() => vi.advanceTimersByTime(3000));
    expect(onSpeech).not.toHaveBeenLastCalledWith(undefined);

    act(() => vi.advanceTimersByTime(2100));
    expect(onSpeech).toHaveBeenLastCalledWith(undefined);
  });

  it('hides the bubble when the reaction ends or there is no text', async () => {
    const onSpeech = vi.fn();
    const ui = render(
      <TutorBot
        npc={view({ state: 'reacting', reaction: 'phrase', reactionSeq: 1 })}
        phraseText="Hola"
        onSpeech={onSpeech}
      />,
    );
    expect(onSpeech).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Hola' }),
    );
    ui.rerender(
      <TutorBot
        npc={view({ reactionSeq: 1 })}
        phraseText="Hola"
        onSpeech={onSpeech}
      />,
    );
    expect(onSpeech).toHaveBeenLastCalledWith(undefined);

    onSpeech.mockClear();
    ui.rerender(
      <TutorBot
        npc={view({ state: 'reacting', reaction: 'phrase', reactionSeq: 2 })}
        onSpeech={onSpeech}
      />,
    );
    expect(onSpeech).not.toHaveBeenCalledWith(
      expect.objectContaining({ seq: 2 }),
    );
  });
});

describe('TutorBot skins', () => {
  /** A bot with the hideable torso, and skins sharing its one bone. */
  function botWithSkins(failing: readonly string[] = []) {
    const loaded: string[] = [];
    setGlbLoaderForTests({
      loadAsync: (url: string) => {
        loaded.push(url);
        if (failing.some((part) => url.includes(part))) {
          return Promise.reject(new Error('missing skin'));
        }
        const model = skinnedGltf(1, CLIPS);
        const mesh = model.scene.getObjectByName('Part_0')!;
        mesh.name = url.includes('/skins/') ? 'BotSkin_Test' : 'Bot_Torso';
        return Promise.resolve(model);
      },
    });
    return loaded;
  }
  const torso = (handle: TutorBotHandle) =>
    handle.group.getObjectByName('Bot_Torso');
  const worn = (handle: TutorBotHandle) =>
    handle.group.getObjectByName('BotSkin_Test');

  it('wears the chosen skin and restores the bot when it changes', async () => {
    const loaded = botWithSkins();
    const { ui, handle } = await setup(home, { skin: 'boca' });
    await waitFor(() => expect(worn(handle)).toBeDefined());
    expect(loaded).toContain('/models/bot/skins/skin-boca.glb');
    expect(torso(handle)?.visible).toBe(false);

    ui.rerender(<TutorBot npc={home} skin="none" />);

    expect(worn(handle)).toBeUndefined();
    expect(torso(handle)?.visible).toBe(true);
    // Only the base bot stays cached: the removed skin is disposed.
    expect(getAssetCacheSize()).toBe(1);
  });

  it('keeps the default bot when the skin cannot load', async () => {
    const loaded = botWithSkins(['/skins/']);
    const { handle } = await setup(home, { skin: 'gamer' });
    await waitFor(() => expect(loaded).toHaveLength(2));
    await act(async () => {});

    expect(worn(handle)).toBeUndefined();
    expect(torso(handle)?.visible).toBe(true);
  });
});
