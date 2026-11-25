import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { Group, Mesh, type Material, type Object3D } from 'three';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { loadGlbAsset } from '../asset-cache';
import type { Pose } from '../movement';
import { usePrefersReducedMotion } from '../use-prefers-reduced-motion';
import {
  DOOR_FADE_OPACITY,
  DOOR_OCCLUDER_BOX,
  nextFadeOpacity,
  shouldFadeOccluder,
} from './classroom-door-fade';
import { deriveDoorPlacement } from './classroom-interactive-placements';
import { getKitModuleUrl } from './kit/classroom-kit-manifest';

export interface ClassroomDoorProps {
  /** Live pose of the local avatar; read in the frame loop, never copied to state. */
  poseRef: { readonly current: Pose } | undefined;
  scopeKey?: string | undefined;
  /** Receives the built group once the model is ready (tests, debugging). */
  onReady?: ((group: Group) => void) | undefined;
}

interface FadeableMaterial extends Material {
  opacity: number;
  transparent: boolean;
}
interface DoorVisual {
  readonly group: Group;
  setOpacity(factor: number): void;
  dispose(): void;
}

/**
 * Clones the cached door scene with its own materials, so fading never touches
 * the shared asset, and removes it from picking: the invisible `classroom-door`
 * proxy owns the entrance hit box.
 */
function buildDoorVisual(source: Object3D): DoorVisual {
  const group = new Group();
  group.name = 'classroom-door-visual';
  const [x, y, z] = deriveDoorPlacement(CLASSROOM_LAYOUT).position;
  group.position.set(x, y, z);
  const model = source.clone(true);
  group.add(model);
  const materials: {
    material: FadeableMaterial;
    baseOpacity: number;
    baseTransparent: boolean;
  }[] = [];
  model.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    node.raycast = () => undefined;
    const cloned = (node.material as FadeableMaterial).clone();
    node.material = cloned;
    materials.push({
      material: cloned,
      baseOpacity: cloned.opacity,
      baseTransparent: cloned.transparent,
    });
  });
  return {
    group,
    setOpacity(factor) {
      for (const entry of materials) {
        entry.material.opacity = entry.baseOpacity * factor;
        const transparent = entry.baseTransparent || factor < 1;
        if (entry.material.transparent !== transparent) {
          entry.material.transparent = transparent;
          entry.material.needsUpdate = true;
        }
      }
    },
    dispose() {
      for (const entry of materials) entry.material.dispose();
    },
  };
}

/**
 * The entrance door, drawn outside the batched kit so only it can fade. It
 * becomes see-through while it would hide the local avatar from the camera
 * (local pose only, never synced) and switches instantly with reduced motion.
 */
export function ClassroomDoor({
  poseRef,
  scopeKey,
  onReady,
}: ClassroomDoorProps) {
  const reducedMotion = usePrefersReducedMotion();
  const invalidate = useThree((state) => state.invalidate);
  const [visual, setVisual] = useState<DoorVisual | null>(null);
  const opacityRef = useRef(1);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    let cancelled = false;
    let built: DoorVisual | null = null;
    loadGlbAsset(getKitModuleUrl('door'), { scopeKey }).then(
      (gltf) => {
        if (cancelled) return;
        built = buildDoorVisual(gltf.scene);
        opacityRef.current = 1;
        setVisual(built);
        onReadyRef.current?.(built.group);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      built?.dispose();
      setVisual(null);
    };
  }, [scopeKey]);

  useFrame((_, delta) => {
    if (!visual || !poseRef) return;
    const target = shouldFadeOccluder(poseRef.current, DOOR_OCCLUDER_BOX)
      ? DOOR_FADE_OPACITY
      : 1;
    const next = nextFadeOpacity(
      opacityRef.current,
      target,
      delta,
      reducedMotion,
    );
    if (next !== opacityRef.current) {
      opacityRef.current = next;
      visual.setOpacity(next);
    }
    if (next !== target) invalidate();
  });

  return visual ? <primitive object={visual.group} /> : null;
}
