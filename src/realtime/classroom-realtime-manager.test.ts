import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFakeRealtimeAuth,
  createFakeRealtimeSdk,
} from '@/test/realtime/fake-realtime-sdk';
import { createClassroomRealtimeManager } from './classroom-realtime-manager';

const CLASSROOM_A = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const CLASSROOM_B = '11111111-1111-4111-8111-111111111111';
const CLASSROOM_C = '22222222-2222-4222-8222-222222222222';
const CLASSROOM_D = '33333333-3333-4333-8333-333333333333';

function setup(options: { maxConnections?: number } = {}) {
  const sdk = createFakeRealtimeSdk();
  const manager = createClassroomRealtimeManager({
    auth: createFakeRealtimeAuth(),
    realtimeUrl: 'wss://realtime.example.invalid',
    createSdkClient: sdk.createSdkClient,
    releaseGraceMs: 100,
    ...options,
  });
  return { sdk, manager };
}

describe('classroom realtime manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares one connection between subscribers of the same classroom', async () => {
    const { sdk, manager } = setup();

    const first = manager.acquire(CLASSROOM_A);
    const second = manager.acquire(CLASSROOM_A);
    await vi.advanceTimersByTimeAsync(0);

    expect(first).not.toBeNull();
    expect(second?.client).toBe(first?.client);
    expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A]);
    manager.dispose();
  });

  it('keeps the connection until the last subscriber releases, then leaves the room', async () => {
    const { sdk, manager } = setup();
    const first = manager.acquire(CLASSROOM_A);
    const second = manager.acquire(CLASSROOM_A);
    await vi.advanceTimersByTimeAsync(0);
    const room = sdk.roomFor(CLASSROOM_A);

    first?.release();
    await vi.advanceTimersByTimeAsync(500);
    expect(room?.leave).not.toHaveBeenCalled();

    second?.release();
    second?.release(); // releasing twice is harmless
    await vi.advanceTimersByTimeAsync(500);
    expect(room?.leave).toHaveBeenCalledTimes(1);
    manager.dispose();
  });

  it('reuses the connection when a subscriber returns inside the grace period', async () => {
    const { sdk, manager } = setup();
    manager.acquire(CLASSROOM_A)?.release();
    const again = manager.acquire(CLASSROOM_A);
    await vi.advanceTimersByTimeAsync(500);

    expect(again).not.toBeNull();
    expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A]);
    expect(sdk.roomFor(CLASSROOM_A)?.leave).not.toHaveBeenCalled();
    manager.dispose();
  });

  it('opens one connection per classroom and refuses to exceed the per-user limit', async () => {
    const { sdk, manager } = setup({ maxConnections: 3 });

    const leases = [CLASSROOM_A, CLASSROOM_B, CLASSROOM_C].map((id) =>
      manager.acquire(id),
    );
    const overLimit = manager.acquire(CLASSROOM_D);
    await vi.advanceTimersByTimeAsync(0);

    expect(leases.every((lease) => lease !== null)).toBe(true);
    expect(overLimit).toBeNull();
    expect(sdk.joinedClassrooms).toEqual([
      CLASSROOM_A,
      CLASSROOM_B,
      CLASSROOM_C,
    ]);

    // A freed slot can be used again.
    leases[0]?.release();
    await vi.advanceTimersByTimeAsync(500);
    expect(manager.acquire(CLASSROOM_D)).not.toBeNull();
    manager.dispose();
  });

  it('retries a transient connection failure with backoff', async () => {
    const { sdk, manager } = setup();
    sdk.failNextJoinWith(new Error('network down'));

    const lease = manager.acquire(CLASSROOM_A);
    await vi.advanceTimersByTimeAsync(0);
    expect(sdk.joinedClassrooms).toEqual([]);

    await vi.advanceTimersByTimeAsync(2_500);
    expect(sdk.joinedClassrooms).toEqual([CLASSROOM_A]);
    expect(lease?.client.getSnapshot().status).toBe('connected');
    manager.dispose();
  });

  it('disposes every connection on dispose', async () => {
    const { sdk, manager } = setup();
    manager.acquire(CLASSROOM_A);
    manager.acquire(CLASSROOM_B);
    await vi.advanceTimersByTimeAsync(0);

    manager.dispose();

    expect(sdk.roomFor(CLASSROOM_A)?.leave).toHaveBeenCalledTimes(1);
    expect(sdk.roomFor(CLASSROOM_B)?.leave).toHaveBeenCalledTimes(1);
    expect(manager.acquire(CLASSROOM_A)).toBeNull();
  });
});
