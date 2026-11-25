import { act, waitFor } from '@testing-library/react';
import {
  AnimationAction,
  AnimationClip,
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
import { createNpcLivePositions } from '../classroom/npc-live-position';
import { ClassroomPet, type ClassroomPetHandle } from './classroom-pet';
import type { NpcView } from './npc-view';
import { PET_SLEEP_LIFT } from './pet-clips';

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

const CLIPS = ['Walk', 'Sleep', 'Meow', 'AskForPets'];
let eyes: Mesh;
let mouth: Mesh;

function gltf(clips: readonly string[] = CLIPS): GLTF {
  const scene = new Group();
  scene.add(
    new Mesh(new BoxGeometry(0.2, 0.4, 0.6), new MeshStandardMaterial()),
  );
  eyes = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial());
  eyes.name = 'Pet_Eyes';
  eyes.morphTargetDictionary = { EyesClosed: 0, EyesHappy: 1 };
  eyes.morphTargetInfluences = [0, 0];
  mouth = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshStandardMaterial());
  mouth.name = 'Pet_Mouth';
  mouth.morphTargetDictionary = { Meow: 0, Happy: 1 };
  mouth.morphTargetInfluences = [0, 0];
  scene.add(eyes, mouth);
  return {
    scene,
    scenes: [scene],
    animations: clips.map((name) => new AnimationClip(name, 1, [])),
    cameras: [],
    asset: {},
  } as unknown as GLTF;
}

/** The mesh clones the component animates, found under the pet root. */
const morph = (group: Group, mesh: 'Pet_Eyes' | 'Pet_Mouth', index: number) =>
  (group.getObjectByName(mesh) as Mesh).morphTargetInfluences![index]!;

const home: NpcView = {
  id: 'pet',
  x: 6.73,
  z: -5.5,
  rotation: 0,
  state: 'idle',
  emote: '',
  reaction: '',
  phraseId: -1,
  reactionSeq: 0,
  reactingSessionId: '',
};
const view = (patch: Partial<NpcView>): NpcView => ({ ...home, ...patch });

const tick = (delta: number) => act(() => frame.callback?.({}, delta));
const run = (seconds: number, step = 1 / 30) => {
  for (let t = 0; t < seconds; t += step) tick(step);
};
const holderOf = (group: Group) =>
  group.getObjectByName('classroom-pet-model') as Group;

async function setup(
  npc: NpcView,
  options: { clips?: readonly string[]; props?: Record<string, unknown> } = {},
) {
  setGlbLoaderForTests({
    loadAsync: () => Promise.resolve(gltf(options.clips ?? CLIPS)),
  });
  let handle: ClassroomPetHandle | undefined;
  const positions = createNpcLivePositions();
  const ui = render(
    <ClassroomPet
      npc={npc}
      positions={positions}
      onReady={(built) => (handle = built)}
      {...options.props}
    />,
  );
  await waitFor(() => expect(handle).toBeDefined());
  return { ui, handle: handle!, positions };
}

beforeEach(() => {
  frame.callback = null;
  frame.reduced = false;
  frame.invalidate.mockClear();
});
afterEach(() => {
  clearAssetCache({ disposeDecoders: true });
  setGlbLoaderForTests(null);
});

describe('ClassroomPet model', () => {
  it('stands at the synced spot, tagged as the pet interactable with a pickable proxy', async () => {
    const { handle } = await setup(home);
    expect(handle.group.position.x).toBeCloseTo(6.73);
    expect(handle.group.position.z).toBeCloseTo(-5.5);
    expect(handle.group.userData.placeholder).toBe('pet');

    handle.group.updateMatrixWorld(true);
    const hits = new Raycaster(
      new Vector3(6.73, 5, -5.5),
      new Vector3(0, -1, 0),
    ).intersectObject(handle.group, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.object.name === 'classroom-pet-proxy')).toBe(
      true,
    );
  });
});

