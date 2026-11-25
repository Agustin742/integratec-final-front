import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CapsuleGeometry,
  CircleGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three';
import type { Avatar } from '@/features/profile/avatar-options';
import { AvatarModel } from '../avatar/avatar-model';
import type { AvatarEquipped } from '../avatar/avatar-part-plan';
import type { Pose } from '../movement';
import { animationFor, placeAvatar } from './local-avatar-frame';
import { advanceRemoteAvatar } from './remote-avatar-frame';

const SHADOW_COLOR = '#6E5F94';
const SHADOW_RADIUS = 0.42;
const SHADOW_HEIGHT = 0.014;
const PLACEHOLDER_COLOR = '#B5A7D6';

/**
 * Module-level shared geometries and materials for remote avatars
 * (`rules/3d-world-and-camera.md`). Separate online and reconnecting materials
 * avoid mutating `material.transparent` at runtime without `needsUpdate`, and
 * `dispose={null}` on consuming meshes prevents R3F unmount cleanup from
 * disposing shared GPU resources.
 */
const SHARED_SHADOW_GEOMETRY = new CircleGeometry(SHADOW_RADIUS, 24);
const SHARED_SHADOW_ONLINE_MATERIAL = new MeshBasicMaterial({
  color: SHADOW_COLOR,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});
const SHARED_SHADOW_RECONNECTING_MATERIAL = new MeshBasicMaterial({
  color: SHADOW_COLOR,
  transparent: true,
  opacity: 0.16,
  depthWrite: false,
});
const SHARED_PLACEHOLDER_GEOMETRY = new CapsuleGeometry(0.25, 1, 4, 12);
const SHARED_PLACEHOLDER_ONLINE_MATERIAL = new MeshStandardMaterial({
  color: PLACEHOLDER_COLOR,
  transparent: false,
  opacity: 1,
});
const SHARED_PLACEHOLDER_RECONNECTING_MATERIAL = new MeshStandardMaterial({
  color: PLACEHOLDER_COLOR,
  transparent: true,
  opacity: 0.55,
});

export const REMOTE_AVATAR_SHARED_ASSETS = Object.freeze({
  shadowGeometry: SHARED_SHADOW_GEOMETRY,
  shadowOnlineMaterial: SHARED_SHADOW_ONLINE_MATERIAL,
  shadowReconnectingMaterial: SHARED_SHADOW_RECONNECTING_MATERIAL,
  placeholderGeometry: SHARED_PLACEHOLDER_GEOMETRY,
  placeholderOnlineMaterial: SHARED_PLACEHOLDER_ONLINE_MATERIAL,
  placeholderReconnectingMaterial: SHARED_PLACEHOLDER_RECONNECTING_MATERIAL,
});

function sanitizeInitialPose(pose: Pose): Pose {
  return {
    x: Number.isFinite(pose.x) ? pose.x : 0,
    z: Number.isFinite(pose.z) ? pose.z : 0,
    rotation: Number.isFinite(pose.rotation) ? pose.rotation : 0,
  };
}

function isFinitePose(x: number, z: number, rotation: number): boolean {
  return Number.isFinite(x) && Number.isFinite(z) && Number.isFinite(rotation);
}

export interface RemoteClassroomParticipant {
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly status: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly avatar?: Avatar | undefined;
  /** Accessory shop codes worn in this classroom. */
  readonly equipped?: AvatarEquipped | undefined;
}

export interface RemoteAvatarProps {
  readonly userId: string;
  readonly status?: string | undefined;
  readonly targetPose: Pose;
  readonly avatar?: Avatar | undefined;
  readonly equipped?: AvatarEquipped | undefined;
  readonly scopeKey?: string | undefined;
}

function PlaceholderBody({ reconnecting }: { readonly reconnecting: boolean }) {
  return (
    <mesh
      name="remote-avatar-placeholder"
      position={[0, 0.75, 0]}
      geometry={SHARED_PLACEHOLDER_GEOMETRY}
      material={
        reconnecting
          ? SHARED_PLACEHOLDER_RECONNECTING_MATERIAL
          : SHARED_PLACEHOLDER_ONLINE_MATERIAL
      }
      dispose={null}
    />
  );
}

/**
 * Renders one remote classroom participant driven strictly by authoritative
 * room state (`rules/realtime-and-presence.md`, `#37`). Interpolation runs in
 * `useFrame` on refs; React re-renders only on `Idle`/`Run` clip flips or
 * server appearance/status changes.
 */
export function RemoteAvatar({
  userId,
  status = 'online',
  targetPose,
  avatar,
  equipped,
  scopeKey,
}: RemoteAvatarProps) {
  const root = useMemo(() => {
    const group = new Group();
    group.name = `remote-avatar-${userId}`;
    placeAvatar(group, sanitizeInitialPose(targetPose));
    return group;
    // The group is created once per user; the frame loop owns its transform afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const invalidate = useThree((state) => state.invalidate);
  const frameloop = useThree((state) => state.frameloop);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);
  const activeUserRef = useRef(userId);
  const prevFrameloopRef = useRef(frameloop);
  const prevStatusRef = useRef(status);
  const currentPoseRef = useRef<Pose>(sanitizeInitialPose(targetPose));
  const targetPoseRef = useRef<Pose>(sanitizeInitialPose(targetPose));

  const { x, z, rotation } = targetPose;
  useEffect(() => {
    const frameloopWoke =
      frameloop === 'demand' && prevFrameloopRef.current !== 'demand';
    const statusChanged = prevStatusRef.current !== status;
    prevFrameloopRef.current = frameloop;
    prevStatusRef.current = status;

    if (activeUserRef.current !== userId) {
      activeUserRef.current = userId;
      const initialPose = sanitizeInitialPose({ x, z, rotation });
      currentPoseRef.current = { ...initialPose };
      targetPoseRef.current = { ...initialPose };
      placeAvatar(root, initialPose);
      if (movingRef.current) {
        movingRef.current = false;
        queueMicrotask(() => {
          if (!movingRef.current) {
            setMoving(false);
          }
        });
      }
      if (frameloop === 'demand') {
        invalidate();
      }
      return;
    }

    if (!isFinitePose(x, z, rotation)) {
      if (frameloop === 'demand' && (frameloopWoke || statusChanged)) {
        invalidate();
      }
      return;
    }

    targetPoseRef.current = { x, z, rotation };
    if (frameloop === 'demand') {
      invalidate();
    }
  }, [frameloop, invalidate, root, rotation, status, userId, x, z]);

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
      <mesh
        name="remote-avatar-shadow"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, SHADOW_HEIGHT, 0]}
        geometry={SHARED_SHADOW_GEOMETRY}
        material={
          reconnecting
            ? SHARED_SHADOW_RECONNECTING_MATERIAL
            : SHARED_SHADOW_ONLINE_MATERIAL
        }
        dispose={null}
      />
      {avatar ? (
        <AvatarModel
          avatar={avatar}
          equipped={equipped}
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
