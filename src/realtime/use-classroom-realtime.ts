import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionService, useSessionSnapshot } from '@/session/provider';
import type { ClassroomRealtimeLease } from './classroom-realtime-manager';
import { useClassroomRealtimeManager } from './classroom-realtime-provider';
import {
  createClassroomRealtimeClient,
  realtimeMessages,
  type ClassroomRealtimeClient,
  type RealtimeClassroomControls,
  type RealtimeParticipant,
  type RealtimeSdkClientLike,
  type RealtimeSnapshot,
} from './client';
import type { NpcView } from '@/features/world/npc/npc-view';
import type { AvatarInput } from './contracts.generated';

const EMPTY_PARTICIPANTS: ReadonlyMap<string, RealtimeParticipant> = new Map();
const EMPTY_NPCS: ReadonlyMap<string, NpcView> = new Map();
const DEFAULT_CONTROLS: RealtimeClassroomControls = Object.freeze({
  frozen: false,
});

const DISCONNECTED_SNAPSHOT: RealtimeSnapshot = Object.freeze({
  status: 'disconnected',
  classroomId: null,
  roomId: null,
  sessionId: null,
  presenceUncertain: true,
  reason: null,
  message: null,
  participants: EMPTY_PARTICIPANTS,
  npcs: EMPTY_NPCS,
  controls: DEFAULT_CONTROLS,
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
  readonly interactNpc: (npcId: string) => boolean;
}

/**
 * Connects to the authoritative Colyseus classroom room for the active
 * authenticated session and guarantees cleanup across StrictMode double-mounts,
 * classroom switches, and logout (`rules/realtime-and-presence.md`, `#23`, `#37`).
 * When mounted under `ClassroomRealtimeProvider` without custom test overrides,
 * acquires a shared lease so chat and the 3D classroom share one connection.
 */
export function useClassroomRealtime({
  classroomId,
  enabled = true,
  realtimeUrl,
  createSdkClient,
}: UseClassroomRealtimeOptions): UseClassroomRealtimeResult {
  const { controller } = useSessionService();
  const session = useSessionSnapshot();
  const manager = useClassroomRealtimeManager();
  const sessionUserId =
    session.status === 'authenticated' ? session.user.id : null;
  const trimmedClassroomId = classroomId?.trim() || null;
  const activeClassroomId =
    enabled && sessionUserId !== null ? trimmedClassroomId : null;
  const hasCustomOverride =
    realtimeUrl !== undefined || createSdkClient !== undefined;

  const [ownedSnapshot, setOwnedSnapshot] = useState<{
    readonly ownerUserId: string;
    readonly snapshot: RealtimeSnapshot;
  } | null>(null);
  const clientRef = useRef<ClassroomRealtimeClient | null>(null);
  const leaseRef = useRef<ClassroomRealtimeLease | null>(null);
  const leaseUnsubscribeRef = useRef<(() => void) | null>(null);
  const activeScopeRef = useRef<{
    readonly classroomId: string;
    readonly userId: string;
  } | null>(null);

  useEffect(() => {
    if (activeClassroomId === null || sessionUserId === null) {
      activeScopeRef.current = null;
      return undefined;
    }

    activeScopeRef.current = {
      classroomId: activeClassroomId,
      userId: sessionUserId,
    };

    if (hasCustomOverride) {
      const client = createClassroomRealtimeClient({
        auth: controller,
        realtimeUrl,
        createSdkClient,
      });
      clientRef.current = client;

      const unsubscribe = client.subscribe(() => {
        setOwnedSnapshot({
          ownerUserId: sessionUserId,
          snapshot: client.getSnapshot(),
        });
      });
      void client.connect(activeClassroomId);

      return () => {
        activeScopeRef.current = null;
        unsubscribe();
        if (clientRef.current === client) {
          clientRef.current = null;
        }
        client.dispose();
      };
    }

    if (manager === null) {
      return () => {
        activeScopeRef.current = null;
      };
    }

    let cancelled = false;
    const lease = manager.acquire(activeClassroomId);
    if (lease === null) {
      leaseRef.current = null;
      clientRef.current = null;
      queueMicrotask(() => {
        if (cancelled || leaseRef.current !== null) return;
        setOwnedSnapshot({
          ownerUserId: sessionUserId,
          snapshot: Object.freeze({
            status: 'rejected',
            classroomId: activeClassroomId,
            roomId: null,
            sessionId: null,
            presenceUncertain: true,
            reason: 'too-many-connections',
            message: realtimeMessages.tooManyConnections,
            participants: EMPTY_PARTICIPANTS,
            npcs: EMPTY_NPCS,
            controls: DEFAULT_CONTROLS,
          }),
        });
      });
    } else {
      leaseRef.current = lease;
      clientRef.current = lease.client;
      const syncFromLease = () => {
        if (cancelled || leaseRef.current !== lease) return;
        setOwnedSnapshot({
          ownerUserId: sessionUserId,
          snapshot: lease.client.getSnapshot(),
        });
      };
      leaseUnsubscribeRef.current = lease.client.subscribe(syncFromLease);
      queueMicrotask(syncFromLease);
    }

    return () => {
      cancelled = true;
      activeScopeRef.current = null;
      leaseUnsubscribeRef.current?.();
      leaseUnsubscribeRef.current = null;
      const currentLease = leaseRef.current;
      leaseRef.current = null;
      if (currentLease && clientRef.current === currentLease.client) {
        clientRef.current = null;
      }
      currentLease?.release();
    };
  }, [
    activeClassroomId,
    controller,
    createSdkClient,
    hasCustomOverride,
    manager,
    realtimeUrl,
    sessionUserId,
  ]);

  const reconnect = useCallback(async () => {
    if (activeClassroomId === null || sessionUserId === null) {
      return false;
    }
    if (clientRef.current !== null) {
      return clientRef.current.connect(activeClassroomId);
    }
    if (hasCustomOverride || manager === null) {
      return false;
    }
    const scope = activeScopeRef.current;
    if (
      scope === null ||
      scope.classroomId !== activeClassroomId ||
      scope.userId !== sessionUserId
    ) {
      return false;
    }
    const lease = manager.acquire(activeClassroomId);
    if (lease === null) {
      return false;
    }
    leaseRef.current = lease;
    clientRef.current = lease.client;
    const syncFromLease = () => {
      if (leaseRef.current !== lease) return;
      setOwnedSnapshot({
        ownerUserId: sessionUserId,
        snapshot: lease.client.getSnapshot(),
      });
    };
    leaseUnsubscribeRef.current = lease.client.subscribe(syncFromLease);
    syncFromLease();
    return lease.client.connect(activeClassroomId);
  }, [activeClassroomId, hasCustomOverride, manager, sessionUserId]);

  const sendAvatarInput = useCallback(
    (input: AvatarInput) => {
      if (activeClassroomId === null || !clientRef.current) {
        return false;
      }
      return clientRef.current.sendAvatarInput(input);
    },
    [activeClassroomId],
  );

  const interactNpc = useCallback(
    (npcId: string) => {
      if (activeClassroomId === null || !clientRef.current) {
        return false;
      }
      return clientRef.current.interactNpc(npcId);
    },
    [activeClassroomId],
  );

  const visibleSnapshot =
    activeClassroomId === null ||
    sessionUserId === null ||
    ownedSnapshot === null ||
    ownedSnapshot.ownerUserId !== sessionUserId ||
    ownedSnapshot.snapshot.classroomId !== activeClassroomId
      ? DISCONNECTED_SNAPSHOT
      : ownedSnapshot.snapshot;

  return {
    ...visibleSnapshot,
    reconnect,
    sendAvatarInput,
    interactNpc,
  };
}
