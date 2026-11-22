import type { ReactNode } from 'react';
import type { AvatarInput } from '@/realtime';
import { useOwnProfile } from '@/features/profile/use-own-profile';
import { worldMessages } from '../messages';
import { WorldCanvas, type WorldCanvasProps } from '../world-canvas';
import type { ClassroomInteractable } from './classroom-interactables';
import { ClassroomScene } from './classroom-scene';

export interface ClassroomWorldProps extends Pick<
  WorldCanvasProps,
  'label' | 'scopeKey'
> {
  /** Movement intent of the local avatar, for the realtime sender (#37). */
  onIntentChange?: (intent: AvatarInput) => void;
  highlightedInteractableId?: string | undefined;
  ownDeskIndex?: number | null | undefined;
  petReactionNonce?: number | undefined;
  interactionLocked?: boolean | undefined;
  onHoverInteractable?: ((id: string | undefined) => void) | undefined;
  onSelectInteractable?:
    ((interactable: ClassroomInteractable) => void) | undefined;
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
  onIntentChange,
  highlightedInteractableId,
  ownDeskIndex,
  petReactionNonce,
  interactionLocked,
  onHoverInteractable,
  onSelectInteractable,
  children,
}: ClassroomWorldProps) {
  const { query } = useOwnProfile();
  return (
    <WorldCanvas
      label={label}
      scopeKey={scopeKey}
      framing="classroom"
      description={worldMessages.classroomControls}
    >
      <ClassroomScene
        avatar={query.data?.avatar}
        scopeKey={scopeKey}
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
