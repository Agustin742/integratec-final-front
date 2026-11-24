import type { ClassroomInteractable } from '../world/classroom/classroom-interactables';
import { classroomMessages } from './messages';

export interface ProximityAvailability {
  readonly canOpenPanel: (key: string) => boolean;
  /** Server-assigned 1-based desk index, or null when unassigned. */
  readonly myDeskIndex: number | null;
}

/**
 * Whether walking up to `interactable` should offer an action. Mirrors what a
 * click can actually do, so no prompt promises something that would be denied:
 * panels the user cannot open and desks that are not theirs are skipped, and
 * the entrance is left to a deliberate click because it leaves the classroom
 * and sits next to the spawn points.
 */
export function canTargetByProximity(
  interactable: ClassroomInteractable,
  { canOpenPanel, myDeskIndex }: ProximityAvailability,
): boolean {
  if (interactable.interactionClass === 'direct_transition') return false;
  if (interactable.interactionClass === 'decorative') return true;
  if (!interactable.panelKey || !canOpenPanel(interactable.panelKey)) {
    return false;
  }
  if (interactable.type === 'student-desk') {
    return myDeskIndex !== null && interactable.deskIndex === myDeskIndex;
  }
  return true;
}

/** Action text shown beside the key, e.g. "Abrir tienda". */
export function proximityActionLabel(
  interactable: ClassroomInteractable,
  petName: string,
): string {
  const copy = classroomMessages.proximity;
  return interactable.type === 'pet'
    ? copy.petAction(petName)
    : copy.actions[interactable.type];
}
