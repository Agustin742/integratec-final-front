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
  /** Movement intent for the realtime sender (#37); fired on change only. */
  onIntentChange?: ((intent: AvatarInput) => void) | undefined;
}

/**
 * Everything the classroom needs to walk the local avatar: the controller
 * (keyboard + destination), the click handler for the floor, the destination
 * marker and Escape to stop. Input is ignored while the canvas is not
 * rendering (hidden tab, offscreen).
 */
export function useClassroomNavigation({
  scopeKey,
  onIntentChange,
}: UseClassroomNavigationOptions) {
  const invalidate = useThree((state) => state.invalidate);
  const enabled = useThree((state) => state.frameloop) !== 'never';
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
    spawn: LOCAL_SPAWN,
    enabled,
    resetKey: scopeKey ?? '',
    onIntentChange: wakeAndForward,
  });
  const marker = useMemo(() => createDestinationMarker(), []);
  useEffect(() => () => marker.dispose(), [marker]);

  // Declared after the controller so it runs after the respawn it triggers.
  useEffect(() => {
    marker.hide();
    invalidate();
  }, [marker, invalidate, scopeKey]);

  useEscapeKey({
    enabled,
    onEscape: () => {
      controller.clearDestination();
      marker.hide();
      invalidate();
    },
  });

  const { setDestination } = controller;
  const onFloorClick = useCallback(
    (event: FloorClickEvent) => {
      const point = destinationFromFloorClick(event, setDestination);
      if (!point) return;
      marker.show(point);
      invalidate();
    },
    [setDestination, marker, invalidate],
  );

  return { controller, marker, onFloorClick };
}
