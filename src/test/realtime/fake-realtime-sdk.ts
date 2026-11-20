import { MapSchema } from '@colyseus/schema';
import { vi } from 'vitest';
import type {
  RealtimeAuthPort,
  RealtimeRoomLike,
  RealtimeSdkClientLike,
} from '@/realtime/client';
import { Avatar } from '@/realtime/avatar.generated';
import { ClassroomState } from '@/realtime/room-state.generated';

type MessageListener = (type: string, payload: unknown) => void;

/**
 * Colyseus room double at the SDK boundary: tests push server messages with
 * `emitMessage` and simulate network loss with `emitDrop`.
 */
export class FakeRealtimeRoom implements RealtimeRoomLike<ClassroomState> {
  readonly roomId: string;
  readonly sessionId: string;
  readonly reconnectionToken: string;
  readonly state: ClassroomState;
  readonly leave = vi.fn(async () => 1000);
  readonly send = vi.fn();
  private readonly dropListeners = new Set<(code: number) => void>();
  private readonly messageListeners = new Set<MessageListener>();

  constructor(
    readonly classroomId: string,
    ordinal: number,
  ) {
    this.roomId = `room-${classroomId.slice(0, 4)}-${ordinal}`;
    this.sessionId = `session-${ordinal}`;
    this.reconnectionToken = `${this.roomId}:token`;
    this.state = new ClassroomState();
    this.state.classroomId = classroomId;
    this.state.avatars = new MapSchema<Avatar>();
  }

  onStateChange(): void {}
  onDrop(callback: (code: number) => void): void {
    this.dropListeners.add(callback);
  }
  onLeave(): void {}
  onError(): void {}
  onMessage(_type: '*', callback: MessageListener): void {
    this.messageListeners.add(callback);
  }
  removeAllListeners(): void {
    this.dropListeners.clear();
    this.messageListeners.clear();
  }

  emitMessage(type: string, payload: unknown): void {
    for (const listener of [...this.messageListeners]) {
      listener(type, payload);
    }
  }

  emitDrop(): void {
    for (const listener of [...this.dropListeners]) {
      listener(1006);
    }
  }
}

/** Fake SDK factory: records every join so tests can assert connection counts. */
export function createFakeRealtimeSdk() {
  const rooms: FakeRealtimeRoom[] = [];
  const joinedClassrooms: string[] = [];
  let failNextJoin: Error | null = null;

  const createSdkClient = (): RealtimeSdkClientLike => ({
    auth: { token: undefined },
    joinOrCreate: async (_name, options) => {
      if (failNextJoin) {
        const error = failNextJoin;
        failNextJoin = null;
        throw error;
      }
      const classroomId = options?.classroomId ?? '';
      joinedClassrooms.push(classroomId);
      const room = new FakeRealtimeRoom(classroomId, rooms.length + 1);
      rooms.push(room);
      return room;
    },
    reconnect: async (token) => {
      const previous = rooms.find((room) => room.reconnectionToken === token);
      const room = new FakeRealtimeRoom(
        previous?.classroomId ?? '',
        rooms.length + 1,
      );
      rooms.push(room);
      return room;
    },
  });

  return {
    createSdkClient,
    rooms,
    joinedClassrooms,
    failNextJoinWith(error: Error) {
      failNextJoin = error;
    },
    /** Latest room opened for a classroom. */
    roomFor(classroomId: string): FakeRealtimeRoom | undefined {
      return rooms.filter((room) => room.classroomId === classroomId).at(-1);
    },
  };
}

export function createFakeRealtimeAuth(): RealtimeAuthPort {
  return {
    getAccessToken: () => 'test-token',
    refreshAccessToken: async () => 'test-token',
    registerCleanup: () => () => {},
  };
}
