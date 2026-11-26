import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requestApi } from '@/api/client';
import {
  classroomDetailQueryKey,
  classroomDirectoryMembersQueryKey,
} from '@/api/query-keys';
import type { components } from '@/api/schema.generated';
import type { Avatar } from '@/features/profile/avatar-options';
import type { Pose, RemoteClassroomParticipant } from '@/features/world';
import type { AvatarEmotePlay } from '@/features/world/avatar/avatar-model';
import type { NpcView } from '@/features/world/npc/npc-view';
import {
  AVATAR_EMOTE_COOLDOWN_MS,
  realtimeMessages,
  useClassroomRealtime,
  type AvatarEmote,
  type AvatarEmoted,
  type AvatarInput,
  type RealtimeConnectionStatus,
  type RealtimeFailureReason,
  type RealtimeEquippedCodes,
  type RealtimeParticipant,
} from '@/realtime';
import { useSessionService } from '@/session/provider';
import { avatarSchema } from '@/session/transport';
import { clearLoadedWorldAssets } from './classroom-3d-stage';
import type { ClassroomViewMode } from './classroom-mode-store';

type ClassroomDetail = components['schemas']['ClassroomContextResponseDto'];
type CachedDirectoryMembers = {
  readonly items?: ReadonlyArray<{ readonly userId: string }>;
};

const EMPTY_AVATARS = new Map<string, Avatar>();
const EMPTY_PARTICIPANTS: readonly RealtimeParticipant[] = [];
const EMPTY_NPCS: ReadonlyMap<string, NpcView> = new Map();
const EMPTY_REMOTE_PARTICIPANTS: readonly RemoteClassroomParticipant[] = [];
const EMPTY_EMOTES: ReadonlyMap<string, AvatarEmotePlay> = new Map();

