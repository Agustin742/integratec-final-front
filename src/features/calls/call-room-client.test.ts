import { describe, expect, it, vi } from 'vitest';
import type { RealtimeAuthPort } from '@/realtime/client';
import { createFakeCallSdk } from '@/test/calls/call-fakes';
import {
  CallRoomError,
  createCallRoomClient,
  type CallConnectionHandlers,
} from './call-room-client';

const CLASSROOM = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const PEER = '11111111-1111-4111-8111-111111111111';

function auth(overrides: Partial<RealtimeAuthPort> = {}): RealtimeAuthPort {
  return {
    getAccessToken: () => 'token-1',
    refreshAccessToken: async () => 'token-2',
    registerCleanup: () => () => {},
    ...overrides,
  };
}

function handlers(): CallConnectionHandlers & {
  states: unknown[];
  signals: unknown[];
  closed: { reason: string; unexpected: boolean }[];
} {
  const states: unknown[] = [];
  const signals: unknown[] = [];
  const closed: { reason: string; unexpected: boolean }[] = [];
  return {
    states,
    signals,
    closed,
    onState: (snapshot) => states.push(snapshot),
    onSignal: (relay) => signals.push(relay),
    onClosed: (reason, unexpected) => closed.push({ reason, unexpected }),
  };
}

async function open(options?: { auth?: RealtimeAuthPort }) {
  const sdk = createFakeCallSdk();
  const client = createCallRoomClient({
    auth: options?.auth ?? auth(),
    realtimeUrl: 'wss://realtime.example.invalid',
    createSdkClient: sdk.createSdkClient,
  });
  const h = handlers();
  const connection = await client.join(
    { kind: 'classroom', classroomId: CLASSROOM },
    h,
  );
  return { sdk, client, h, connection };
}

describe('createCallRoomClient join (#141)', () => {
  it('joins the call room with the bearer token and the join options only', async () => {
    const { sdk, connection } = await open();
    expect(sdk.joins).toEqual([
      {
        roomName: 'call',
        options: { kind: 'classroom', classroomId: CLASSROOM },
        token: 'token-1',
      },
    ]);
    expect(connection.sessionId).toBe('S-self');
    expect(sdk.lastRoom.reconnection.enabled).toBe(false);
  });

  it('sends peerUserId for a direct call', async () => {
    const sdk = createFakeCallSdk();
    const client = createCallRoomClient({
      auth: auth(),
      createSdkClient: sdk.createSdkClient,
      realtimeUrl: 'wss://realtime.example.invalid',
    });
    await client.join(
      { kind: 'direct', classroomId: CLASSROOM, peerUserId: PEER },
      handlers(),
    );
    expect(sdk.joins[0]!.options).toEqual({
      kind: 'direct',
      classroomId: CLASSROOM,
      peerUserId: PEER,
    });
  });

  it('fails with unauthorized without a token', async () => {
    const sdk = createFakeCallSdk();
    const client = createCallRoomClient({
      auth: auth({ getAccessToken: () => undefined }),
      createSdkClient: sdk.createSdkClient,
      realtimeUrl: 'wss://realtime.example.invalid',
    });
    await expect(
      client.join({ kind: 'classroom', classroomId: CLASSROOM }, handlers()),
    ).rejects.toMatchObject({ reason: 'unauthorized' });
    expect(sdk.joins).toEqual([]);
  });

  it('refreshes the token once after a 401 and retries', async () => {
    const sdk = createFakeCallSdk();
    sdk.failNextJoinWith(
      Object.assign(new Error('unauthorized'), { code: 401 }),
    );
    const client = createCallRoomClient({
      auth: auth(),
      createSdkClient: sdk.createSdkClient,
      realtimeUrl: 'wss://realtime.example.invalid',
    });
    await client.join(
      { kind: 'classroom', classroomId: CLASSROOM },
      handlers(),
    );
    expect(sdk.joins.map((join) => join.token)).toEqual(['token-1', 'token-2']);
  });

  it.each([
    [{ code: 403, message: 'call_not_started' }, 'not-started'],
    [{ code: 403, message: 'forbidden' }, 'forbidden'],
    [{ code: 4101, message: 'call_full' }, 'full'],
    [
      { code: 4100, message: 'verification_unavailable' },
      'verification-unavailable',
    ],
    [{ code: 500, message: 'boom' }, 'connection-error'],
  ])('maps join failure %j to %s', async (failure, reason) => {
    const sdk = createFakeCallSdk();
    sdk.failNextJoinWith(Object.assign(new Error(failure.message), failure));
    const client = createCallRoomClient({
      auth: auth(),
      createSdkClient: sdk.createSdkClient,
      realtimeUrl: 'wss://realtime.example.invalid',
    });
    const error = await client
      .join({ kind: 'classroom', classroomId: CLASSROOM }, handlers())
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CallRoomError);
    expect((error as CallRoomError).reason).toBe(reason);
  });
});

