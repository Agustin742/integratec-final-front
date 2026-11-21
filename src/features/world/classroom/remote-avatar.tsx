import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group } from 'three';
import type { Avatar } from '@/features/profile/avatar-options';
import { AvatarModel } from '../avatar/avatar-model';
import type { Pose } from '../movement';
import { animationFor, placeAvatar } from './local-avatar-frame';
import { advanceRemoteAvatar } from './remote-avatar-frame';

const SHADOW_COLOR = '#6E5F94';
const SHADOW_RADIUS = 0.42;
const SHADOW_HEIGHT = 0.014;

export interface RemoteClassroomParticipant {
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly status: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly avatar?: Avatar | undefined;
}

export interface RemoteAvatarProps {
  readonly userId: string;
  readonly status?: string | undefined;
  readonly targetPose: Pose;
  readonly avatar?: Avatar | undefined;
  readonly scopeKey?: string | undefined;
}

function PlaceholderBody({ reconnecting }: { readonly reconnecting: boolean }) {
  return (
    <mesh position={[0, 0.75, 0]}>
      <capsuleGeometry args={[0.25, 1, 4, 12]} />
      <meshStandardMaterial
        color="#B5A7D6"
        transparent={reconnecting}
        opacity={reconnecting ? 0.55 : 1}
      />
    </mesh>
  );
}

/**
 * Renders one remote classroom participant driven strictly by authoritative
 * room state (`rules/realtime-and-presence.md`, `#37`). Interpolation runs in
 * `useFrame` on refs; React re-renders only on `Idle`/`Walk` clip flips or
 * server appearance/status changes.
 */
export function RemoteAvatar({
  userId,
  status = 'online',
  targetPose,
  avatar,
  scopeKey,
}: RemoteAvatarProps) {
  const root = useMemo(() => {
    const group = new Group();
    group.name = `remote-avatar-${userId}`;
    placeAvatar(group, targetPose);
    return group;
    // The group is created once per user; the frame loop owns its transform afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const invalidate = useThree((state) => state.invalidate);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const activeUserRef = useRef(userId);
  const currentPoseRef = useRef<Pose>({ ...targetPose });
  const targetPoseRef = useRef<Pose>(targetPose);

  const { x, z, rotation } = targetPose;
  useEffect(() => {
    if (activeUserRef.current !== userId) {
      activeUserRef.current = userId;
      currentPoseRef.current = { x, z, rotation };
    }
    targetPoseRef.current = { x, z, rotation };
    invalidate();
  }, [invalidate, rotation, status, userId, x, z]);

  useFrame((_state, dt) => {
    const nowMoving = advanceRemoteAvatar({
      current: currentPoseRef.current,
      target: targetPoseRef.current,
      avatar: root,
      dt,
      invalidate,
    });
    if (nowMoving !== movingRef.current) {
      movingRef.current = nowMoving;
      setMoving(nowMoving);
    }
  });

  const reconnecting = status === 'reconnecting';
  return (
    <primitive object={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SHADOW_HEIGHT, 0]}>
        <circleGeometry args={[SHADOW_RADIUS, 24]} />
        <meshBasicMaterial
          color={SHADOW_COLOR}
          transparent
          opacity={reconnecting ? 0.16 : 0.28}
          depthWrite={false}
        />
      </mesh>
      {avatar ? (
        <AvatarModel
          avatar={avatar}
          scopeKey={scopeKey}
          animation={animationFor(moving)}
          fallback={<PlaceholderBody reconnecting={reconnecting} />}
          errorFallback={<PlaceholderBody reconnecting={reconnecting} />}
        />
      ) : (
        <PlaceholderBody reconnecting={reconnecting} />
      )}
    </primitive>
  );
}
