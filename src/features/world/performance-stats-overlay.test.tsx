import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PerformanceProbeRuntime } from './performance-monitor';
import { PerformanceStatsOverlay } from './performance-stats-overlay';

// The global test setup (`src/test/setup.ts`) stubs a valid test config, so
// `getPublicConfig()` resolves `appEnv: 'test'` and the overlay is enabled.

describe('PerformanceStatsOverlay (#56, dev-only)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('reports fps, draw calls, triangles and GPU memory against the FD8 budget', () => {
    vi.useFakeTimers();
    const runtime = new PerformanceProbeRuntime();
    driveRuntime(runtime, 20, 10_000, {
      drawCalls: 120,
      triangles: 240_000,
      gpuMemory: {
        bytes: 300 * 1024 * 1024,
        textures: 9,
        geometries: 40,
      },
    });
    render(<PerformanceStatsOverlay runtime={runtime} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const panel = screen.getByTestId('dev-performance-stats');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel.textContent).toContain('20');
    expect(panel.textContent).toContain('120');
    expect(panel.textContent).toContain('240000');
    expect(panel.textContent).toContain('300');
    // Values over the FD8 limits are visibly flagged.
    expect(panel.textContent).toMatch(/over budget/i);
  });

  test('keeps the panel empty and quiet until the first stats refresh', () => {
    vi.useFakeTimers();
    const runtime = new PerformanceProbeRuntime();
    render(<PerformanceStatsOverlay runtime={runtime} />);

    const panel = screen.getByTestId('dev-performance-stats');
    expect(panel.textContent).toContain('0');
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(panel.textContent).toContain('0');
  });

  test('reflects an updated snapshot on later refreshes', () => {
    vi.useFakeTimers();
    const runtime = new PerformanceProbeRuntime();
    render(<PerformanceStatsOverlay runtime={runtime} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByTestId('dev-performance-stats').textContent).toContain(
      '0',
    );

    driveRuntime(runtime, 55, 2000, {
      drawCalls: 61,
      triangles: 90_000,
      gpuMemory: { bytes: 40 * 1024 * 1024, textures: 3, geometries: 12 },
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    const panel = screen.getByTestId('dev-performance-stats');
    expect(panel.textContent).toContain('55');
    expect(panel.textContent).toContain('61');
    expect(panel.textContent).toMatch(/\(ok\)/);
  });
});

/** Simulated frame source feeding the runtime directly. */
function driveRuntime(
  runtime: PerformanceProbeRuntime,
  fps: number,
  durationMs: number,
  sources: {
    readonly drawCalls: number;
    readonly triangles: number;
    readonly gpuMemory: {
      readonly bytes: number;
      readonly textures: number;
      readonly geometries: number;
    };
  },
): void {
  const stepMs = 1000 / fps;
  for (let t = 0; t < durationMs; t += stepMs) {
    runtime.recordFrame(t + stepMs, sources);
  }
}
