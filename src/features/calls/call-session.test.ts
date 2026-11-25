import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FakeAudioContext,
  FakeAudioElement,
  FakePeerConnection,
  FakeStream,
  FakeTrack,
  asStream,
  createFakeCallSdk,
  createFakePeerFactory,
} from '@/test/calls/call-fakes';
import { createCallRoomClient } from './call-room-client';
import { createCallSession } from './call-session';
import { MicCaptureError } from './mic-capture';

const CLASSROOM = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const JOIN = { kind: 'classroom', classroomId: CLASSROOM } as const;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(
  options: {
    mic?: 'ok' | MicCaptureError;
    captureMic?: () => Promise<MediaStream>;
  } = {},
) {
  const sdk = createFakeCallSdk();
  const peers = createFakePeerFactory();
  const audioContexts: FakeAudioContext[] = [];
  const elements: FakeAudioElement[] = [];
  const localStream = new FakeStream();
  const captureMic = vi.fn(async () => {
    if (options.captureMic) return options.captureMic();
    if (options.mic instanceof MicCaptureError) throw options.mic;
    return asStream(localStream);
  });
  const session = createCallSession({
    roomClient: createCallRoomClient({
      auth: {
        getAccessToken: () => 'token',
        refreshAccessToken: async () => 'token',
        registerCleanup: () => () => {},
      },
      realtimeUrl: 'wss://realtime.example.invalid',
      createSdkClient: sdk.createSdkClient,
    }),
    captureMic,
    createPeerConnection: peers.create,
    createAudioContext: () => {
      const context = new FakeAudioContext();
      audioContexts.push(context);
      return context as unknown as AudioContext;
    },
    createAudioElement: () => {
      const element = new FakeAudioElement();
      elements.push(element);
      return element as unknown as HTMLAudioElement;
    },
  });
  const pc = (index: number) =>
    peers.connections[index] as unknown as FakePeerConnection;
  const sends = (type: string) =>
    sdk.lastRoom.send.mock.calls.filter((call) => call[0] === type);
  return {
    sdk,
    peers,
    audioContexts,
    elements,
    localStream,
    captureMic,
    session,
    pc,
    sends,
  };
}

async function joined(options?: Parameters<typeof setup>[0]) {
  const ctx = setup(options);
  await ctx.session.join(JOIN);
  return ctx;
}

afterEach(() => vi.useRealTimers());

describe('createCallSession join and teardown (#141)', () => {
  it('primes audio synchronously inside the join gesture, then connects', async () => {
    const { session, audioContexts, sdk } = setup();
    const promise = session.join(JOIN);
    expect(audioContexts).toHaveLength(1);
    expect(audioContexts[0]!.resume).toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('joining');
    await promise;
    expect(session.getSnapshot().status).toBe('connected');
    expect(session.getSnapshot().selfSessionId).toBe('S-self');
    expect(sdk.joins).toHaveLength(1);
  });

  it('marks the local participant and derives moderator from its role', async () => {
    const { session, sdk } = await joined();
    expect(session.getSnapshot().isModerator).toBe(false);
    sdk.lastRoom.setParticipant({ sessionId: 'S-self', role: 'TEACHER' });
    const snapshot = session.getSnapshot();
    expect(snapshot.isModerator).toBe(true);
    expect(snapshot.participants.find((p) => p.isSelf)?.sessionId).toBe(
      'S-self',
    );
  });

  it('ends with the typed reason and releases the microphone when the join is refused', async () => {
    const { session, sdk, localStream, audioContexts } = setup();
    sdk.failNextJoinWith(
      Object.assign(new Error('call_not_started'), { code: 403 }),
    );
    await session.join(JOIN);
    expect(session.getSnapshot()).toMatchObject({
      status: 'ended',
      endReason: 'not-started',
    });
    expect(localStream.tracks[0]!.stop).toHaveBeenCalled();
    expect(audioContexts[0]!.close).toHaveBeenCalled();
  });

  it('joins as a listener and reports the typed error when the microphone is denied', async () => {
    const { session, sends, pc, sdk } = await joined({
      mic: new MicCaptureError('denied'),
    });
    expect(session.getSnapshot()).toMatchObject({
      status: 'connected',
      micError: 'denied',
    });
    expect(sends('call:self')).toEqual([['call:self', { muted: true }]]);
    sdk.lastRoom.setParticipant({ sessionId: 'S-peer' });
    expect(pc(0).addedTracks).toEqual([]);
    expect(pc(0).transceivers).toHaveLength(1);
    expect(session.setMuted(false)).toBe('refused');
  });

  it('leave() leaves the room, stops tracks, closes peers and the audio context', async () => {
    const { session, sdk, localStream, audioContexts, pc } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-peer' });
    await session.leave();
    expect(sdk.lastRoom.leave).toHaveBeenCalledWith(true);
    expect(pc(0).closed).toBe(true);
    expect(localStream.tracks[0]!.stop).toHaveBeenCalled();
    expect(audioContexts[0]!.close).toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('idle');
  });

  it('dispose() behaves like leave() and is idempotent', async () => {
    const { session, localStream } = await joined();
    session.dispose();
    session.dispose();
    expect(localStream.tracks[0]!.stop).toHaveBeenCalledTimes(1);
  });
});

