import { Client } from '@colyseus/sdk';
import { z } from 'zod';
import { getPublicConfig } from '../config/public-config';
import {
  AVATAR_EMOTE_MESSAGE,
  AVATAR_EMOTES,
  avatarEmoteSchema,
  AVATAR_INPUT_MESSAGE,
  avatarInputSchema,
  CLASSROOM_ROOM_NAME,
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_CODE_TOO_MANY_CONNECTIONS,
  CLOSE_CODE_VERIFICATION_UNAVAILABLE,
  CLOSE_REASON_ACCESS_REVOKED,
  CLOSE_REASON_TOO_MANY_CONNECTIONS,
  CLOSE_REASON_VERIFICATION_UNAVAILABLE,
  NPC_INTERACT_MESSAGE,
  npcInteractSchema,
  type AvatarEmote,
  type AvatarEmoted,
  type AvatarInput,
  type ClassroomJoinOptions,
} from './contracts.generated';
import { ClassroomState } from './room-state.generated';
import {
  type NpcState,
  type NpcReaction,
  type NpcView,
} from '@/features/world/npc/npc-view';

z.config({ jitless: true });

export const realtimeMessages = {
  connecting: 'Conectando con el aula en vivo...',
  connected: 'Conectado al aula en vivo.',
  reconnecting: 'Se perdió la conexión con el aula. Intentando reconectar...',
  accessDenied: 'No tenés permiso para ingresar a esta aula en vivo.',
  lostAccess: 'Tu acceso a esta aula en vivo fue revocado.',
  tooManyConnections: 'Tenés demasiadas sesiones abiertas en esta aula.',
  unauthorized:
    'Tu sesión venció o no pudo verificarse. Volvé a iniciar sesión.',
  verificationUnavailable:
    'No se pudo verificar el acceso en este momento. Podés reintentar.',
  connectionFailed: 'No se pudo conectar con el aula en vivo.',
} as const;

/** Incoming `avatar:emoted`; unlisted emotes are ignored. */
export const avatarEmotedSchema: z.ZodType<AvatarEmoted> = z.object({
  userId: z.string().min(1),
  emote: z.enum(AVATAR_EMOTES),
});

export type RealtimeConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'rejected'
  | 'lost-access'
  | 'disconnected';

export type RealtimeFailureReason =
  | 'forbidden'
  | 'unauthorized'
  | 'too-many-connections'
  | 'verification-unavailable'
  | 'invalid-classroom'
  | 'connection-error';

/** Shop item codes worn on the avatar; `null` is an empty slot. */
export interface RealtimeEquippedCodes {
  readonly head: string | null;
  readonly face: string | null;
  readonly back: string | null;
  readonly hand: string | null;
  readonly neck: string | null;
  readonly ears: string | null;
}

export interface RealtimeAvatarAppearance {
  readonly bodyId: string;
  readonly hairId: string;
  readonly topId: string;
  readonly hairColor: string;
  readonly clothingColor: string;
  /** Present only when at least one accessory slot is equipped. */
  readonly equipped?: RealtimeEquippedCodes | undefined;
  /** Shop item code of the `desk_decor` slot, present only when equipped. */
  readonly deskDecorCode?: string | undefined;
}

export interface RealtimeClassroomControls {
  readonly chatMuted?: boolean | undefined;
  readonly collaborationLocked?: boolean | undefined;
  readonly gamesDisabled?: boolean | undefined;
  readonly frozen: boolean;
}

export interface RealtimeParticipant {
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly x: number;
  readonly z: number;
  readonly rotation: number;
  readonly status: string;
  readonly avatar?: RealtimeAvatarAppearance | undefined;
}

export interface RealtimeSnapshot {
  readonly status: RealtimeConnectionStatus;
  readonly classroomId: string | null;
  readonly roomId: string | null;
  readonly sessionId: string | null;
  readonly presenceUncertain: boolean;
  readonly reason: RealtimeFailureReason | null;
  readonly message: string | null;
  readonly participants: ReadonlyMap<string, RealtimeParticipant>;
  /** Synced tutor bot skin; absent until the room reports one. */
  readonly tutorBotSkin?: string | undefined;
  /** Synced pet and tutor bot, keyed by NPC id. */
  readonly npcs: ReadonlyMap<string, NpcView>;
  readonly controls: RealtimeClassroomControls;
}

