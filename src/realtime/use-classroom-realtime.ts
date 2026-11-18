import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import {
  createClassroomRealtimeClient,
  type ClassroomRealtimeClient,
  type RealtimeParticipant,
  type RealtimeSdkClientLike,
  type RealtimeSnapshot,
} from './client';
import type { AvatarInput } from './contracts.generated';

const EMPTY_PARTICIPANTS: ReadonlyMap<string, RealtimeParticipant> = new Map();

const DISCONNECTED_SNAPSHOT: RealtimeSnapshot = Object.freeze({
  status: 'disconnected',
  classroomId: null,
  roomId: null,
  sessionId: null,
  presenceUncertain: true,
  reason: null,
  message: null,
  participants: EMPTY_PARTICIPANTS,
});

export interface UseClassroomRealtimeOptions {
  readonly classroomId: string | null;
  readonly enabled?: boolean;
  readonly realtimeUrl?: string;
  readonly createSdkClient?: (endpoint: string) => RealtimeSdkClientLike;
}

export interface UseClassroomRealtimeResult extends RealtimeSnapshot {
  readonly reconnect: () => Promise<boolean>;
  readonly sendAvatarInput: (input: AvatarInput) => boolean;
}

/**
 * Connects to the authoritative Colyseus classroom room for the active
 * authenticated session and guarantees cleanup across StrictMode double-mounts,
 * classroom switches, and logout (`rules/realtime-and-presence.md`, `#23`).
 */
export function useClassroomRealtime({
  classroomId,
  enabled = true,
  realtimeUrl,
  createSdkClient,
}: UseClassroomRealtimeOptions): UseClassroomRealtimeResult {
  const { controller } = useSessionService();
  const session = useSessionSnapshot();
  const sessionUserId =
    session.status === 'authenticated' ? session.user.id : null;
  const trimmedClassroomId = classroomId?.trim() || null;
  const activeClassroomId =
    enabled && sessionUserId !== null ? trimmedClassroomId : null;

  const [snapshot, setSnapshot] = useState<RealtimeSnapshot>(
    DISCONNECTED_SNAPSHOT,
  );
  const clientRef = useRef<ClassroomRealtimeClient | null>(null);

  useEffect(() => {
    if (activeClassroomId === null) {
      return undefined;
    }

    const client = createClassroomRealtimeClient({
      auth: controller,
      realtimeUrl,
      createSdkClient,
    });
    clientRef.current = client;

    const unsubscribe = client.subscribe(() => {
      setSnapshot(client.getSnapshot());
    });
    void client.connect(activeClassroomId);

    return () => {
      unsubscribe();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      client.dispose();
    };
  }, [
    activeClassroomId,
    controller,
    createSdkClient,
    realtimeUrl,
    sessionUserId,
  ]);

  const reconnect = useCallback(async () => {
    if (activeClassroomId === null || !clientRef.current) {
      return false;
    }
    return clientRef.current.connect(activeClassroomId);
  }, [activeClassroomId]);

  const sendAvatarInput = useCallback(
    (input: AvatarInput) => {
      if (activeClassroomId === null || !clientRef.current) {
        return false;
      }
      return clientRef.current.sendAvatarInput(input);
    },
    [activeClassroomId],
  );

  const visibleSnapshot =
    activeClassroomId === null || snapshot.classroomId !== activeClassroomId
      ? DISCONNECTED_SNAPSHOT
      : snapshot;

  return {
    ...visibleSnapshot,
    reconnect,
    sendAvatarInput,
  };
}
