import { MapSchema } from '@colyseus/schema';
import { vi } from 'vitest';
import { CallParticipant } from '@/realtime/call-participant.generated';
import { CallState } from '@/realtime/call-state.generated';
import type { RealtimeRoomLike } from '@/realtime/client';

/** Audio track double: `enabled` and `stop` are what the call engine drives. */
export class FakeTrack {
  readonly kind = 'audio';
  enabled = true;
  readonly stop = vi.fn();
}

export class FakeStream {
  constructor(readonly tracks: FakeTrack[] = [new FakeTrack()]) {}
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
  getAudioTracks(): FakeTrack[] {
    return this.tracks;
  }
}

export function asStream(stream: FakeStream): MediaStream {
  return stream as unknown as MediaStream;
}

type Description = { type: 'offer' | 'answer' | 'rollback'; sdp?: string };

/**
 * Minimal RTCPeerConnection double that follows the signaling-state machine
 * (including the implicit rollback of an incoming offer during glare) and
 * records everything the peer manager does to it.
 */
export class FakePeerConnection {
  signalingState: 'stable' | 'have-local-offer' | 'have-remote-offer' =
    'stable';
  iceConnectionState = 'new';
  localDescription: Description | null = null;
  remoteDescription: Description | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((event: unknown) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  readonly addedTracks: unknown[] = [];
  readonly transceivers: { kind: string; init: unknown }[] = [];
  readonly remoteDescriptions: Description[] = [];
  readonly candidates: unknown[] = [];
  implicitRollbacks = 0;
  closed = false;
  failIceWith: Error | null = null;
  readonly restartIce = vi.fn();
  private counter = 0;

  constructor(readonly config: unknown) {}

  addTrack(track: unknown): unknown {
    this.addedTracks.push(track);
    return {};
  }

  addTransceiver(kind: string, init: unknown): unknown {
    this.transceivers.push({ kind, init });
    return {};
  }

  async setLocalDescription(description?: Description): Promise<void> {
    const type =
      description?.type ??
      (this.signalingState === 'have-remote-offer' ? 'answer' : 'offer');
    if (type === 'rollback') {
      this.signalingState = 'stable';
      this.localDescription = null;
      return;
    }
    this.counter += 1;
    this.localDescription = { type, sdp: `${type}-sdp-${this.counter}` };
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }

  async setRemoteDescription(description: Description): Promise<void> {
    if (
      description.type === 'offer' &&
      this.signalingState === 'have-local-offer'
    ) {
      this.implicitRollbacks += 1;
      this.localDescription = null;
    }
    this.remoteDescriptions.push(description);
    this.remoteDescription = description;
    this.signalingState =
      description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }

  async addIceCandidate(candidate: unknown): Promise<void> {
    if (this.failIceWith) throw this.failIceWith;
    this.candidates.push(candidate);
  }

  close(): void {
    this.closed = true;
  }

  /** Browser event: the connection wants a new offer. */
  fireNegotiationNeeded(): void {
    this.onnegotiationneeded?.();
  }

  emitCandidate(json: { candidate: string; sdpMid?: string | null }): void {
    this.onicecandidate?.({ candidate: { toJSON: () => json } });
  }

  emitTrack(stream: FakeStream): void {
    this.ontrack?.({ streams: [stream], track: stream.tracks[0] });
  }
}

/** Collects every connection the engine creates, in creation order. */
export function createFakePeerFactory() {
  const connections: FakePeerConnection[] = [];
  return {
    connections,
    create: (config: unknown) => {
      const pc = new FakePeerConnection(config);
      connections.push(pc);
      return pc as unknown as RTCPeerConnection;
    },
  };
}

export class FakeAnalyser {
  fftSize = 0;
  /** Constant sample amplitude: the RMS of the frame equals this value. */
  amplitude = 0;
  getFloatTimeDomainData(buffer: Float32Array): void {
    buffer.fill(this.amplitude);
  }
}

export class FakeAudioContext {
  readonly analysers: FakeAnalyser[] = [];
  readonly resume = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);
  readonly sourceDisconnects = vi.fn();
  createAnalyser(): FakeAnalyser {
    const analyser = new FakeAnalyser();
    this.analysers.push(analyser);
    return analyser;
  }
  createMediaStreamSource(): {
    connect: () => void;
    disconnect: () => void;
  } {
    return { connect: () => undefined, disconnect: this.sourceDisconnects };
  }
}

export class FakeAudioElement {
  srcObject: unknown = null;
  muted = false;
  autoplay = false;
  paused = true;
  rejectPlay = false;
  readonly play = vi.fn(async () => {
    if (this.rejectPlay) throw new DOMException('blocked', 'NotAllowedError');
    this.paused = false;
  });
  readonly pause = vi.fn(() => {
    this.paused = true;
  });
}