export interface RealtimeAuthPort {
  getAccessToken(): string | undefined;
  refreshAccessToken(): Promise<string | undefined>;
  registerCleanup(cleanup: () => void): () => void;
}

export interface RealtimeRoomLike<TState = ClassroomState> {
  readonly roomId: string;
  readonly sessionId: string;
  readonly reconnectionToken?: string;
  readonly reconnection?: { enabled: boolean } | undefined;
  readonly state: TState;
  onStateChange(callback: (state: TState) => void): unknown;
  onDrop?(callback: (code: number, reason?: string) => void): unknown;
  onLeave(callback: (code: number, reason?: string) => void): unknown;
  onError(callback: (code: number, message?: string) => void): unknown;
  onMessage(
    type: '*',
    callback: (type: string, message: unknown) => void,
  ): unknown;
  send(type: string, message?: unknown): void;
  leave(consented?: boolean): Promise<number>;
  removeAllListeners(): void;
}

export interface RealtimeSdkClientLike {
  auth: { token: string | undefined };
  joinOrCreate(
    roomName: string,
    options?: ClassroomJoinOptions,
  ): Promise<RealtimeRoomLike<ClassroomState>>;
  reconnect(
    reconnectionToken: string,
  ): Promise<RealtimeRoomLike<ClassroomState>>;
}

export interface CreateClassroomRealtimeClientOptions {
  readonly auth: RealtimeAuthPort;
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => RealtimeSdkClientLike;
}

export interface ClassroomRealtimeClient {
  getSnapshot(): RealtimeSnapshot;
  subscribe(listener: () => void): () => void;
  connect(classroomId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  sendAvatarInput(input: AvatarInput): boolean;
  /** Asks the server to react to this member pressing E at an NPC. */
  interactNpc(npcId: string): boolean;
  /** Asks the server to play an emote on this member's avatar. */
  sendEmote(emote: AvatarEmote): boolean;
  onMessage<T>(
    type: string,
    schema: z.ZodType<T>,
    handler: (payload: T) => void,
  ): () => void;
  dispose(): void;
}

interface RegisteredMessageHandler {
  readonly schema: z.ZodType<unknown>;
  readonly handler: (payload: unknown) => void;
}

const MAX_SEEN_EVENT_IDS = 500;
const EMPTY_PARTICIPANTS: ReadonlyMap<string, RealtimeParticipant> = new Map();
const EMPTY_NPCS: ReadonlyMap<string, NpcView> = new Map();
const NPC_STATES: readonly string[] = [
  'idle',
  'walking',
  'emote',
  'sleeping',
  'reacting',
];
const NPC_REACTIONS: readonly string[] = ['', 'greet', 'askForPets', 'phrase'];
const DEFAULT_CONTROLS: RealtimeClassroomControls = Object.freeze({
  frozen: false,
});

function disableSdkAutoReconnect<T extends RealtimeRoomLike<ClassroomState>>(
  room: T,
): T {
  if (room.reconnection) {
    room.reconnection.enabled = false;
  }
  return room;
}

function createDefaultSdkClient(endpoint: string): RealtimeSdkClientLike {
  const sdk = new Client(endpoint);
  return {
    auth: sdk.auth as { token: string | undefined },
    joinOrCreate: async (roomName: string, options?: ClassroomJoinOptions) =>
      disableSdkAutoReconnect(
        (await sdk.joinOrCreate(
          roomName,
          options,
        )) as unknown as RealtimeRoomLike<ClassroomState>,
      ),
    reconnect: async (reconnectionToken: string) =>
      disableSdkAutoReconnect(
        (await sdk.reconnect(
          reconnectionToken,
        )) as unknown as RealtimeRoomLike<ClassroomState>,
      ),
  };
}

function parseAppearanceFields(
  source: unknown,
): RealtimeAvatarAppearance | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  const candidate = source as Record<string, unknown>;
  const { bodyId, hairId, topId, hairColor, clothingColor } = candidate;
  if (
    typeof bodyId === 'string' &&
    bodyId !== '' &&
    typeof hairId === 'string' &&
    hairId !== '' &&
    typeof topId === 'string' &&
    topId !== '' &&
    typeof hairColor === 'string' &&
    hairColor !== '' &&
    typeof clothingColor === 'string' &&
    clothingColor !== ''
  ) {
    return Object.freeze({
      bodyId,
      hairId,
      topId,
      hairColor,
      clothingColor,
    });
  }
  return undefined;
}

