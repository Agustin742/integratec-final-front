import { describe, expect, it, vi } from 'vitest';
import {
  FakePeerConnection,
  FakeStream,
  asStream,
  createFakePeerFactory,
} from '@/test/calls/call-fakes';
import { DEFAULT_ICE_SERVERS } from './call-config';
import { createPeerManager } from './peer-manager';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(localSessionId: string, withMic = true) {
  const factory = createFakePeerFactory();
  const sent: { to: string; payload: Record<string, unknown> }[] = [];
  const remoteStreams: { id: string; stream: unknown }[] = [];
  const localStream = new FakeStream();
  const manager = createPeerManager({
    localSessionId,
    localStream: withMic ? asStream(localStream) : null,
    iceServers: DEFAULT_ICE_SERVERS,
    createPeerConnection: factory.create,
    sendSignal: (to, payload) => sent.push({ to, payload: { ...payload } }),
    onRemoteStream: (id, stream) => remoteStreams.push({ id, stream }),
    now: () => 0,
  });
  const pc = (index: number) =>
    factory.connections[index] as unknown as FakePeerConnection;
  return { manager, factory, sent, remoteStreams, localStream, pc };
}

describe('createPeerManager (#141)', () => {
  it('opens one connection per remote participant and never one to itself', () => {
    const { manager, factory } = setup('B');
    manager.syncPeers(['A', 'B', 'C']);
    expect(factory.connections).toHaveLength(2);
    manager.syncPeers(['A', 'B', 'C']);
    expect(factory.connections).toHaveLength(2);
  });

  it('configures STUN servers and adds the local audio track', () => {
    const { manager, pc, localStream } = setup('B');
    manager.syncPeers(['A']);
    expect(pc(0).config).toMatchObject({ iceServers: DEFAULT_ICE_SERVERS });
    expect(pc(0).addedTracks).toEqual([localStream.tracks[0]]);
  });

  it('negotiates receive-only when there is no microphone', () => {
    const { manager, pc } = setup('B', false);
    manager.syncPeers(['A']);
    expect(pc(0).addedTracks).toEqual([]);
    expect(pc(0).transceivers).toEqual([
      { kind: 'audio', init: { direction: 'recvonly' } },
    ]);
  });

  it('closes the connection of a participant that left', () => {
    const { manager, pc } = setup('B');
    manager.syncPeers(['A', 'C']);
    manager.syncPeers(['C']);
    expect(pc(0).closed).toBe(true);
    expect(pc(1).closed).toBe(false);
  });

  it('sends an offer when negotiation is needed and relays ICE candidates', async () => {
    const { manager, sent, pc } = setup('B');
    manager.syncPeers(['A']);
    pc(0).fireNegotiationNeeded();
    await flush();
    expect(sent).toEqual([
      { to: 'A', payload: { type: 'offer', sdp: 'offer-sdp-1' } },
    ]);
    pc(0).emitCandidate({ candidate: 'cand-1', sdpMid: '0' });
    expect(sent.at(-1)).toEqual({
      to: 'A',
      payload: { type: 'ice', candidate: { candidate: 'cand-1', sdpMid: '0' } },
    });
  });

  it('answers a remote offer', async () => {
    const { manager, sent, pc } = setup('B');
    manager.syncPeers(['A']);
    await manager.handleSignal('A', { type: 'offer', sdp: 'remote-offer' });
    expect(pc(0).remoteDescriptions).toEqual([
      { type: 'offer', sdp: 'remote-offer' },
    ]);
    expect(sent).toEqual([
      { to: 'A', payload: { type: 'answer', sdp: 'answer-sdp-1' } },
    ]);
  });

  it('applies a remote answer', async () => {
    const { manager, pc } = setup('B');
    manager.syncPeers(['A']);
    pc(0).fireNegotiationNeeded();
    await flush();
    await manager.handleSignal('A', { type: 'answer', sdp: 'remote-answer' });
    expect(pc(0).signalingState).toBe('stable');
  });

  describe('glare (perfect negotiation)', () => {
    it('the impolite peer (greater session id) ignores a colliding offer', async () => {
      const { manager, sent, pc } = setup('B'); // 'B' > 'A' => impolite
      manager.syncPeers(['A']);
      pc(0).fireNegotiationNeeded();
      await flush();
      sent.length = 0;
      await manager.handleSignal('A', { type: 'offer', sdp: 'colliding' });
      expect(pc(0).remoteDescriptions).toEqual([]);
      expect(pc(0).signalingState).toBe('have-local-offer');
      expect(sent).toEqual([]);
    });

    it('the polite peer (lesser session id) rolls back and answers', async () => {
      const { manager, sent, pc } = setup('A'); // 'A' < 'B' => polite
      manager.syncPeers(['B']);
      pc(0).fireNegotiationNeeded();
      await flush();
      sent.length = 0;
      await manager.handleSignal('B', { type: 'offer', sdp: 'colliding' });
      expect(pc(0).implicitRollbacks).toBe(1);
      expect(pc(0).remoteDescriptions).toEqual([
        { type: 'offer', sdp: 'colliding' },
      ]);
      expect(sent).toEqual([
        { to: 'B', payload: { type: 'answer', sdp: expect.any(String) } },
      ]);
    });

    it('does not surface candidate errors that belong to an ignored offer', async () => {
      const { manager, pc } = setup('B');
      manager.syncPeers(['A']);
      pc(0).fireNegotiationNeeded();
      await flush();
      await manager.handleSignal('A', { type: 'offer', sdp: 'colliding' });
      pc(0).failIceWith = new Error('no remote description');
      await expect(
        manager.handleSignal('A', {
          type: 'ice',
          candidate: { candidate: 'late' },
        }),
      ).resolves.toBeUndefined();
    });
  });

  it('adds relayed ICE candidates to the matching peer only', async () => {
    const { manager, pc } = setup('B');
    manager.syncPeers(['A', 'C']);
    await manager.handleSignal('C', {
      type: 'ice',
      candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 },
    });
    expect(pc(0).candidates).toEqual([]);
    expect(pc(1).candidates).toEqual([
      { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 },
    ]);
  });

  it('buffers signals from a participant not yet in the state and replays them', async () => {
    const { manager, sent, pc } = setup('B');
    await manager.handleSignal('A', { type: 'offer', sdp: 'early' });
    expect(sent).toEqual([]);
    manager.syncPeers(['A']);
    await flush();
    expect(pc(0).remoteDescriptions).toEqual([{ type: 'offer', sdp: 'early' }]);
    expect(sent).toEqual([
      { to: 'A', payload: { type: 'answer', sdp: expect.any(String) } },
    ]);
  });

  it('reports remote audio streams and restarts ICE after a failure', () => {
    const { manager, remoteStreams, pc } = setup('B');
    manager.syncPeers(['A']);
    const remote = new FakeStream();
    pc(0).emitTrack(remote);
    expect(remoteStreams).toEqual([{ id: 'A', stream: remote }]);
    pc(0).iceConnectionState = 'failed';
    pc(0).oniceconnectionstatechange?.();
    expect(pc(0).restartIce).toHaveBeenCalledTimes(1);
  });

  it('closes everything on dispose and ignores later signals', async () => {
    const { manager, sent, pc } = setup('B');
    manager.syncPeers(['A']);
    manager.dispose();
    expect(pc(0).closed).toBe(true);
    pc(0).fireNegotiationNeeded();
    await manager.handleSignal('A', { type: 'offer', sdp: 'x' });
    await flush();
    expect(sent).toEqual([]);
    expect(vi.isMockFunction(pc(0).restartIce)).toBe(true);
  });
});
