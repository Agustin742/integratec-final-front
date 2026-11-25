import type {
  CallEmote,
  CallJoinOptions,
  CallModerate,
} from '@/realtime/call-contracts.generated';
import {
  CALL_MODERATOR_ROLES,
  DEFAULT_ICE_SERVERS,
  MAX_REJOIN_ATTEMPTS,
} from './call-config';
import {
  type CallConnection,
  type CallConnectionHandlers,
  type CallEndReason,
  type CallParticipantView,
  type CallRoomClient,
  type CallStateSnapshot,
} from './call-room-client';
import { createLocalMicControl, type LocalMicControl } from './local-mic';
import { MicCaptureError, type MicCaptureErrorCode } from './mic-capture';
import {
  createPeerManager,
  type PeerConnectionLike,
  type PeerManager,
} from './peer-manager';
import {
  createRemoteAudioSink,
  type RemoteAudioSink,
} from './remote-audio-sink';
import {
  createVoiceActivityDetector,
  type VoiceActivityDetector,
} from './voice-activity';

export type CallStatus =
  'idle' | 'joining' | 'connected' | 'reconnecting' | 'ended';

export interface CallParticipantState extends CallParticipantView {
  readonly isSelf: boolean;
  /** Muted by themselves or by a moderator: nobody should hear them. */
  readonly muted: boolean;
}

export interface CallSelfState {
  readonly muted: boolean;
  readonly forcedMuted: boolean;
  readonly canUnmute: boolean;
  readonly hasMicrophone: boolean;
}

export interface CallSessionSnapshot {
  readonly status: CallStatus;
  /** Why the call is over; `null` while it is running. */
  readonly endReason: CallEndReason | null;
  /** Typed microphone failure; the user then listens without speaking. */
  readonly micError: MicCaptureErrorCode | null;
  readonly kind: string | null;
  readonly selfSessionId: string | null;
  readonly participants: readonly CallParticipantState[];
  readonly self: CallSelfState;
  readonly focusMode: boolean;
  readonly allowSelfUnmute: boolean;
  readonly isModerator: boolean;
  /** Autoplay was blocked: call `resumeAudio()` from a click. */
  readonly needsAudioUnlock: boolean;
}

export interface CallSessionDeps {
  readonly roomClient: CallRoomClient;
  readonly captureMic: () => Promise<MediaStream>;
  readonly createPeerConnection: (
    configuration: RTCConfiguration,
  ) => PeerConnectionLike;
  readonly createAudioContext: () => AudioContext;
  readonly createAudioElement?: () => HTMLAudioElement;
  readonly iceServers?: readonly RTCIceServer[];
}

export interface CallSession {
  getSnapshot(): CallSessionSnapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Call it synchronously from the click that starts the call: audio playback
   * is primed before the first `await`, while the browser still sees the gesture.
   */
  join(options: CallJoinOptions): Promise<void>;
  leave(): Promise<void>;
  setMuted(muted: boolean): 'ok' | 'refused';
  toggleMute(): 'ok' | 'refused';
  sendEmote(emote: CallEmote): void;
  moderate(action: CallModerate): void;
  endCall(): void;
  resumeAudio(): Promise<void>;
  /** Smoothed 0..1 voice level of a participant (for head motion); 0 when unknown. */
  getLevel(sessionId: string): number;
  dispose(): void;
}

const IDLE_SELF: CallSelfState = Object.freeze({
  muted: false,
  forcedMuted: false,
  canUnmute: false,
  hasMicrophone: false,
});

const IDLE_SNAPSHOT: CallSessionSnapshot = Object.freeze({
  status: 'idle',
  endReason: null,
  micError: null,
  kind: null,
  selfSessionId: null,
  participants: Object.freeze([]),
  self: IDLE_SELF,
  focusMode: false,
  allowSelfUnmute: false,
  isModerator: false,
  needsAudioUnlock: false,
});

