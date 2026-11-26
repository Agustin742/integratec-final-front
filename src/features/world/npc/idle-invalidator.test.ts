import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_FRAME_INTERVAL_MS,
  createIdleInvalidator,
} from './idle-invalidator';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createIdleInvalidator', () => {
  it('does not invalidate synchronously', () => {
    const invalidate = vi.fn();
    createIdleInvalidator(invalidate).request();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('coalesces repeated requests into one invalidation per interval', () => {
    const invalidate = vi.fn();
    const idle = createIdleInvalidator(invalidate);
    for (let i = 0; i < 10; i += 1) idle.request();
    vi.advanceTimersByTime(IDLE_FRAME_INTERVAL_MS);
    expect(invalidate).toHaveBeenCalledTimes(1);
    idle.request();
    vi.advanceTimersByTime(IDLE_FRAME_INTERVAL_MS);
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('caps the idle cadence at roughly 15 frames per second', () => {
    const invalidate = vi.fn();
    const idle = createIdleInvalidator(invalidate);
    for (let ms = 0; ms < 1000; ms += 4) {
      idle.request();
      vi.advanceTimersByTime(4);
    }
    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(16);
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(10);
  });

  it('cancels a pending invalidation on dispose', () => {
    const invalidate = vi.fn();
    const idle = createIdleInvalidator(invalidate);
    idle.request();
    idle.dispose();
    vi.advanceTimersByTime(IDLE_FRAME_INTERVAL_MS * 3);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
