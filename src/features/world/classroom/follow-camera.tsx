import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { OrthographicCamera } from 'three';
import {
  advanceFollowTarget,
  applyFollowCamera,
  CLASSROOM_BOUNDS,
  FOLLOW_EPSILON,
  frameCamera,
  type FollowPoint,
} from '../camera';
import type { Pose } from '../movement';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';

export interface FollowCameraProps {
  /** Live pose of the local avatar; read in the frame loop, never copied to state. */
  poseRef: { readonly current: Pose } | undefined;
}

const isFinitePose = (pose: Pose | undefined): pose is Pose =>
  !!pose && Number.isFinite(pose.x) && Number.isFinite(pose.z);

/**
 * Keeps the fixed isometric camera centered on the local avatar at the closer
 * follow zoom, always on the avatar (the backdrop may show near the room
 * edges). The camera is mutated in the frame loop
 * (no React state) and frames are requested only until the damped target
 * settles. Without an avatar it frames the whole classroom.
 */
export function FollowCamera({ poseRef }: FollowCameraProps) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const reducedMotion = usePrefersReducedMotion();
  const target = useRef<FollowPoint | null>(null);
  const lastViewport = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    const pose = poseRef?.current;
    if (!isFinitePose(pose)) {
      target.current = null;
      lastViewport.current = null;
      frameCamera(camera, width, height, CLASSROOM_BOUNDS);
      invalidate();
      return;
    }
    // Mount snaps onto the avatar; a resize keeps the current damped target.
    target.current ??= { x: pose.x, z: pose.z };
    applyFollowCamera(camera, width, height, target.current);
    lastViewport.current = { width, height };
    invalidate();
  }, [camera, width, height, poseRef, invalidate]);

  useFrame((_state, dt) => {
    const pose = poseRef?.current;
    if (!isFinitePose(pose) || !(camera instanceof OrthographicCamera)) return;
    if (target.current === null) {
      target.current = { x: pose.x, z: pose.z };
      applyFollowCamera(camera, width, height, target.current);
      lastViewport.current = { width, height };
      invalidate();
      return;
    }
    const current = target.current;
    const settledAtPose =
      Math.abs(pose.x - current.x) <= FOLLOW_EPSILON &&
      Math.abs(pose.z - current.z) <= FOLLOW_EPSILON;
    const viewportUnchanged =
      lastViewport.current !== null &&
      lastViewport.current.width === width &&
      lastViewport.current.height === height;
    if (settledAtPose && viewportUnchanged) return;

    const next = advanceFollowTarget(
      current,
      { x: pose.x, z: pose.z },
      dt,
      reducedMotion,
    );
    target.current = { x: next.x, z: next.z };
    applyFollowCamera(camera, width, height, target.current);
    lastViewport.current = { width, height };
    if (!next.settled) invalidate();
  });

  return null;
}
