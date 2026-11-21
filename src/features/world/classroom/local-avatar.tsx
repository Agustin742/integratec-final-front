import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, type Object3D } from 'three';
import type { Avatar } from '@/features/profile/avatar-options';
import { AvatarModel } from '../avatar/avatar-model';
import type { Pose } from '../movement';
import {
  advanceLocalAvatar,
  animationFor,
  placeAvatar,
  type FrameController,
} from './local-avatar-frame';

const SHADOW_COLOR = '#6E5F94';
const SHADOW_RADIUS = 0.42;
const SHADOW_HEIGHT = 0.014;

export interface LocalAvatarProps {
  /** Frame-level controller surface; the pose is read, never copied to state. */
  controller: FrameController & {
    readonly poseRef: { readonly current: Pose };
  };
  /** Destination ring, driven imperatively by the frame loop. */
  marker: Object3D;
  /** Confirmed profile avatar; a capsule stands in while it is unknown. */
  avatar?: Avatar | undefined;
  scopeKey?: string | undefined;
}

/** Stand-in body used while the profile or the GLBs are not available. */
function PlaceholderBody() {
  return (
    <mesh position={[0, 0.75, 0]}>
      <capsuleGeometry args={[0.25, 1, 4, 12]} />
      <meshStandardMaterial color="#B5A7D6" />
    </mesh>
  );
}

/**
 * The user's own avatar. Position and heading are written to a three group in
 * `useFrame`; React re-renders only when the Idle/Walk clip flips.
 */
export function LocalAvatar({
  controller,
  marker,
  avatar,
  scopeKey,
}: LocalAvatarProps) {
  const root = useMemo(() => {
    const group = new Group();
    group.name = 'local-avatar';
    placeAvatar(group, controller.poseRef.current);
    return group;
    // The group is created once; the frame loop owns its transform afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const invalidate = useThree((state) => state.invalidate);
  const [moving, setMoving] = useState(false);
  const movingRef = useRef(false);

  useFrame((_state, dt) => {
    const nowMoving = advanceLocalAvatar({
      controller,
      avatar: root,
      marker,
      dt,
      invalidate,
    });
    if (nowMoving !== movingRef.current) {
      movingRef.current = nowMoving;
      setMoving(nowMoving);
    }
  });

  useEffect(() => {
    // Draw the first (and any post-reset) frame under the demand loop.
    invalidate();
  }, [invalidate, scopeKey]);

  return (
    <>
      <primitive object={marker} />
      <primitive object={root}>
        {/* Soft contact shadow: a translucent lavender disc, no real shadows.
            Only the scene root takes pointer events, so it never blocks a click. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SHADOW_HEIGHT, 0]}>
          <circleGeometry args={[SHADOW_RADIUS, 24]} />
          <meshBasicMaterial
            color={SHADOW_COLOR}
            transparent
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
        {avatar ? (
          <AvatarModel
            avatar={avatar}
            scopeKey={scopeKey}
            animation={animationFor(moving)}
            fallback={<PlaceholderBody />}
            errorFallback={<PlaceholderBody />}
          />
        ) : (
          <PlaceholderBody />
        )}
      </primitive>
    </>
  );
}
