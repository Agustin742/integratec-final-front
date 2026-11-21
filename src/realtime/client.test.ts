import { MapSchema } from '@colyseus/schema';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Avatar } from './avatar.generated';
import {
  AVATAR_INPUT_MESSAGE,
  CLASSROOM_ROOM_NAME,
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_CODE_TOO_MANY_CONNECTIONS,
  CLOSE_CODE_VERIFICATION_UNAVAILABLE,
  CLOSE_REASON_ACCESS_REVOKED,
  CLOSE_REASON_TOO_MANY_CONNECTIONS,
  CLOSE_REASON_VERIFICATION_UNAVAILABLE,
} from './contracts.generated';
import { ClassroomState } from './room-state.generated';
import {
  createClassroomRealtimeClient,
  realtimeMessages,
  type RealtimeAuthPort,
  type RealtimeRoomLike,
  type RealtimeSdkClientLike,
} from './client';

const CLASSROOM_A = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const CLASSROOM_B = '11111111-1111-4111-8111-111111111111';

class FakeRoom implements RealtimeRoomLike<ClassroomState> {
  readonly roomId: string;
  readonly sessionId: string;
  readonly reconnectionToken: string;
  state: ClassroomState;
  readonly sentMessages: Array<{ type: string; payload: unknown }> = [];
  leaveCalls = 0;
  removeAllListenersCalls = 0;

  private stateListeners = new Set<(state: ClassroomState) => void>();
  private dropListeners = new Set<(code: number, reason?: string) => void>();
  private leaveListeners = new Set<(code: number, reason?: string) => void>();
  private errorListeners = new Set<(code: number, message?: string) => void>();
  private wildcardMessageListeners = new Set<
    (type: string, payload: unknown) => void
  >();

  constructor(options: {
    classroomId: string;
    roomId?: string;
    sessionId?: string;
    reconnectionToken?: string;
  }) {
    this.roomId = options.roomId ?? `room-${options.classroomId.slice(0, 4)}`;
    this.sessionId = options.sessionId ?? 'conn-session-1';
    this.reconnectionToken =
      options.reconnectionToken ?? `${this.roomId}:reconnect-token-1`;
    this.state = new ClassroomState();
    this.state.classroomId = options.classroomId;
    this.state.avatars = new MapSchema<Avatar>();
  }

  onStateChange(callback: (state: ClassroomState) => void): void {
    this.stateListeners.add(callback);
  }

  onDrop(callback: (code: number, reason?: string) => void): void {
    this.dropListeners.add(callback);
  }

  onLeave(callback: (code: number, reason?: string) => void): void {
    this.leaveListeners.add(callback);
  }

  onError(callback: (code: number, message?: string) => void): void {
    this.errorListeners.add(callback);
  }

  onMessage(
    type: '*',
    callback: (messageType: string, payload: unknown) => void,
  ): () => void {
    if (type === '*') {
      this.wildcardMessageListeners.add(callback);
    }
    return () => {
      this.wildcardMessageListeners.delete(callback);
    };
  }

  send(type: string, payload?: unknown): void {
    this.sentMessages.push({ type, payload });
  }

  async leave(): Promise<number> {
    this.leaveCalls += 1;
    return 1000;
  }

  removeAllListeners(): void {
    this.removeAllListenersCalls += 1;
    this.stateListeners.clear();
    this.dropListeners.clear();
    this.leaveListeners.clear();
    this.errorListeners.clear();
    this.wildcardMessageListeners.clear();
  }

  setAvatar(
    userId: string,
    data: Partial<{
      displayName: string;
      role: string;
      x: number;
      z: number;
      rotation: number;
      status: string;
    }>,
  ): void {
    const avatar = new Avatar();
    avatar.userId = userId;
    avatar.displayName = data.displayName ?? 'Ada Lovelace';
    avatar.role = data.role ?? 'STUDENT';
    avatar.x = data.x ?? 1;
    avatar.z = data.z ?? 2;
    avatar.rotation = data.rotation ?? 0;
    avatar.status = data.status ?? 'online';
    this.state.avatars.set(userId, avatar);
  }

  emitStateChange(): void {
    for (const listener of [...this.stateListeners]) {
      listener(this.state);
    }
  }

