import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { MathUtils, OrthographicCamera } from 'three';
import { MAX_FOLLOW_DT } from '../world/camera';

export interface PitchCameraRigProps {
  readonly target: readonly [number, number, number];
  readonly visibleHeight: number;
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
}

const CAMERA_DISTANCE = 16;
const PITCH_CAMERA_POS_DAMPING = 2.35;
const PITCH_CAMERA_ANGLE_DAMPING = 2.15;

interface RigState {
  x: number;
  y: number;
  z: number;
  visibleHeight: number;
  elevationDeg: number;
  azimuthDeg: number;
}

function applySphericalRigCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
  state: RigState,
  swayX: number,
  swayZ: number,
): void {
  if (!(width > 0 && height > 0)) return;
  const elevRad = MathUtils.degToRad(state.elevationDeg);
  const azimRad = MathUtils.degToRad(state.azimuthDeg);
  const horiz = CAMERA_DISTANCE * Math.cos(elevRad);

  const lookX = state.x + swayX;
  const lookY = state.y;
  const lookZ = state.z + swayZ;

  camera.position.set(
    lookX + horiz * Math.sin(azimRad),
    lookY + CAMERA_DISTANCE * Math.sin(elevRad),
    lookZ + horiz * Math.cos(azimRad),
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(lookX, lookY, lookZ);
  camera.updateMatrixWorld(true);

  const aspect = width / height;
  const minVisibleWidth = state.visibleHeight * 1.4;
  const halfHeight =
    Math.max(state.visibleHeight, minVisibleWidth / aspect) / 2;
  const halfWidth = halfHeight * aspect;

  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.right = halfWidth;
  camera.left = -halfWidth;
  camera.near = 0.1;
  camera.far = 60;
  camera.zoom = 1;
  camera.updateProjectionMatrix();
}

/**
 * 3-Plane camera rig for `/pitch` smoothly transitioning across wide classroom
 * views, 2nd-person station focus, and eye-level 3-character showcase turntables.
 */
export function PitchCameraRig({
  target,
  visibleHeight,
  elevationDeg,
  azimuthDeg,
}: PitchCameraRigProps) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);

  const currentRef = useRef<RigState | null>(null);

  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    currentRef.current ??= {
      x: target[0],
      y: target[1],
      z: target[2],
      visibleHeight,
      elevationDeg,
      azimuthDeg,
    };
    applySphericalRigCamera(camera, width, height, currentRef.current, 0, 0);
    invalidate();
  }, [
    camera,
    width,
    height,
    target,
    visibleHeight,
    elevationDeg,
    azimuthDeg,
    invalidate,
  ]);

  useFrame((state, dt) => {
    if (!(camera instanceof OrthographicCamera)) return;
    const current = currentRef.current;
    if (!current) return;

    const clampedDt = Math.min(
      Number.isFinite(dt) && dt > 0 ? dt : 0,
      MAX_FOLLOW_DT,
    );
    current.x = MathUtils.damp(
      current.x,
      target[0],
      PITCH_CAMERA_POS_DAMPING,
      clampedDt,
    );
    current.y = MathUtils.damp(
      current.y,
      target[1],
      PITCH_CAMERA_POS_DAMPING,
      clampedDt,
    );
    current.z = MathUtils.damp(
      current.z,
      target[2],
      PITCH_CAMERA_POS_DAMPING,
      clampedDt,
    );
    current.visibleHeight = MathUtils.damp(
      current.visibleHeight,
      visibleHeight,
      PITCH_CAMERA_POS_DAMPING,
      clampedDt,
    );
    current.elevationDeg = MathUtils.damp(
      current.elevationDeg,
      elevationDeg,
      PITCH_CAMERA_ANGLE_DAMPING,
      clampedDt,
    );
    current.azimuthDeg = MathUtils.damp(
      current.azimuthDeg,
      azimuthDeg,
      PITCH_CAMERA_ANGLE_DAMPING,
      clampedDt,
    );

    applySphericalRigCamera(camera, width, height, current, 0, 0);
    state.invalidate();
  });

  return null;
}