function readParticipantAppearance(
  rawAvatar: unknown,
): RealtimeAvatarAppearance | undefined {
  if (typeof rawAvatar !== 'object' || rawAvatar === null) {
    return undefined;
  }
  const appearance = (rawAvatar as { appearance?: unknown }).appearance;
  if (typeof appearance !== 'object' || appearance === null) {
    return undefined;
  }
  const base =
    parseAppearanceFields(appearance) ??
    parseAppearanceFields((appearance as { baseAvatar?: unknown }).baseAvatar);
  if (!base) {
    return undefined;
  }
  const items = (appearance as { items?: unknown }).items;
  const equipped = parseEquippedCodes(items);
  const deskDecorCode =
    typeof items === 'object' && items !== null
      ? readItemCode(items as Record<string, unknown>, 'desk_decor')
      : null;
  if (!equipped && !deskDecorCode) {
    return base;
  }
  return Object.freeze({
    ...base,
    ...(equipped ? { equipped } : {}),
    ...(deskDecorCode ? { deskDecorCode } : {}),
  });
}

/** Reads one slot from a synced `MapSchema`/`Map` (`get`) or a plain record. */
function readSlot(items: Record<string, unknown>, slot: string): unknown {
  const getter = (items as { get?: unknown }).get;
  return typeof getter === 'function'
    ? (getter as (key: string) => unknown).call(items, slot)
    : items[slot];
}

function readItemCode(items: Record<string, unknown>, slot: string) {
  const item = readSlot(items, slot);
  if (typeof item !== 'object' || item === null) {
    return null;
  }
  const code = (item as { shopItemCode?: unknown }).shopItemCode;
  return typeof code === 'string' && code !== '' ? code : null;
}

function parseEquippedCodes(items: unknown): RealtimeEquippedCodes | undefined {
  if (typeof items !== 'object' || items === null) {
    return undefined;
  }
  const record = items as Record<string, unknown>;
  const equipped = Object.freeze({
    head: readItemCode(record, 'head'),
    face: readItemCode(record, 'face'),
    back: readItemCode(record, 'back'),
    hand: readItemCode(record, 'hand'),
    neck: readItemCode(record, 'neck'),
    ears: readItemCode(record, 'ears'),
  });
  return Object.values(equipped).some(Boolean) ? equipped : undefined;
}

function toFiniteCoordinate(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return Number.isFinite(fallback) ? fallback : 0;
}

function readParticipants(
  state: ClassroomState | undefined,
  previousParticipants?: ReadonlyMap<string, RealtimeParticipant>,
): ReadonlyMap<string, RealtimeParticipant> {
  if (!state?.avatars) {
    return EMPTY_PARTICIPANTS;
  }
  const next = new Map<string, RealtimeParticipant>();
  state.avatars.forEach((avatar, key) => {
    const userId = avatar.userId || key;
    const previous = previousParticipants?.get(userId);
    const appearance = readParticipantAppearance(avatar);
    next.set(
      userId,
      Object.freeze({
        userId,
        displayName: avatar.displayName,
        role: avatar.role,
        x: toFiniteCoordinate(avatar.x, previous?.x ?? 0),
        z: toFiniteCoordinate(avatar.z, previous?.z ?? 0),
        rotation: toFiniteCoordinate(avatar.rotation, previous?.rotation ?? 0),
        status: avatar.status,
        ...(appearance ? { avatar: appearance } : {}),
      }),
    );
  });
  return next;
}

function readTutorBotSkin(
  state: ClassroomState | undefined,
): string | undefined {
  const skin: unknown = state?.tutorBotSkin;
  return typeof skin === 'string' && skin !== '' ? skin : undefined;
}

