import type { ReactNode } from 'react';
import type { fakeSession } from '@/app/router/fake-session';
import { ClassroomRealtimeProvider } from '@/realtime/classroom-realtime-provider';
import { createFakeRealtimeSdk } from './fake-realtime-sdk';

/**
 * Wires the app-level realtime provider to a fake Colyseus SDK so component
 * suites can push `chat:message` events like the server would, without a socket.
 */
export function createLiveRealtimeHarness(
  session: ReturnType<typeof fakeSession>,
) {
  // The fake session has no tokens; the realtime client needs one to join.
  session.service.controller.getAccessToken = () => 'live-test-token';
  session.service.controller.refreshAccessToken = async () => 'live-test-token';
  const sdk = createFakeRealtimeSdk();

  function LiveRealtimeProvider({
    children,
  }: {
    readonly children: ReactNode;
  }) {
    return (
      <ClassroomRealtimeProvider
        realtimeUrl="wss://realtime.example.invalid"
        createSdkClient={sdk.createSdkClient}
        releaseGraceMs={0}
      >
        {children}
      </ClassroomRealtimeProvider>
    );
  }

  return { sdk, LiveRealtimeProvider };
}
