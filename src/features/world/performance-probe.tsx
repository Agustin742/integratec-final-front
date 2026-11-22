import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Scene } from 'three';
import {
  estimateGpuMemory,
  type GpuMemoryInput,
  type PerformanceProbeRuntime,
} from './performance-monitor';

/**
 * Canvas-side performance probe (issue #56 S2/S3). Mounted as a child of
 * `WorldCanvas`, it samples the real render cadence (`useFrame` fires per
 * rendered frame, so a static demand-loop scene produces no samples) into
 * the shared `PerformanceProbeRuntime`.
 *
 * `onSustainedLowFps` fires once per sustained low-fps period; the trigger
 * re-arms only after the rate recovers, which is how "conditions change" is
 * interpreted for the 2D Classic Mode offer.
 */

/** Material slots that may hold GPU textures. */
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'displacementMap',
  'specularMap',
  'envMap',
  'lightMap',
] as const;

export interface PerformanceProbeProps {
  /** Shared runtime; also polled by the dev-only stats overlay. */
  readonly runtime: PerformanceProbeRuntime;
  /** Fired once per sustained low-fps period; re-arms after recovery. */
  readonly onSustainedLowFps?: () => void;
}

export function PerformanceProbe({
  runtime,
  onSustainedLowFps,
}: PerformanceProbeProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const onSustainedLowFpsRef = useRef(onSustainedLowFps);

  useEffect(() => {
    onSustainedLowFpsRef.current = onSustainedLowFps;
  }, [onSustainedLowFps]);

  useFrame(() => {
    const offerFired = runtime.recordFrame(performance.now(), {
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      gpuMemory: () => estimateGpuMemory(collectGpuMemoryInput(scene)),
    });
    if (offerFired) {
      onSustainedLowFpsRef.current?.();
    }
  });

  return null;
}

/** Collects the unique geometries and material textures used by the scene. */
function collectGpuMemoryInput(scene: Scene): GpuMemoryInput {
  const geometries = new Set<unknown>();
  const textures = new Set<unknown>();
  scene.traverse((object) => {
    const holder = object as {
      geometry?: unknown;
      material?: unknown;
    };
    if (holder.geometry) {
      geometries.add(holder.geometry);
    }
    const material = holder.material;
    if (material) {
      const materials = Array.isArray(material) ? material : [material];
      for (const candidate of materials) {
        const record = candidate as Record<string, unknown> | null;
        if (!record) {
          continue;
        }
        for (const slot of TEXTURE_SLOTS) {
          const texture = record[slot];
          if (texture) {
            textures.add(texture);
          }
        }
      }
    }
  });
  return { geometries: [...geometries], textures: [...textures] };
}
