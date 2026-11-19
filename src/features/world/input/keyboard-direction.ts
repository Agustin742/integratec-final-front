import type { Direction } from '../movement';

/**
 * Screen axes: `x` is right, `y` is up (screen-up = away from the viewer).
 * The camera sits at (+h, y, +h) looking at the origin (see `frameCamera`), so
 * on the ground screen-up is (-1, 0, -1)/sqrt2 and screen-right is (1, 0, -1)/sqrt2.
 */
const FORWARD = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 } as const;
const RIGHT = { x: Math.SQRT1_2, z: -Math.SQRT1_2 } as const;

/** Maps a screen-space intent (right/up) to a unit world direction on the floor, or zero. */
export function screenToWorldDirection(screen: {
  x: number;
  y: number;
}): Direction {
  const x = RIGHT.x * screen.x + FORWARD.x * screen.y;
  const z = RIGHT.z * screen.x + FORWARD.z * screen.y;
  const length = Math.hypot(x, z);
  // Opposite keys sum to exactly zero or float dust; both mean "stand still".
  if (length < 1e-9) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

const KEY_AXES: Readonly<Record<string, { x: number; y: number }>> = {
  KeyW: { x: 0, y: 1 },
  ArrowUp: { x: 0, y: 1 },
  KeyS: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: -1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export function isMovementKey(code: string): boolean {
  return Object.hasOwn(KEY_AXES, code);
}

export interface KeyboardState {
  /** Registers a held key; returns false when it is not a movement key. */
  press: (code: string) => boolean;
  /** Releases a key; returns true only when it was actually held. */
  release: (code: string) => boolean;
  clear: () => void;
  hasHeldKeys: () => boolean;
  /** Current unit world direction from every held key. */
  direction: () => Direction;
}

export function createKeyboardState(): KeyboardState {
  const held = new Set<string>();
  return {
    press(code) {
      if (!isMovementKey(code)) return false;
      held.add(code);
      return true;
    },
    release(code) {
      return held.delete(code);
    },
    clear() {
      held.clear();
    },
    hasHeldKeys: () => held.size > 0,
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const axis = KEY_AXES[code]!;
        x += axis.x;
        y += axis.y;
      }
      return screenToWorldDirection({ x, y });
    },
  };
}
