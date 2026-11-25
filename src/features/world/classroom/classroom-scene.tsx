import { useCallback, useEffect, useMemo } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import type { AvatarEquipped } from '../avatar/avatar-part-plan';
import type { Pose } from '../movement';
import {
  TUTOR_BOT_NPC_ID,
  deriveTutorBotHome,
  findNpcView,
  type NpcSpeech,
  type NpcView,
  type NpcViews,
} from '../npc/npc-view';
import { TutorBot } from '../npc/tutor-bot';
import { WarmLighting } from '../world-lighting';
import { buildClassroomScene } from './build-classroom-scene';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  resolveInteractableHit,
  type ClassroomInteractable,
  type InteractablePointerEvent,
} from './classroom-interactables';
import { deriveFurniturePlacements } from './classroom-furniture-placements';
import { deriveInteractivePlacements } from './classroom-interactive-placements';
import { deriveShellPlacements } from './classroom-shell-placements';
import { ClassroomDoor } from './classroom-door';
import type { FloorClickEvent } from './floor-click';
import { FollowCamera } from './follow-camera';
import { InteractableHighlight } from './interactable-highlight';
import { ClassroomKit } from './kit/classroom-kit';
import { LocalAvatar } from './local-avatar';
import { createNpcLivePositions } from './npc-live-position';
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
  /** Accessory shop codes the local member wears in this classroom. */
  selfEquipped?: AvatarEquipped | undefined;
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
  /**
   * Synced NPC state by id. Without it the tutor bot rests idle at its home
   * in front of the bot station, so the scene never lacks one.
   */
  npcs?: NpcViews | undefined;
  /** Text for an NPC phrase reaction (resolved from its synced phrase id). */
  resolveNpcPhrase?: ((npc: NpcView) => string | undefined) | undefined;
  /** Phrase an NPC is saying now, or undefined once it fades. */
  onNpcSpeech?: ((speech: NpcSpeech | undefined) => void) | undefined;
  /** Screen point (0..1, y down) above the speaking NPC, every frame it moves. */
  onNpcSpeechAnchor?: ((anchor: ProximityAnchor) => void) | undefined;
}

type ScenePointerEvent = FloorClickEvent & InteractablePointerEvent;

/**
 * Classroom (modular shell with cutaway near walls, modular furniture placed
 * from the layout and the remaining named prop placeholders) with the shared warm lighting and cream backdrop,
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
  selfEquipped,
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
  npcs,
  resolveNpcPhrase,
  onNpcSpeech,
  onNpcSpeechAnchor,
}: ClassroomSceneProps) {
  const scene = useMemo(() => buildClassroomScene(CLASSROOM_LAYOUT), []);
  useEffect(() => () => scene.dispose(), [scene]);
  const kitPlacements = useMemo(
    () => [
      ...deriveShellPlacements(CLASSROOM_LAYOUT),
      ...deriveFurniturePlacements(CLASSROOM_LAYOUT),
      ...deriveInteractivePlacements(CLASSROOM_LAYOUT),
    ],
    [],
  );
  const interactablesById = useMemo(
    () =>
      indexClassroomInteractables(
        deriveClassroomInteractables(CLASSROOM_LAYOUT),
      ),
    [],
  );

  const npcPositions = useMemo(() => createNpcLivePositions(), []);
  const botHome = useMemo(() => deriveTutorBotHome(CLASSROOM_LAYOUT), []);
  const bot = findNpcView(npcs, TUTOR_BOT_NPC_ID) ?? botHome;
  const botPhrase =
    bot.reaction === 'phrase' ? resolveNpcPhrase?.(bot) : undefined;

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
      >
        {/* Under the scene root so clicks on the moving bot reach its handlers. */}
        <TutorBot
          npc={bot}
          phraseText={botPhrase}
          scopeKey={scopeKey}
          positions={npcPositions}
          onSpeech={onNpcSpeech}
          onSpeechAnchor={onNpcSpeechAnchor}
        />
      </primitive>
      <ClassroomKit placements={kitPlacements} scopeKey={scopeKey} />
      <ClassroomDoor poseRef={controller.poseRef} scopeKey={scopeKey} />
      <InteractableHighlight
        interactablesById={interactablesById}
        highlightedId={
          interactionLocked ? undefined : highlightedInteractableId
        }
        ownDeskIndex={ownDeskIndex}
        sceneRoot={scene.root}
        petReactionNonce={petReactionNonce}
        npcPositions={npcPositions}
      />
      <LocalAvatar
        controller={controller}
        marker={marker.object}
        avatar={avatar}
        equipped={selfEquipped}
        scopeKey={scopeKey}
      />
      {/* After LocalAvatar so its frame callback sees the freshly stepped pose. */}
      <FollowCamera poseRef={controller.poseRef} />
      <ProximityTracker
        poseRef={controller.poseRef}
        interactables={proximityCandidates}
        onChange={onProximityChange}
        onAnchor={onProximityAnchor}
        npcPositions={npcPositions}
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
          equipped={participant.equipped}
          scopeKey={scopeKey}
        />
      ))}
    </>
  );
}
