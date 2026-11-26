import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CALL_DECLINE_MESSAGE,
  CALL_DECLINED_EVENT,
  CALL_INCOMING_EVENT,
  CALL_RING_CANCELED_EVENT,
  callDeclineSchema,
  callDeclinedPayloadSchema,
  callIncomingPayloadSchema,
  callRingCanceledPayloadSchema,
} from '@/realtime/call-contracts.generated';
import type { ClassroomRealtimeClient } from '@/realtime/client';
import { useClassroomRealtimeManager } from '@/realtime/classroom-realtime-provider';
import { useClassroomRealtime } from '@/realtime/use-classroom-realtime';

export interface IncomingCall {
  readonly callerUserId: string;
  readonly callerDisplayName: string;
}

export interface ClassroomCallSignals {
  readonly connected: boolean;
  /** A class call is running in this classroom. */
  readonly classCallActive: boolean;
  /** The teacher locked the 3D world for students. */
  readonly focusMode: boolean;
  /** Direct calls ringing for this user (one per caller). */
  readonly incomingCalls: readonly IncomingCall[];
  /** Set when the peer declined the direct call this user started. */
  readonly declinedByUserId: string | null;
  readonly declineCall: (callerUserId: string) => boolean;
  readonly dismissDeclined: () => void;
}

/** User ids are UUIDs and the server compares them case-insensitively. */
const sameUser = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Call signals that travel over the classroom connection: the class call and
 * focus flags (state), direct-call rings, cancelations and declines (events).
 * It shares the app-wide classroom connection, so it never opens another one.
 */
export function useClassroomCallSignals(
  classroomId: string | null,
): ClassroomCallSignals {
  const manager = useClassroomRealtimeManager();
  const realtime = useClassroomRealtime({ classroomId });
  const [incomingCalls, setIncomingCalls] = useState<readonly IncomingCall[]>(
    [],
  );
  const [declinedByUserId, setDeclinedByUserId] = useState<string | null>(null);
  const clientRef = useRef<ClassroomRealtimeClient | null>(null);

  useEffect(() => {
    const id = classroomId?.trim() ?? '';
    if (manager === null || id === '') return undefined;
    const lease = manager.acquire(id);
    if (lease === null) return undefined;
    const { client } = lease;
    clientRef.current = client;

    const offIncoming = client.onMessage(
      CALL_INCOMING_EVENT,
      callIncomingPayloadSchema,
      (payload) => {
        if (payload.classroomId !== id) return;
        setIncomingCalls((current) =>
          current.some((call) =>
            sameUser(call.callerUserId, payload.callerUserId),
          )
            ? current
            : [
                ...current,
                {
                  callerUserId: payload.callerUserId,
                  callerDisplayName: payload.callerDisplayName,
                },
              ],
        );
      },
    );
    const offCanceled = client.onMessage(
      CALL_RING_CANCELED_EVENT,
      callRingCanceledPayloadSchema,
      (payload) => {
        setIncomingCalls((current) =>
          current.filter(
            (call) => !sameUser(call.callerUserId, payload.callerUserId),
          ),
        );
      },
    );
    const offDeclined = client.onMessage(
      CALL_DECLINED_EVENT,
      callDeclinedPayloadSchema,
      (payload) => setDeclinedByUserId(payload.byUserId),
    );

    return () => {
      offIncoming();
      offCanceled();
      offDeclined();
      if (clientRef.current === client) clientRef.current = null;
      lease.release();
      setIncomingCalls([]);
      setDeclinedByUserId(null);
    };
  }, [classroomId, manager]);

  const declineCall = useCallback((callerUserId: string) => {
    const sent =
      clientRef.current?.send(CALL_DECLINE_MESSAGE, callDeclineSchema, {
        callerUserId,
      }) ?? false;
    if (sent) {
      setIncomingCalls((current) =>
        current.filter((call) => !sameUser(call.callerUserId, callerUserId)),
      );
    }
    return sent;
  }, []);

  const dismissDeclined = useCallback(() => setDeclinedByUserId(null), []);

  return {
    connected: realtime.status === 'connected',
    classCallActive: realtime.controls.classCallActive === true,
    focusMode: realtime.controls.focusMode === true,
    incomingCalls,
    declinedByUserId,
    declineCall,
    dismissDeclined,
  };
}
