/**
 * Runtime performance sampling for the 3D classroom (issue #56, FD8).
 *
 * Pure module: no React and no three.js. The canvas probe feeds it real frame
 * timestamps (`useFrame` cadence), which keeps it testable with a simulated
 * frame source and makes idle (frame-on-demand) scenes decide nothing.
 *
 * Decisions recorded in `odd/tasks/issue-56-perf-monitor-2d-offer.md`:
 * - The offer trigger uses the conservative 30 fps integrated-GPU target, not
 *   the 60 fps mid-range figure, because runtime GPU-class detection is
 *   unreliable and a usable 40 fps device should not be pushed to 2D.
 * - Only rendered frames count: a static demand-loop scene produces no
 *   samples, so quiet scenes never trigger the offer.
 */

/** FD8 performance budget limits (rules/3d-world-and-camera.md). */
export const FD8_BUDGET = {
  maxDrawCalls: 100,
  maxTriangles: 200_000,
  maxGpuMemoryBytes: 256 * 1024 * 1024,
} as const;

/**
 * Sampler configuration. Thresholds and window are defined here and
 * documented in the feature docs guide, per issue #56.
 */
export const PERF_SAMPLER_CONFIG = {
  /** FD8: target frame rate on integrated GPUs. */
  conservativeTargetFps: 30,
  /** FD8: target frame rate on mid-range machines (reported, never a trigger). */
  midRangeTargetFps: 60,
  /**
   * Offer threshold: 80% of the conservative target. A stream at or above
   * the nominal threshold must not trigger the offer.
   */
  sustainedBelowFps: 24,
  /**
   * Measurement tolerance: mean fps over a finite window measures slightly
   * below the nominal rate, so a nominal 24 fps stream stays unflagged.
   */
  fpsEpsilon: 0.5,
  /** Rolling window: the newest `windowMs` of rendered frames decide. */
  windowMs: 8000,
  /** Frames required inside the window before any offer decision. */
  minDecisionFrames: 30,
  /**
   * A gap longer than this between frames resets the window: frames across
   * an idle pause (hidden tab, static scene) are not evidence of slowness.
   */
  idleGapResetMs: 1000,
  /** Hard cap on stored samples so fast devices cannot grow the array. */
  maxStoredFrames: 700,
} as const;

export interface FpsMetrics {
  /** Mean frame rate over the rolling window, 0 when undecidable. */
  readonly fps: number;
  /** Frames currently inside the rolling window. */
  readonly frames: number;
  /** Span of the rolling window in ms, 0 when fewer than two frames. */
  readonly windowMs: number;
}

/** Rolling-window frame-rate sampler driven by frame timestamps. */
export class FpsSampler {
  private frames: number[] = [];
  private lastFrameMs: number | null = null;

  /** Records one rendered frame at `nowMs` (epoch or monotonic ms). */
  recordFrame(nowMs: number): void {
    if (
      this.lastFrameMs !== null &&
      nowMs - this.lastFrameMs > PERF_SAMPLER_CONFIG.idleGapResetMs
    ) {
      // The gap is idle time, not rendering: forget pre-idle samples.
      this.frames = [];
    }
    this.lastFrameMs = nowMs;
    this.frames.push(nowMs);
    this.prune(nowMs);
  }

  /** Mean fps and sample count over the current rolling window. */
  getMetrics(): FpsMetrics {
    if (this.frames.length < 2) {
      return { fps: 0, frames: this.frames.length, windowMs: 0 };
    }
    const oldest = this.frames[0];
    const newest = this.frames[this.frames.length - 1];
    const spanMs = newest - oldest;
    if (spanMs <= 0) {
      return { fps: 0, frames: this.frames.length, windowMs: 0 };
    }
    return {
      fps: ((this.frames.length - 1) * 1000) / spanMs,
      frames: this.frames.length,
      windowMs: spanMs,
    };
  }

  /**
   * True when the rolling window holds enough frames to decide and their
   * mean rate sits below the offer threshold (issue #56: sustained low fps).
   */
  isSustainedBelowTarget(): boolean {
    const metrics = this.getMetrics();
    if (metrics.frames < PERF_SAMPLER_CONFIG.minDecisionFrames) {
      return false;
    }
    return (
      metrics.fps + PERF_SAMPLER_CONFIG.fpsEpsilon <
      PERF_SAMPLER_CONFIG.sustainedBelowFps
    );
  }

  /** Clears all samples; the next recorded frame starts a fresh window. */
  reset(): void {
    this.frames = [];
    this.lastFrameMs = null;
  }

  private prune(nowMs: number): void {
    const cutoff = nowMs - PERF_SAMPLER_CONFIG.windowMs;
    while (this.frames.length > 0 && this.frames[0] < cutoff) {
      this.frames.shift();
    }
    while (this.frames.length > PERF_SAMPLER_CONFIG.maxStoredFrames) {
      this.frames.shift();
    }
  }
}

/**
 * Dev-only GPU memory estimation (issue #56 S3): three.js exposes texture and
 * geometry counts but not bytes, so the estimate sums known attribute and
 * image dimensions. It is a documented heuristic for the FD8 overlay, never
 * a user-facing measurement.
 */
