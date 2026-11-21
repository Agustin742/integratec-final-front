import { useEffect, useMemo } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import type { Pose } from '../movement';
import { WarmLighting } from '../world-lighting';
import { buildClassroomScene } from './build-classroom-scene';
import { LocalAvatar } from './local-avatar';
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
}

/**
 * Classroom (floor, cutaway walls, desks from the layout and the
 * named prop placeholders) with the shared warm lighting and cream backdrop,
 * plus the user's own avatar and live remote participants. Shadowless; the
 * object graph is built once per layout and disposed on unmount because
 * `<primitive>` objects are not owned by R3F. Only the scene root takes pointer
 * events; the walkable floor turns a click or tap into a destination.
 */
export function ClassroomScene({
  avatar,
  scopeKey,
  selfPose,
  connectionKey,
  frozen = false,
  remoteParticipants = [],
  onIntentChange,
}: ClassroomSceneProps) {
  const scene = useMemo(() => buildClassroomScene(CLASSROOM_LAYOUT), []);
  useEffect(() => () => scene.dispose(), [scene]);
  const { controller, marker, onFloorClick } = useClassroomNavigation({
    scopeKey,
    serverPose: selfPose,
    connectionKey,
    frozen,
    onIntentChange,
  });
  return (
    <>
      <color attach="background" args={['#FFF9EB']} />
      <WarmLighting />
      <primitive object={scene.root} onClick={onFloorClick} />
      <LocalAvatar
        controller={controller}
        marker={marker.object}
        avatar={avatar}
        scopeKey={scopeKey}
      />
      {remoteParticipants.map((participant) => (
        <RemoteAvatar
          key={participant.userId}
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