export function createCallSession(deps: CallSessionDeps): CallSession {
  const iceServers = deps.iceServers ?? DEFAULT_ICE_SERVERS;
  const listeners = new Set<() => void>();

  let snapshot: CallSessionSnapshot = IDLE_SNAPSHOT;
  let status: CallStatus = 'idle';
  let endReason: CallEndReason | null = null;
  let micError: MicCaptureErrorCode | null = null;
  let lastState: CallStateSnapshot | null = null;

  let epoch = 0;
  let rejoins = 0;
  let joinOptions: CallJoinOptions | null = null;

  let audioContext: AudioContext | null = null;
  let sink: RemoteAudioSink | null = null;
  let localStream: MediaStream | null = null;
  let mic: LocalMicControl | null = null;
  let localDetector: VoiceActivityDetector | null = null;
  let connection: CallConnection | null = null;
  let peers: PeerManager | null = null;
  let scopeActive = false;
  const remoteDetectors = new Map<string, VoiceActivityDetector>();
  const attachedPeers = new Set<string>();

  function publish(): void {
    const self = lastState?.participants.get(connection?.sessionId ?? '');
    const micState = mic?.getState();
    const participants = [...(lastState?.participants.values() ?? [])].map(
      (participant) =>
        Object.freeze({
          ...participant,
          isSelf: participant.sessionId === connection?.sessionId,
          muted: participant.selfMuted || participant.forcedMuted,
        }),
    );
    snapshot = Object.freeze({
      status,
      endReason,
      micError,
      kind: lastState?.kind || null,
      selfSessionId: connection?.sessionId ?? null,
      participants: Object.freeze(participants),
      self: micState
        ? Object.freeze({
            muted: micState.effectiveMuted,
            forcedMuted: micState.forcedMuted,
            canUnmute: micState.canUnmute,
            hasMicrophone: micState.hasMicrophone,
          })
        : IDLE_SELF,
      focusMode: lastState?.focusMode ?? false,
      allowSelfUnmute: lastState?.allowSelfUnmute ?? false,
      isModerator:
        lastState?.kind === 'classroom' &&
        self !== undefined &&
        CALL_MODERATOR_ROLES.includes(self.role),
      needsAudioUnlock: sink?.needsAudioUnlock() ?? false,
    });
    for (const listener of [...listeners]) listener();
  }

  function releasePeers(): void {
    scopeActive = false;
    peers?.dispose();
    peers = null;
    for (const id of attachedPeers) sink?.detach(id);
    attachedPeers.clear();
    for (const detector of remoteDetectors.values()) detector.dispose();
    remoteDetectors.clear();
    connection = null;
    lastState = null;
  }

  function releaseAll(): void {
    releasePeers();
    localDetector?.dispose();
    localDetector = null;
    mic?.stop();
    mic = null;
    localStream = null;
    sink?.dispose();
    sink = null;
    if (audioContext) {
      void Promise.resolve(audioContext.close()).catch(() => undefined);
      audioContext = null;
    }
  }

  function finish(reason: CallEndReason): void {
    releaseAll();
    status = 'ended';
    endReason = reason;
    publish();
  }

  function applyState(next: CallStateSnapshot): void {
    if (!scopeActive || !peers || !connection) return;
    lastState = next;
    const selfId = connection.sessionId;
    peers.syncPeers([...next.participants.keys()]);
    for (const id of [...attachedPeers]) {
      if (!next.participants.has(id)) {
        sink?.detach(id);
        attachedPeers.delete(id);
        remoteDetectors.get(id)?.dispose();
        remoteDetectors.delete(id);
      }
    }
    for (const [id, participant] of next.participants) {
      if (id === selfId) {
        mic?.applyServer({
          forcedMuted: participant.forcedMuted,
          allowSelfUnmute: next.allowSelfUnmute,
        });
      } else {
        sink?.setMuted(id, participant.selfMuted || participant.forcedMuted);
      }
    }
    publish();
  }

  function attachRemoteStream(peerId: string, stream: MediaStream): void {
    const participant = lastState?.participants.get(peerId);
    if (!scopeActive || !participant || !sink) return;
    attachedPeers.add(peerId);
    sink.attach(
      peerId,
      stream,
      participant.selfMuted || participant.forcedMuted,
    );
    remoteDetectors.get(peerId)?.dispose();
    if (audioContext) {
      remoteDetectors.set(
        peerId,
        createVoiceActivityDetector({ audioContext, stream }),
      );
    }
  }

  function handleClosed(reason: CallEndReason, unexpected: boolean): void {
    releasePeers();
    if (unexpected && rejoins < MAX_REJOIN_ATTEMPTS && joinOptions) {
      rejoins += 1;
      status = 'reconnecting';
      publish();
      void connect(joinOptions, epoch);
      return;
    }
    finish(reason);
  }

  async function connect(
    options: CallJoinOptions,
    myEpoch: number,
  ): Promise<void> {
    let joined: CallConnection | undefined;
    const handlers: CallConnectionHandlers = {
      onState: (state) => {
        if (epoch === myEpoch && joined && connection === joined)
          applyState(state);
      },
      onSignal: (relay) => {
        if (epoch === myEpoch && joined && connection === joined) {
          void peers?.handleSignal(relay.from, relay.payload);
        }
      },
      onClosed: (reason, unexpected) => {
        if (epoch === myEpoch && joined && connection === joined) {
          handleClosed(reason, unexpected);
        }
      },
    };
    try {
      joined = await deps.roomClient.join(options, handlers);
    } catch (error) {
      if (epoch !== myEpoch) return;
      finish(
        typeof error === 'object' && error !== null && 'reason' in error
          ? (error as { reason: CallEndReason }).reason
          : 'connection-error',
      );
      return;
    }
    if (epoch !== myEpoch) {
      await joined.leave();
      return;
    }
    connection = joined;
    scopeActive = true;
    peers = createPeerManager({
      localSessionId: joined.sessionId,
      localStream,
      iceServers,
      createPeerConnection: deps.createPeerConnection,
      sendSignal: (to, payload) => connection?.sendSignal(to, payload),
      onRemoteStream: attachRemoteStream,
    });
    status = 'connected';
    if (mic?.getState().selfMuted) joined.sendSelf({ muted: true });
    applyState(joined.getSnapshot());
  }

  function setMuted(muted: boolean): 'ok' | 'refused' {
    if (!mic) return 'refused';
    const result = mic.setMuted(muted);
    if (result === 'ok') connection?.sendSelf({ muted });
    publish();
    return result;
  }

  const api: CallSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async join(options) {
      if (status !== 'idle' && status !== 'ended') return;
      epoch += 1;
      const myEpoch = epoch;
      rejoins = 0;
      endReason = null;
      micError = null;
      joinOptions = options;
      // Runs inside the click: prime audio before any await loses the gesture.
      audioContext = deps.createAudioContext();
      void Promise.resolve(audioContext.resume()).catch(() => undefined);
      sink = createRemoteAudioSink({
        createAudioElement: deps.createAudioElement,
        onNeedsUnlockChange: () => publish(),
      });
      status = 'joining';
      publish();

      try {
        localStream = await deps.captureMic();
      } catch (error) {
        micError = error instanceof MicCaptureError ? error.code : 'unknown';
        localStream = null;
      }
      if (epoch !== myEpoch) {
        for (const track of localStream?.getTracks() ?? []) track.stop();
        return;
      }
      mic = createLocalMicControl({ stream: localStream });
      if (localStream && audioContext) {
        localDetector = createVoiceActivityDetector({
          audioContext,
          stream: localStream,
          onSpeakingChange: (speaking) => {
            if (!mic?.getState().effectiveMuted)
              connection?.sendSelf({ speaking });
          },
        });
      }
      await connect(options, myEpoch);
    },
    async leave() {
      if (status === 'idle') return;
      epoch += 1;
      const leaving = connection;
      releaseAll();
      status = 'idle';
      endReason = null;
      micError = null;
      publish();
      await leaving?.leave();
    },
    setMuted,
    toggleMute() {
      return setMuted(!(mic?.getState().effectiveMuted ?? true));
    },
    sendEmote(emote) {
      connection?.sendEmote(emote);
    },
    moderate(action) {
      if (snapshot.isModerator) connection?.moderate(action);
    },
    endCall() {
      if (snapshot.isModerator) connection?.endCall();
    },
    async resumeAudio() {
      if (audioContext) {
        await Promise.resolve(audioContext.resume()).catch(() => undefined);
      }
      await sink?.resume();
      publish();
    },
    getLevel(sessionId) {
      if (sessionId === connection?.sessionId)
        return localDetector?.getLevel() ?? 0;
      return remoteDetectors.get(sessionId)?.getLevel() ?? 0;
    },
    dispose() {
      void api.leave();
    },
  };
  return api;
}