function toValidAvatar(raw: unknown): Avatar | undefined {
  const parsed = avatarSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export interface UseClassroomPresenceOptions {
  readonly classroomId: string;
  readonly userId: string | null;
  readonly enabled: boolean;
  readonly mode: ClassroomViewMode;
  readonly onLostAccess?: () => void;
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
  readonly connectionKey: string | undefined;
  readonly selfPose: Pose | undefined;
  /** Accessory codes the room reports for the local member. */
  readonly selfEquipped: RealtimeEquippedCodes | undefined;
  /** Synced desk decor code per connected member, `null` when empty. */
  readonly liveDeskDecor: ReadonlyMap<string, string | null>;
  readonly participants: readonly RealtimeParticipant[];
  readonly remoteParticipants: readonly RemoteClassroomParticipant[];
  /** Synced pet and tutor bot; empty without a live connection. */
  readonly npcs: ReadonlyMap<string, NpcView>;
  /** Synced bot skin; `undefined` while the room has not reported one. */
  readonly liveTutorBotSkin: string | undefined;
  readonly reconnect: () => Promise<boolean>;
  readonly sendIntent: (intent: AvatarInput) => void;
  /** Asks the server to react to E / click on an NPC (`npc:interact`). */
  readonly interactNpc: (npcId: string) => void;
  /** Whether an emote can be sent: live 3D classroom, not frozen. */
  readonly canEmote: boolean;
  readonly sendEmote: (emote: AvatarEmote) => boolean;
  /** Emote the room announced for the local member, while it lasts. */
  readonly selfEmote: AvatarEmotePlay | undefined;
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
  onLostAccess,
}: UseClassroomPresenceOptions): ClassroomPresence {
  const { client } = useSessionService();
  const queryClient = useQueryClient();

  const scopeKey = userId !== null ? `${userId}:${classroomId}` : '';
  const [lostAccessState, setLostAccessState] = useState<{
    readonly scopeKey: string;
    readonly message: string;
  } | null>(null);
  const isLatchedLostAccess =
    scopeKey !== '' && lostAccessState?.scopeKey === scopeKey;

  const [emotes, setEmotes] = useState(EMPTY_EMOTES);
  const emoteSeqRef = useRef(0);
  const emoteTimersRef = useRef(new Set<number>());
  const onEmote = useCallback(
    ({ userId: emoterId, emote }: AvatarEmoted) => {
      if (mode !== '3d') return;
      const seq = ++emoteSeqRef.current;
      setEmotes((current) =>
        new Map(current).set(emoterId, { name: emote, seq }),
      );
      // Kept no longer than the cooldown (every clip is shorter), so an
      // avatar mounted later never replays an old emote.
      const timer = window.setTimeout(() => {
        emoteTimersRef.current.delete(timer);
        setEmotes((current) => {
          if (current.get(emoterId)?.seq !== seq) return current;
          const next = new Map(current);
          next.delete(emoterId);
          return next;
        });
      }, AVATAR_EMOTE_COOLDOWN_MS);
      emoteTimersRef.current.add(timer);
    },
    [mode],
  );
  useEffect(() => {
    const timers = emoteTimersRef.current;
    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      setEmotes(EMPTY_EMOTES);
    };
  }, [mode, scopeKey]);

  const realtime = useClassroomRealtime({
    classroomId,
    enabled: enabled && !isLatchedLostAccess,
    onEmote,
  });

  const isLiveLostAccess =
    realtime.status === 'lost-access' && realtime.classroomId === classroomId;
  const lostAccess = isLiveLostAccess || isLatchedLostAccess;
  const lostAccessMessage = isLiveLostAccess
    ? (realtime.message ?? realtimeMessages.lostAccess)
    : lostAccessState?.scopeKey === scopeKey
      ? lostAccessState.message
      : realtimeMessages.lostAccess;

  const onLostAccessRef = useRef(onLostAccess);
  useEffect(() => {
    onLostAccessRef.current = onLostAccess;
  }, [onLostAccess]);

  useEffect(() => {
    if (!isLiveLostAccess || userId === null) {
      return;
    }
    const activeScopeKey = `${userId}:${classroomId}`;
    const detailKey = classroomDetailQueryKey(userId, classroomId);
    const directoryKey = classroomDirectoryMembersQueryKey(
      userId,
      classroomId,
      { page: 1, pageSize: 100 },
    );
    clearLoadedWorldAssets({ scopeKey: classroomId });
    void queryClient.cancelQueries({ queryKey: detailKey, exact: true });
    void queryClient.cancelQueries({ queryKey: directoryKey, exact: true });
    const message = realtime.message ?? realtimeMessages.lostAccess;
    queueMicrotask(() => {
      setLostAccessState({ scopeKey: activeScopeKey, message });
      onLostAccessRef.current?.();
    });
  }, [classroomId, isLiveLostAccess, queryClient, realtime.message, userId]);

  useEffect(() => {
    if (!lostAccess || userId === null) {
      return;
    }
    const detailKey = classroomDetailQueryKey(userId, classroomId);
    const directoryKey = classroomDirectoryMembersQueryKey(
      userId,
      classroomId,
      { page: 1, pageSize: 100 },
    );
    queryClient.removeQueries({
      queryKey: detailKey,
      exact: true,
      type: 'inactive',
    });
    queryClient.removeQueries({
      queryKey: directoryKey,
      exact: true,
      type: 'inactive',
    });
  }, [classroomId, enabled, lostAccess, queryClient, userId]);

  const prevStatusRef = useRef<RealtimeConnectionStatus>(realtime.status);
  const hadConnectedRef = useRef(false);
  const prevScopeRef = useRef(scopeKey);
  const reconciledForbiddenScopeRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevScopeRef.current !== scopeKey) {
      prevScopeRef.current = scopeKey;
      hadConnectedRef.current = false;
      prevStatusRef.current = 'disconnected';
      reconciledForbiddenScopeRef.current = null;
    }
    if (userId === null || realtime.classroomId !== classroomId) {
      prevStatusRef.current = realtime.status;
      return;
    }

    if (
      !lostAccess &&
      realtime.status === 'rejected' &&
      realtime.reason === 'forbidden' &&
      reconciledForbiddenScopeRef.current !== scopeKey
    ) {
      reconciledForbiddenScopeRef.current = scopeKey;
      void queryClient.invalidateQueries({
        queryKey: classroomDetailQueryKey(userId, classroomId),
        exact: true,
      });
    }

    if (realtime.status === 'connected') {
      reconciledForbiddenScopeRef.current = null;
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
        (hadConnectedRef.current && prevStatusRef.current !== 'connected')
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
    lostAccess,
    queryClient,
    realtime.classroomId,
    realtime.controls,
    realtime.reason,
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
  const fetchedScopeRef = useRef<string | null>(null);
  const directoryAvatars =
    directoryState?.scopeKey === scopeKey
      ? directoryState.avatars
      : EMPTY_AVATARS;
  const directoryAvatarsRef =
    useRef<ReadonlyMap<string, Avatar>>(EMPTY_AVATARS);
  useEffect(() => {
    directoryAvatarsRef.current = directoryAvatars;
  }, [directoryAvatars]);

  useEffect(() => {
    if (userId === null || missingAvatarUserIds === '') {
      return;
    }
    const missingIds = missingAvatarUserIds.split(',');
    const hasUnresolvedMissing = missingIds.some(
      (id) => !directoryAvatarsRef.current.has(id),
    );
    if (fetchedScopeRef.current === scopeKey && !hasUnresolvedMissing) {
      return;
    }
    const fetchKey = `${scopeKey}:${missingAvatarUserIds}`;
    if (fetchedMissingKeyRef.current === fetchKey) {
      return;
    }
    fetchedMissingKeyRef.current = fetchKey;
    const queryKey = classroomDirectoryMembersQueryKey(userId, classroomId, {
      page: 1,
      pageSize: 100,
    });
    const cached = queryClient.getQueryData<CachedDirectoryMembers>(queryKey);
    const cachedUserIds = cached?.items
      ? new Set(cached.items.map((member) => member.userId))
      : null;
    const hasUnseenInCache =
      cachedUserIds !== null && missingIds.some((id) => !cachedUserIds.has(id));
    const staleTime =
      (fetchedScopeRef.current === scopeKey && hasUnresolvedMissing) ||
      hasUnseenInCache
        ? 0
        : 60_000;

    let cancelled = false;
    let settled = false;

    void queryClient
      .fetchQuery({
        queryKey,
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
        staleTime,
      })
      .then((data) => {
        settled = true;
        if (cancelled) return;
        fetchedScopeRef.current = scopeKey;
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
        if (fetchedMissingKeyRef.current === fetchKey) {
          fetchedMissingKeyRef.current = null;
        }
        /* Fallback capsule remains visible if directory lookup fails. */
      });

    return () => {
      cancelled = true;
      if (!settled && fetchedMissingKeyRef.current === fetchKey) {
        fetchedMissingKeyRef.current = null;
      }
      void queryClient.cancelQueries({ queryKey, exact: true });
    };
  }, [
    classroomId,
    client,
    missingAvatarUserIds,
    queryClient,
    scopeKey,
    userId,
  ]);

  const [frozenState, setFrozenState] = useState<{
    readonly scopeKey: string;
    readonly frozen: boolean;
  }>({ scopeKey, frozen: false });
  const isRealtimeForCurrentClassroom = realtime.classroomId === classroomId;
  const frozen =
    !lostAccess && isRealtimeForCurrentClassroom
      ? realtime.status === 'connected'
        ? realtime.controls.frozen
        : realtime.status === 'reconnecting'
          ? frozenState.scopeKey === scopeKey
            ? frozenState.frozen
            : false
          : false
      : false;
  if (frozenState.scopeKey !== scopeKey || frozenState.frozen !== frozen) {
    setFrozenState({ scopeKey, frozen });
  }

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

  const selfHead = selfParticipant?.avatar?.equipped?.head ?? null;
  const selfFace = selfParticipant?.avatar?.equipped?.face ?? null;
  const selfBack = selfParticipant?.avatar?.equipped?.back ?? null;
  const selfHand = selfParticipant?.avatar?.equipped?.hand ?? null;
  const selfNeck = selfParticipant?.avatar?.equipped?.neck ?? null;
  const selfEars = selfParticipant?.avatar?.equipped?.ears ?? null;
  const selfEquipped = useMemo<RealtimeEquippedCodes | undefined>(() => {
    const codes = {
      head: selfHead,
      face: selfFace,
      back: selfBack,
      hand: selfHand,
      neck: selfNeck,
      ears: selfEars,
    };
    return Object.values(codes).some(Boolean) ? codes : undefined;
  }, [selfHead, selfFace, selfBack, selfHand, selfNeck, selfEars]);

  // Keyed by content: participants change on every movement patch.
  const liveDeskDecorKey = JSON.stringify(
    hasPresenceParticipants
      ? Array.from(realtime.participants.values()).flatMap((participant) =>
          participant.avatar
            ? [[participant.userId, participant.avatar.deskDecorCode ?? null]]
            : [],
        )
      : [],
  );
  const liveDeskDecor = useMemo(
    () => new Map(JSON.parse(liveDeskDecorKey) as [string, string | null][]),
    [liveDeskDecorKey],
  );

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
        equipped: participant.avatar?.equipped,
        emote: emotes.get(participant.userId),
      });
    });
    return remotes;
  }, [
    directoryAvatars,
    emotes,
    hasPresenceParticipants,
    realtime.participants,
    userId,
  ]);

  const lastSentIntentRef = useRef<AvatarInput>({ x: 0, z: 0 });
  const { sendAvatarInput } = realtime;
  const sendAvatarInputRef = useRef(sendAvatarInput);
  useLayoutEffect(() => {
    sendAvatarInputRef.current = sendAvatarInput;
  }, [sendAvatarInput]);

  useLayoutEffect(() => {
    return () => {
      if (
        lastSentIntentRef.current.x !== 0 ||
        lastSentIntentRef.current.z !== 0
      ) {
        lastSentIntentRef.current = { x: 0, z: 0 };
        sendAvatarInputRef.current({ x: 0, z: 0 });
      }
    };
  }, [scopeKey]);

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

  const { interactNpc: sendNpcInteract } = realtime;
  const interactNpc = useCallback(
    (npcId: string) => {
      if (lostAccess || realtime.status !== 'connected' || frozen) {
        return;
      }
      sendNpcInteract(npcId);
    },
    [frozen, lostAccess, realtime.status, sendNpcInteract],
  );

  const canEmote =
    !lostAccess && !frozen && mode === '3d' && realtime.status === 'connected';
  const { sendEmote: sendRoomEmote } = realtime;
  const sendEmote = useCallback(
    (emote: AvatarEmote) => canEmote && sendRoomEmote(emote),
    [canEmote, sendRoomEmote],
  );
  const selfEmote = userId !== null ? emotes.get(userId) : undefined;

  const npcs = hasPresenceParticipants ? realtime.npcs : EMPTY_NPCS;

  const isIdle =
    !lostAccess &&
    realtime.status === 'disconnected' &&
    realtime.reason === null &&
    realtime.message === null;

  const connectionKey =
    realtime.roomId !== null
      ? realtime.sessionId !== null
        ? `${realtime.roomId}:${realtime.sessionId}`
        : realtime.roomId
      : undefined;

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
    selfEquipped,
    liveDeskDecor,
    participants,
    remoteParticipants,
    reconnect: realtime.reconnect,
    sendIntent,
    npcs,
    liveTutorBotSkin: hasPresenceParticipants
      ? realtime.tutorBotSkin
      : undefined,
    interactNpc,
    canEmote,
    sendEmote,
    selfEmote,
  };
}