function readNpcs(
  state: ClassroomState | undefined,
  previousNpcs?: ReadonlyMap<string, NpcView>,
): ReadonlyMap<string, NpcView> {
  if (!state?.npcs) {
    return EMPTY_NPCS;
  }
  const next = new Map<string, NpcView>();
  state.npcs.forEach((npc, key) => {
    const id = npc.id || key;
    const previous = previousNpcs?.get(id);
    next.set(
      id,
      Object.freeze({
        id,
        x: toFiniteCoordinate(npc.x, previous?.x ?? 0),
        z: toFiniteCoordinate(npc.z, previous?.z ?? 0),
        rotation: toFiniteCoordinate(npc.rotation, previous?.rotation ?? 0),
        state: (NPC_STATES.includes(npc.state)
          ? npc.state
          : 'idle') as NpcState,
        emote: npc.emote ?? '',
        reaction: (NPC_REACTIONS.includes(npc.reaction)
          ? npc.reaction
          : '') as NpcReaction,
        phraseId: Number.isInteger(npc.phraseId) ? npc.phraseId : -1,
        reactionSeq: Number.isFinite(npc.reactionSeq) ? npc.reactionSeq : 0,
        reactingSessionId: npc.reactingSessionId ?? '',
      }),
    );
  });
  return next;
}

function readControls(
  state: ClassroomState | undefined,
): RealtimeClassroomControls {
  if (!state || typeof state !== 'object') {
    return DEFAULT_CONTROLS;
  }
  const record = state as unknown as Record<string, unknown>;
  const chatMuted =
    typeof record.chatMuted === 'boolean' ? record.chatMuted : undefined;
  const collaborationLocked =
    typeof record.collaborationLocked === 'boolean'
      ? record.collaborationLocked
      : undefined;
  const gamesDisabled =
    typeof record.gamesDisabled === 'boolean'
      ? record.gamesDisabled
      : undefined;
  const frozen = typeof record.frozen === 'boolean' ? record.frozen : false;
  if (
    chatMuted === undefined &&
    collaborationLocked === undefined &&
    gamesDisabled === undefined &&
    !frozen
  ) {
    return DEFAULT_CONTROLS;
  }
  return Object.freeze({
    ...(chatMuted !== undefined ? { chatMuted } : {}),
    ...(collaborationLocked !== undefined ? { collaborationLocked } : {}),
    ...(gamesDisabled !== undefined ? { gamesDisabled } : {}),
    frozen,
  });
}

function extractErrorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number' && Number.isFinite(code)) {
      return code;
    }
  }
  return undefined;
}

function extractErrorReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown; reason?: unknown };
    if (typeof candidate.message === 'string') {
      return candidate.message.toLowerCase();
    }
    if (typeof candidate.reason === 'string') {
      return candidate.reason.toLowerCase();
    }
  }
  if (typeof error === 'string') {
    return error.toLowerCase();
  }
  return '';
}

function classifyFailure(
  error: unknown,
  forLiveClose: boolean,
): {
  status: RealtimeConnectionStatus;
  reason: RealtimeFailureReason;
  message: string;
} {
  const code = extractErrorCode(error);
  const text = extractErrorReason(error);
  const hasAccessRevokedReason = text.includes(CLOSE_REASON_ACCESS_REVOKED);
  const hasTooManyReason = text.includes(CLOSE_REASON_TOO_MANY_CONNECTIONS);

  // D14: Colyseus shares 4001 (server shutdown) and 4002 (protocol error), so require the reason text.
  if (
    code === 403 ||
    (code === CLOSE_CODE_ACCESS_REVOKED && hasAccessRevokedReason) ||
    (code === undefined && hasAccessRevokedReason)
  ) {
    return {
      status: forLiveClose ? 'lost-access' : 'rejected',
      reason: 'forbidden',
      message: forLiveClose
        ? realtimeMessages.lostAccess
        : realtimeMessages.accessDenied,
    };
  }

  if (
    (code === CLOSE_CODE_TOO_MANY_CONNECTIONS && hasTooManyReason) ||
    (code === undefined && hasTooManyReason)
  ) {
    return {
      status: 'rejected',
      reason: 'too-many-connections',
      message: realtimeMessages.tooManyConnections,
    };
  }

  if (
    code === CLOSE_CODE_VERIFICATION_UNAVAILABLE ||
    text.includes(CLOSE_REASON_VERIFICATION_UNAVAILABLE)
  ) {
    return {
      status: 'disconnected',
      reason: 'verification-unavailable',
      message: realtimeMessages.verificationUnavailable,
    };
  }

  if (code === 401 || text.includes('unauthorized')) {
    return {
      status: 'rejected',
      reason: 'unauthorized',
      message: realtimeMessages.unauthorized,
    };
  }

  if (code === 400 || text.includes('bad request')) {
    return {
      status: 'rejected',
      reason: 'invalid-classroom',
      message: realtimeMessages.connectionFailed,
    };
  }

  return {
    status: 'disconnected',
    reason: 'connection-error',
    message: realtimeMessages.connectionFailed,
  };
}