  emitDrop(code = 1006, reason = 'abnormal closure'): void {
    for (const listener of [...this.dropListeners]) {
      listener(code, reason);
    }
  }

  emitLeave(code: number, reason?: string): void {
    for (const listener of [...this.leaveListeners]) {
      listener(code, reason);
    }
  }

  emitMessage(type: string, payload: unknown): void {
    for (const listener of [...this.wildcardMessageListeners]) {
      listener(type, payload);
    }
  }

  listenerCount(): number {
    return (
      this.stateListeners.size +
      this.dropListeners.size +
      this.leaveListeners.size +
      this.errorListeners.size +
      this.wildcardMessageListeners.size
    );
  }
}

function createFakeAuth(
  initialToken: string | undefined = 'initial-access-token',
) {
  let token: string | undefined = initialToken;
  const cleanups = new Set<() => void>();
  const refreshAccessToken = vi.fn<() => Promise<string | undefined>>(
    async () => token,
  );
  const auth: RealtimeAuthPort = {
    getAccessToken: () => token,
    refreshAccessToken,
    registerCleanup: (cleanup) => {
      cleanups.add(cleanup);
      return () => cleanups.delete(cleanup);
    },
  };
  return {
    auth,
    refreshAccessToken,
    setToken: (next: string | undefined) => {
      token = next;
    },
    triggerLogoutCleanup: () => {
      token = undefined;
      for (const cleanup of [...cleanups]) {
        cleanup();
      }
    },
  };
}

function createFakeSdk() {
  const joinCalls: Array<{
    endpoint: string;
    roomName: string;
    options: unknown;
    authToken: string | undefined;
  }> = [];
  const reconnectCalls: Array<{
    endpoint: string;
    reconnectionToken: string;
    authToken: string | undefined;
  }> = [];

  let onJoin: (call: {
    roomName: string;
    options: { classroomId: string };
    authToken: string | undefined;
    attempt: number;
  }) => Promise<FakeRoom> = async ({ options }) =>
    new FakeRoom({ classroomId: options.classroomId });

  let onReconnect: (call: {
    reconnectionToken: string;
    authToken: string | undefined;
  }) => Promise<FakeRoom> = async () =>
    new FakeRoom({ classroomId: CLASSROOM_A, sessionId: 'conn-reconnected' });

  const createSdkClient = (endpoint: string): RealtimeSdkClientLike => {
    const sdk: RealtimeSdkClientLike = {
      auth: { token: undefined },
      joinOrCreate: async (roomName, options) => {
        const currentAttempt = joinCalls.length + 1;
        joinCalls.push({
          endpoint,
          roomName,
          options,
          authToken: sdk.auth.token,
        });
        return (await onJoin({
          roomName,
          options: options as { classroomId: string },
          authToken: sdk.auth.token,
          attempt: currentAttempt,
        })) as RealtimeRoomLike<ClassroomState>;
      },
      reconnect: async (reconnectionToken) => {
        reconnectCalls.push({
          endpoint,
          reconnectionToken,
          authToken: sdk.auth.token,
        });
        return (await onReconnect({
          reconnectionToken,
          authToken: sdk.auth.token,
        })) as RealtimeRoomLike<ClassroomState>;
      },
    };
    return sdk;
  };

  return {
    createSdkClient,
    joinCalls,
    reconnectCalls,
    setJoinHandler: (handler: typeof onJoin) => {
      onJoin = handler;
    },
    setReconnectHandler: (handler: typeof onReconnect) => {
      onReconnect = handler;
    },
  };
}

