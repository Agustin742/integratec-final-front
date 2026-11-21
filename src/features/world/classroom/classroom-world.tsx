import type { AvatarInput } from '@/realtime';
import { useOwnProfile } from '@/features/profile/use-own-profile';
import { worldMessages } from '../messages';
import type { Pose } from '../movement';
import { WorldCanvas, type WorldCanvasProps } from '../world-canvas';
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
        selfPose={selfPose}
        connectionKey={connectionKey}
        frozen={frozen}
        remoteParticipants={remoteParticipants}
        onIntentChange={onIntentChange}
      />
    </WorldCanvas>
  );
}
