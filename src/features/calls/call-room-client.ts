import { Client } from '@colyseus/sdk';
import { getPublicConfig } from '@/config/public-config';
import {
  CALL_EMOTE_MESSAGE,
  CALL_END_MESSAGE,
  CALL_ENDED_EVENT,
  CALL_MODERATE_MESSAGE,
  CALL_ROOM_NAME,
  CALL_SELF_MESSAGE,
  CALL_SIGNAL_MESSAGE,
  CLOSE_CODE_CALL_ENDED,
  CLOSE_CODE_CALL_FULL,
  CLOSE_CODE_CALL_REPLACED,
  callEmoteSchema,
  callEndSchema,
  callEndedPayloadSchema,
  callModerateSchema,
  callSelfSchema,
  callSignalRelaySchema,
  callSignalSchema,
  type CallEmote,
  type CallEndedReason,
  type CallJoinOptions,
  type CallModerate,
  type CallSelf,
  type CallSignalPayload,
  type CallSignalRelay,
} from '@/realtime/call-contracts.generated';
import type { CallState } from '@/realtime/call-state.generated';
import {
  isUnauthorizedError,
  type RealtimeAuthPort,
  type RealtimeRoomLike,
} from '@/realtime/client';
import {
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_CODE_VERIFICATION_UNAVAILABLE,
  CLOSE_REASON_ACCESS_REVOKED,
} from '@/realtime/contracts.generated';

export type CallEndReason =
  | CallEndedReason
  | 'ended'
  | 'full'
  | 'replaced'
  | 'not-started'
  | 'forbidden'
  | 'access-revoked'
  | 'verification-unavailable'
  | 'unauthorized'
  | 'connection-error';

export class CallRoomError extends Error {
  readonly reason: CallEndReason;

  constructor(reason: CallEndReason, options?: { cause?: unknown }) {
    super(`Call room unavailable: ${reason}`, options);
    this.name = 'CallRoomError';
    this.reason = reason;
  }
}

export interface CallEquippedItemView {
  readonly slot: string;
  readonly shopItemId: string;
  readonly shopItemCode: string;
  readonly shopItemName: string;
  readonly kind: string;
}

export interface CallAppearanceView {
  readonly bodyId: string;
  readonly hairId: string;
  readonly topId: string;
  readonly hairColor: string;
  readonly clothingColor: string;
  readonly items: Readonly<Record<string, CallEquippedItemView>>;
}

export interface CallParticipantView {
  readonly sessionId: string;
  readonly userId: string;
  readonly displayName: string;
  readonly role: string;
  readonly selfMuted: boolean;
  readonly forcedMuted: boolean;
  readonly speaking: boolean;
  readonly emote: string;
  readonly emoteSeq: number;
  readonly appearance: CallAppearanceView;
}

export interface CallStateSnapshot {
  readonly kind: string;
  readonly classroomId: string;
  readonly hostUserId: string;
  readonly focusMode: boolean;
  readonly allowSelfUnmute: boolean;
  readonly participants: ReadonlyMap<string, CallParticipantView>;
}

export interface CallConnectionHandlers {
  onState(snapshot: CallStateSnapshot): void;
  onSignal(relay: CallSignalRelay): void;
  /** `unexpected` closes (network drops) are worth one rejoin; the rest are final. */
  onClosed(reason: CallEndReason, unexpected: boolean): void;
}

export interface CallConnection {
  readonly sessionId: string;
  getSnapshot(): CallStateSnapshot;
  sendSignal(to: string, payload: CallSignalPayload): void;
  sendSelf(self: CallSelf): void;
  sendEmote(emote: CallEmote): void;
  moderate(action: CallModerate): void;
  endCall(): void;
  /** Consented leave: never reported through `onClosed`. */
  leave(): Promise<void>;
}

export interface CallSdkClientLike {
  auth: { token: string | undefined };
  joinOrCreate(
    roomName: string,
    options?: CallJoinOptions,
  ): Promise<RealtimeRoomLike<CallState>>;
}

export interface CreateCallRoomClientOptions {
  readonly auth: RealtimeAuthPort;
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => CallSdkClientLike;
}

export interface CallRoomClient {
  join(
    options: CallJoinOptions,
    handlers: CallConnectionHandlers,
  ): Promise<CallConnection>;
}