describe('createCallSession peers and signaling (#141)', () => {
  it('creates and tears down peers as participants join and leave the state', async () => {
    const { sdk, pc, peers } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    sdk.lastRoom.setParticipant({ sessionId: 'S-b' });
    expect(peers.connections).toHaveLength(2);
    sdk.lastRoom.removeParticipant('S-a');
    expect(pc(0).closed).toBe(true);
    expect(pc(1).closed).toBe(false);
  });

  it('sends negotiation signals through the call room', async () => {
    const { sdk, pc, sends } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    pc(0).fireNegotiationNeeded();
    await flush();
    expect(sends('call:signal')).toEqual([
      [
        'call:signal',
        { to: 'S-a', payload: { type: 'offer', sdp: 'offer-sdp-1' } },
      ],
    ]);
  });

  it('routes relayed signals to the matching peer', async () => {
    const { sdk, pc, sends } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    sdk.lastRoom.emitMessage('call:signal', {
      from: 'S-a',
      payload: { type: 'offer', sdp: 'remote' },
    });
    await flush();
    expect(pc(0).remoteDescriptions).toEqual([
      { type: 'offer', sdp: 'remote' },
    ]);
    expect(sends('call:signal')[0]![1]).toMatchObject({ to: 'S-a' });
  });
});

describe('createCallSession receiver-side mute (#141)', () => {
  async function withRemoteAudio() {
    const ctx = await joined();
    ctx.sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    const remote = new FakeStream([new FakeTrack()]);
    ctx.pc(0).emitTrack(remote);
    await flush();
    return { ...ctx, remote, element: ctx.elements[0]! };
  }

  it('plays a remote participant that is not muted', async () => {
    const { element } = await withRemoteAudio();
    expect(element.play).toHaveBeenCalled();
    expect(element.muted).toBe(false);
  });

  it.each([['forcedMuted'], ['selfMuted']])(
    'does not play a participant that is %s',
    async (flag) => {
      const { sdk, element, remote } = await withRemoteAudio();
      sdk.lastRoom.setParticipant({ sessionId: 'S-a', [flag]: true });
      expect(element.pause).toHaveBeenCalled();
      expect(element.muted).toBe(true);
      expect(remote.tracks[0]!.enabled).toBe(false);
      sdk.lastRoom.setParticipant({ sessionId: 'S-a', [flag]: false });
      expect(remote.tracks[0]!.enabled).toBe(true);
    },
  );

  it('surfaces needsAudioUnlock when playback is blocked and clears it on resumeAudio()', async () => {
    const ctx = await joined();
    ctx.sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    ctx.pc(0).emitTrack(new FakeStream());
    const element = ctx.elements[0]!;
    element.rejectPlay = true;
    ctx.sdk.lastRoom.setParticipant({ sessionId: 'S-a', selfMuted: true });
    ctx.sdk.lastRoom.setParticipant({ sessionId: 'S-a', selfMuted: false });
    await flush();
    expect(ctx.session.getSnapshot().needsAudioUnlock).toBe(true);
    element.rejectPlay = false;
    await ctx.session.resumeAudio();
    expect(ctx.session.getSnapshot().needsAudioUnlock).toBe(false);
    expect(ctx.audioContexts[0]!.resume).toHaveBeenCalledTimes(2);
  });
});

