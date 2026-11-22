import { describe, expect, test, vi } from 'vitest';
import { destinationFromFloorClick } from './floor-click';

const floor = { userData: { walkableFloor: true } };
const desk = { userData: {} };

function event(
  overrides: Partial<{
    button: number;
    point: { x: number; y: number; z: number };
    first: { userData: Record<string, unknown> };
  }> = {},
) {
  return {
    nativeEvent: { button: overrides.button ?? 0 },
    point: overrides.point ?? { x: 1.5, y: 0, z: -2 },
    intersections: [{ object: overrides.first ?? floor }, { object: floor }],
    stopPropagation: vi.fn(),
  };
}

describe('destinationFromFloorClick', () => {
  test('sends the floor hit point to setDestination', () => {
    const setDestination = vi.fn(() => true);
    const e = event();
    expect(destinationFromFloorClick(e, setDestination)).toEqual({
      x: 1.5,
      z: -2,
    });
    expect(setDestination).toHaveBeenCalledWith({ x: 1.5, z: -2 });
    expect(e.stopPropagation).toHaveBeenCalled();
  });

  test('ignores a click whose nearest hit is a prop, even with the floor behind it', () => {
    const setDestination = vi.fn(() => true);
    const e = event({ first: desk });
    expect(destinationFromFloorClick(e, setDestination)).toBeNull();
    expect(setDestination).not.toHaveBeenCalled();
  });

  test('ignores non-primary buttons', () => {
    const setDestination = vi.fn(() => true);
    expect(
      destinationFromFloorClick(event({ button: 2 }), setDestination),
    ).toBeNull();
    expect(setDestination).not.toHaveBeenCalled();
  });

  test('returns null, so no marker, when the destination is rejected', () => {
    const setDestination = vi.fn(() => false);
    expect(destinationFromFloorClick(event(), setDestination)).toBeNull();
  });

  test('ignores a hit without intersections', () => {
    const setDestination = vi.fn(() => true);
    const e = { ...event(), intersections: [] };
    expect(destinationFromFloorClick(e, setDestination)).toBeNull();
  });
});
