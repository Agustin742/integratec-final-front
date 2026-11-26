import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiQueryProvider, createAppQueryClient } from '@/api/query-client';
import { fakeSession } from '@/app/router/fake-session';
import { ClassroomRealtimeProvider } from '@/realtime/classroom-realtime-provider';
import { SessionProvider } from '@/session/provider';
import { profile } from '@/session/test-fixtures';
import { createFakeRealtimeSdk } from '@/test/realtime/fake-realtime-sdk';
import { useClassroomCallSignals } from './use-classroom-call-signals';

const CLASSROOM = '7b1f3c52-8d1e-4f0a-9a57-2c6f5e8d9a10';
const CALLER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function setup() {
  const sdk = createFakeRealtimeSdk();
  const session = fakeSession({ status: 'authenticated', user: profile });
  session.service.controller.getAccessToken = () => 'live-token';
  session.service.controller.refreshAccessToken = async () => 'live-token';
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <ApiQueryProvider client={createAppQueryClient()}>
        <SessionProvider service={session.service}>
          <ClassroomRealtimeProvider
            realtimeUrl="wss://realtime.example.invalid"
            createSdkClient={sdk.createSdkClient}
            releaseGraceMs={0}
          >
            {children}
          </ClassroomRealtimeProvider>
        </SessionProvider>
      </ApiQueryProvider>
    </StrictMode>
  );
  const view = renderHook(() => useClassroomCallSignals(CLASSROOM), {
    wrapper,
  });
  const room = async () => {
    await waitFor(() => expect(sdk.roomFor(CLASSROOM)).toBeDefined());
    await waitFor(() => expect(view.result.current.connected).toBe(true));
    return sdk.roomFor(CLASSROOM)!;
  };
  return { ...view, sdk, room };
}

const incoming = (callerUserId: string, name = 'Ana') => ({
  classroomId: CLASSROOM,
  callerUserId,
  callerDisplayName: name,
});

describe('useClassroomCallSignals (#141)', () => {
  it('mirrors the class call and focus flags from the classroom state', async () => {
    const t = setup();
    const room = await t.room();
    expect(t.result.current).toMatchObject({
      classCallActive: false,
      focusMode: false,
    });
    act(() => room.setControls({ classCallActive: true, focusMode: true }));
    expect(t.result.current).toMatchObject({
      classCallActive: true,
      focusMode: true,
    });
  });

  it('tracks an incoming direct call once per caller and drops it when the ring is canceled', async () => {
    const t = setup();
    const room = await t.room();
    act(() => {
      room.emitMessage('call:incoming', incoming(CALLER));
    });
    expect(t.result.current.incomingCalls).toEqual([
      { callerUserId: CALLER, callerDisplayName: 'Ana' },
    ]);
    act(() => {
      room.emitMessage('call:incoming', incoming(CALLER.toUpperCase(), 'Ana'));
    });
    expect(t.result.current.incomingCalls).toHaveLength(1);
    act(() => {
      room.emitMessage('call:ring-canceled', {
        callerUserId: CALLER.toUpperCase(),
        reason: 'caller_left',
      });
    });
    expect(t.result.current.incomingCalls).toEqual([]);
  });

  it('ignores malformed payloads and calls for another classroom', async () => {
    const t = setup();
    const room = await t.room();
    act(() => {
      room.emitMessage('call:incoming', { callerUserId: 'nope' });
      room.emitMessage('call:incoming', {
        ...incoming(OTHER),
        classroomId: '33333333-3333-4333-8333-333333333333',
      });
    });
    expect(t.result.current.incomingCalls).toEqual([]);
  });

  it('declining sends call:decline over the classroom connection and clears the ring', async () => {
    const t = setup();
    const room = await t.room();
    act(() => {
      room.emitMessage('call:incoming', incoming(CALLER));
    });
    act(() => {
      expect(t.result.current.declineCall(CALLER)).toBe(true);
    });
    expect(room.send).toHaveBeenCalledWith('call:decline', {
      callerUserId: CALLER,
    });
    expect(t.result.current.incomingCalls).toEqual([]);
  });

  it('records who declined my direct call until dismissed', async () => {
    const t = setup();
    const room = await t.room();
    act(() => {
      room.emitMessage('call:declined', { byUserId: OTHER });
    });
    expect(t.result.current.declinedByUserId).toBe(OTHER);
    act(() => t.result.current.dismissDeclined());
    expect(t.result.current.declinedByUserId).toBeNull();
  });
});
