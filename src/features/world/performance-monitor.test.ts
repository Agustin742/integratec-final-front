import { beforeEach, describe, expect, test } from 'vitest';
import {
  FD8_BUDGET,
  PERF_SAMPLER_CONFIG,
  FpsSampler,
  estimateGpuMemory,
} from './performance-monitor';

/**
 * Issue #56 S2/S6: the sampler is fed a simulated frame source (deterministic
 * timestamps) because jsdom cannot render the R3F loop.
 */
describe('FpsSampler (#56)', () => {
  let sampler: FpsSampler;

  beforeEach(() => {
    sampler = new FpsSampler();
  });

  test('never flags a device that sustains the mid-range 60 fps target', () => {
    // 10 seconds at 60 fps.
    stream(sampler, 60, 10000);
    expect(sampler.isSustainedBelowTarget()).toBe(false);
    expect(sampler.getMetrics().fps).toBeGreaterThanOrEqual(59);
  });

  test('flags a sustained 20 fps stream below the conservative 30 fps target', () => {
    stream(sampler, 20, 10000);
    expect(sampler.isSustainedBelowTarget()).toBe(true);
    expect(sampler.getMetrics().fps).toBeLessThan(24);
  });

  test('a short dip does not trigger the offer', () => {
    // 2 seconds at 5 fps, then recovery to 60 fps.
    stream(sampler, 5, 2000);
    stream(sampler, 60, 8000);
    expect(sampler.isSustainedBelowTarget()).toBe(false);
  });

  test('an idle gap resets the window so pre-idle slowness is forgotten', () => {
    stream(sampler, 5, 3000);
    // A 2 s idle gap before the next frame clears the window.
    stream(sampler, 5, 1000, { startAtMs: 5000 });
    expect(sampler.getMetrics().frames).toBeLessThan(10);
    // Healthy rendering after the gap must not inherit the old samples.
    stream(sampler, 60, 8000, { startAtMs: 8000 });
    expect(sampler.isSustainedBelowTarget()).toBe(false);
  });

  test('24 fps sits exactly at the offer threshold and does not trigger', () => {
    stream(sampler, 24, 12000);
    expect(sampler.getMetrics().fps).toBeLessThan(25);
    expect(sampler.isSustainedBelowTarget()).toBe(false);
  });

  test('23 fps is below the threshold and triggers', () => {
    stream(sampler, 23, 12000);
    expect(sampler.isSustainedBelowTarget()).toBe(true);
  });

  test('a very slow but active device (4 fps) still triggers the offer', () => {
    stream(sampler, 4, 12000);
    expect(sampler.isSustainedBelowTarget()).toBe(true);
  });

  test('reports the frame count and mean fps of the rolling window', () => {
    stream(sampler, 30, 8000);
    const metrics = sampler.getMetrics();
    expect(metrics.frames).toBeGreaterThan(0);
    expect(metrics.fps).toBeGreaterThan(25);
    expect(metrics.fps).toBeLessThan(35);
  });

  test('reset clears all samples', () => {
    stream(sampler, 4, 12000);
    expect(sampler.isSustainedBelowTarget()).toBe(true);
    sampler.reset();
    expect(sampler.getMetrics().frames).toBe(0);
    expect(sampler.isSustainedBelowTarget()).toBe(false);
  });

  test('exports the documented FD8 budget and sampler configuration', () => {
    expect(FD8_BUDGET.maxDrawCalls).toBe(100);
    expect(FD8_BUDGET.maxTriangles).toBe(200_000);
    expect(FD8_BUDGET.maxGpuMemoryBytes).toBe(256 * 1024 * 1024);
    expect(PERF_SAMPLER_CONFIG.conservativeTargetFps).toBe(30);
    expect(PERF_SAMPLER_CONFIG.midRangeTargetFps).toBe(60);
    expect(PERF_SAMPLER_CONFIG.sustainedBelowFps).toBe(24);
    expect(PERF_SAMPLER_CONFIG.windowMs).toBe(8000);
    expect(PERF_SAMPLER_CONFIG.minDecisionFrames).toBeGreaterThan(0);
    expect(PERF_SAMPLER_CONFIG.idleGapResetMs).toBeGreaterThan(0);
  });
});

/** Feeds `sampler` a simulated frame source at `fps` for `durationMs`. */
function stream(
  sampler: FpsSampler,
  fps: number,
  durationMs: number,
  options?: { readonly startAtMs?: number },
): void {
  const startAtMs = options?.startAtMs ?? 0;
  const stepMs = 1000 / fps;
  for (let t = startAtMs; t < startAtMs + durationMs; t += stepMs) {
    sampler.recordFrame(t);
  }
}

describe('estimateGpuMemory (#56)', () => {
  test('estimates texture bytes as RGBA8 plus a mip chain', () => {
    const result = estimateGpuMemory({
      textures: [{ image: { width: 64, height: 64 } }],
      geometries: [],
    });
    expect(result.bytes).toBeGreaterThan(64 * 64 * 4);
    expect(result.bytes).toBeLessThan(64 * 64 * 4 * 1.4);
    expect(result.textures).toBe(1);
    expect(result.geometries).toBe(0);
  });

  test('estimates geometry bytes from vertex attributes and the index', () => {
    const result = estimateGpuMemory({
      textures: [],
      geometries: [
        {
          attributes: {
            position: { count: 8, itemSize: 3 },
            normal: { count: 8, itemSize: 3 },
          },
          index: { count: 12 },
        },
      ],
    });
    // position 8*3*4 + normal 8*3*4 + index 12*4 = 96 + 96 + 48
    expect(result.bytes).toBe(240);
    expect(result.geometries).toBe(1);
  });

  test('skips textures without known dimensions instead of guessing', () => {
    const result = estimateGpuMemory({
      textures: [{ image: null }, {}],
      geometries: [],
    });
    expect(result.bytes).toBe(0);
    expect(result.textures).toBe(2);
  });
});
