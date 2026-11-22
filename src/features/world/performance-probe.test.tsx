import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Scene } from 'three';
import { PerformanceProbeRuntime } from './performance-monitor';
import { PerformanceProbe } from './performance-probe';

/**
 * Issue #56 S2/S6: the canvas probe is driven by a simulated frame source —
 * jsdom cannot run the R3F render loop, so `useFrame` is captured and invoked
 * with controlled timestamps.
 */

interface FrameCallback {
  (state: { clock: { elapsedTime: number } }): void;
}

let frameCallback: FrameCallback | undefined;
const fakeScene = {
  traverse: (visit: (object: unknown) => void) => {
    visit({
      geometry: { attributes: { position: { count: 4, itemSize: 3 } } },
    });
    visit({
      material: { map: { image: { width: 32, height: 32 } } },
    });
  },
} as unknown as Scene;
const fakeRoot = {
  gl: {
    info: {
      render: { calls: 42, triangles: 12_345 },
      memory: { geometries: 1, textures: 1 },
    },
  },
  scene: fakeScene,
};

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: unknown) => unknown) => selector(fakeRoot),
  useFrame: (callback: FrameCallback) => {
    frameCallback = callback;
  },
}));

describe('PerformanceProbe (#56)', () => {
  let clockMs: number;
  let nowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    frameCallback = undefined;
    clockMs = 0;
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clockMs);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  test('fires the offer callback once per sustained low period and re-arms after recovery', () => {
    const onSustainedLowFps = vi.fn();
    const runtime = new PerformanceProbeRuntime();
    render(
      <PerformanceProbe
        runtime={runtime}
        onSustainedLowFps={onSustainedLowFps}
      />,
    );

    // Sustained 20 fps: below the 24 fps offer threshold.
    driveFrames(20, 10_000);
    expect(onSustainedLowFps).toHaveBeenCalledTimes(1);

    // Still low: the offer is not repeated within the same low period.
    driveFrames(20, 4000);
    expect(onSustainedLowFps).toHaveBeenCalledTimes(1);

    // Recovery to a healthy rate re-arms the trigger.
    driveFrames(60, 12_000);
    expect(onSustainedLowFps).toHaveBeenCalledTimes(1);
    driveFrames(20, 10_000);
    expect(onSustainedLowFps).toHaveBeenCalledTimes(2);
  });

  test('publishes fps, draw calls, triangles and GPU estimates into the runtime', () => {
    const onSustainedLowFps = vi.fn();
    const runtime = new PerformanceProbeRuntime();
    render(
      <PerformanceProbe
        runtime={runtime}
        onSustainedLowFps={onSustainedLowFps}
      />,
    );

    driveFrames(60, 2000);
    const stats = runtime.getStats();
    expect(stats.fps).toBeGreaterThan(50);
    expect(stats.frames).toBeGreaterThan(0);
    expect(stats.drawCalls).toBe(42);
    expect(stats.triangles).toBe(12_345);
    expect(stats.gpuMemoryBytes).toBeGreaterThan(0);
    expect(stats.gpuTextures).toBe(1);
    expect(stats.gpuGeometries).toBe(1);
    expect(stats.sustainedLowFps).toBe(false);

    driveFrames(20, 10_000);
    expect(runtime.getStats().sustainedLowFps).toBe(true);
  });

  test('never fires when no callback is provided', () => {
    const runtime = new PerformanceProbeRuntime();
    render(<PerformanceProbe runtime={runtime} />);
    driveFrames(20, 10_000);
    expect(runtime.getStats().sustainedLowFps).toBe(true);
    expect(() => driveFrames(60, 2000)).not.toThrow();
  });

  /** Simulated frame source: advances the clock at `fps` and renders a frame. */
  function driveFrames(fps: number, durationMs: number): void {
    if (frameCallback === undefined) {
      throw new Error('useFrame was never registered');
    }
    const stepMs = 1000 / fps;
    for (let t = 0; t < durationMs; t += stepMs) {
      clockMs += stepMs;
      frameCallback({ clock: { elapsedTime: clockMs / 1000 } });
    }
  }
});
