import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarInput, ClassroomLayout } from '@/realtime';
import { useKeyboardDirection } from '../input/use-keyboard-direction';
import {
  LocalAvatarController,
  type StepResult,
} from './local-avatar-controller';
import type { Waypoint } from './pathfinding';
import type { Pose } from './step-avatar';

export interface UseLocalAvatarControllerOptions {
  layout: ClassroomLayout;
  spawn: Pose;
  /** False while the scene cannot take input (no access, loading); drops keys and destination. */
  enabled: boolean;
  /** Changing it (e.g. the classroom id) respawns the avatar and drops all input. */
  resetKey: string;
  /** Fired only when the movement intent changes; for the realtime sender (#37). */
  onIntentChange?: (intent: AvatarInput) => void;
}

export interface LocalAvatarApi {
  /** Live pose; read it inside `useFrame`, never copy it into React state. */
  readonly poseRef: { readonly current: Pose };
  /** Live movement intent in the `AvatarInput` shape. */
  readonly intentRef: { readonly current: AvatarInput };
  getIntent: () => AvatarInput;
  /** Returns false, changing nothing, when the point is unwalkable, unreachable or input is disabled. */
  setDestination: (point: Waypoint) => boolean;
  clearDestination: () => void;
  /** Advances one frame from `useFrame`; mutates refs only, never React state. */
  step: (dtSeconds: number) => StepResult;
}

/** Local avatar movement driven by WASD/arrows and click destinations. No network, no persistence. */
export function useLocalAvatarController({
  layout,
  spawn,
  enabled,
  resetKey,
  onIntentChange,
}: UseLocalAvatarControllerOptions): LocalAvatarApi {
  const [controller] = useState(
    () => new LocalAvatarController({ layout, spawn }),
  );
  const [api] = useState(() => ({
    poseRef: {
      get current() {
        return controller.pose;
      },
    },
    intentRef: {
      get current() {
        return controller.intent;
      },
    },
  }));
  const latest = useRef({ spawn, enabled });

  useEffect(() => {
    latest.current = { spawn, enabled };
    controller.configure(layout, onIntentChange);
  });

  useEffect(() => {
    controller.reset(latest.current.spawn);
  }, [controller, resetKey]);

  useEffect(() => {
    if (!enabled) controller.clearDestination();
  }, [controller, enabled]);

  useKeyboardDirection({
    enabled,
    resetKey,
    onChange: (direction) => controller.setKeyboardDirection(direction),
    onPress: () => controller.clearDestination(),
  });

  const getIntent = useCallback(() => controller.intent, [controller]);
  const setDestination = useCallback(
    (point: Waypoint) =>
      latest.current.enabled && controller.setDestination(point),
    [controller],
  );
  const clearDestination = useCallback(
    () => controller.clearDestination(),
    [controller],
  );
  const step = useCallback((dt: number) => controller.step(dt), [controller]);

  return {
    poseRef: api.poseRef,
    intentRef: api.intentRef,
    getIntent,
    setDestination,
    clearDestination,
    step,
  };
}
