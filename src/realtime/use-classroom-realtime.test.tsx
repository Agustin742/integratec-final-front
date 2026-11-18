import { StrictMode } from 'react';
import { MapSchema } from '@colyseus/schema';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { Avatar } from './avatar.generated';
import type { RealtimeRoomLike, RealtimeSdkClientLike } from './client';
import { ClassroomState } from './room-state.generated';
import { useClassroomRealtime } from './use-classroom-realtime';

const CLASSROOM_A = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const CLASSROOM_B = '11111111-1111-4111-8111-111111111111';

function createHookTestRoom(classroomId: string) {
  const state = new ClassroomState();
  state.classroomId = classroomId;
  state.avatars = new MapSchema<Avatar>();
  const avatar = new Avatar();
  avatar.userId = profile.id;
  avatar.displayName = profile.displayName;
  avatar.role = 'TEACHER';
  avatar.x = 0;
  avatar.z = 0;
  avatar.rotation = 0;
  avatar.status = 'online';
  state.avatars.set(profile.id, avatar);

  const leave = vi.fn(async () => 1000);
  const removeAllListeners = vi.fn();
  const send = vi.fn();
  const stateListeners = new Set<(next: ClassroomState) => void>();

  const room: RealtimeRoomLike<ClassroomState> = {
    roomId: `room-${classroomId.slice(0, 4)}`,
    sessionId: 'hook-conn-1',
    reconnectionToken: 'reconn-1',
    state,
    onStateChange: (cb) => {
      stateListeners.add(cb);
    },
    onDrop: () => {},
    onLeave: () => {},
    onError: () => {},
    onMessage: () => {},
    send,
    leave,
    removeAllListeners,
  };

  return { room, leave, removeAllListeners, send, stateListeners };
}

describe('useClassroomRealtime (#23)', () => {
  it('S5: cleans up connections across StrictMode mount/unmount cycles without duplicate listeners', async () => {
    const rooms = new Map<string, ReturnType<typeof createHookTestRoom>>();
    const joinCalls: string[] = [];

    const createSdkClient = (): RealtimeSdkClientLike => ({
      auth: { token: undefined },
      joinOrCreate: async (_name, options) => {
        const id = options?.classroomId ?? CLASSROOM_A;
        joinCalls.push(id);
        const created = createHookTestRoom(id);
        rooms.set(`${id}#${joinCalls.length}`, created);
        return created.room;
      },
      reconnect: async () => createHookTestRoom(CLASSROOM_A).room,
    });

    const session = fakeSession({ status: 'authenticated', user: profile });
    session.service.controller.getAccessToken = () => 'hook-token';
    session.service.controller.refreshAccessToken = async () => 'hook-token';
    session.service.controller.registerCleanup = () => () => {};

    const queryClient = createAppQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <ApiQueryProvider client={queryClient}>
          <SessionProvider service={session.service}>
            {children}
          </SessionProvider>
        </ApiQueryProvider>
      </StrictMode>
    );

    const { result, unmount } = renderHook(
      () =>
        useClassroomRealtime({
          classroomId: CLASSROOM_A,
          realtimeUrl: 'wss://realtime.example.invalid',
          createSdkClient,
        }),
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(result.current.status).toBe('connected');
    });

    // Explicit mount -> unmount -> remount cycle proves no duplicate listeners or dangling rooms.
    await vi.waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
    expect(joinCalls).toHaveLength(1);
    const firstRoom = rooms.get(`${CLASSROOM_A}#1`);
    expect(firstRoom?.stateListeners.size).toBe(1);
    expect(result.current.presenceUncertain).toBe(false);
    expect(result.current.participants.has(profile.id)).toBe(true);

    unmount();
    expect(firstRoom?.leave).toHaveBeenCalledTimes(1);
    expect(firstRoom?.removeAllListeners).toHaveBeenCalledTimes(1);

    const secondMount = renderHook(
      () =>
        useClassroomRealtime({
          classroomId: CLASSROOM_A,
          realtimeUrl: 'wss://realtime.example.invalid',
          createSdkClient,
        }),
      { wrapper },
    );
    await vi.waitFor(() => {
      expect(secondMount.result.current.status).toBe('connected');
    });
    expect(joinCalls).toHaveLength(2);
    const secondRoom = rooms.get(`${CLASSROOM_A}#2`);
    expect(secondRoom?.stateListeners.size).toBe(1);

    secondMount.unmount();
    expect(secondRoom?.leave).toHaveBeenCalledTimes(1);
    expect(secondRoom?.removeAllListeners).toHaveBeenCalledTimes(1);
  });

  it('S3 & S5: disconnects previous classroom on switch and clears room when disabled or logged out', async () => {
    const roomsByClassroom = new Map<
      string,
      ReturnType<typeof createHookTestRoom>
    >();
    let token: string | undefined = 'hook-token';
    const cleanups = new Set<() => void>();

    const createSdkClient = (): RealtimeSdkClientLike => ({
      auth: { token: undefined },
      joinOrCreate: async (_name, options) => {
        const id = options?.classroomId ?? CLASSROOM_A;
        const created = createHookTestRoom(id);
        roomsByClassroom.set(id, created);
        return created.room;
      },
      reconnect: async () => createHookTestRoom(CLASSROOM_A).room,
    });

    const session = fakeSession({ status: 'authenticated', user: profile });
    session.service.controller.getAccessToken = () => token;
    session.service.controller.refreshAccessToken = async () => token;
    session.service.controller.registerCleanup = (cleanup) => {
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    };

    const queryClient = createAppQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiQueryProvider client={queryClient}>
        <SessionProvider service={session.service}>{children}</SessionProvider>
      </ApiQueryProvider>
    );

    const { result, rerender } = renderHook(
      ({
        classroomId,
        enabled,
      }: {
        classroomId: string | null;
        enabled: boolean;
      }) =>
        useClassroomRealtime({
          classroomId,
          enabled,
          realtimeUrl: 'wss://realtime.example.invalid',
          createSdkClient,
        }),
      {
        wrapper,
        initialProps: {
          classroomId: CLASSROOM_A as string | null,
          enabled: true,
        },
      },
    );

    await vi.waitFor(() => {
      expect(result.current.status).toBe('connected');
    });
    expect(result.current.classroomId).toBe(CLASSROOM_A);

    // Switch classroom A -> classroom B
    rerender({ classroomId: CLASSROOM_B, enabled: true });
    await vi.waitFor(() => {
      expect(result.current.classroomId).toBe(CLASSROOM_B);
      expect(result.current.status).toBe('connected');
    });
    expect(roomsByClassroom.get(CLASSROOM_A)?.leave).toHaveBeenCalledTimes(1);
    expect(
      roomsByClassroom.get(CLASSROOM_A)?.removeAllListeners,
    ).toHaveBeenCalledTimes(1);

    // Logout clears token, triggers cleanups, and switches snapshot to unauthenticated
    act(() => {
      token = undefined;
      for (const cleanup of [...cleanups]) {
        cleanup();
      }
      session.set({ status: 'unauthenticated' });
    });

    await vi.waitFor(() => {
      expect(result.current.status).toBe('disconnected');
    });
    expect(result.current.presenceUncertain).toBe(true);
    expect(result.current.participants.size).toBe(0);
    expect(roomsByClassroom.get(CLASSROOM_B)?.leave).toHaveBeenCalledTimes(1);
  });
});
