import { useCallback, useEffect, useMemo } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import type { Pose } from '../movement';
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
import { FollowCamera } from './follow-camera';
import { InteractableHighlight } from './interactable-highlight';
import { LocalAvatar } from './local-avatar';
import { ProximityTracker, type ProximityAnchor } from './proximity-tracker';
import { RemoteAvatar, type RemoteClassroomParticipant } from './remote-avatar';
import { useClassroomNavigation } from './use-classroom-navigation';

export interface ClassroomSceneProps {
  /** Confirmed profile avatar; the scene works without it. */
  avatar?: Avatar | undefined;
  /** Classroom id: scopes avatar assets and resets the local avatar. */
  scopeKey?: string | undefined;
  /** Authoritative pose from the room for the local participant (#37). */
  selfPose?: Pose | undefined;
  /** Connection epoch key that changes on join/reconnect/drop (#37). */
  connectionKey?: string | undefined;
  /** True while the classroom freeze lock is active (#37). */
  frozen?: boolean | undefined;
  /** Connected remote participants from authoritative room state (#37). */
  remoteParticipants?: readonly RemoteClassroomParticipant[] | undefined;
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
  /** Whether walking up to this object should offer an action; omit to disable proximity. */
  isProximityTarget?:
    ((interactable: ClassroomInteractable) => boolean) | undefined;
  /** Nearby target id; fires only when it changes. */
  onProximityChange?: ((id: string | undefined) => void) | undefined;
  /** Screen point of the nearby target, every frame it is shown. */
  onProximityAnchor?: ((anchor: ProximityAnchor) => void) | undefined;
}

type ScenePointerEvent = FloorClickEvent & InteractablePointerEvent;

/**
 * Classroom (floor, cutaway walls, desks from the layout and the
 * named prop placeholders) with the shared warm lighting and cream backdrop,
 * plus the user's own avatar and live remote participants. Shadowless; the
 * object graph is built once per layout and disposed on unmount because
 * `<primitive>` objects are not owned by R3F. Only the scene root takes pointer
 * events: interactables emit intent while the walkable floor turns a click or
 * tap into a walk destination.
 */
export function ClassroomScene({
  avatar,
  scopeKey,
  selfPose,
  connectionKey,
  frozen = false,
  remoteParticipants = [],
  onIntentChange,
  highlightedInteractableId,
  ownDeskIndex,
  petReactionNonce,
  interactionLocked = false,
  onHoverInteractable,
  onSelectInteractable,
  isProximityTarget,
  onProximityChange,
  onProximityAnchor,
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

  const proximityCandidates = useMemo(
    () =>
      isProximityTarget
        ? [...interactablesById.values()].filter(isProximityTarget)
        : [],
    [interactablesById, isProximityTarget],
  );

  const { controller, marker, onFloorClick, clearDestination } =
    useClassroomNavigation({
      scopeKey,
      serverPose: selfPose,
      connectionKey,
      frozen,
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
      {/* After LocalAvatar so its frame callback sees the freshly stepped pose. */}
      <FollowCamera poseRef={controller.poseRef} />
      <ProximityTracker
        poseRef={controller.poseRef}
        interactables={proximityCandidates}
        onChange={onProximityChange}
        onAnchor={onProximityAnchor}
      />
      {remoteParticipants.map((participant) => (
        <RemoteAvatar
          key={`${scopeKey ?? ''}:${participant.userId}`}
          userId={participant.userId}
          status={participant.status}
          targetPose={{
            x: participant.x,
            z: participant.z,
            rotation: participant.rotation,
          }}
          avatar={participant.avatar}
          scopeKey={scopeKey}
        />
      ))}
    </>
  );
}