describe('createCallSession stale joins and speaking resync (#141)', () => {
  it('a stale join resolving its microphone late does not stop the current call mic', async () => {
    const stale = new FakeStream();
    const current = new FakeStream();
    let resolveStale: (stream: MediaStream) => void = () => undefined;
    const queue = [
      () => new Promise<MediaStream>((resolve) => (resolveStale = resolve)),
      () => Promise.resolve(asStream(current)),
    ];
    const { session, sdk, pc } = setup({
      captureMic: () => queue.shift()!(),
    });
    void session.join(JOIN);
    await session.leave();
    await session.join(JOIN);
    resolveStale(asStream(stale));
    await flush();
    expect(stale.tracks[0]!.stop).toHaveBeenCalled();
    expect(current.tracks[0]!.stop).not.toHaveBeenCalled();
    expect(session.getSnapshot().status).toBe('connected');
    expect(session.getSnapshot().self.hasMicrophone).toBe(true);
    // A rejoin rebuilds the mesh from the shared local stream.
    sdk.lastRoom.emitLeave(1006);
    await flush();
    sdk.lastRoom.setParticipant({ sessionId: 'S-peer' });
    expect(pc(0).addedTracks).toEqual([current.tracks[0]]);
  });

  it('re-sends the current speaking state when unmuting while still talking', async () => {
    vi.useFakeTimers();
    const { session, audioContexts, sends } = setup();
    await session.join(JOIN);
    audioContexts[0]!.analysers[0]!.amplitude = 0.1;
    await vi.advanceTimersByTimeAsync(300);
    session.setMuted(true);
    await vi.advanceTimersByTimeAsync(50);
    session.setMuted(false);
    expect(sends('call:self').at(-1)).toEqual([
      'call:self',
      { muted: false, speaking: true },
    ]);
  });

  it('re-sends speaking when a moderator unmute clears the forced mute', async () => {
    vi.useFakeTimers();
    const { session, sdk, audioContexts, sends } = setup();
    await session.join(JOIN);
    audioContexts[0]!.analysers[0]!.amplitude = 0.1;
    sdk.lastRoom.setParticipant({ sessionId: 'S-self', forcedMuted: true });
    await vi.advanceTimersByTimeAsync(300);
    sdk.lastRoom.setParticipant({ sessionId: 'S-self', forcedMuted: false });
    expect(sends('call:self').at(-1)).toEqual([
      'call:self',
      { speaking: true },
    ]);
  });
});

