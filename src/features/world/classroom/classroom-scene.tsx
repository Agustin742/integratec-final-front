import { useCallback, useEffect, useMemo } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import { WarmLighting } from '../world-lighting';
import { buildClassroomScene } from './build-classroom-scene';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  resolveInteractableHit,
  type ClassroomInteractable,
  type InteractablePointerEvent,
} from './classroom-interactables';
import type { FloorClickEvent } from './floor-click';
import { InteractableHighlight } from './interactable-highlight';
import { LocalAvatar } from './local-avatar';
import { useClassroomNavigation } from './use-classroom-navigation';

export interface ClassroomSceneProps {
  /** Confirmed profile avatar; the scene works without it. */
  avatar?: Avatar | undefined;
  /** Classroom id: scopes avatar assets and resets the local avatar. */
  scopeKey?: string | undefined;
  onIntentChange?: ((intent: AvatarInput) => void) | undefined;
  /** Highlighted interactable id (from 3D hover or DOM focus). */
  highlightedInteractableId?: string | undefined;
  /** Server-assigned 1-based student desk index, or null when unassigned. */
  ownDeskIndex?: number | null | undefined;
  /** Monotonic nonce triggering a decorative bounce on the classroom pet. */
  petReactionNonce?: number | undefined;
  /** True while a modal panel owns focus and blocks 3D interaction. */
  interactionLocked?: boolean | undefined;
  onHoverInteractable?: ((id: string | undefined) => void) | undefined;
  onSelectInteractable?:
    ((interactable: ClassroomInteractable) => void) | undefined;
}

type ScenePointerEvent = FloorClickEvent & InteractablePointerEvent;

/**
 * Placeholder classroom (floor, cutaway walls, desks from the layout and the
 * named prop placeholders) with the shared warm lighting and cream backdrop,
 * plus the user's own avatar. Shadowless; the object graph is built once per
 * layout and disposed on unmount because `<primitive>` objects are not owned
 * by R3F. Only the scene root takes pointer events: interactables emit intent
 * while the walkable floor turns a click or tap into a walk destination.
 */
export function ClassroomScene({
  avatar,
  scopeKey,
  onIntentChange,
  highlightedInteractableId,
  ownDeskIndex,
  petReactionNonce,
  interactionLocked = false,
  onHoverInteractable,
  onSelectInteractable,
}: ClassroomSceneProps) {
  const scene = useMemo(() => buildClassroomScene(CLASSROOM_LAYOUT), []);
  useEffect(() => () => scene.dispose(), [scene]);

  const interactablesById = useMemo(
    () =>
      indexClassroomInteractables(
        deriveClassroomInteractables(CLASSROOM_LAYOUT),
      ),
    [],
  );

  const { controller, marker, onFloorClick, clearDestination } =
    useClassroomNavigation({
      scopeKey,
      onIntentChange,
      interactionLocked,
    });

  const handlePointerMove = useCallback(
    (event: InteractablePointerEvent) => {
      if (interactionLocked) return;
      const pointerType =
        event.pointerType ?? event.nativeEvent?.pointerType ?? '';
      if (pointerType === 'touch') return;
      const hit = resolveInteractableHit(
        event.intersections ?? [],
        interactablesById,
      );
      onHoverInteractable?.(hit?.id);
    },
    [interactionLocked, interactablesById, onHoverInteractable],
  );

  const handlePointerOut = useCallback(
    (event: InteractablePointerEvent) => {
      const hit = resolveInteractableHit(
        event.intersections ?? [],
        interactablesById,
      );
      if (!hit) {
        onHoverInteractable?.(undefined);
      }
    },
    [interactablesById, onHoverInteractable],
  );

  const handleClick = useCallback(
    (event: ScenePointerEvent) => {
      if (interactionLocked) return;
      if (
        event.nativeEvent?.button !== undefined &&
        event.nativeEvent.button !== 0
      ) {
        return;
      }
      const hit = resolveInteractableHit(
        event.intersections ?? [],
        interactablesById,
      );
      if (hit) {
        event.stopPropagation();
        clearDestination();
        onSelectInteractable?.(hit);
        return;
      }
      onFloorClick(event);
    },
    [
      interactionLocked,
      interactablesById,
      clearDestination,
      onSelectInteractable,
      onFloorClick,
    ],
  );

  return (
    <>
      <color attach="background" args={['#FFF9EB']} />
      <WarmLighting />
      <primitive
        object={scene.root}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />
      <InteractableHighlight
        interactablesById={interactablesById}
        highlightedId={
          interactionLocked ? undefined : highlightedInteractableId
        }
        ownDeskIndex={ownDeskIndex}
        sceneRoot={scene.root}
        petReactionNonce={petReactionNonce}
      />
      <LocalAvatar
        controller={controller}
        marker={marker.object}
        avatar={avatar}
        scopeKey={scopeKey}
      />
    </>
  );
}
