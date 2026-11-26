import type { ReactNode } from 'react';
import type { AvatarInput } from '@/realtime';
import { useOwnProfile } from '@/features/profile/use-own-profile';
import { worldMessages } from '../messages';
import type { AvatarEquipped } from '../avatar/avatar-part-plan';
import type { Pose } from '../movement';
import { WorldCanvas, type WorldCanvasProps } from '../world-canvas';
import type { NpcSpeech, NpcView, NpcViews } from '../npc/npc-view';
import type { ClassroomInteractable } from './classroom-interactables';
import { ClassroomScene } from './classroom-scene';
import type { DeskDecorAssignment } from './desk-decor';
import type { ProximityAnchor } from './proximity-tracker';
import type { RemoteClassroomParticipant } from './remote-avatar';

export interface ClassroomWorldProps extends Pick<
  WorldCanvasProps,
  'label' | 'scopeKey'
> {
  /** Authoritative pose from the room for the local user (#37). */
  selfPose?: Pose | undefined;
  onAssetError?: (() => void) | undefined;
  selfEquipped?: AvatarEquipped | undefined;
  /** Decor shown on each student desk. */
  deskDecor?: readonly DeskDecorAssignment[] | undefined;
  /** Connection epoch key that changes on join, reconnect, or drop (#37). */
  connectionKey?: string | undefined;
  /** True while the classroom freeze lock is active (#37). */
  frozen?: boolean | undefined;
  /** Remote participants synchronized from the Colyseus room (#37). */
  remoteParticipants?: readonly RemoteClassroomParticipant[] | undefined;
  /** Movement intent of the local avatar, for the realtime sender (#37). */
  onIntentChange?: (intent: AvatarInput) => void;
  highlightedInteractableId?: string | undefined;
  ownDeskIndex?: number | null | undefined;
  interactionLocked?: boolean | undefined;
  onHoverInteractable?: ((id: string | undefined) => void) | undefined;
  onSelectInteractable?:
    ((interactable: ClassroomInteractable) => void) | undefined;
  isProximityTarget?:
    ((interactable: ClassroomInteractable) => boolean) | undefined;
  onProximityChange?: ((id: string | undefined) => void) | undefined;
  onProximityAnchor?: ((anchor: ProximityAnchor) => void) | undefined;
  /** Synced NPC state by id (pet, tutor bot); the bot rests at home without it. */
  npcs?: NpcViews | undefined;
  /** Skin of the tutor bot; the default bot without one. */
  tutorBotSkin?: string | undefined;
  resolveNpcPhrase?: ((npc: NpcView) => string | undefined) | undefined;
  onNpcSpeech?: ((speech: NpcSpeech | undefined) => void) | undefined;
  onNpcSpeechAnchor?: ((anchor: ProximityAnchor) => void) | undefined;
  /**
   * Fills the positioned parent instead of using the fixed card height, for
   * a full-screen world (#128). The parent must have a definite size.
   */
  fill?: boolean;
  /** Extra in-canvas nodes, such as the performance probe (#56). */
  children?: ReactNode;
}

/**
 * The isometric classroom canvas: `WorldCanvas` with the follow camera plus its
 * scene and the signed-in user's avatar. The profile is read here, outside the
 * canvas, so the scene never depends on providers crossing the R3F boundary.
 */
export function ClassroomWorld({
  label,
  scopeKey,
  onAssetError,
  selfPose,
  selfEquipped,
  deskDecor,
  connectionKey,
  frozen,
  remoteParticipants,
  onIntentChange,
  highlightedInteractableId,
  ownDeskIndex,
  interactionLocked,
  onHoverInteractable,
  onSelectInteractable,
  isProximityTarget,
  onProximityChange,
  onProximityAnchor,
  npcs,
  tutorBotSkin,
  resolveNpcPhrase,
  onNpcSpeech,
  onNpcSpeechAnchor,
  fill = false,
  children,
}: ClassroomWorldProps) {
  const { query } = useOwnProfile();
  return (
    <WorldCanvas
      label={label}
      scopeKey={scopeKey}
      framing="follow"
      description={worldMessages.classroomControls}
      {...(fill && {
        fill: true,
        canvasClassName: 'h-full w-full',
        hostClassName: 'h-full',
        loading: (
          <p
            role="status"
            className="absolute inset-x-0 top-1/2 text-center text-sm text-foreground"
          >
            {worldMessages.loading}
          </p>
        ),
      })}
    >
      <ClassroomScene
        onAssetError={onAssetError}
        avatar={query.data?.avatar}
        scopeKey={scopeKey}
        selfPose={selfPose}
        selfEquipped={selfEquipped}
        deskDecor={deskDecor}
        connectionKey={connectionKey}
        frozen={frozen}
        remoteParticipants={remoteParticipants}
        onIntentChange={onIntentChange}
        highlightedInteractableId={highlightedInteractableId}
        ownDeskIndex={ownDeskIndex}
        interactionLocked={interactionLocked}
        onHoverInteractable={onHoverInteractable}
        onSelectInteractable={onSelectInteractable}
        isProximityTarget={isProximityTarget}
        onProximityChange={onProximityChange}
        onProximityAnchor={onProximityAnchor}
        npcs={npcs}
        tutorBotSkin={tutorBotSkin}
        resolveNpcPhrase={resolveNpcPhrase}
        onNpcSpeech={onNpcSpeech}
        onNpcSpeechAnchor={onNpcSpeechAnchor}
      />
      {children}
    </WorldCanvas>
  );
}