function createDefaultSdkClient(endpoint: string): CallSdkClientLike {
  const sdk = new Client(endpoint);
  return {
    auth: sdk.auth as { token: string | undefined },
    joinOrCreate: async (roomName, options) =>
      (await sdk.joinOrCreate(
        roomName,
        options,
      )) as unknown as RealtimeRoomLike<CallState>,
  };
}

function errorCode(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number' && Number.isFinite(code)) return code;
  }
  return undefined;
}

function errorText(error: unknown): string {
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object' && error !== null) {
    const { message, reason } = error as {
      message?: unknown;
      reason?: unknown;
    };
    if (typeof message === 'string') return message.toLowerCase();
    if (typeof reason === 'string') return reason.toLowerCase();
  }
  return '';
}

/** Maps a failed matchmake/join (HTTP-like codes and messages) to a typed reason. */
function reasonFromJoinError(error: unknown): CallEndReason {
  const code = errorCode(error);
  const text = errorText(error);
  if (text.includes('call_not_started')) return 'not-started';
  if (code === CLOSE_CODE_CALL_FULL || text.includes('call_full'))
    return 'full';
  if (
    code === CLOSE_CODE_VERIFICATION_UNAVAILABLE ||
    text.includes('verification_unavailable')
  ) {
    return 'verification-unavailable';
  }
  if (
    code === CLOSE_CODE_ACCESS_REVOKED ||
    text.includes(CLOSE_REASON_ACCESS_REVOKED)
  ) {
    return 'access-revoked';
  }
  if (code === 403) return 'forbidden';
  if (code === 401 || text.includes('unauthorized')) return 'unauthorized';
  return 'connection-error';
}

/** Maps the close of a joined room; `unexpected` marks a lost connection. */
function reasonFromClose(
  code: number,
  text: string,
  endedReason: CallEndedReason | null,
): { reason: CallEndReason; unexpected: boolean } {
  if (code === CLOSE_CODE_CALL_ENDED) {
    return { reason: endedReason ?? 'ended', unexpected: false };
  }
  if (code === CLOSE_CODE_CALL_FULL)
    return { reason: 'full', unexpected: false };
  if (code === CLOSE_CODE_CALL_REPLACED) {
    return { reason: 'replaced', unexpected: false };
  }
  if (code === CLOSE_CODE_VERIFICATION_UNAVAILABLE) {
    return { reason: 'verification-unavailable', unexpected: false };
  }
  // Colyseus also uses 4001 for a server shutdown, so require the reason text.
  if (
    code === CLOSE_CODE_ACCESS_REVOKED &&
    text.toLowerCase().includes(CLOSE_REASON_ACCESS_REVOKED)
  ) {
    return { reason: 'access-revoked', unexpected: false };
  }
  if (code === 1000)
    return { reason: endedReason ?? 'ended', unexpected: false };
  return { reason: 'connection-error', unexpected: true };
}

function readSnapshot(state: CallState): CallStateSnapshot {
  const participants = new Map<string, CallParticipantView>();
  // Before the first full state patch the decoded state has no map yet.
  state.participants?.forEach((participant, sessionId) => {
    const items: Record<string, CallEquippedItemView> = {};
    participant.appearance?.items?.forEach((item, slot) => {
      items[slot] = Object.freeze({
        slot: item.slot ?? slot,
        shopItemId: item.shopItemId ?? '',
        shopItemCode: item.shopItemCode ?? '',
        shopItemName: item.shopItemName ?? '',
        kind: item.kind ?? '',
      });
    });
    participants.set(
      sessionId,
      Object.freeze({
        sessionId,
        userId: participant.userId ?? '',
        displayName: participant.displayName ?? '',
        role: participant.role ?? '',
        selfMuted: participant.selfMuted === true,
        forcedMuted: participant.forcedMuted === true,
        speaking: participant.speaking === true,
        emote: participant.emote ?? '',
        emoteSeq: participant.emoteSeq ?? 0,
        appearance: Object.freeze({
          bodyId: participant.appearance?.bodyId ?? '',
          hairId: participant.appearance?.hairId ?? '',
          topId: participant.appearance?.topId ?? '',
          hairColor: participant.appearance?.hairColor ?? '',
          clothingColor: participant.appearance?.clothingColor ?? '',
          items: Object.freeze(items),
        }),
      }),
    );
  });
  return Object.freeze({
    kind: state.kind ?? '',
    classroomId: state.classroomId ?? '',
    hostUserId: state.hostUserId ?? '',
    focusMode: state.focusMode === true,
    allowSelfUnmute: state.allowSelfUnmute === true,
    participants,
  });
}

