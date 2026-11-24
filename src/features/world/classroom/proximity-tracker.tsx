import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Pose } from '../movement';
import type { ClassroomInteractable } from './classroom-interactables';
import { selectProximityTarget } from './proximity';

export interface ProximityAnchor {
  /** 0..1 across the canvas, left to right. */
  readonly x: number;
  /** 0..1 down the canvas, top to bottom. */
  readonly y: number;
}

export interface ProximityTrackerProps {
  /** Live pose of the local avatar; read in the frame loop, never copied to state. */
  poseRef: { readonly current: Pose } | undefined;
  /** Interactables the user could act on; the caller filters out unavailable ones. */
  interactables: readonly ClassroomInteractable[];
  /** Fires only when the nearby target id changes. */
  onChange: ((id: string | undefined) => void) | undefined;
  /** Fires while a target exists, with its projected screen point (no React state). */
  onAnchor: ((anchor: ProximityAnchor) => void) | undefined;
}

const SCRATCH = new Vector3();

/**
 * Finds the interactable the local avatar stands next to, once per frame,
 * and projects it for the DOM prompt. React is told only when the target id
 * changes; the anchor goes through a callback that writes straight to the DOM.
 * Render it after `FollowCamera` so the projection uses this frame's camera.
 */
export function ProximityTracker({
  poseRef,
  interactables,
  onChange,
  onAnchor,
}: ProximityTrackerProps) {
  const invalidate = useThree((state) => state.invalidate);
  const currentRef = useRef<string | undefined>(undefined);
  const lastAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const callbacks = useRef({ onChange, onAnchor });
  useEffect(() => {
    callbacks.current = { onChange, onAnchor };
  });
  const byId = useMemo(
    () => new Map(interactables.map((item) => [item.id, item])),
    [interactables],
  );

  useEffect(() => {
    // Availability changed (e.g. the desk assignment arrived): re-evaluate.
    invalidate();
  }, [byId, invalidate]);

  useEffect(
    () => () => {
      lastAnchorRef.current = null;
      if (currentRef.current !== undefined) {
        currentRef.current = undefined;
        callbacks.current.onChange?.(undefined);
      }
    },
    [],
  );

  useFrame(({ camera }) => {
    const next = selectProximityTarget({
      position: poseRef?.current,
      candidates: interactables,
      currentId: currentRef.current,
    });
    if (next !== currentRef.current) {
      currentRef.current = next;
      lastAnchorRef.current = null;
      callbacks.current.onChange?.(next);
    }
    const target = next === undefined ? undefined : byId.get(next);
    if (!target) return;
    const [worldX, , worldZ] = target.worldPosition;
    camera.updateMatrixWorld();
    SCRATCH.set(worldX, target.beaconHeight, worldZ).project(camera);
    if (!Number.isFinite(SCRATCH.x) || !Number.isFinite(SCRATCH.y)) return;
    const x = SCRATCH.x / 2 + 0.5;
    const y = 0.5 - SCRATCH.y / 2;
    const last = lastAnchorRef.current;
    if (last && Math.abs(x - last.x) < 1e-4 && Math.abs(y - last.y) < 1e-4) {
      return;
    }
    lastAnchorRef.current = { x, y };
    callbacks.current.onAnchor?.({ x, y });
  });

  return null;
}