export interface GpuAttributeLike {
  readonly count: number;
  readonly itemSize?: number;
}

export interface GpuGeometryLike {
  readonly attributes?: Record<string, GpuAttributeLike>;
  readonly index?: { readonly count: number } | null;
}

export interface GpuTextureLike {
  readonly image?: { readonly width?: number; readonly height?: number } | null;
}

export interface GpuMemoryInput {
  readonly geometries: readonly unknown[];
  readonly textures: readonly unknown[];
}

export interface GpuMemoryEstimate {
  /** Estimated bytes: RGBA8 pixels (with a ~1/3 mip chain) plus attributes. */
  readonly bytes: number;
  readonly textures: number;
  readonly geometries: number;
}

const FLOAT32_BYTES = 4;
/** Full mip chain of a base texture adds one third of its size. */
const MIP_CHAIN_FACTOR = 4 / 3;

export function estimateGpuMemory(input: GpuMemoryInput): GpuMemoryEstimate {
  let bytes = 0;
  for (const candidate of input.geometries) {
    const geometry = candidate as GpuGeometryLike | null;
    if (!geometry) {
      continue;
    }
    for (const attribute of Object.values(geometry.attributes ?? {})) {
      bytes += attribute.count * (attribute.itemSize ?? 1) * FLOAT32_BYTES;
    }
    if (geometry.index) {
      bytes += geometry.index.count * FLOAT32_BYTES;
    }
  }
  for (const candidate of input.textures) {
    const texture = candidate as GpuTextureLike | null;
    const image = texture?.image;
    const width = typeof image?.width === 'number' ? image.width : 0;
    const height = typeof image?.height === 'number' ? image.height : 0;
    // Unknown dimensions contribute 0 bytes rather than a guessed size.
    if (width > 0 && height > 0) {
      bytes += width * height * FLOAT32_BYTES * MIP_CHAIN_FACTOR;
    }
  }
  return {
    bytes: Math.round(bytes),
    textures: input.textures.length,
    geometries: input.geometries.length,
  };
}

/** Shared canvas stats model consumed by the probe and the dev overlay. */
export interface CanvasPerformanceStats {
  readonly fps: number;
  readonly frames: number;
  readonly sustainedLowFps: boolean;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly gpuMemoryBytes: number;
  readonly gpuTextures: number;
  readonly gpuGeometries: number;
}

export function createCanvasPerformanceStats(): CanvasPerformanceStats {
  return {
    fps: 0,
    frames: 0,
    sustainedLowFps: false,
    drawCalls: 0,
    triangles: 0,
    gpuMemoryBytes: 0,
    gpuTextures: 0,
    gpuGeometries: 0,
  };
}

/** Throttled cadence for publishing stats from the probe (never per frame). */
export const STATS_REFRESH_MS = 500;

/** Per-frame renderer readings fed by the canvas probe. */
export interface ProbeFrameSources {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly gpuMemory: GpuMemoryEstimate;
}

/**
 * Probe runtime owned outside React (issue #56 S2/S3): the canvas probe feeds
 * it rendered frames and the dev overlay polls its published stats, so no
 * per-frame React state is involved. A plain class keeps the render loop
 * compiler-friendly (foreign-object mutation, like three.js animation
 * mixers) and testable with a simulated frame source.
 */
export class PerformanceProbeRuntime {
  private readonly sampler = new FpsSampler();
  private sustainedLow = false;
  private lastStatsWriteMs = 0;
  private stats: CanvasPerformanceStats = createCanvasPerformanceStats();

  /**
   * Records one rendered frame at `nowMs`. Returns `true` exactly once per
   * sustained low-fps period; the trigger re-arms after the rate recovers,
   * which is how "conditions change" is interpreted for the 2D offer.
   */
  recordFrame(nowMs: number, sources: ProbeFrameSources): boolean {
    this.sampler.recordFrame(nowMs);
    const sustained = this.sampler.isSustainedBelowTarget();
    let offerFired = false;
    if (sustained && !this.sustainedLow) {
      this.sustainedLow = true;
      offerFired = true;
    } else if (!sustained && this.sustainedLow) {
      this.sustainedLow = false;
    }
    if (nowMs - this.lastStatsWriteMs >= STATS_REFRESH_MS) {
      this.lastStatsWriteMs = nowMs;
      const metrics = this.sampler.getMetrics();
      this.stats = {
        fps: Math.round(metrics.fps * 10) / 10,
        frames: metrics.frames,
        sustainedLowFps: this.sustainedLow,
        drawCalls: sources.drawCalls,
        triangles: sources.triangles,
        gpuMemoryBytes: sources.gpuMemory.bytes,
        gpuTextures: sources.gpuMemory.textures,
        gpuGeometries: sources.gpuMemory.geometries,
      };
    }
    return offerFired;
  }

  /** Latest published stats snapshot (refreshed at `STATS_REFRESH_MS`). */
  getStats(): CanvasPerformanceStats {
    return this.stats;
  }
}
