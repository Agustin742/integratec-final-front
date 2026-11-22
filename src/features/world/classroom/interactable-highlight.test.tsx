import { act, render } from '@testing-library/react';
import {
  BoxGeometry,
  Group,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
} from './classroom-interactables';
import { InteractableHighlight } from './interactable-highlight';

const r3f = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
  domElement: null as HTMLElement | null,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    r3f.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = {
      invalidate: r3f.invalidate,
      gl: { domElement: r3f.domElement },
    };
    return select ? select(state) : state;
  },
}));

const byId = indexClassroomInteractables(
  deriveClassroomInteractables(CLASSROOM_LAYOUT),
);

function makeSceneRoot() {
  const root = new Group();
  const pet = new Group();
  pet.name = 'classroom-pet';
  root.add(pet);
  return { root, pet };
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  r3f.callback = null;
  r3f.invalidate.mockClear();
  r3f.domElement = document.createElement('canvas');
  stubReducedMotion(false);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InteractableHighlight', () => {
  test('sets pointer cursor while an interactable is highlighted and resets on clear and unmount', () => {
    const { root } = makeSceneRoot();
    const view = render(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="board"
        sceneRoot={root}
      />,
    );
    expect(r3f.domElement?.style.cursor).toBe('pointer');

    view.rerender(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId={undefined}
        sceneRoot={root}
      />,
    );
    expect(r3f.domElement?.style.cursor).toBe('');

    view.rerender(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="shop"
        sceneRoot={root}
      />,
    );
    expect(r3f.domElement?.style.cursor).toBe('pointer');
    view.unmount();
    expect(r3f.domElement?.style.cursor).toBe('');
  });

  test('renders non-raycasting highlight meshes and disposes geometries and materials on unmount', () => {
    const { root } = makeSceneRoot();
    const boxDispose = vi.spyOn(BoxGeometry.prototype, 'dispose');
    const octDispose = vi.spyOn(OctahedronGeometry.prototype, 'dispose');
    const matDispose = vi.spyOn(MeshBasicMaterial.prototype, 'dispose');

    const { container, unmount } = render(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="board"
        ownDeskIndex={1}
        sceneRoot={root}
      />,
    );

    const meshes = container.querySelectorAll('mesh');
    expect(meshes.length).toBeGreaterThan(0);

    unmount();
    expect(boxDispose).toHaveBeenCalledTimes(1);
    expect(octDispose).toHaveBeenCalledTimes(2);
    expect(matDispose).toHaveBeenCalledTimes(3);
  });

  test('animates the pet hop over ~450ms and restores exact baseline y = 0', () => {
    const { root, pet } = makeSceneRoot();
    const view = render(
      <InteractableHighlight
        interactablesById={byId}
        sceneRoot={root}
        petReactionNonce={0}
      />,
    );
    expect(pet.position.y).toBe(0);

    view.rerender(
      <InteractableHighlight
        interactablesById={byId}
        sceneRoot={root}
        petReactionNonce={1}
      />,
    );
    r3f.invalidate.mockClear();

    act(() => r3f.callback?.({}, 0.05));
    expect(pet.position.y).toBeGreaterThan(0);
    expect(r3f.invalidate).toHaveBeenCalledTimes(1);

    for (let step = 0; step < 12; step += 1) {
      act(() => r3f.callback?.({}, 0.05));
    }
    expect(pet.position.y).toBe(0);

    r3f.invalidate.mockClear();
    act(() => r3f.callback?.({}, 0.05));
    expect(r3f.invalidate).not.toHaveBeenCalled();
  });

  test('runs a bounded beacon entrance pulse and returns demand rendering to idle while highlighted', () => {
    const { root } = makeSceneRoot();
    render(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="board"
        sceneRoot={root}
      />,
    );
    const beacon = root.parent ?? undefined;
    expect(beacon).toBeUndefined();

    r3f.invalidate.mockClear();
    act(() => r3f.callback?.({}, 0.05));
    expect(r3f.invalidate).toHaveBeenCalledTimes(1);

    for (let step = 0; step < 15; step += 1) {
      act(() => r3f.callback?.({}, 0.05));
    }

    r3f.invalidate.mockClear();
    act(() => r3f.callback?.({}, 0.05));
    expect(r3f.invalidate).not.toHaveBeenCalled();
  });

  test('skips pet hop and beacon motion under prefers-reduced-motion', () => {
    stubReducedMotion(true);
    const { root, pet } = makeSceneRoot();
    const view = render(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="board"
        sceneRoot={root}
        petReactionNonce={0}
      />,
    );

    view.rerender(
      <InteractableHighlight
        interactablesById={byId}
        highlightedId="board"
        sceneRoot={root}
        petReactionNonce={1}
      />,
    );
    r3f.invalidate.mockClear();
    act(() => r3f.callback?.({}, 0.05));
    expect(pet.position.y).toBe(0);
    expect(r3f.invalidate).not.toHaveBeenCalled();
  });
});