export interface SeedParticipant {
  readonly sessionId: string;
  readonly userId?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly selfMuted?: boolean;
  readonly forcedMuted?: boolean;
  readonly speaking?: boolean;
  readonly emote?: string;
  readonly emoteSeq?: number;
}

type MessageListener = (type: string, payload: unknown) => void;

/** Colyseus call-room double: tests patch state, push messages and close it. */
export class FakeCallRoom implements RealtimeRoomLike<CallState> {
  readonly roomId = 'call-room-1';
  readonly reconnection = { enabled: true };
  readonly state = new CallState();
  readonly send = vi.fn();
  readonly leave = vi.fn(async () => 1000);
  private stateListeners: ((state: CallState) => void)[] = [];
  private leaveListeners: ((code: number, reason?: string) => void)[] = [];
  private dropListeners: ((code: number, reason?: string) => void)[] = [];
  private messageListeners: MessageListener[] = [];

  constructor(readonly sessionId: string) {
    this.state.kind = 'classroom';
    this.state.classroomId = 'classroom-1';
    this.state.allowSelfUnmute = true;
    this.state.participants = new MapSchema<CallParticipant>();
  }

  onStateChange(callback: (state: CallState) => void): void {
    this.stateListeners.push(callback);
  }
  onLeave(callback: (code: number, reason?: string) => void): void {
    this.leaveListeners.push(callback);
  }
  onDrop(callback: (code: number, reason?: string) => void): void {
    this.dropListeners.push(callback);
  }
  onError(): void {}
  onMessage(_type: '*', callback: MessageListener): void {
    this.messageListeners.push(callback);
  }
  removeAllListeners(): void {
    this.stateListeners = [];
    this.leaveListeners = [];
    this.dropListeners = [];
    this.messageListeners = [];
  }

  setParticipant(seed: SeedParticipant): void {
    const existing = this.state.participants.get(seed.sessionId);
    const participant = existing ?? new CallParticipant();
    participant.userId = seed.userId ?? `user-${seed.sessionId}`;
    participant.displayName = seed.displayName ?? seed.sessionId;
    participant.role = seed.role ?? existing?.role ?? 'STUDENT';
    participant.selfMuted = seed.selfMuted ?? existing?.selfMuted ?? false;
    participant.forcedMuted =
      seed.forcedMuted ?? existing?.forcedMuted ?? false;
    participant.speaking = seed.speaking ?? existing?.speaking ?? false;
    participant.emote = seed.emote ?? existing?.emote ?? '';
    participant.emoteSeq = seed.emoteSeq ?? existing?.emoteSeq ?? 0;
    this.state.participants.set(seed.sessionId, participant);
    this.emitState();
  }

  removeParticipant(sessionId: string): void {
    this.state.participants.delete(sessionId);
    this.emitState();
  }

  setFlags(flags: { focusMode?: boolean; allowSelfUnmute?: boolean }): void {
    if (flags.focusMode !== undefined) this.state.focusMode = flags.focusMode;
    if (flags.allowSelfUnmute !== undefined) {
      this.state.allowSelfUnmute = flags.allowSelfUnmute;
    }
    this.emitState();
  }

  emitState(): void {
    for (const listener of [...this.stateListeners]) listener(this.state);
  }
  emitMessage(type: string, payload: unknown): void {
    for (const listener of [...this.messageListeners]) listener(type, payload);
  }
  emitLeave(code: number, reason?: string): void {
    for (const listener of [...this.leaveListeners]) listener(code, reason);
  }
  emitDrop(code = 1006, reason?: string): void {
    for (const listener of [...this.dropListeners]) listener(code, reason);
  }
}

export interface CallJoinRecord {
  readonly roomName: string;
  readonly options: unknown;
  readonly token: string | undefined;
}

/** SDK double for the call room; records joins with the token used at that moment. */
export function createFakeCallSdk(selfSessionId = 'S-self') {
  const rooms: FakeCallRoom[] = [];
  const joins: CallJoinRecord[] = [];
  const failures: unknown[] = [];

  const createSdkClient = () => {
    const auth: { token: string | undefined } = { token: undefined };
    return {
      auth,
      joinOrCreate: async (roomName: string, options?: unknown) => {
        joins.push({ roomName, options, token: auth.token });
        const failure = failures.shift();
        if (failure) throw failure;
        const room = new FakeCallRoom(
          rooms.length === 0
            ? selfSessionId
            : `${selfSessionId}-${rooms.length}`,
        );
        room.setParticipant({ sessionId: room.sessionId, userId: 'user-self' });
        rooms.push(room);
        return room;
      },
    };
  };

  return {
    createSdkClient,
    rooms,
    joins,
    failNextJoinWith(error: unknown) {
      failures.push(error);
    },
    get lastRoom(): FakeCallRoom {
      const room = rooms.at(-1);
      if (!room) throw new Error('no call room joined yet');
      return room;
    },
  };
}
