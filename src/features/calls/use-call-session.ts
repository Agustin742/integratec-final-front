import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSessionService } from '@/session/provider';
import {
  createCallRoomClient,
  type CallSdkClientLike,
} from './call-room-client';
import {
  createCallSession,
  type CallSession,
  type CallSessionDeps,
  type CallSessionSnapshot,
} from './call-session';
import { captureMicrophone } from './mic-capture';

export interface UseCallSessionOptions {
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => CallSdkClientLike;
  /** Test seam: replaces the browser WebRTC / audio / microphone engine. */
  readonly engine?: Partial<Omit<CallSessionDeps, 'roomClient'>>;
}

export interface UseCallSessionResult extends CallSessionSnapshot {
  readonly join: CallSession['join'];
  readonly leave: CallSession['leave'];
  readonly setMuted: CallSession['setMuted'];
  readonly toggleMute: CallSession['toggleMute'];
  readonly sendEmote: CallSession['sendEmote'];
  readonly moderate: CallSession['moderate'];
  readonly endCall: CallSession['endCall'];
  readonly resumeAudio: CallSession['resumeAudio'];
  /** Reads the smoothed voice level (0..1) without re-rendering per audio frame. */
  readonly getLevel: CallSession['getLevel'];
}

/**
 * One voice call for the signed-in user. The hook owns the session: leaving the
 * screen (or unmounting under StrictMode) leaves the call, stops the microphone
 * and closes every peer. `join` must be called from a click handler so audio
 * playback is primed inside the user gesture.
 */
export function useCallSession(
  options: UseCallSessionOptions = {},
): UseCallSessionResult {
  const { controller } = useSessionService();
  // Options configure the session once (URL, SDK, test engine); changing them later is not supported.
  const [initial] = useState(options);

  const session = useMemo(() => {
    return createCallSession({
      roomClient: createCallRoomClient({
        auth: controller,
        realtimeUrl: initial.realtimeUrl,
        createSdkClient: initial.createSdkClient,
      }),
      captureMic: captureMicrophone,
      createPeerConnection: (configuration) =>
        new RTCPeerConnection(configuration),
      createAudioContext: () => new AudioContext(),
      ...initial.engine,
    });
  }, [controller, initial]);

  useEffect(() => {
    return () => session.dispose();
  }, [session]);

  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  return useMemo(
    () => ({
      ...snapshot,
      join: session.join,
      leave: session.leave,
      setMuted: session.setMuted,
      toggleMute: session.toggleMute,
      sendEmote: session.sendEmote,
      moderate: session.moderate,
      endCall: session.endCall,
      resumeAudio: session.resumeAudio,
      getLevel: session.getLevel,
    }),
    [snapshot, session],
  );
}
