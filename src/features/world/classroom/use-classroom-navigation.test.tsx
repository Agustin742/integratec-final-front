import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { useClassroomNavigation } from './use-classroom-navigation';

const three = vi.hoisted(() => ({
  frameloop: 'demand' as 'demand' | 'never',
  invalidate: vi.fn(),
}));
vi.mock('@react-three/fiber', () => ({
  useThree: (select?: (state: unknown) => unknown) => {
    const state = { invalidate: three.invalidate, frameloop: three.frameloop };
    return select ? select(state) : state;
  },
}));

const floor = { userData: { walkableFloor: true } };
const click = (x: number, z: number, button = 0) => ({
  nativeEvent: { button },
  point: { x, y: 0, z },
  intersections: [{ object: floor }],
  stopPropagation: vi.fn(),
});

function setup(
  props: {
    scopeKey?: string;
    serverPose?: { x: number; z: number; rotation: number };
    connectionKey?: string;
    frozen?: boolean;
    onIntentChange?: () => void;
    interactionLocked?: boolean;
  } = {},
) {
  return renderHook(
    (p: {
      scopeKey?: string;
      serverPose?: { x: number; z: number; rotation: number };
      connectionKey?: string;
      frozen?: boolean;
      onIntentChange?: () => void;
      interactionLocked?: boolean;
    }) => useClassroomNavigation(p),
    { initialProps: props },
  );
}

const escape = () =>
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }),
    );
  });

beforeEach(() => {
  three.frameloop = 'demand';
  three.invalidate.mockClear();
});

describe('useClassroomNavigation', () => {
  test('spawns at the first layout spawn point', () => {
    const { result } = setup({ scopeKey: 'room-1' });
    const first = CLASSROOM_LAYOUT.spawnPoints[0]!;
    expect(result.current.controller.poseRef.current).toMatchObject(first);
  });

  test('a floor click starts a walk and shows the marker', () => {
    const { result } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(result.current.controller.hasDestination()).toBe(true);
    expect(result.current.marker.object.visible).toBe(true);
    expect(result.current.marker.object.position.x).toBe(-4);
    expect(three.invalidate).toHaveBeenCalled();
  });

  test('an unreachable click shows no marker and does not move', () => {
    const { result } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(500, 500)));
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
  });

  test('Escape clears the destination and hides the marker', () => {
    const { result } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(-4, 5)));
    three.invalidate.mockClear();
    escape();
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
    expect(three.invalidate).toHaveBeenCalled();
  });

  test('Escape does nothing while a dialog is open', () => {
    const { result } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(-4, 5)));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    escape();
    expect(result.current.controller.hasDestination()).toBe(true);
    dialog.remove();
  });

  test('switching classroom respawns and hides the marker', () => {
    const { result, rerender } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(-4, 5)));
    act(() => {
      result.current.controller.step(0.05);
    });
    three.invalidate.mockClear();
    rerender({ scopeKey: 'room-2' });
    const first = CLASSROOM_LAYOUT.spawnPoints[0]!;
    expect(result.current.controller.poseRef.current).toMatchObject(first);
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
    expect(three.invalidate).toHaveBeenCalled();
  });

  test('ignores input while the canvas is not rendering', () => {
    three.frameloop = 'never';
    const { result } = setup({ scopeKey: 'room-1' });
    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
  });

  test('passes the movement intent through', () => {
    const onIntentChange = vi.fn();
    const { result } = setup({ scopeKey: 'room-1', onIntentChange });
    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(onIntentChange).toHaveBeenCalled();
  });

  test('a keyboard press wakes the demand frameloop and forwards the intent', () => {
    const onIntentChange = vi.fn();
    setup({ scopeKey: 'room-1', onIntentChange });
    three.invalidate.mockClear();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyD',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(three.invalidate).toHaveBeenCalled();
    expect(onIntentChange).toHaveBeenCalledTimes(1);
  });

  test('spawns and reconciles to serverPose on join and reconnect while clearing destinations', () => {
    const { result, rerender } = setup({
      scopeKey: 'room-1',
      connectionKey: 'connecting',
    });

    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(result.current.controller.hasDestination()).toBe(true);

    // Server join provides authoritative spawn and replaces local state.
    rerender({
      scopeKey: 'room-1',
      connectionKey: 'room-a:session-1',
      serverPose: { x: 2, z: 5, rotation: 0.4 },
    });
    expect(result.current.controller.poseRef.current).toEqual({
      x: 2,
      z: 5,
      rotation: 0.4,
    });
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);

    // Reconnect under a new session epoch reconciles pose and discards queued destination.
    act(() => result.current.onFloorClick(click(0, 5)));
    expect(result.current.controller.hasDestination()).toBe(true);

    rerender({
      scopeKey: 'room-1',
      connectionKey: 'room-a:session-2',
      serverPose: { x: 4, z: 5, rotation: Math.PI },
    });
    expect(result.current.controller.poseRef.current).toEqual({
      x: 4,
      z: 5,
      rotation: Math.PI,
    });
    expect(result.current.controller.hasDestination()).toBe(false);
  });

  test('stops movement input and drops destinations when classroom is frozen', () => {
    const onIntentChange = vi.fn();
    const { result, rerender } = setup({
      scopeKey: 'room-1',
      connectionKey: 'room-a:session-1',
      serverPose: { x: -4, z: 5, rotation: 0 },
      frozen: false,
      onIntentChange,
    });

    act(() => result.current.onFloorClick(click(-2, 5)));
    expect(result.current.controller.hasDestination()).toBe(true);

    onIntentChange.mockClear();
    rerender({
      scopeKey: 'room-1',
      connectionKey: 'room-a:session-1',
      serverPose: { x: -1.5, z: 0.4, rotation: Math.PI },
      frozen: true,
      onIntentChange,
    });

    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
    expect(result.current.controller.poseRef.current).toEqual({
      x: -1.5,
      z: 0.4,
      rotation: Math.PI,
    });

    // Floor clicks and WASD keys are ignored while frozen.
    act(() => result.current.onFloorClick(click(0, 5)));
    expect(result.current.controller.hasDestination()).toBe(false);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'KeyW',
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(result.current.controller.getIntent()).toEqual({ x: 0, z: 0 });
  });

  test('interactionLocked clears any active walk destination and ignores new clicks until unlocked', () => {
    const { result, rerender } = setup({
      scopeKey: 'room-1',
      interactionLocked: false,
    });
    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(result.current.controller.hasDestination()).toBe(true);
    expect(result.current.marker.object.visible).toBe(true);

    rerender({ scopeKey: 'room-1', interactionLocked: true });
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);

    act(() => result.current.onFloorClick(click(-4, 5)));
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);

    // Unlocking must never replay an earlier destination.
    rerender({ scopeKey: 'room-1', interactionLocked: false });
    expect(result.current.controller.hasDestination()).toBe(false);
    expect(result.current.marker.object.visible).toBe(false);
  });
});
