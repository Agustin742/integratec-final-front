import { useEffect, useMemo } from 'react';
import type { Avatar } from '@/features/profile/avatar-options';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import { WarmLighting } from '../world-lighting';
import { buildClassroomScene } from './build-classroom-scene';
import { LocalAvatar } from './local-avatar';
import { useClassroomNavigation } from './use-classroom-navigation';

export interface ClassroomSceneProps {
  /** Confirmed profile avatar; the scene works without it. */
  avatar?: Avatar | undefined;
  /** Classroom id: scopes avatar assets and resets the local avatar. */
  scopeKey?: string | undefined;
  onIntentChange?: ((intent: AvatarInput) => void) | undefined;
}

/**
 * Placeholder classroom (floor, cutaway walls, desks from the layout and the
 * named prop placeholders) with the shared warm lighting and cream backdrop,
 * plus the user's own avatar. Shadowless; the object graph is built once per
 * layout and disposed on unmount because `<primitive>` objects are not owned
 * by R3F. Only the scene root takes pointer events; the walkable floor turns a
 * click or tap into a destination.
 */
export function ClassroomScene({
  avatar,
  scopeKey,
  onIntentChange,
}: ClassroomSceneProps) {
  const scene = useMemo(() => buildClassroomScene(CLASSROOM_LAYOUT), []);
  useEffect(() => () => scene.dispose(), [scene]);
  const { controller, marker, onFloorClick } = useClassroomNavigation({
    scopeKey,
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
    </>
  );
}
