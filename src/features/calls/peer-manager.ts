import type { CallSignalPayload } from '@/realtime/call-contracts.generated';

/** The slice of `RTCPeerConnection` the mesh uses; tests inject a double. */
export type PeerConnectionLike = Pick<
  RTCPeerConnection,
  | 'signalingState'
  | 'iceConnectionState'
  | 'localDescription'
  | 'onnegotiationneeded'
  | 'onicecandidate'
  | 'ontrack'
  | 'oniceconnectionstatechange'
  | 'addTrack'
  | 'addTransceiver'
  | 'setLocalDescription'
  | 'setRemoteDescription'
  | 'addIceCandidate'
  | 'restartIce'
  | 'close'
>;

export interface PeerManagerOptions {
  readonly localSessionId: string;
  /** `null` joins listen-only (no microphone). */
  readonly localStream: MediaStream | null;
  readonly iceServers: readonly RTCIceServer[];
  readonly createPeerConnection: (
    configuration: RTCConfiguration,
  ) => PeerConnectionLike;
  readonly sendSignal: (to: string, payload: CallSignalPayload) => void;
  readonly onRemoteStream: (peerId: string, stream: MediaStream) => void;
  readonly now?: () => number;
}

export interface PeerManager {
  /** Reconciles the mesh with the sessions currently in the call state. */
  syncPeers(sessionIds: readonly string[]): void;
  handleSignal(from: string, payload: CallSignalPayload): Promise<void>;
  dispose(): void;
}

/** Signals that beat the state patch that introduces their sender are kept briefly. */
const PENDING_SIGNAL_TTL_MS = 10_000;
const MAX_PENDING_SIGNALS_PER_PEER = 50;

interface Peer {
  readonly connection: PeerConnectionLike;
  /** Serializes signal handling so awaits of two signals never interleave. */
  queue: Promise<void>;
  closed: boolean;
  handle(payload: CallSignalPayload): Promise<void>;
}

type PendingSignals = {
  readonly at: number;
  readonly payloads: CallSignalPayload[];
};

/**
 * Full-mesh audio peers using the "perfect negotiation" pattern (MDN): both
 * sides may offer at any time; on a collision the polite peer rolls back and
 * the impolite one ignores the incoming offer. Politeness is decided by a
 * lexicographic comparison of session ids, which both sides evaluate the same.
 */
export function createPeerManager(options: PeerManagerOptions): PeerManager {
  const now = options.now ?? (() => Date.now());
  const peers = new Map<string, Peer>();
  const pending = new Map<string, PendingSignals>();
  let disposed = false;

  function createPeer(remoteId: string): Peer {
    const polite = options.localSessionId < remoteId;
    const connection = options.createPeerConnection({
      iceServers: [...options.iceServers],
    });
    let makingOffer = false;
    let ignoreOffer = false;
    let settingRemoteAnswer = false;
    const peer: Peer = {
      connection,
      queue: Promise.resolve(),
      closed: false,
      handle: async (payload) => {
        if (payload.type === 'ice') {
          try {
            await connection.addIceCandidate(payload.candidate);
          } catch {
            // Candidates that belong to an offer we ignored are expected to fail.
          }
          return;
        }
        const description = { type: payload.type, sdp: payload.sdp } as const;
        const readyForOffer =
          !makingOffer &&
          (connection.signalingState === 'stable' || settingRemoteAnswer);
        const collision = description.type === 'offer' && !readyForOffer;
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        try {
          settingRemoteAnswer = description.type === 'answer';
          await connection.setRemoteDescription(description);
          settingRemoteAnswer = false;
          if (description.type === 'offer') {
            await connection.setLocalDescription();
            const local = connection.localDescription;
            if (
              !peer.closed &&
              local?.sdp !== undefined &&
              local.type === 'answer'
            ) {
              options.sendSignal(remoteId, { type: 'answer', sdp: local.sdp });
            }
          }
        } catch {
          settingRemoteAnswer = false;
        }
      },
    };

    connection.onnegotiationneeded = () => {
      peer.queue = peer.queue.then(async () => {
        if (peer.closed) return;
        try {
          makingOffer = true;
          await connection.setLocalDescription();
          const description = connection.localDescription;
          if (
            !peer.closed &&
            description?.sdp !== undefined &&
            description.type === 'offer'
          ) {
            options.sendSignal(remoteId, {
              type: 'offer',
              sdp: description.sdp,
            });
          }
        } catch {
          // The connection was closed or rolled back mid-negotiation; the next
          // negotiationneeded event retries.
        } finally {
          makingOffer = false;
        }
      });
    };

    connection.onicecandidate = (event) => {
      if (peer.closed || !event.candidate) return;
      const { candidate, sdpMid, sdpMLineIndex, usernameFragment } =
        event.candidate.toJSON();
      if (candidate === undefined) return;
      options.sendSignal(remoteId, {
        type: 'ice',
        candidate: {
          candidate,
          ...(sdpMid !== undefined ? { sdpMid } : {}),
          ...(sdpMLineIndex !== undefined ? { sdpMLineIndex } : {}),
          ...(usernameFragment !== undefined ? { usernameFragment } : {}),
        },
      });
    };

    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!peer.closed && stream && event.track.kind === 'audio') {
        options.onRemoteStream(remoteId, stream);
      }
    };

    connection.oniceconnectionstatechange = () => {
      if (!peer.closed && connection.iceConnectionState === 'failed') {
        connection.restartIce();
      }
    };

    const audioTrack = options.localStream?.getAudioTracks()[0];
    if (audioTrack && options.localStream) {
      connection.addTrack(audioTrack, options.localStream);
    } else {
      connection.addTransceiver('audio', { direction: 'recvonly' });
    }

    return peer;
  }

  function dispatch(peer: Peer, payload: CallSignalPayload): Promise<void> {
    peer.queue = peer.queue.then(() =>
      peer.closed ? undefined : peer.handle(payload),
    );
    return peer.queue;
  }

  function closePeer(peer: Peer): void {
    peer.closed = true;
    peer.connection.onnegotiationneeded = null;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.oniceconnectionstatechange = null;
    peer.connection.close();
  }

  return {
    syncPeers(sessionIds) {
      if (disposed) return;
      const wanted = new Set(
        sessionIds.filter((id) => id !== options.localSessionId),
      );
      for (const [id, peer] of [...peers]) {
        if (!wanted.has(id)) {
          closePeer(peer);
          peers.delete(id);
        }
      }
      const at = now();
      for (const id of wanted) {
        if (peers.has(id)) continue;
        const peer = createPeer(id);
        peers.set(id, peer);
        const buffered = pending.get(id);
        pending.delete(id);
        for (const payload of buffered?.payloads ?? [])
          void dispatch(peer, payload);
      }
      for (const [id, entry] of [...pending]) {
        if (at - entry.at > PENDING_SIGNAL_TTL_MS) pending.delete(id);
      }
    },
    async handleSignal(from, payload) {
      if (disposed || from === options.localSessionId) return;
      const peer = peers.get(from);
      if (peer) {
        await dispatch(peer, payload);
        return;
      }
      const entry = pending.get(from) ?? { at: now(), payloads: [] };
      if (entry.payloads.length < MAX_PENDING_SIGNALS_PER_PEER) {
        entry.payloads.push(payload);
      }
      pending.set(from, entry);
    },
    dispose() {
      disposed = true;
      for (const peer of peers.values()) closePeer(peer);
      peers.clear();
      pending.clear();
    },
  };
}