/**
 * Joins the `call` Colyseus room with the same bearer-token flow as the
 * classroom room (token on `client.auth`, one refresh on a 401). The SDK's own
 * reconnection is disabled: the server never holds a dropped seat, so a
 * reconnect token would be useless; the session rejoins instead.
 */
export function createCallRoomClient(
  options: CreateCallRoomClientOptions,
): CallRoomClient {
  const endpoint = options.realtimeUrl ?? getPublicConfig().realtimeUrl;
  const createSdk = options.createSdkClient ?? createDefaultSdkClient;
  const { auth } = options;

  async function joinWithToken(
    token: string,
    joinOptions: CallJoinOptions,
  ): Promise<RealtimeRoomLike<CallState>> {
    const sdk = createSdk(endpoint);
    sdk.auth.token = token;
    return sdk.joinOrCreate(CALL_ROOM_NAME, joinOptions);
  }

  async function openRoom(
    joinOptions: CallJoinOptions,
  ): Promise<RealtimeRoomLike<CallState>> {
    const token = auth.getAccessToken();
    if (!token) throw new CallRoomError('unauthorized');
    try {
      return await joinWithToken(token, joinOptions);
    } catch (firstError) {
      if (!isUnauthorizedError(firstError)) {
        throw new CallRoomError(reasonFromJoinError(firstError), {
          cause: firstError,
        });
      }
      const refreshed = await auth.refreshAccessToken();
      if (!refreshed) {
        throw new CallRoomError('unauthorized', { cause: firstError });
      }
      try {
        return await joinWithToken(refreshed, joinOptions);
      } catch (secondError) {
        throw new CallRoomError(reasonFromJoinError(secondError), {
          cause: secondError,
        });
      }
    }
  }

  return {
    async join(joinOptions, handlers) {
      const room = await openRoom(joinOptions);
      if (room.reconnection) room.reconnection.enabled = false;

      let closed = false;
      let endedReason: CallEndedReason | null = null;

      const close = (reason: CallEndReason, unexpected: boolean) => {
        if (closed) return;
        closed = true;
        try {
          room.removeAllListeners();
        } catch {
          /* Already torn down. */
        }
        handlers.onClosed(reason, unexpected);
      };

      room.onStateChange((state) => {
        if (!closed) handlers.onState(readSnapshot(state));
      });
      room.onMessage('*', (type, payload) => {
        if (closed) return;
        if (type === CALL_SIGNAL_MESSAGE) {
          const parsed = callSignalRelaySchema.safeParse(payload);
          if (parsed.success) handlers.onSignal(parsed.data);
        } else if (type === CALL_ENDED_EVENT) {
          const parsed = callEndedPayloadSchema.safeParse(payload);
          if (parsed.success) endedReason = parsed.data.reason;
        }
      });
      room.onDrop?.(() => close('connection-error', true));
      room.onLeave((code, reason) => {
        const mapped = reasonFromClose(code, reason ?? '', endedReason);
        close(mapped.reason, mapped.unexpected);
      });
      room.onError(() => {
        /* Terminal failures arrive as a leave with their close code. */
      });

      function send<T>(
        type: string,
        schema: { safeParse(value: unknown): { success: boolean; data?: T } },
        value: unknown,
      ): void {
        if (closed) return;
        const parsed = schema.safeParse(value);
        if (parsed.success) room.send(type, parsed.data);
      }

      return {
        sessionId: room.sessionId,
        getSnapshot: () => readSnapshot(room.state),
        sendSignal: (to, payload) =>
          send(CALL_SIGNAL_MESSAGE, callSignalSchema, { to, payload }),
        sendSelf: (self) => send(CALL_SELF_MESSAGE, callSelfSchema, self),
        sendEmote: (emote) =>
          send(CALL_EMOTE_MESSAGE, callEmoteSchema, { emote }),
        moderate: (action) =>
          send(CALL_MODERATE_MESSAGE, callModerateSchema, action),
        endCall: () => send(CALL_END_MESSAGE, callEndSchema, {}),
        async leave() {
          if (closed) return;
          closed = true;
          try {
            room.removeAllListeners();
          } catch {
            /* Already torn down. */
          }
          await Promise.resolve(room.leave(true)).catch(() => undefined);
        },
      };
    },
  };
}
