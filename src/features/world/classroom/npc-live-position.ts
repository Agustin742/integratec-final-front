import type { ClassroomInteractable } from './classroom-interactables';

/** Floor position of an NPC that moves (`NpcView.id` -> x/z). */
export type NpcLivePositions = Map<string, { x: number; z: number }>;

/**
 * Where moving NPCs are right now. The NPC component writes it every frame
 * and the proximity tracker, the highlight and the prompt anchor read it, so
 * none of them needs React state to follow a walking NPC.
 */
export function createNpcLivePositions(): NpcLivePositions {
  return new Map();
}

/**
 * Returns the interactable standing where its NPC is now. Interactables
 * without an `npcId`, or whose NPC has not published a position, come back
 * unchanged (same object), so static ones never allocate.
 */
export function resolveLiveInteractable(
  interactable: ClassroomInteractable,
  positions: NpcLivePositions | undefined,
): ClassroomInteractable {
  if (!interactable.npcId || !positions) return interactable;
  const live = positions.get(interactable.npcId);
  if (!live) return interactable;
  return {
    ...interactable,
    worldPosition: [live.x, interactable.worldPosition[1], live.z],
  };
}

/** How far an NPC interactable's NPC has walked from its catalog position. */
export function npcFollowOffset(
  interactable: ClassroomInteractable,
  positions: NpcLivePositions | undefined,
): readonly [number, number] {
  if (!interactable.npcId || !positions) return [0, 0];
  const live = positions.get(interactable.npcId);
  if (!live) return [0, 0];
  return [
    live.x - interactable.worldPosition[0],
    live.z - interactable.worldPosition[2],
  ];
}
