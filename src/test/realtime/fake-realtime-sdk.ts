import { MapSchema } from '@colyseus/schema';
import { vi } from 'vitest';
import type {
  RealtimeAuthPort,
  RealtimeAvatarAppearance,
  RealtimeClassroomControls,
  RealtimeRoomLike,
  RealtimeSdkClientLike,
} from '@/realtime/client';
import { Avatar } from '@/realtime/avatar.generated';
import { ClassroomState } from '@/realtime/room-state.generated';

type MessageListener = (type: string, payload: unknown) => void;
type StateListener = (state: ClassroomState) => void;
type DropListener = (code: number, reason?: string) => void;
type LeaveListener = (code: number, reason?: string) => void;
type ErrorListener = (code: number, message?: string) => void;

export type FakeAvatarAppearance =
  RealtimeAvatarAppearance | { readonly baseAvatar: RealtimeAvatarAppearance };

export interface FakeAvatarSeed {
  readonly userId: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly x?: number;
  readonly z?: number;
  readonly rotation?: number;
  readonly status?: string;
  readonly appearance?: FakeAvatarAppearance;
}

type FakeAvatarRecord = Omit<Avatar, 'appearance'> & {
  appearance?: FakeAvatarAppearance;
};
type FakeStateRecord = ClassroomState & {
  chatMuted?: boolean;
  collaborationLocked?: boolean;
  gamesDisabled?: boolean;
  frozen?: boolean;
};

const CONTROL_KEYS = [
  'chatMuted',
  'collaborationLocked',
  'gamesDisabled',
  'frozen',
] as const;

function cloneAppearance(source: FakeAvatarAppearance): FakeAvatarAppearance {
  if ('baseAvatar' in source) {
    return { baseAvatar: { ...source.baseAvatar } };
  }
  return { ...source };
}

/** Plain data bypasses the typed schema setter, mimicking legacy payload shapes. */
function setPlainAppearance(avatar: object, value: FakeAvatarAppearance): void {
  Object.defineProperty(avatar, 'appearance', {
    value,
    configurable: true,
    writable: true,
  });
}

function cloneAvatarInto(
  target: MapSchema<Avatar>,
  source: Avatar,
  key: string,
): void {
  const copy = new Avatar() as unknown as FakeAvatarRecord;
  copy.userId = source.userId;
  copy.displayName = source.displayName;
  copy.role = source.role;
  copy.x = source.x;
  copy.z = source.z;
  copy.rotation = source.rotation;
  copy.status = source.status;
  const sourceAppearance = (source as FakeAvatarRecord).appearance;
  if (sourceAppearance) {
    setPlainAppearance(copy, cloneAppearance(sourceAppearance));
  }
  target.set(key, copy as unknown as Avatar);
}

/**
 * Colyseus room double at the SDK boundary: tests push state patches, server
 * messages, drops, leaves, and errors without opening a socket.
 */
export class FakeRealtimeRoom implements RealtimeRoomLike<ClassroomState> {
  readonly roomId: string;
  readonly sessionId: string;
  readonly reconnectionToken: string;
  readonly reconnection = { enabled: true };
  readonly state: ClassroomState;
  readonly leave = vi.fn(async () => 1000);
  readonly send = vi.fn();
  private readonly stateListeners = new Set<StateListener>();
  private readonly dropListeners = new Set<DropListener>();
  private readonly leaveListeners = new Set<LeaveListener>();
  private readonly errorListeners = new Set<ErrorListener>();
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

  onStateChange(callback: StateListener): void {
    this.stateListeners.add(callback);
  }
  onDrop(callback: DropListener): void {
    this.dropListeners.add(callback);
  }
  onLeave(callback: LeaveListener): void {
    this.leaveListeners.add(callback);
  }
  onError(callback: ErrorListener): void {
    this.errorListeners.add(callback);
  }
  onMessage(_type: '*', callback: MessageListener): void {
    this.messageListeners.add(callback);
  }
  removeAllListeners(): void {
    this.stateListeners.clear();
    this.dropListeners.clear();
    this.leaveListeners.clear();
    this.errorListeners.clear();
    this.messageListeners.clear();
  }

  setAvatar(input: FakeAvatarSeed): Avatar {
    const existing = this.state.avatars.get(input.userId) as
      FakeAvatarRecord | undefined;
    const avatar = existing ?? (new Avatar() as unknown as FakeAvatarRecord);
    avatar.userId = input.userId;
    avatar.displayName =
      input.displayName ?? existing?.displayName ?? 'Estudiante';
    avatar.role = input.role ?? existing?.role ?? 'STUDENT';
    avatar.x = input.x ?? existing?.x ?? 0;
    avatar.z = input.z ?? existing?.z ?? 0;
    avatar.rotation = input.rotation ?? existing?.rotation ?? 0;
    avatar.status = input.status ?? existing?.status ?? 'online';
    if (input.appearance !== undefined) {
      setPlainAppearance(avatar, cloneAppearance(input.appearance));
    }
    this.state.avatars.set(input.userId, avatar as unknown as Avatar);
    this.emitStateChange();
    return avatar as unknown as Avatar;
  }

  removeAvatar(userId: string): void {
    this.state.avatars.delete(userId);
    this.emitStateChange();
  }

  setControls(controls: Partial<RealtimeClassroomControls>): void {
    const target = this.state as FakeStateRecord;
    for (const key of CONTROL_KEYS) {
      const value = controls[key];
      if (value !== undefined) {
        target[key] = value;
      }
    }
    this.emitStateChange();
  }

  emitStateChange(): void {
    for (const listener of [...this.stateListeners]) {
      listener(this.state);
    }
  }

  emitMessage(type: string, payload: unknown): void {
    for (const listener of [...this.messageListeners]) {
      listener(type, payload);
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

  emitError(code: number, message?: string): void {
    for (const listener of [...this.errorListeners]) {
      listener(code, message);
    }
  }
}

/** Fake SDK factory: records every join so tests can assert connection counts. */
export function createFakeRealtimeSdk() {
  const rooms: FakeRealtimeRoom[] = [];
  const joinedClassrooms: string[] = [];
  let failNextJoin: Error | null = null;
  let failNextReconnect: Error | null = null;

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
      if (failNextReconnect) {
        const error = failNextReconnect;
        failNextReconnect = null;
        throw error;
      }
      const previous = rooms.find((room) => room.reconnectionToken === token);
      const room = new FakeRealtimeRoom(
        previous?.classroomId ?? '',
        rooms.length + 1,
      );
      if (previous) {
        previous.state.avatars.forEach((avatar, key) => {
          cloneAvatarInto(room.state.avatars, avatar, key);
        });
        const prevState = previous.state as FakeStateRecord;
        const nextState = room.state as FakeStateRecord;
        for (const key of CONTROL_KEYS) {
          if (typeof prevState[key] === 'boolean') {
            nextState[key] = prevState[key];
          }
        }
      }
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
    failNextReconnectWith(error: Error) {
      failNextReconnect = error;
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