function isUnauthorizedError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (
    code === CLOSE_CODE_ACCESS_REVOKED ||
    code === CLOSE_CODE_TOO_MANY_CONNECTIONS ||
    code === CLOSE_CODE_VERIFICATION_UNAVAILABLE
  ) {
    return false;
  }
  if (code === 401) {
    return true;
  }
  return extractErrorReason(error).includes('unauthorized');
}

export function createClassroomRealtimeClient(
  options: CreateClassroomRealtimeClientOptions,
): ClassroomRealtimeClient {
  const endpoint = options.realtimeUrl ?? getPublicConfig().realtimeUrl;
  const createSdk = options.createSdkClient ?? createDefaultSdkClient;
  const { auth } = options;

  let snapshot: RealtimeSnapshot = Object.freeze({
    status: 'disconnected',
    classroomId: null,
    roomId: null,
    sessionId: null,
    presenceUncertain: true,
    reason: null,
    message: null,
    participants: EMPTY_PARTICIPANTS,
    npcs: EMPTY_NPCS,
    controls: DEFAULT_CONTROLS,
  });

  const listeners = new Set<() => void>();
  const messageHandlers = new Map<string, Set<RegisteredMessageHandler>>();
  const seenEventIds: string[] = [];
  const seenEventIdSet = new Set<string>();
  const lastSeqByType = new Map<string, number>();

  let epoch = 0;
  let disposed = false;
  let activeRoom: RealtimeRoomLike<ClassroomState> | null = null;
  let reconnectingRoom: RealtimeRoomLike<ClassroomState> | null = null;
  let inFlightConnect: {
    classroomId: string;
    promise: Promise<boolean>;
  } | null = null;

  function publish(
    next: Omit<RealtimeSnapshot, 'presenceUncertain' | 'npcs'> & {
      npcs?: RealtimeSnapshot['npcs'];
    },
  ): void {
    snapshot = Object.freeze({
      npcs: EMPTY_NPCS,
      ...next,
      presenceUncertain: next.status !== 'connected',
    });
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        /* Subscriber errors must not interrupt realtime lifecycle cleanup. */
      }
    }
  }

  function resetMessageGuards(): void {
    seenEventIds.length = 0;
    seenEventIdSet.clear();
    lastSeqByType.clear();
  }

  function detachRoom(
    room: RealtimeRoomLike<ClassroomState> | null,
    leaveRoom: boolean,
  ): void {
    if (!room) {
      return;
    }
    try {
      room.removeAllListeners();
    } catch {
      /* Ignore teardown errors from already-closed rooms. */
    }
    if (leaveRoom) {
      void Promise.resolve(room.leave(true)).catch(() => undefined);
    }
    if (activeRoom === room) {
      activeRoom = null;
    }
    if (reconnectingRoom === room) {
      reconnectingRoom = null;
    }
  }

  function isEventFresh(type: string, payload: unknown): boolean {
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      if (
        typeof record.classroomId === 'string' &&
        record.classroomId !== snapshot.classroomId
      ) {
        return false;
      }
      if (
        typeof record.eventId === 'string' &&
        record.eventId !== '' &&
        seenEventIdSet.has(record.eventId)
      ) {
        return false;
      }
      if (typeof record.seq === 'number' && Number.isInteger(record.seq)) {
        const previous = lastSeqByType.get(type);
        if (previous !== undefined && record.seq <= previous) {
          return false;
        }
      }
    }
    return true;
  }

  function commitEventGuards(type: string, payload: unknown): void {
    if (typeof payload !== 'object' || payload === null) {
      return;
    }
    const record = payload as Record<string, unknown>;
    if (
      typeof record.eventId === 'string' &&
      record.eventId !== '' &&
      !seenEventIdSet.has(record.eventId)
    ) {
      seenEventIdSet.add(record.eventId);
      seenEventIds.push(record.eventId);
      if (seenEventIds.length > MAX_SEEN_EVENT_IDS) {
        const evicted = seenEventIds.shift();
        if (evicted !== undefined) {
          seenEventIdSet.delete(evicted);
        }
      }
    }
    if (typeof record.seq === 'number' && Number.isInteger(record.seq)) {
      const previous = lastSeqByType.get(type);
      if (previous === undefined || record.seq > previous) {
        lastSeqByType.set(type, record.seq);
      }
    }
  }

  function attachRoom(
    room: RealtimeRoomLike<ClassroomState>,
    classroomId: string,
    roomEpoch: number,
  ): void {
    disableSdkAutoReconnect(room);
    activeRoom = room;
    publish({
      status: 'connected',
      classroomId,
      roomId: room.roomId,
      sessionId: room.sessionId,
      reason: null,
      message: null,
      participants: readParticipants(room.state),
      npcs: readNpcs(room.state),
      tutorBotSkin: readTutorBotSkin(room.state),
      controls: readControls(room.state),
    });

    room.onStateChange((state) => {
      if (disposed || roomEpoch !== epoch || activeRoom !== room) {
        return;
      }
      publish({
        status: snapshot.status,
        classroomId,
        roomId: room.roomId,
        sessionId: room.sessionId,
        reason: snapshot.reason,
        message: snapshot.message,
        participants: readParticipants(state, snapshot.participants),
        npcs: readNpcs(state, snapshot.npcs),
        tutorBotSkin: readTutorBotSkin(state),
        controls: readControls(state),
      });
    });

    room.onMessage('*', (type, payload) => {
      if (disposed || roomEpoch !== epoch || activeRoom !== room) {
        return;
      }
      const handlers = messageHandlers.get(type);
      if (!handlers || handlers.size === 0) {
        return;
      }
      if (!isEventFresh(type, payload)) {
        return;
      }
      let accepted = false;
      for (const entry of [...handlers]) {
        const parsed = entry.schema.safeParse(payload);
        if (parsed.success) {
          accepted = true;
          entry.handler(parsed.data);
        }
      }
      if (accepted) {
        commitEventGuards(type, payload);
      }
    });

    room.onDrop?.(() => {
      if (
        disposed ||
        roomEpoch !== epoch ||
        activeRoom !== room ||
        reconnectingRoom === room
      ) {
        return;
      }
      const reconnectionToken = room.reconnectionToken;
      publish({
        status: 'reconnecting',
        classroomId,
        roomId: room.roomId,
        sessionId: room.sessionId,
        reason: null,
        message: realtimeMessages.reconnecting,
        participants: snapshot.participants,
        npcs: snapshot.npcs,
        tutorBotSkin: snapshot.tutorBotSkin,
        controls: DEFAULT_CONTROLS,
      });

      if (!reconnectionToken) {
        detachRoom(room, false);
        publish({
          status: 'disconnected',
          classroomId,
          roomId: null,
          sessionId: null,
          reason: 'connection-error',
          message: realtimeMessages.connectionFailed,
          participants: EMPTY_PARTICIPANTS,
          controls: DEFAULT_CONTROLS,
        });
        return;
      }

      reconnectingRoom = room;

      const reconnectWithToken = async (
        token: string | undefined,
      ): Promise<RealtimeRoomLike<ClassroomState>> => {
        const sdk = createSdk(endpoint);
        sdk.auth.token = token;
        return sdk.reconnect(reconnectionToken);
      };

      const attemptReconnect = async (): Promise<void> => {
        try {
          let reconnectedRoom: RealtimeRoomLike<ClassroomState>;
          try {
            reconnectedRoom = await reconnectWithToken(auth.getAccessToken());
          } catch (firstError) {
            if (disposed || roomEpoch !== epoch || activeRoom !== room) {
              return;
            }
            if (!isUnauthorizedError(firstError)) {
              throw firstError;
            }
            const refreshedToken = await auth.refreshAccessToken();
            if (disposed || roomEpoch !== epoch || activeRoom !== room) {
              return;
            }
            if (!refreshedToken) {
              throw firstError;
            }
            reconnectedRoom = await reconnectWithToken(refreshedToken);
          }

          if (disposed || roomEpoch !== epoch || activeRoom !== room) {
            detachRoom(reconnectedRoom, true);
            return;
          }
          reconnectingRoom = null;
          detachRoom(room, false);
          attachRoom(reconnectedRoom, classroomId, roomEpoch);
        } catch (error: unknown) {
          if (disposed || roomEpoch !== epoch || activeRoom !== room) {
            return;
          }
          reconnectingRoom = null;
          detachRoom(room, false);
          const failure = classifyFailure(error, true);
          publish({
            status: failure.status,
            classroomId,
            roomId: null,
            sessionId: null,
            reason: failure.reason,
            message: failure.message,
            participants: EMPTY_PARTICIPANTS,
            controls: DEFAULT_CONTROLS,
          });
        }
      };

      void attemptReconnect();
    });

    room.onLeave((code, reason) => {
      if (
        disposed ||
        roomEpoch !== epoch ||
        activeRoom !== room ||
        reconnectingRoom === room
      ) {
        return;
      }
      detachRoom(room, false);
      if (code === 1000) {
        publish({
          status: 'disconnected',
          classroomId: null,
          roomId: null,
          sessionId: null,
          reason: null,
          message: null,
          participants: EMPTY_PARTICIPANTS,
          controls: DEFAULT_CONTROLS,
        });
        return;
      }
      const failure = classifyFailure({ code, message: reason }, true);
      publish({
        status: failure.status,
        classroomId,
        roomId: null,
        sessionId: null,
        reason: failure.reason,
        message: failure.message,
        participants: EMPTY_PARTICIPANTS,
        controls: DEFAULT_CONTROLS,
      });
    });

    room.onError((code, message) => {
      if (disposed || roomEpoch !== epoch || activeRoom !== room) {
        return;
      }
      const failure = classifyFailure({ code, message }, true);
      if (failure.status === 'lost-access' || failure.status === 'rejected') {
        detachRoom(room, true);
        publish({
          status: failure.status,
          classroomId,
          roomId: null,
          sessionId: null,
          reason: failure.reason,
          message: failure.message,
          participants: EMPTY_PARTICIPANTS,
          controls: DEFAULT_CONTROLS,
        });
      }
    });
  }

  async function disconnect(): Promise<void> {
    epoch += 1;
    inFlightConnect = null;
    resetMessageGuards();
    const current = activeRoom;
    activeRoom = null;
    reconnectingRoom = null;
    detachRoom(current, true);
    publish({
      status: 'disconnected',
      classroomId: null,
      roomId: null,
      sessionId: null,
      reason: null,
      message: null,
      participants: EMPTY_PARTICIPANTS,
      controls: DEFAULT_CONTROLS,
    });
  }

  async function connect(rawClassroomId: string): Promise<boolean> {
    if (disposed) {
      return false;
    }
    const classroomId = rawClassroomId.trim();
    if (classroomId === '') {
      publish({
        status: 'rejected',
        classroomId: null,
        roomId: null,
        sessionId: null,
        reason: 'invalid-classroom',
        message: realtimeMessages.connectionFailed,
        participants: EMPTY_PARTICIPANTS,
        controls: DEFAULT_CONTROLS,
      });
      return false;
    }

    if (
      snapshot.classroomId === classroomId &&
      snapshot.status === 'connected' &&
      activeRoom !== null
    ) {
      return true;
    }

    if (inFlightConnect?.classroomId === classroomId) {
      return inFlightConnect.promise;
    }

    epoch += 1;
    const connectEpoch = epoch;
    resetMessageGuards();
    const previousRoom = activeRoom;
    activeRoom = null;
    reconnectingRoom = null;
    detachRoom(previousRoom, true);

    publish({
      status: 'connecting',
      classroomId,
      roomId: null,
      sessionId: null,
      reason: null,
      message: realtimeMessages.connecting,
      participants: EMPTY_PARTICIPANTS,
      controls: DEFAULT_CONTROLS,
    });

    const attemptConnect = async (): Promise<boolean> => {
      const initialToken = auth.getAccessToken();
      if (!initialToken) {
        if (!disposed && connectEpoch === epoch) {
          publish({
            status: 'rejected',
            classroomId,
            roomId: null,
            sessionId: null,
            reason: 'unauthorized',
            message: realtimeMessages.unauthorized,
            participants: EMPTY_PARTICIPANTS,
            controls: DEFAULT_CONTROLS,
          });
        }
        return false;
      }

      const joinWithToken = async (
        token: string,
      ): Promise<RealtimeRoomLike<ClassroomState>> => {
        const sdk = createSdk(endpoint);
        // FD3: send bearer token only through client.auth.token; options carry classroomId only.
        sdk.auth.token = token;
        return sdk.joinOrCreate(CLASSROOM_ROOM_NAME, { classroomId });
      };

      try {
        let joinedRoom: RealtimeRoomLike<ClassroomState>;
        try {
          joinedRoom = await joinWithToken(initialToken);
        } catch (firstError) {
          if (disposed || connectEpoch !== epoch) {
            return false;
          }
          if (!isUnauthorizedError(firstError)) {
            throw firstError;
          }
          const refreshedToken = await auth.refreshAccessToken();
          if (disposed || connectEpoch !== epoch) {
            return false;
          }
          if (!refreshedToken) {
            throw firstError;
          }
          joinedRoom = await joinWithToken(refreshedToken);
        }

        if (disposed || connectEpoch !== epoch) {
          detachRoom(joinedRoom, true);
          return false;
        }

        attachRoom(joinedRoom, classroomId, connectEpoch);
        return true;
      } catch (error) {
        if (disposed || connectEpoch !== epoch) {
          return false;
        }
        const failure = classifyFailure(error, false);
        publish({
          status: failure.status,
          classroomId,
          roomId: null,
          sessionId: null,
          reason: failure.reason,
          message: failure.message,
          participants: EMPTY_PARTICIPANTS,
          controls: DEFAULT_CONTROLS,
        });
        return false;
      } finally {
        if (inFlightConnect?.promise === connectPromise) {
          inFlightConnect = null;
        }
      }
    };

    const connectPromise = attemptConnect();
    inFlightConnect = { classroomId, promise: connectPromise };
    return connectPromise;
  }

  const unregisterCleanup = auth.registerCleanup(() => {
    void disconnect();
  });

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect,
    disconnect,
    sendAvatarInput(input) {
      if (disposed || snapshot.status !== 'connected' || !activeRoom) {
        return false;
      }
      const parsed = avatarInputSchema.safeParse(input);
      if (!parsed.success) {
        return false;
      }
      activeRoom.send(AVATAR_INPUT_MESSAGE, parsed.data);
      return true;
    },
    interactNpc(npcId) {
      if (disposed || snapshot.status !== 'connected' || !activeRoom) {
        return false;
      }
      const parsed = npcInteractSchema.safeParse({ npcId });
      if (!parsed.success) {
        return false;
      }
      activeRoom.send(NPC_INTERACT_MESSAGE, parsed.data);
      return true;
    },
    sendEmote(emote) {
      if (disposed || snapshot.status !== 'connected' || !activeRoom) {
        return false;
      }
      // An unlisted payload would close the connection (4002).
      const parsed = avatarEmoteSchema.safeParse({ emote });
      if (!parsed.success) {
        return false;
      }
      activeRoom.send(AVATAR_EMOTE_MESSAGE, parsed.data);
      return true;
    },
    onMessage(type, schema, handler) {
      let bucket = messageHandlers.get(type);
      if (!bucket) {
        bucket = new Set();
        messageHandlers.set(type, bucket);
      }
      const entry: RegisteredMessageHandler = {
        schema: schema as z.ZodType<unknown>,
        handler: handler as (payload: unknown) => void,
      };
      bucket.add(entry);
      return () => {
        bucket.delete(entry);
        if (bucket.size === 0) {
          messageHandlers.delete(type);
        }
      };
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      unregisterCleanup();
      epoch += 1;
      inFlightConnect = null;
      resetMessageGuards();
      const current = activeRoom;
      activeRoom = null;
      reconnectingRoom = null;
      detachRoom(current, true);
      listeners.clear();
      messageHandlers.clear();
    },
  };
}
