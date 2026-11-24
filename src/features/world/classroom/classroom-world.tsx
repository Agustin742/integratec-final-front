import type { ReactNode } from 'react';
import type { AvatarInput } from '@/realtime';
import { useOwnProfile } from '@/features/profile/use-own-profile';
import { worldMessages } from '../messages';
import type { Pose } from '../movement';
import { WorldCanvas, type WorldCanvasProps } from '../world-canvas';
import type { ClassroomInteractable } from './classroom-interactables';
import { ClassroomScene } from './classroom-scene';
import type { RemoteClassroomParticipant } from './remote-avatar';

export interface ClassroomWorldProps extends Pick<
  WorldCanvasProps,
  'label' | 'scopeKey'
> {
  /** Authoritative pose from the room for the local user (#37). */
  selfPose?: Pose | undefined;
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
  petReactionNonce?: number | undefined;
  interactionLocked?: boolean | undefined;
  onHoverInteractable?: ((id: string | undefined) => void) | undefined;
  onSelectInteractable?:
    ((interactable: ClassroomInteractable) => void) | undefined;
  /**
   * Fills the positioned parent instead of using the fixed card height, for
   * a full-screen world (#128). The parent must have a definite size.
   */
  fill?: boolean;
  /** Extra in-canvas nodes, such as the performance probe (#56). */
  children?: ReactNode;
}

/**
 * The isometric classroom canvas: `WorldCanvas` framed to the room plus its
 * scene and the signed-in user's avatar. The profile is read here, outside the
 * canvas, so the scene never depends on providers crossing the R3F boundary.
 */
export function ClassroomWorld({
  label,
  scopeKey,
  selfPose,
  connectionKey,
  frozen,
  remoteParticipants,
  onIntentChange,
  highlightedInteractableId,
  ownDeskIndex,
  petReactionNonce,
  interactionLocked,
  onHoverInteractable,
  onSelectInteractable,
  fill = false,
  children,
}: ClassroomWorldProps) {
  const { query } = useOwnProfile();
  return (
    <WorldCanvas
      label={label}
      scopeKey={scopeKey}
      framing="classroom"
      description={worldMessages.classroomControls}
      {...(fill && {
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
        avatar={query.data?.avatar}
        scopeKey={scopeKey}
        selfPose={selfPose}
        connectionKey={connectionKey}
        frozen={frozen}
        remoteParticipants={remoteParticipants}
        onIntentChange={onIntentChange}
        highlightedInteractableId={highlightedInteractableId}
        ownDeskIndex={ownDeskIndex}
        petReactionNonce={petReactionNonce}
        interactionLocked={interactionLocked}
        onHoverInteractable={onHoverInteractable}
        onSelectInteractable={onSelectInteractable}
      />
      {children}
    </WorldCanvas>
  );
}
