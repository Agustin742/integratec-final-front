import { Group } from 'three';

export const PET_HOP_DURATION_SECONDS = 0.45;
export const BEACON_PULSE_DURATION_SECONDS = 0.65;
const PET_HOP_PEAK_METERS = 0.24;

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

export function resetPetPosition(sceneRoot: Group): void {
  const petGroup = sceneRoot.getObjectByName('classroom-pet');
  if (petGroup) {
    petGroup.position.y = 0;
  }
}

export function stepPetHop(sceneRoot: Group, elapsed: number): boolean {
  const petGroup = sceneRoot.getObjectByName('classroom-pet');
  if (!petGroup) return false;
  if (elapsed >= PET_HOP_DURATION_SECONDS) {
    petGroup.position.y = 0;
    return false;
  }
  const progress = elapsed / PET_HOP_DURATION_SECONDS;
  petGroup.position.y =
    Math.sin(progress * Math.PI) * PET_HOP_PEAK_METERS * (1 - 0.15 * progress);
  return true;
}
