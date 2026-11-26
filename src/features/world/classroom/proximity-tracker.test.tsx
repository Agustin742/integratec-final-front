import { act, render } from '@testing-library/react';
import { OrthographicCamera } from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { applyFollowCamera } from '../camera';
import type { Pose } from '../movement';
import type { ClassroomInteractable } from './classroom-interactables';
import { createNpcLivePositions } from './npc-live-position';
import { ProximityTracker } from './proximity-tracker';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
  camera: null as unknown,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = { camera: frame.camera, invalidate: frame.invalidate };
    return select ? select(state) : state;
  },
}));

const shop: ClassroomInteractable = {
  id: 'shop',
  type: 'shop',
  interactionClass: 'opens_panel',
  panelKey: 'shop',
  worldPosition: [4.8, 0, -5.86],
  footprint: [2, 0.32],
  beaconHeight: 2.25,
};

const tick = () =>
  act(() => frame.callback?.({ camera: frame.camera }, 1 / 60));

beforeEach(() => {
  frame.callback = null;
  frame.invalidate.mockClear();
  const camera = new OrthographicCamera();
  applyFollowCamera(camera, 1280, 720, { x: 4.8, z: -4 });
  frame.camera = camera;
});

function setup(pose: Pose, interactables = [shop]) {
  const poseRef = { current: pose };
  const onChange = vi.fn();
  const onAnchor = vi.fn();
  const view = render(
    <ProximityTracker
      poseRef={poseRef}
      interactables={interactables}
      onChange={onChange}
      onAnchor={onAnchor}
    />,
  );
  return { poseRef, onChange, onAnchor, view };
}

describe('ProximityTracker', () => {
  test('reports the target only when its id changes', () => {
    const { poseRef, onChange } = setup({ x: 0, z: 5, rotation: 0 });
    tick();
    expect(onChange).not.toHaveBeenCalled();

    poseRef.current = { x: 4.8, z: -4.5, rotation: 0 };
    tick();
    tick();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('shop');

    poseRef.current = { x: 0, z: 5, rotation: 0 };
    tick();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test('anchors the prompt on screen above the object while a target exists', () => {
    const { poseRef, onAnchor } = setup({ x: 0, z: 5, rotation: 0 });
    tick();
    expect(onAnchor).not.toHaveBeenCalled();

    poseRef.current = { x: 4.8, z: -4.5, rotation: 0 };
    tick();
    const anchor = onAnchor.mock.calls.at(-1)![0] as { x: number; y: number };
    expect(anchor.x).toBeGreaterThan(0);
    expect(anchor.x).toBeLessThan(1);
    expect(anchor.y).toBeGreaterThan(0);
    expect(anchor.y).toBeLessThan(1);
  });

  test('skips repeated onAnchor calls while projected screen coordinates stay unchanged', () => {
    const { onAnchor } = setup({ x: 4.8, z: -4.5, rotation: 0 });
    tick();
    tick();
    tick();
    expect(onAnchor).toHaveBeenCalledTimes(1);

    applyFollowCamera(frame.camera as OrthographicCamera, 1280, 720, {
      x: 3.5,
      z: -4,
    });
    tick();
    expect(onAnchor).toHaveBeenCalledTimes(2);
    tick();
    expect(onAnchor).toHaveBeenCalledTimes(2);
  });

  test('re-evaluates when the candidates change and clears on unmount', () => {
    const { poseRef, onChange, view } = setup({ x: 4.8, z: -4.5, rotation: 0 });
    tick();
    expect(onChange).toHaveBeenLastCalledWith('shop');
    frame.invalidate.mockClear();
    view.rerender(
      <ProximityTracker
        poseRef={poseRef}
        interactables={[]}
        onChange={onChange}
        onAnchor={undefined}
      />,
    );
    expect(frame.invalidate).toHaveBeenCalled();
    tick();
    expect(onChange).toHaveBeenLastCalledWith(undefined);

    onChange.mockClear();
    poseRef.current = { x: 4.8, z: -4.5, rotation: 0 };
    view.rerender(
      <ProximityTracker
        poseRef={poseRef}
        interactables={[shop]}
        onChange={onChange}
        onAnchor={undefined}
      />,
    );
    tick();
    expect(onChange).toHaveBeenLastCalledWith('shop');
    view.unmount();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test('follows a moving NPC instead of its catalog position', () => {
    const bot: ClassroomInteractable = {
      id: 'tutor-bot',
      type: 'tutor-bot',
      interactionClass: 'npc',
      npcId: 'tutorBot',
      worldPosition: [-5.6, 0, 1.05],
      footprint: [0.6, 0.6],
      beaconHeight: 1.3,
    };
    const poseRef = { current: { x: 3, z: 1, rotation: 0 } };
    const npcPositions = createNpcLivePositions();
    const onChange = vi.fn();
    render(
      <ProximityTracker
        poseRef={poseRef}
        interactables={[bot]}
        npcPositions={npcPositions}
        onChange={onChange}
        onAnchor={undefined}
      />,
    );
    tick();
    expect(onChange).not.toHaveBeenCalled();

    npcPositions.set('tutorBot', { x: 3.5, z: 1 });
    tick();
    expect(onChange).toHaveBeenLastCalledWith('tutor-bot');

    npcPositions.set('tutorBot', { x: -5.6, z: 1.05 });
    tick();
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