describe('ClassroomPet with the GLB clips', () => {
  it('plays each clip by name for the synced state; idle plays none', async () => {
    const { ui, handle } = await setup(home);
    expect(handle.group.userData).toMatchObject({
      activeClip: '',
      petMotion: 'idle',
      petSource: 'procedural',
    });

    ui.rerender(<ClassroomPet npc={view({ state: 'walking' })} />);
    expect(handle.group.userData).toMatchObject({
      activeClip: 'Walk',
      petMotion: 'walk',
      petSource: 'clip',
    });

    ui.rerender(<ClassroomPet npc={view({ state: 'sleeping' })} />);
    expect(handle.group.userData.activeClip).toBe('Sleep');

    ui.rerender(
      <ClassroomPet
        npc={view({ state: 'emote', emote: 'AskForPets', reactionSeq: 1 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('AskForPets');

    ui.rerender(
      <ClassroomPet
        npc={view({ state: 'reacting', reaction: 'greet', reactionSeq: 2 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('Meow');

    ui.rerender(<ClassroomPet npc={view({ state: 'idle' })} />);
    expect(handle.group.userData.activeClip).toBe('');
  });

  it('holds the sleeping face and rests on the bed cushion', async () => {
    const { handle } = await setup(view({ state: 'sleeping' }));
    run(2);
    expect(morph(handle.group, 'Pet_Eyes', 0)).toBe(1);
    expect(holderOf(handle.group).position.y).toBeCloseTo(PET_SLEEP_LIFT, 2);
  });

  it('smiles on a greet (EyesHappy) and an askForPets reaction (Happy)', async () => {
    const { ui, handle } = await setup(
      view({ state: 'reacting', reaction: 'greet', reactionSeq: 1 }),
    );
    tick(1 / 30);
    expect(morph(handle.group, 'Pet_Eyes', 1)).toBe(1);

    ui.rerender(
      <ClassroomPet
        npc={view({
          state: 'reacting',
          reaction: 'askForPets',
          reactionSeq: 2,
        })}
      />,
    );
    tick(1 / 30);
    expect(morph(handle.group, 'Pet_Mouth', 1)).toBe(1);
    expect(morph(handle.group, 'Pet_Eyes', 1)).toBe(0);
  });

  it('idles on the natural rest pose: breathes and blinks, never frozen', async () => {
    const { handle } = await setup(home);
    const scales = new Set<number>();
    let blinked = 0;
    for (let i = 0; i < 4 * 30; i += 1) {
      tick(1 / 30);
      scales.add(holderOf(handle.group).scale.y);
      blinked = Math.max(blinked, morph(handle.group, 'Pet_Eyes', 0));
    }
    expect(scales.size).toBeGreaterThan(10);
    expect(blinked).toBeGreaterThan(0.9);
    expect(handle.group.userData.activeClip).toBe('');
  });

  it('settles back to idle once a one-shot clip ends, blending when motion is allowed', async () => {
    const fade = vi.spyOn(AnimationAction.prototype, 'fadeOut');
    const { ui, handle } = await setup(home);
    ui.rerender(
      <ClassroomPet
        npc={view({ state: 'emote', emote: 'Meow', reactionSeq: 1 })}
      />,
    );
    expect(handle.group.userData.activeClip).toBe('Meow');
    run(2);
    expect(handle.group.userData).toMatchObject({
      activeClip: '',
      petMotion: 'idle',
    });
    expect(fade).toHaveBeenCalledWith(0.25);
    fade.mockRestore();
  });

  it('settles back to idle without a blend under reduced motion', async () => {
    frame.reduced = true;
    const fade = vi.spyOn(AnimationAction.prototype, 'fadeOut');
    const { ui, handle } = await setup(home);
    ui.rerender(
      <ClassroomPet
        npc={view({ state: 'emote', emote: 'Meow', reactionSeq: 1 })}
      />,
    );
    run(2);
    expect(handle.group.userData.activeClip).toBe('');
    expect(fade).not.toHaveBeenCalled();
    fade.mockRestore();
  });

  it('keeps a clip playing when it is requested again during its own fade-out', async () => {
    const { ui, handle } = await setup(home);
    ui.rerender(<ClassroomPet npc={view({ state: 'walking' })} />);
    ui.rerender(<ClassroomPet npc={view({ state: 'idle' })} />);
    tick(0.1);
    ui.rerender(<ClassroomPet npc={view({ state: 'walking' })} />);
    const stop = vi.spyOn(AnimationAction.prototype, 'stop');
    run(1);
    expect(stop).not.toHaveBeenCalled();
    expect(handle.group.userData.activeClip).toBe('Walk');
    stop.mockRestore();
  });

  it('keeps the idle pet still under reduced motion', async () => {
    frame.reduced = true;
    const { handle } = await setup(home);
    run(2);
    const holder = holderOf(handle.group);
    expect(holder.scale.y).toBe(1);
    expect(morph(handle.group, 'Pet_Eyes', 0)).toBe(0);
  });
});

describe('ClassroomPet without clips (procedural fallback)', () => {
  const bare = { clips: [] as string[] };

  it('walks with a bob and a sway', async () => {
    const { handle } = await setup(view({ state: 'walking' }), bare);
    expect(handle.group.userData).toMatchObject({
      activeClip: '',
      petMotion: 'walk',
      petSource: 'procedural',
    });
    let bob = 0;
    let sway = 0;
    for (let i = 0; i < 40; i += 1) {
      tick(1 / 30);
      bob = Math.max(bob, holderOf(handle.group).position.y);
      sway = Math.max(sway, Math.abs(holderOf(handle.group).rotation.z));
    }
    expect(bob).toBeGreaterThan(0.005);
    expect(sway).toBeGreaterThan(0.01);
  });

  it('sleeps with slow breathing, closed eyes and the cushion lift', async () => {
    const { handle } = await setup(view({ state: 'sleeping' }), bare);
    const scales = new Set<number>();
    for (let i = 0; i < 90; i += 1) {
      tick(1 / 30);
      scales.add(holderOf(handle.group).scale.y);
    }
    expect(scales.size).toBeGreaterThan(5);
    expect(morph(handle.group, 'Pet_Eyes', 0)).toBe(1);
    expect(holderOf(handle.group).position.y).toBeCloseTo(PET_SLEEP_LIFT, 1);
  });

  it('meows with a pop and the Meow morph, then goes back to idle', async () => {
    const { handle } = await setup(
      view({ state: 'emote', emote: 'Meow', reactionSeq: 1 }),
      bare,
    );
    let mouthOpen = 0;
    let pop = 1;
    for (let i = 0; i < 60; i += 1) {
      tick(1 / 30);
      mouthOpen = Math.max(mouthOpen, morph(handle.group, 'Pet_Mouth', 0));
      pop = Math.max(pop, holderOf(handle.group).scale.y);
    }
    expect(mouthOpen).toBeGreaterThan(0.8);
    expect(pop).toBeGreaterThan(1.02);
    run(2);
    expect(handle.group.userData.petMotion).toBe('idle');
    expect(morph(handle.group, 'Pet_Mouth', 0)).toBe(0);
  });

  it('asks for pets with a hop, a wiggle and a smile', async () => {
    const { handle } = await setup(
      view({
        state: 'reacting',
        reaction: 'askForPets',
        reactionSeq: 1,
      }),
      bare,
    );
    let hop = 0;
    let wiggle = 0;
    for (let i = 0; i < 60; i += 1) {
      tick(1 / 30);
      hop = Math.max(hop, holderOf(handle.group).position.y);
      wiggle = Math.max(wiggle, Math.abs(holderOf(handle.group).rotation.z));
    }
    expect(hop).toBeGreaterThan(0.02);
    expect(wiggle).toBeGreaterThan(0.02);
    expect(morph(handle.group, 'Pet_Mouth', 1)).toBe(1);
  });

  it('uses the clip for the states that have one even if others are missing', async () => {
    const { handle } = await setup(view({ state: 'walking' }), {
      clips: ['Walk'],
    });
    expect(handle.group.userData).toMatchObject({
      activeClip: 'Walk',
      petSource: 'clip',
    });
  });
});

describe('ClassroomPet motion', () => {
  it('glides toward the synced position and publishes its live position', async () => {
    const { ui, handle, positions } = await setup(home);
    ui.rerender(
      <ClassroomPet
        npc={view({ x: 5.7, state: 'walking' })}
        positions={positions}
      />,
    );
    frame.invalidate.mockClear();
    tick(1 / 60);
    expect(handle.group.position.x).toBeLessThan(6.73);
    expect(handle.group.position.x).toBeGreaterThan(5.7);
    expect(positions.get('pet')).toEqual({
      x: handle.group.position.x,
      z: handle.group.position.z,
    });
    expect(frame.invalidate).toHaveBeenCalled();
    for (let i = 0; i < 240; i += 1) tick(1 / 60);
    expect(handle.group.position.x).toBeCloseTo(5.7, 5);
  });

  it('snaps to the synced position with reduced motion', async () => {
    frame.reduced = true;
    const { ui, handle, positions } = await setup(home);
    ui.rerender(
      <ClassroomPet npc={view({ x: 0, z: 0 })} positions={positions} />,
    );
    tick(1 / 60);
    expect(handle.group.position.x).toBe(0);
    expect(handle.group.position.z).toBe(0);
  });
});
