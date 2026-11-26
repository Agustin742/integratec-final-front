import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import {
  FakeAudioContext,
  FakeAudioElement,
  FakeStream,
  asStream,
  createFakeCallSdk,
  createFakePeerFactory,
} from '@/test/calls/call-fakes';
import { useCallSession } from './use-call-session';

const CLASSROOM = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';

function setup() {
  const sdk = createFakeCallSdk();
  const peers = createFakePeerFactory();
  const localStream = new FakeStream();
  const session = fakeSession({ status: 'authenticated', user: profile });
  session.service.controller.getAccessToken = () => 'live-token';
  session.service.controller.refreshAccessToken = async () => 'live-token';
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <ApiQueryProvider client={createAppQueryClient()}>
        <SessionProvider service={session.service}>{children}</SessionProvider>
      </ApiQueryProvider>
    </StrictMode>
  );
  const view = renderHook(
    () =>
      useCallSession({
        realtimeUrl: 'wss://realtime.example.invalid',
        createSdkClient: sdk.createSdkClient,
        engine: {
          captureMic: async () => asStream(localStream),
          createPeerConnection: peers.create,
          createAudioContext: () =>
            new FakeAudioContext() as unknown as AudioContext,
          createAudioElement: () =>
            new FakeAudioElement() as unknown as HTMLAudioElement,
        },
      }),
    { wrapper },
  );
  return { ...view, sdk, localStream };
}

describe('useCallSession (#141)', () => {
  it('starts idle, joins with the session token and exposes the live snapshot', async () => {
    const t = setup();
    expect(t.result.current.status).toBe('idle');
    await act(async () => {
      await t.result.current.join({
        kind: 'classroom',
        classroomId: CLASSROOM,
      });
    });
    expect(t.sdk.joins.map((join) => join.token)).toEqual(['live-token']);
    expect(t.result.current.status).toBe('connected');
    act(() => {
      t.sdk.lastRoom.setParticipant({
        sessionId: 'S-peer',
        displayName: 'Ana',
      });
    });
    await waitFor(() =>
      expect(t.result.current.participants.map((p) => p.displayName)).toContain(
        'Ana',
      ),
    );
  });

  it('leaves the call and stops the microphone when the component unmounts', async () => {
    const t = setup();
    await act(async () => {
      await t.result.current.join({
        kind: 'classroom',
        classroomId: CLASSROOM,
      });
    });
    t.unmount();
    expect(t.sdk.rooms[0]!.leave).toHaveBeenCalledWith(true);
    expect(t.localStream.tracks[0]!.stop).toHaveBeenCalled();
  });
});