describe('createCallSession local mute and actions (#141)', () => {
  it('mutes the local track and tells the room', async () => {
    const { session, localStream, sends } = await joined();
    expect(session.toggleMute()).toBe('ok');
    expect(localStream.tracks[0]!.enabled).toBe(false);
    expect(sends('call:self')).toEqual([['call:self', { muted: true }]]);
    expect(session.getSnapshot().self.muted).toBe(true);
    expect(session.toggleMute()).toBe('ok');
    expect(localStream.tracks[0]!.enabled).toBe(true);
  });

  it('refuses an unmute while force-muted without self unmute', async () => {
    const { session, sdk, localStream, sends } = await joined();
    sdk.lastRoom.setFlags({ allowSelfUnmute: false });
    sdk.lastRoom.setParticipant({ sessionId: 'S-self', forcedMuted: true });
    expect(localStream.tracks[0]!.enabled).toBe(false);
    expect(session.getSnapshot().self).toMatchObject({
      forcedMuted: true,
      canUnmute: false,
    });
    expect(session.setMuted(false)).toBe('refused');
    expect(localStream.tracks[0]!.enabled).toBe(false);
    expect(sends('call:self')).toEqual([]);
  });

  it('reports speaking changes from the voice detector and suppresses them while muted', async () => {
    vi.useFakeTimers();
    const { session, audioContexts, sends } = setup();
    await session.join(JOIN);
    const analyser = audioContexts[0]!.analysers[0]!;
    analyser.amplitude = 0.1;
    await vi.advanceTimersByTimeAsync(300);
    expect(sends('call:self')).toContainEqual([
      'call:self',
      { speaking: true },
    ]);
    session.setMuted(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(
      sends('call:self').filter(([, body]) => 'speaking' in (body as object)),
    ).toEqual([['call:self', { speaking: true }]]);
    expect(session.getLevel('S-self')).toBeGreaterThanOrEqual(0);
  });

  it('sends emotes, and moderation only for a moderator', async () => {
    const { session, sdk, sends } = await joined();
    session.sendEmote('wave');
    expect(sends('call:emote')).toEqual([['call:emote', { emote: 'wave' }]]);
    session.moderate({ action: 'mute-all' });
    session.endCall();
    expect(sends('call:moderate')).toEqual([]);
    expect(sends('call:end')).toEqual([]);
    sdk.lastRoom.setParticipant({ sessionId: 'S-self', role: 'TEACHER' });
    session.moderate({ action: 'mute-all' });
    session.endCall();
    expect(sends('call:moderate')).toEqual([
      ['call:moderate', { action: 'mute-all' }],
    ]);
    expect(sends('call:end')).toEqual([['call:end', {}]]);
  });
});

describe('createCallSession close handling (#141)', () => {
  it('ends the call with the moderator reason and cleans up', async () => {
    const { session, sdk, localStream, pc } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    sdk.lastRoom.emitMessage('call:ended', { reason: 'moderator_ended' });
    sdk.lastRoom.emitLeave(4102, 'call_ended');
    expect(session.getSnapshot()).toMatchObject({
      status: 'ended',
      endReason: 'moderator_ended',
    });
    expect(localStream.tracks[0]!.stop).toHaveBeenCalled();
    expect(pc(0).closed).toBe(true);
  });

  it('rejoins once after an unexpected drop and rebuilds the mesh', async () => {
    const { session, sdk, pc, peers, localStream } = await joined();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    sdk.lastRoom.emitLeave(1006);
    expect(session.getSnapshot().status).toBe('reconnecting');
    expect(pc(0).closed).toBe(true);
    await flush();
    expect(session.getSnapshot().status).toBe('connected');
    expect(sdk.joins).toHaveLength(2);
    expect(localStream.tracks[0]!.stop).not.toHaveBeenCalled();
    sdk.lastRoom.setParticipant({ sessionId: 'S-a' });
    expect(peers.connections).toHaveLength(2);
    expect(pc(1).closed).toBe(false);
  });

  it('gives up after the single rejoin also drops', async () => {
    const { session, sdk } = await joined();
    sdk.lastRoom.emitLeave(1006);
    await flush();
    sdk.lastRoom.emitLeave(1006);
    await flush();
    expect(session.getSnapshot()).toMatchObject({
      status: 'ended',
      endReason: 'connection-error',
    });
    expect(sdk.joins).toHaveLength(2);
  });

  it('ends when the rejoin itself fails', async () => {
    const { session, sdk } = await joined();
    sdk.failNextJoinWith(
      Object.assign(new Error('call_not_started'), { code: 403 }),
    );
    sdk.lastRoom.emitLeave(1006);
    await flush();
    expect(session.getSnapshot()).toMatchObject({
      status: 'ended',
      endReason: 'not-started',
    });
  });

  it('does not rejoin after a replaced or full close', async () => {
    const { session, sdk } = await joined();
    sdk.lastRoom.emitLeave(4104, 'call_replaced');
    await flush();
    expect(session.getSnapshot().endReason).toBe('replaced');
    expect(sdk.joins).toHaveLength(1);
  });
});