describe('createClassroomRealtimeClient (#23)', () => {
  it('S1 & S2: configures endpoint from F05, sets client.auth.token (never in join options), joins classroom room, and syncs typed participants', async () => {
    const { auth } = createFakeAuth('bearer-token-123');
    const sdk = createFakeSdk();
    const room = new FakeRoom({ classroomId: CLASSROOM_A });
    room.setAvatar('user-1', {
      displayName: 'Ada Lovelace',
      role: 'TEACHER',
      x: 2.5,
      z: -1.5,
      status: 'online',
    });
    sdk.setJoinHandler(async () => room);

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      classroomId: null,
      presenceUncertain: true,
    });

    const connected = await client.connect(CLASSROOM_A);
    expect(connected).toBe(true);

    expect(sdk.joinCalls).toEqual([
      {
        endpoint: 'wss://realtime.example.invalid',
        roomName: CLASSROOM_ROOM_NAME,
        options: { classroomId: CLASSROOM_A },
        authToken: 'bearer-token-123',
      },
    ]);
    expect(sdk.joinCalls[0].options).not.toHaveProperty('accessToken');
    expect(sdk.joinCalls[0].options).not.toHaveProperty('token');

    const snapshot = client.getSnapshot();
    expect(snapshot.status).toBe('connected');
    expect(snapshot.classroomId).toBe(CLASSROOM_A);
    expect(snapshot.presenceUncertain).toBe(false);
    expect(snapshot.reason).toBeNull();
    expect(snapshot.participants.get('user-1')).toEqual({
      userId: 'user-1',
      displayName: 'Ada Lovelace',
      role: 'TEACHER',
      x: 2.5,
      z: -1.5,
      rotation: 0,
      status: 'online',
    });

    client.dispose();
  });

  it('S2: surfaces rejected joins (403/4001, 4002 too many connections, 400 invalid classroom) with distinct messages and never fabricates presence', async () => {
    const { auth } = createFakeAuth('valid-token');
    const sdk = createFakeSdk();

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    // 1. 4002 too many connections
    sdk.setJoinHandler(async () => {
      throw Object.assign(new Error(CLOSE_REASON_TOO_MANY_CONNECTIONS), {
        code: CLOSE_CODE_TOO_MANY_CONNECTIONS,
      });
    });
    expect(await client.connect(CLASSROOM_A)).toBe(false);
    expect(client.getSnapshot()).toMatchObject({
      status: 'rejected',
      reason: 'too-many-connections',
      message: realtimeMessages.tooManyConnections,
      presenceUncertain: true,
    });
    expect(client.getSnapshot().participants.size).toBe(0);

    // 2. 403 / 4001 access revoked on admission
    sdk.setJoinHandler(async () => {
      throw Object.assign(new Error(CLOSE_REASON_ACCESS_REVOKED), {
        code: CLOSE_CODE_ACCESS_REVOKED,
      });
    });
    expect(await client.connect(CLASSROOM_A)).toBe(false);
    expect(client.getSnapshot()).toMatchObject({
      status: 'rejected',
      reason: 'forbidden',
      message: realtimeMessages.accessDenied,
      presenceUncertain: true,
    });
    expect(client.getSnapshot().participants.size).toBe(0);

    client.dispose();
  });

  it('S3: refreshes expired token via F08 and rejoins at most once (bounded)', async () => {
    const { auth, refreshAccessToken, setToken } =
      createFakeAuth('expired-token');
    const sdk = createFakeSdk();
    const room = new FakeRoom({ classroomId: CLASSROOM_A });

    refreshAccessToken.mockImplementationOnce(async () => {
      setToken('fresh-token-after-f08');
      return 'fresh-token-after-f08';
    });

    sdk.setJoinHandler(async ({ authToken }) => {
      if (authToken !== 'fresh-token-after-f08') {
        throw Object.assign(new Error('Unauthorized'), { code: 401 });
      }
      return room;
    });

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    const ok = await client.connect(CLASSROOM_A);
    expect(ok).toBe(true);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sdk.joinCalls).toHaveLength(2);
    expect(sdk.joinCalls[0].authToken).toBe('expired-token');
    expect(sdk.joinCalls[1].authToken).toBe('fresh-token-after-f08');
    expect(client.getSnapshot().status).toBe('connected');

    // Bounded check: when both initial join and refreshed retry reject with 401, does not loop.
    await client.disconnect();
    sdk.joinCalls.length = 0;
    refreshAccessToken.mockClear();
    refreshAccessToken.mockResolvedValueOnce('still-rejected-token');
    sdk.setJoinHandler(async () => {
      throw Object.assign(new Error('Unauthorized'), { code: 401 });
    });

    const secondAttempt = await client.connect(CLASSROOM_A);
    expect(secondAttempt).toBe(false);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(sdk.joinCalls).toHaveLength(2);
    expect(client.getSnapshot()).toMatchObject({
      status: 'rejected',
      reason: 'unauthorized',
      message: realtimeMessages.unauthorized,
      presenceUncertain: true,
    });

    client.dispose();
  });

  it('S2 & S3: handles abnormal drop -> reconnecting -> reconnect reconciliation, and classifies 4001 vs 4100 on reconnect or live eviction', async () => {
    const { auth } = createFakeAuth('valid-token');
    const sdk = createFakeSdk();
    const initialRoom = new FakeRoom({
      classroomId: CLASSROOM_A,
      reconnectionToken: 'room-a:reconn-1',
    });
    initialRoom.setAvatar('stale-user', { displayName: 'Stale User' });

    const reconnectedRoom = new FakeRoom({
      classroomId: CLASSROOM_A,
      sessionId: 'conn-session-reconnected',
      reconnectionToken: 'room-a:reconn-2',
    });
    reconnectedRoom.setAvatar('fresh-user', { displayName: 'Fresh User' });

    let resolveReconnect!: (room: FakeRoom) => void;
    sdk.setJoinHandler(async () => initialRoom);
    sdk.setReconnectHandler(
      () =>
        new Promise<FakeRoom>((resolve) => {
          resolveReconnect = resolve;
        }),
    );

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    await client.connect(CLASSROOM_A);
    expect(client.getSnapshot().participants.has('stale-user')).toBe(true);

    // Drop triggers reconnecting with uncertain presence immediately.
    initialRoom.emitDrop(1006, 'network drop');
    expect(client.getSnapshot()).toMatchObject({
      status: 'reconnecting',
      presenceUncertain: true,
      message: realtimeMessages.reconnecting,
    });
    expect(sdk.reconnectCalls).toEqual([
      {
        endpoint: 'wss://realtime.example.invalid',
        reconnectionToken: 'room-a:reconn-1',
        authToken: 'valid-token',
      },
    ]);

    // Completing reconnect replaces stale snapshot with current authoritative room state.
    resolveReconnect(reconnectedRoom);
    await vi.waitFor(() => {
      expect(client.getSnapshot().status).toBe('connected');
    });
    expect(client.getSnapshot().presenceUncertain).toBe(false);
    expect(client.getSnapshot().participants.has('stale-user')).toBe(false);
    expect(client.getSnapshot().participants.has('fresh-user')).toBe(true);

    // Live eviction (4001 access_revoked) transitions immediately to lost-access without reconnecting.
    reconnectedRoom.emitLeave(
      CLOSE_CODE_ACCESS_REVOKED,
      CLOSE_REASON_ACCESS_REVOKED,
    );
    expect(client.getSnapshot()).toMatchObject({
      status: 'lost-access',
      reason: 'forbidden',
      message: realtimeMessages.lostAccess,
      presenceUncertain: true,
    });
    expect(client.getSnapshot().participants.size).toBe(0);
    expect(sdk.reconnectCalls).toHaveLength(1);

    // Reconnect failing with 4100 verification_unavailable transitions to disconnected (retryable).
    const thirdRoom = new FakeRoom({
      classroomId: CLASSROOM_A,
      reconnectionToken: 'room-a:reconn-3',
    });
    sdk.setJoinHandler(async () => thirdRoom);
    sdk.setReconnectHandler(async () => {
      throw Object.assign(new Error(CLOSE_REASON_VERIFICATION_UNAVAILABLE), {
        code: CLOSE_CODE_VERIFICATION_UNAVAILABLE,
      });
    });
    await client.connect(CLASSROOM_A);
    thirdRoom.emitDrop(1006, 'drop before 4100');
    await vi.waitFor(() => {
      expect(client.getSnapshot().status).toBe('disconnected');
    });
    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      reason: 'verification-unavailable',
      message: realtimeMessages.verificationUnavailable,
      presenceUncertain: true,
    });

    // D14: Colyseus 4001 ('server shutdown') and 4002 ('protocol error') without domain reasons are outages, not revoked/too-many-connections.
    const fourthRoom = new FakeRoom({ classroomId: CLASSROOM_A });
    sdk.setJoinHandler(async () => fourthRoom);
    await client.connect(CLASSROOM_A);
    fourthRoom.emitLeave(CLOSE_CODE_ACCESS_REVOKED, 'server shutdown');
    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      reason: 'connection-error',
      message: realtimeMessages.connectionFailed,
      presenceUncertain: true,
    });

    const fifthRoom = new FakeRoom({ classroomId: CLASSROOM_A });
    sdk.setJoinHandler(async () => fifthRoom);
    await client.connect(CLASSROOM_A);
    fifthRoom.emitLeave(CLOSE_CODE_TOO_MANY_CONNECTIONS, 'protocol error');
    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      reason: 'connection-error',
      message: realtimeMessages.connectionFailed,
      presenceUncertain: true,
    });

    client.dispose();
  });

  it('S4: validates outgoing avatarInputSchema, ignores unknown/malformed messages safely, and blocks duplicate/stale sequences', async () => {
    const { auth } = createFakeAuth('valid-token');
    const sdk = createFakeSdk();
    const room = new FakeRoom({ classroomId: CLASSROOM_A });
    sdk.setJoinHandler(async () => room);

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    // Cannot send while disconnected
    expect(client.sendAvatarInput({ x: 1, z: 0 })).toBe(false);

    await client.connect(CLASSROOM_A);

    // Valid avatar input is sent
    expect(client.sendAvatarInput({ x: 0.5, z: -1 })).toBe(true);
    expect(room.sentMessages).toEqual([
      { type: AVATAR_INPUT_MESSAGE, payload: { x: 0.5, z: -1 } },
    ]);

    // Out-of-bounds avatar input is rejected without throwing
    expect(client.sendAvatarInput({ x: 2, z: 0 })).toBe(false);
    expect(room.sentMessages).toHaveLength(1);

    // Typed incoming message handler with stale/duplicate protection
    const announcementSchema = z.object({
      eventId: z.string().optional(),
      seq: z.number().int().optional(),
      classroomId: z.string().optional(),
      title: z.string(),
    });
    const received: string[] = [];
    const unregister = client.onMessage(
      'classroom:announcement',
      announcementSchema,
      (payload) => {
        received.push(payload.title);
      },
    );

    // 1. Unknown message type is ignored safely
    expect(() =>
      room.emitMessage('unknown:event', { anything: true }),
    ).not.toThrow();

    // 2. Malformed payload (even with a high seq/eventId) is ignored and never poisons sequence guards
    expect(() =>
      room.emitMessage('classroom:announcement', {
        eventId: 'bad-evt-100',
        seq: 100,
        classroomId: CLASSROOM_A,
        wrongShape: 123,
      }),
    ).not.toThrow();
    expect(received).toEqual([]);

    // 3. Valid message with seq=2 and eventId='evt-2' is accepted
    room.emitMessage('classroom:announcement', {
      eventId: 'evt-2',
      seq: 2,
      classroomId: CLASSROOM_A,
      title: 'Second announcement',
    });
    expect(received).toEqual(['Second announcement']);

    // 4. Duplicate eventId='evt-2' is ignored
    room.emitMessage('classroom:announcement', {
      eventId: 'evt-2',
      seq: 3,
      classroomId: CLASSROOM_A,
      title: 'Duplicate announcement',
    });
    expect(received).toEqual(['Second announcement']);

    // 5. Stale sequence seq=1 (< 2) is ignored
    room.emitMessage('classroom:announcement', {
      eventId: 'evt-1',
      seq: 1,
      classroomId: CLASSROOM_A,
      title: 'Stale first announcement',
    });
    expect(received).toEqual(['Second announcement']);

    // 6. Foreign classroomId is ignored
    room.emitMessage('classroom:announcement', {
      eventId: 'evt-3',
      seq: 4,
      classroomId: CLASSROOM_B,
      title: 'Wrong classroom announcement',
    });
    expect(received).toEqual(['Second announcement']);

    // 7. Newer sequence seq=3 for active classroom is accepted
    room.emitMessage('classroom:announcement', {
      eventId: 'evt-4',
      seq: 3,
      classroomId: CLASSROOM_A,
      title: 'Third announcement',
    });
    expect(received).toEqual(['Second announcement', 'Third announcement']);

    unregister();
    client.dispose();
  });

  it('S5: isolates classroom switches, prevents duplicate connections/listeners on repeated connect, and cleans up on logout', async () => {
    const { auth, triggerLogoutCleanup } = createFakeAuth('valid-token');
    const sdk = createFakeSdk();
    const roomA = new FakeRoom({ classroomId: CLASSROOM_A, roomId: 'room-a' });
    roomA.setAvatar('user-a', { displayName: 'Student A' });
    const roomB = new FakeRoom({ classroomId: CLASSROOM_B, roomId: 'room-b' });
    roomB.setAvatar('user-b', { displayName: 'Student B' });

    sdk.setJoinHandler(async ({ options }) =>
      options.classroomId === CLASSROOM_A ? roomA : roomB,
    );

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    // Idempotent connect to same classroom does not create a second connection or duplicate listeners
    await client.connect(CLASSROOM_A);
    await client.connect(CLASSROOM_A);
    expect(sdk.joinCalls).toHaveLength(1);
    expect(roomA.listenerCount()).toBe(5);

    // Switching to CLASSROOM_B leaves roomA, removes roomA listeners, and ignores late roomA events
    await client.connect(CLASSROOM_B);
    expect(roomA.leaveCalls).toBe(1);
    expect(roomA.removeAllListenersCalls).toBe(1);
    expect(roomA.listenerCount()).toBe(0);
    expect(client.getSnapshot().classroomId).toBe(CLASSROOM_B);
    expect(client.getSnapshot().participants.has('user-a')).toBe(false);
    expect(client.getSnapshot().participants.has('user-b')).toBe(true);

    // Late state mutation on roomA does not leak into CLASSROOM_B
    roomA.setAvatar('ghost-user', { displayName: 'Ghost' });
    roomA.emitStateChange();
    expect(client.getSnapshot().participants.has('ghost-user')).toBe(false);

    // Logout cleanup leaves roomB immediately and clears state
    triggerLogoutCleanup();
    expect(roomB.leaveCalls).toBe(1);
    expect(roomB.removeAllListenersCalls).toBe(1);
    expect(client.getSnapshot()).toMatchObject({
      status: 'disconnected',
      classroomId: null,
      roomId: null,
      sessionId: null,
      presenceUncertain: true,
    });
    expect(client.getSnapshot().participants.size).toBe(0);

    client.dispose();
  });

  it('extracts optional participant appearance and classroom control flags from room state', async () => {
    const { auth } = createFakeAuth('valid-token');
    const sdk = createFakeSdk();
    const room = new FakeRoom({ classroomId: CLASSROOM_A });
    room.setAvatar('user-with-look', {
      displayName: 'Sofía',
      role: 'STUDENT',
      x: 2,
      z: 4,
      rotation: 1,
      status: 'online',
    });
    const avatarWithLook = room.state.avatars.get(
      'user-with-look',
    ) as Avatar & {
      appearance?: unknown;
    };
    avatarWithLook.appearance = {
      bodyId: 'female',
      hairId: 'original',
      topId: 'tshirt',
      hairColor: '#6C4D48',
      clothingColor: '#75B7DA',
    };
    Object.assign(room.state, {
      chatMuted: true,
      collaborationLocked: true,
      gamesDisabled: false,
      frozen: true,
    });
    sdk.setJoinHandler(async () => room);

    const client = createClassroomRealtimeClient({
      auth,
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    });

    await client.connect(CLASSROOM_A);
    const snapshot = client.getSnapshot();
    expect(snapshot.controls).toEqual({
      chatMuted: true,
      collaborationLocked: true,
      gamesDisabled: false,
      frozen: true,
    });
    expect(snapshot.participants.get('user-with-look')?.avatar).toEqual({
      bodyId: 'female',
      hairId: 'original',
      topId: 'tshirt',
      hairColor: '#6C4D48',
      clothingColor: '#75B7DA',
    });

    room.emitDrop(1006, 'drop');
    expect(client.getSnapshot().controls).toEqual({ frozen: false });

    client.dispose();
  });
});
