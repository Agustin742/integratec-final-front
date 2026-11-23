import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AvatarInput } from '@/realtime';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { useEscapeKey } from '../input/use-escape-key';
import { useLocalAvatarController, type Pose } from '../movement';
import { createDestinationMarker } from './destination-marker';
import { destinationFromFloorClick, type FloorClickEvent } from './floor-click';

/**
 * Local spawn: the first layout spawn point, facing the board (-z). #37 will
 * replace it with the position the server assigns when joining the room.
 */
const FIRST_SPAWN = CLASSROOM_LAYOUT.spawnPoints[0] ?? { x: 0, z: 0 };
export const LOCAL_SPAWN: Pose = {
  x: FIRST_SPAWN.x,
  z: FIRST_SPAWN.z,
  rotation: Math.PI,
};

export interface UseClassroomNavigationOptions {
  /** Classroom id: changing it respawns the avatar and drops all input. */
  scopeKey?: string | undefined;
  /** Authoritative pose from the room for the local user (#37). */
  serverPose?: Pose | undefined;
  /** Connection epoch key that changes on join, reconnect, or drop (#37). */
  connectionKey?: string | undefined;
  /** True while the classroom is frozen or movement is locked (#37). */
  frozen?: boolean | undefined;
  /** Movement intent for the realtime sender (#37); fired on change only. */
  onIntentChange?: ((intent: AvatarInput) => void) | undefined;
  /** True while a modal panel blocks world movement and pointer picking. */
  interactionLocked?: boolean | undefined;
}

const SERVER_SNAP_DISTANCE = 1.5;
const SERVER_IDLE_SETTLE_EPSILON = 0.05;

/**
 * Everything the classroom needs to walk the local avatar: the controller
 * (keyboard + destination), the click handler for the floor, the destination
 * marker and Escape to stop. Input is ignored while the canvas is not
 * rendering (hidden tab, offscreen), while frozen, or while
 * `interactionLocked` is true.
 */
export function useClassroomNavigation({
  scopeKey,
  serverPose,
  connectionKey,
  frozen = false,
  onIntentChange,
  interactionLocked = false,
}: UseClassroomNavigationOptions) {
  const invalidate = useThree((state) => state.invalidate);
  const enabled =
    useThree((state) => state.frameloop) !== 'never' &&
    !frozen &&
    !interactionLocked;
  // A key press from rest must wake the demand loop itself; nothing else
  // (placeholder body, reduced motion) is guaranteed to be requesting frames.
  const listener = useRef(onIntentChange);
  useEffect(() => {
    listener.current = onIntentChange;
  });
  const wakeAndForward = useCallback(
    (intent: AvatarInput) => {
      invalidate();
      listener.current?.(intent);
    },
    [invalidate],
  );
  const controller = useLocalAvatarController({
    layout: CLASSROOM_LAYOUT,
    spawn: serverPose ?? LOCAL_SPAWN,
    enabled,
    resetKey: scopeKey ?? '',
    onIntentChange: wakeAndForward,
  });
  const marker = useMemo(() => createDestinationMarker(), []);
  useEffect(() => () => marker.dispose(), [marker]);

  const appliedConnectionRef = useRef<string | null>(null);
  const spawnedForConnectionRef = useRef(false);
  const prevFrozenRef = useRef(false);
  const {
    reset: resetController,
    clearDestination: clearControllerDestination,
  } = controller;
  const serverX = serverPose?.x;
  const serverZ = serverPose?.z;
  const serverRotation = serverPose?.rotation;

  const clearDestination = useCallback(() => {
    clearControllerDestination();
    marker.hide();
    invalidate();
  }, [clearControllerDestination, marker, invalidate]);

  // Declared after the controller so it runs after the respawn it triggers.
  useEffect(() => {
    marker.hide();
    invalidate();
  }, [marker, invalidate, scopeKey]);

  useEffect(() => {
    const resolvedPose: Pose | undefined =
      serverX !== undefined &&
      serverZ !== undefined &&
      serverRotation !== undefined
        ? { x: serverX, z: serverZ, rotation: serverRotation }
        : undefined;
    const effectiveKey =
      connectionKey !== undefined ? `${scopeKey ?? ''}:${connectionKey}` : null;

    if (
      effectiveKey !== null &&
      appliedConnectionRef.current !== effectiveKey
    ) {
      appliedConnectionRef.current = effectiveKey;
      spawnedForConnectionRef.current = resolvedPose !== undefined;
      resetController(resolvedPose ?? LOCAL_SPAWN);
      marker.hide();
      invalidate();
      prevFrozenRef.current = frozen;
      return;
    }

    if (
      effectiveKey !== null &&
      !spawnedForConnectionRef.current &&
      resolvedPose !== undefined
    ) {
      spawnedForConnectionRef.current = true;
      resetController(resolvedPose);
      marker.hide();
      invalidate();
      prevFrozenRef.current = frozen;
      return;
    }

    if (frozen && !prevFrozenRef.current) {
      clearControllerDestination();
      marker.hide();
      invalidate();
    }
    prevFrozenRef.current = frozen;

    if (resolvedPose === undefined) {
      return;
    }

    const current = controller.poseRef.current;
    const dist = Math.hypot(
      current.x - resolvedPose.x,
      current.z - resolvedPose.z,
    );
    const intent = controller.getIntent();
    const isIdle = intent.x === 0 && intent.z === 0;
    if (
      dist > SERVER_SNAP_DISTANCE ||
      (frozen && dist > SERVER_IDLE_SETTLE_EPSILON) ||
      (!controller.hasDestination() &&
        isIdle &&
        dist > SERVER_IDLE_SETTLE_EPSILON)
    ) {
      resetController(resolvedPose);
      marker.hide();
      invalidate();
    }
  }, [
    clearControllerDestination,
    connectionKey,
    controller,
    frozen,
    invalidate,
    marker,
    resetController,
    scopeKey,
    serverRotation,
    serverX,
    serverZ,
  ]);

  useEffect(() => {
    if (interactionLocked) {
      clearDestination();
    }
  }, [interactionLocked, clearDestination]);

  useEscapeKey({
    enabled,
    onEscape: clearDestination,
  });

  const { setDestination } = controller;
  const onFloorClick = useCallback(
    (event: FloorClickEvent) => {
      if (!enabled) return;
      const point = destinationFromFloorClick(event, setDestination);
      if (!point) return;
      marker.show(point);
      invalidate();
    },
    [enabled, setDestination, marker, invalidate],
  );

  return { controller, marker, onFloorClick, clearDestination };
}
