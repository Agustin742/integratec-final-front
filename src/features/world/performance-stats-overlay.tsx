import { useEffect, useState } from 'react';
import { getPublicConfig } from '../../config/public-config';
import {
  FD8_BUDGET,
  PERF_SAMPLER_CONFIG,
  type CanvasPerformanceStats,
  type PerformanceProbeRuntime,
} from './performance-monitor';

export { createCanvasPerformanceStats } from './performance-monitor';
export type { CanvasPerformanceStats } from './performance-monitor';

/**
 * Dev-time stats overlay (issue #56 S3): reports fps, draw calls, triangles
 * and texture/GPU memory estimates against the FD8 budget. Developer-facing
 * diagnostics, so the copy is English and `aria-hidden` — it is runtime-gated
 * by `appEnv !== 'production'` (rendered as `null` with no interval in
 * production; the component stays in the bundle) and never becomes a
 * user-facing announcement (`rules/observability-and-privacy.md`).
 */
const OVERLAY_REFRESH_MS = 500;

function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))}MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }
  return `${bytes}B`;
}

function budget(
  value: number | string,
  limit: number | string,
  isOver = typeof value === 'number' &&
    typeof limit === 'number' &&
    value > limit,
): string {
  return `${value}/${limit}${isOver ? ' (over budget)' : ' (ok)'}`;
}

export function PerformanceStatsOverlay({
  runtime,
}: {
  readonly runtime: PerformanceProbeRuntime;
}) {
  // Test builds keep the overlay for verification evidence; production
  // builds render nothing and run no interval. Validated once per mount.
  const [enabled] = useState(() => getPublicConfig().appEnv !== 'production');
  const [snapshot, setSnapshot] = useState<CanvasPerformanceStats>(() => ({
    ...runtime.getStats(),
  }));

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = window.setInterval(() => {
      setSnapshot({ ...runtime.getStats() });
    }, OVERLAY_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [enabled, runtime]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      data-testid="dev-performance-stats"
      aria-hidden="true"
      className="pointer-events-none fixed top-28 right-2 z-50 rounded-md bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-lime-300"
    >
      <p>DEV — 3D performance (estimates, FD8 budget)</p>
      <p>
        fps {snapshot.fps} · target {PERF_SAMPLER_CONFIG.conservativeTargetFps}{' '}
        (mid-range {PERF_SAMPLER_CONFIG.midRangeTargetFps})
        {snapshot.sustainedLowFps ? ' · sustained low' : ''}
      </p>
      <p>draw calls {budget(snapshot.drawCalls, FD8_BUDGET.maxDrawCalls)}</p>
      <p>triangles {budget(snapshot.triangles, FD8_BUDGET.maxTriangles)}</p>
      <p>
        gpu memory est.{' '}
        {budget(
          formatMemory(snapshot.gpuMemoryBytes),
          formatMemory(FD8_BUDGET.maxGpuMemoryBytes),
          snapshot.gpuMemoryBytes > FD8_BUDGET.maxGpuMemoryBytes,
        )}
      </p>
      <p>
        textures {snapshot.gpuTextures} · geometries {snapshot.gpuGeometries}
      </p>
    </div>
  );
}
