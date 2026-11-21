import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import {
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
} from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import type { Avatar } from '@/features/profile/avatar-options';
import type { Pose, RemoteClassroomParticipant } from '@/features/world';
import {
  realtimeMessages,
  useClassroomRealtime,
  type AvatarInput,
  type RealtimeConnectionStatus,
  type RealtimeFailureReason,
  type RealtimeParticipant,
} from '@/realtime';
import { useSessionService } from '@/session/provider';
import { avatarSchema } from '@/session/transport';
import { clearLoadedWorldAssets } from './classroom-3d-stage';
import type { ClassroomViewMode } from './classroom-mode-store';

type ClassroomDetail = components['schemas']['ClassroomContextResponseDto'];

const EMPTY_AVATARS = new Map<string, Avatar>();
const EMPTY_PARTICIPANTS: readonly RealtimeParticipant[] = [];
const EMPTY_REMOTE_PARTICIPANTS: readonly RemoteClassroomParticipant[] = [];

function toValidAvatar(raw: unknown): Avatar | undefined {
  const parsed = avatarSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export interface UseClassroomPresenceOptions {
  readonly classroomId: string;
  readonly userId: string | null;
  readonly enabled: boolean;
  readonly mode: ClassroomViewMode;
}

export interface ClassroomPresence {
  readonly isIdle: boolean;
  readonly status: RealtimeConnectionStatus;
  readonly presenceUncertain: boolean;
  readonly reason: RealtimeFailureReason | null;
  readonly message: string | null;
  readonly lostAccess: boolean;
  readonly lostAccessMessage: string;
  readonly frozen: boolean;
  readonly connectionKey: string;
  readonly selfPose: Pose | undefined;
  readonly participants: readonly RealtimeParticipant[];
  readonly remoteParticipants: readonly RemoteClassroomParticipant[];
  readonly reconnect: () => Promise<boolean>;
  readonly sendIntent: (intent: AvatarInput) => void;
}

/**
 * Coordinates the classroom's live Colyseus room session (#37):
 * - Shares one lease via `useClassroomRealtime` (`ClassroomRealtimeProvider`).
 * - Resolves remote base avatars from room appearance or `GET /classrooms/:id/members`.
 * - Forwards local movement intents only while connected, unfrozen, and in 3D mode.
 * - Reconciles persisted classroom controls (`chatMuted`, `collaborationLocked`,
 *   `gamesDisabled`) and ephemeral `frozen` lock on join and reconnect.
 * - Immediately exits and clears classroom/3D state on `lost-access` (`4001`).
 */
export function useClassroomPresence({
  classroomId,
  userId,
  enabled,
  mode,
}: UseClassroomPresenceOptions): ClassroomPresence {
  const { client } = useSessionService();
  const queryClient = useQueryClient();
  const realtime = useClassroomRealtime({ classroomId, enabled });

  const scopeKey = userId !== null ? `${userId}:${classroomId}` : '';
  const [lostAccessState, setLostAccessState] = useState<{
    readonly scopeKey: string;
    readonly message: string;
  } | null>(null);

  const isLiveLostAccess =
    realtime.status === 'lost-access' && realtime.classroomId === classroomId;
  const lostAccess =
    isLiveLostAccess ||
    (scopeKey !== '' && lostAccessState?.scopeKey === scopeKey);
  const lostAccessMessage = isLiveLostAccess
    ? (realtime.message ?? realtimeMessages.lostAccess)
    : lostAccessState?.scopeKey === scopeKey
      ? lostAccessState.message
      : realtimeMessages.lostAccess;

  useEffect(() => {
    if (!isLiveLostAccess || userId === null) {
      return;
    }
    clearLoadedWorldAssets({ scopeKey: classroomId });
    queryClient.removeQueries({
      queryKey: classroomDetailQueryKey(userId, classroomId),
      exact: true,
    });
    const message = realtime.message ?? realtimeMessages.lostAccess;
    queueMicrotask(() => {
      setLostAccessState({ scopeKey: `${userId}:${classroomId}`, message });
    });
  }, [classroomId, isLiveLostAccess, queryClient, realtime.message, userId]);

  const prevStatusRef = useRef<RealtimeConnectionStatus>(realtime.status);
  const hadConnectedRef = useRef(false);
  const prevScopeRef = useRef(scopeKey);

  useEffect(() => {
    if (prevScopeRef.current !== scopeKey) {
      prevScopeRef.current = scopeKey;
      hadConnectedRef.current = false;
      prevStatusRef.current = 'disconnected';
    }
    if (userId === null || realtime.classroomId !== classroomId) {
      prevStatusRef.current = realtime.status;
      return;
    }

    if (realtime.status === 'connected') {
      const { chatMuted, collaborationLocked, gamesDisabled } =
        realtime.controls;
      if (
        chatMuted !== undefined ||
        collaborationLocked !== undefined ||
        gamesDisabled !== undefined
      ) {
        queryClient.setQueryData<ClassroomDetail>(
          classroomDetailQueryKey(userId, classroomId),
          (current) => {
            if (!current) return current;
            const nextChatMuted = chatMuted ?? current.chatMuted;
            const nextCollabLocked =
              collaborationLocked ?? current.collaborationLocked;
            const nextGamesDisabled = gamesDisabled ?? current.gamesDisabled;
            if (
              nextChatMuted === current.chatMuted &&
              nextCollabLocked === current.collaborationLocked &&
              nextGamesDisabled === current.gamesDisabled
            ) {
              return current;
            }
            return {
              ...current,
              chatMuted: nextChatMuted,
              collaborationLocked: nextCollabLocked,
              gamesDisabled: nextGamesDisabled,
            };
          },
        );
      }

      if (
        prevStatusRef.current === 'reconnecting' ||
        (hadConnectedRef.current && prevStatusRef.current === 'disconnected')
      ) {
        void queryClient.invalidateQueries({
          queryKey: classroomDetailQueryKey(userId, classroomId),
          exact: true,
        });
      }
      hadConnectedRef.current = true;
    }
    prevStatusRef.current = realtime.status;
  }, [
    classroomId,
    queryClient,
    realtime.classroomId,
    realtime.controls,
    realtime.status,
    scopeKey,
    userId,
  ]);

  const missingAvatarUserIds = useMemo(() => {
    if (
      !enabled ||
      lostAccess ||
      userId === null ||
      realtime.status !== 'connected'
    ) {
      return '';
    }
    const missing: string[] = [];
    realtime.participants.forEach((participant) => {
      if (participant.userId !== userId && participant.avatar === undefined) {
        missing.push(participant.userId);
      }
    });
    return missing.sort().join(',');
  }, [enabled, lostAccess, realtime.participants, realtime.status, userId]);

  const [directoryState, setDirectoryState] = useState<{
    readonly scopeKey: string;
    readonly avatars: ReadonlyMap<string, Avatar>;
  } | null>(null);
  const fetchedMissingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (userId === null || missingAvatarUserIds === '') {
      return;
    }
    const fetchKey = `${scopeKey}:${missingAvatarUserIds}`;
    if (fetchedMissingKeyRef.current === fetchKey) {
      return;
    }
    fetchedMissingKeyRef.current = fetchKey;
    let cancelled = false;
    let settled = false;

    void queryClient
      .fetchQuery({
        queryKey: classroomDirectoryMembersQueryKey(userId, classroomId, {
          page: 1,
          pageSize: 100,
        }),
        queryFn: ({ signal }) =>
          requestApi(() =>
            client.GET('/classrooms/{id}/members', {
              params: {
                path: { id: classroomId },
                query: { page: 1, pageSize: 100 },
              },
              signal,
            }),
          ),
        staleTime: 60_000,
      })
      .then((data) => {
        settled = true;
        if (cancelled) return;
        const map = new Map<string, Avatar>();
        for (const member of data.items) {
          const valid = toValidAvatar(member.avatar);
          if (valid) {
            map.set(member.userId, valid);
          }
        }
        setDirectoryState({ scopeKey, avatars: map });
      })
      .catch(() => {
        settled = true;
        /* Fallback capsule remains visible if directory lookup fails. */
      });

    return () => {
      cancelled = true;
      if (!settled && fetchedMissingKeyRef.current === fetchKey) {
        fetchedMissingKeyRef.current = null;
      }
    };
  }, [
    classroomId,
    client,
    missingAvatarUserIds,
    queryClient,
    scopeKey,
    userId,
  ]);

  const directoryAvatars =
    directoryState?.scopeKey === scopeKey
      ? directoryState.avatars
      : EMPTY_AVATARS;

  const frozen =
    realtime.status === 'connected' ? realtime.controls.frozen : false;
  const hasPresenceParticipants =
    !lostAccess &&
    (realtime.status === 'connected' || realtime.status === 'reconnecting');

  const participants = useMemo(() => {
    if (!hasPresenceParticipants) {
      return EMPTY_PARTICIPANTS;
    }
    return Array.from(realtime.participants.values());
  }, [hasPresenceParticipants, realtime.participants]);

  const selfParticipant =
    hasPresenceParticipants && userId !== null
      ? realtime.participants.get(userId)
      : undefined;

  const selfX = selfParticipant?.x;
  const selfZ = selfParticipant?.z;
  const selfRotation = selfParticipant?.rotation;
  const selfPose = useMemo<Pose | undefined>(() => {
    if (
      selfX === undefined ||
      selfZ === undefined ||
      selfRotation === undefined
    ) {
      return undefined;
    }
    return { x: selfX, z: selfZ, rotation: selfRotation };
  }, [selfRotation, selfX, selfZ]);

  const remoteParticipants = useMemo(() => {
    if (!hasPresenceParticipants) {
      return EMPTY_REMOTE_PARTICIPANTS;
    }
    const remotes: RemoteClassroomParticipant[] = [];
    realtime.participants.forEach((participant) => {
      if (participant.userId === userId) {
        return;
      }
      const resolvedAvatar =
        (participant.avatar !== undefined
          ? toValidAvatar(participant.avatar)
          : undefined) ?? directoryAvatars.get(participant.userId);
      remotes.push({
        userId: participant.userId,
        displayName: participant.displayName,
        role: participant.role,
        status: participant.status,
        x: participant.x,
        z: participant.z,
        rotation: participant.rotation,
        avatar: resolvedAvatar,
      });
    });
    return remotes;
  }, [
    directoryAvatars,
    hasPresenceParticipants,
    realtime.participants,
    userId,
  ]);

  const lastSentIntentRef = useRef<AvatarInput>({ x: 0, z: 0 });
  const { sendAvatarInput } = realtime;

  useEffect(() => {
    if (mode !== '3d' || frozen || realtime.status !== 'connected') {
      if (
        lastSentIntentRef.current.x !== 0 ||
        lastSentIntentRef.current.z !== 0
      ) {
        lastSentIntentRef.current = { x: 0, z: 0 };
        if (realtime.status === 'connected') {
          sendAvatarInput({ x: 0, z: 0 });
        }
      }
    }
  }, [frozen, mode, realtime.status, sendAvatarInput]);

  const sendIntent = useCallback(
    (intent: AvatarInput) => {
      if (
        lostAccess ||
        realtime.status !== 'connected' ||
        frozen ||
        mode !== '3d'
      ) {
        return;
      }
      if (sendAvatarInput(intent)) {
        lastSentIntentRef.current = intent;
      }
    },
    [frozen, lostAccess, mode, realtime.status, sendAvatarInput],
  );

  const isIdle =
    !lostAccess &&
    realtime.status === 'disconnected' &&
    realtime.reason === null &&
    realtime.message === null;

  const connectionKey =
    realtime.status === 'connected'
      ? `${realtime.roomId ?? ''}:${realtime.sessionId ?? ''}`
      : realtime.status;

  return {
    isIdle,
    status: realtime.status,
    presenceUncertain: realtime.presenceUncertain,
    reason: realtime.reason,
    message: realtime.message,
    lostAccess,
    lostAccessMessage,
    frozen,
    connectionKey,
    selfPose,
    participants,
    remoteParticipants,
    reconnect: realtime.reconnect,
    sendIntent,
  };
}
