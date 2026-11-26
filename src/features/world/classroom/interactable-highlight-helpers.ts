import { Group } from 'three';

export const BEACON_PULSE_DURATION_SECONDS = 0.65;

export function applyPointerCursor(
  element: HTMLElement | undefined,
  active: boolean,
): void {
  if (!element) return;
  element.style.cursor = active ? 'pointer' : '';
}

export function resetBeaconTransform(
  group: Group,
  x: number,
  y: number,
  z: number,
): void {
  group.position.set(x, y, z);
  group.rotation.y = 0;
}

export function stepBeaconTransform(
  group: Group,
  baseY: number,
  elapsed: number,
): boolean {
  if (elapsed >= BEACON_PULSE_DURATION_SECONDS) {
    group.position.y = baseY;
    group.rotation.y = Math.PI / 4;
    return false;
  }
  const progress = elapsed / BEACON_PULSE_DURATION_SECONDS;
  group.position.y =
    baseY + Math.sin(progress * Math.PI * 2) * 0.1 * (1 - progress);
  group.rotation.y = progress * (Math.PI / 4);
  return true;
}
