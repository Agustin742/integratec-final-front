import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AvatarInput } from '@/realtime';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { useEscapeKey } from '../input/use-escape-key';
import { useLocalAvatarController, type Pose } from '../movement';
import { createDestinationMarker } from './destination-marker';
import { destinationFromFloorClick, type FloorClickEvent } from './floor-click';
import { shortestAngleDelta } from './remote-avatar-frame';

/**
 * Fallback local spawn: the first layout spawn point, facing the board (-z),
 * used until the room assigns an authoritative server pose.
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
const SERVER_IDLE_ANGLE_EPSILON = 0.02;

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
  const frameloop = useThree((state) => state.frameloop);
  const enabled = frameloop !== 'never' && !frozen && !interactionLocked;
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
  const serverX = serverPose?.x;
  const serverZ = serverPose?.z;
  const serverRotation = serverPose?.rotation;
  const validServerPose = useMemo<Pose | undefined>(() => {
    if (
      typeof serverX === 'number' &&
      typeof serverZ === 'number' &&
      typeof serverRotation === 'number' &&
      Number.isFinite(serverX) &&
      Number.isFinite(serverZ) &&
      Number.isFinite(serverRotation)
    ) {
      return { x: serverX, z: serverZ, rotation: serverRotation };
    }
    return undefined;
  }, [serverX, serverZ, serverRotation]);

  const controller = useLocalAvatarController({
    layout: CLASSROOM_LAYOUT,
    spawn: validServerPose ?? LOCAL_SPAWN,
    enabled,
    resetKey: scopeKey ?? '',
    onIntentChange: wakeAndForward,
  });
  const marker = useMemo(() => createDestinationMarker(), []);
  useEffect(() => () => marker.dispose(), [marker]);

  const appliedConnectionRef = useRef<string | null>(null);
  const spawnedForConnectionRef = useRef(false);
  const prevFrozenRef = useRef(false);
  const frameloopRef = useRef(frameloop);
  const pendingRenderRef = useRef(false);

  const scheduleRender = useCallback(() => {
    if (frameloopRef.current === 'never') {
      pendingRenderRef.current = true;
      return;
    }
    pendingRenderRef.current = false;
    invalidate();
  }, [invalidate]);

  useEffect(() => {
    frameloopRef.current = frameloop;
    if (frameloop !== 'never' && pendingRenderRef.current) {
      pendingRenderRef.current = false;
      invalidate();
    }
  }, [frameloop, invalidate]);

  const {
    poseRef,
    getIntent,
    hasDestination,
    reset: resetController,
    snapPose: snapControllerPose,
    clearDestination: clearControllerDestination,
    setDestination,
  } = controller;

  const clearDestination = useCallback(() => {
    clearControllerDestination();
    marker.hide();
    scheduleRender();
  }, [clearControllerDestination, marker, scheduleRender]);

  // Declared after the controller so it runs after the respawn it triggers.
  useEffect(() => {
    marker.hide();
    scheduleRender();
  }, [marker, scheduleRender, scopeKey]);

  useEffect(() => {
    const resolvedPose = validServerPose;
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
      scheduleRender();
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
      scheduleRender();
      prevFrozenRef.current = frozen;
      return;
    }

    if (frozen && !prevFrozenRef.current) {
      clearControllerDestination();
      marker.hide();
      scheduleRender();
    }
    prevFrozenRef.current = frozen;

    if (resolvedPose === undefined) {
      return;
    }

    const current = poseRef.current;
    const dist = Math.hypot(
      current.x - resolvedPose.x,
      current.z - resolvedPose.z,
    );
    const angleDelta = Math.abs(
      shortestAngleDelta(current.rotation, resolvedPose.rotation),
    );
    const intent = getIntent();
    const isIdle = intent.x === 0 && intent.z === 0;
    const idleOrFrozenMismatch =
      dist > SERVER_IDLE_SETTLE_EPSILON ||
      angleDelta > SERVER_IDLE_ANGLE_EPSILON;

    if (dist > SERVER_SNAP_DISTANCE) {
      if (frozen) {
        resetController(resolvedPose);
      } else {
        snapControllerPose(resolvedPose);
      }
      marker.hide();
      scheduleRender();
    } else if (frozen && idleOrFrozenMismatch) {
      resetController(resolvedPose);
      marker.hide();
      scheduleRender();
    } else if (!hasDestination() && isIdle && idleOrFrozenMismatch) {
      snapControllerPose(resolvedPose);
      marker.hide();
      scheduleRender();
    }
  }, [
    clearControllerDestination,
    connectionKey,
    frozen,
    getIntent,
    hasDestination,
    marker,
    poseRef,
    resetController,
    scheduleRender,
    scopeKey,
    snapControllerPose,
    validServerPose,
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