describe('createCallRoomClient live room (#141)', () => {
  it('reads participants, flags and appearance into a plain snapshot', async () => {
    const { sdk, h, connection } = await open();
    sdk.lastRoom.setParticipant({
      sessionId: 'S-peer',
      userId: 'user-peer',
      displayName: 'Ana',
      role: 'TEACHER',
      selfMuted: true,
      speaking: false,
      emote: 'wave',
      emoteSeq: 3,
    });
    sdk.lastRoom.setFlags({ focusMode: true, allowSelfUnmute: false });
    const snapshot = connection.getSnapshot();
    expect(snapshot).toMatchObject({
      kind: 'classroom',
      focusMode: true,
      allowSelfUnmute: false,
    });
    expect(snapshot.participants.get('S-peer')).toMatchObject({
      sessionId: 'S-peer',
      userId: 'user-peer',
      displayName: 'Ana',
      role: 'TEACHER',
      selfMuted: true,
      forcedMuted: false,
      emote: 'wave',
      emoteSeq: 3,
      appearance: { items: {} },
    });
    expect(h.states.length).toBeGreaterThan(0);
  });

  it('relays valid signals and drops malformed ones', async () => {
    const { sdk, h } = await open();
    sdk.lastRoom.emitMessage('call:signal', {
      from: 'S-peer',
      payload: { type: 'offer', sdp: 'x' },
    });
    sdk.lastRoom.emitMessage('call:signal', { from: 'S-peer', payload: {} });
    sdk.lastRoom.emitMessage('call:other', {});
    expect(h.signals).toEqual([
      { from: 'S-peer', payload: { type: 'offer', sdp: 'x' } },
    ]);
  });

  it('sends signaling, self state, emotes, moderation and end messages', async () => {
    const { sdk, connection } = await open();
    connection.sendSignal('S-peer', { type: 'answer', sdp: 'y' });
    connection.sendSelf({ muted: true });
    connection.sendEmote('wave');
    connection.moderate({ action: 'mute-all' });
    connection.endCall();
    expect(sdk.lastRoom.send.mock.calls).toEqual([
      ['call:signal', { to: 'S-peer', payload: { type: 'answer', sdp: 'y' } }],
      ['call:self', { muted: true }],
      ['call:emote', { emote: 'wave' }],
      ['call:moderate', { action: 'mute-all' }],
      ['call:end', {}],
    ]);
  });

  it('does not send an invalid message', async () => {
    const { sdk, connection } = await open();
    connection.sendSelf({});
    connection.moderate({ action: 'mute', targetUserId: 'not-a-uuid' });
    expect(sdk.lastRoom.send).not.toHaveBeenCalled();
  });

  it.each([
    [4101, undefined, 'full', false],
    [4104, undefined, 'replaced', false],
    [4100, undefined, 'verification-unavailable', false],
    [4001, 'access_revoked', 'access-revoked', false],
    [4001, undefined, 'connection-error', true],
    [1006, undefined, 'connection-error', true],
  ])(
    'maps close %s %s to %s (unexpected=%s)',
    async (code, text, reason, unexpected) => {
      const { sdk, h } = await open();
      sdk.lastRoom.emitLeave(code, text);
      expect(h.closed).toEqual([{ reason, unexpected }]);
    },
  );

  it('uses the reason of call:ended when the room closes with 4102', async () => {
    const { sdk, h } = await open();
    sdk.lastRoom.emitMessage('call:ended', { reason: 'moderator_ended' });
    sdk.lastRoom.emitLeave(4102, 'call_ended');
    expect(h.closed).toEqual([
      { reason: 'moderator_ended', unexpected: false },
    ]);
  });

  it('reports a dropped connection once as unexpected', async () => {
    const { sdk, h } = await open();
    sdk.lastRoom.emitDrop();
    sdk.lastRoom.emitLeave(1006);
    expect(h.closed).toEqual([
      { reason: 'connection-error', unexpected: true },
    ]);
  });

  it('a consented leave closes the room without reporting a close', async () => {
    const { sdk, h, connection } = await open();
    await connection.leave();
    sdk.lastRoom.emitLeave(1000);
    expect(sdk.lastRoom.leave).toHaveBeenCalledWith(true);
    expect(h.closed).toEqual([]);
    expect(vi.isMockFunction(sdk.lastRoom.leave)).toBe(true);
  });
});
