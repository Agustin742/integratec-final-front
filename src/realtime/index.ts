export {
  createClassroomRealtimeClient,
  realtimeMessages,
  type ClassroomRealtimeClient,
  type CreateClassroomRealtimeClientOptions,
  type RealtimeAuthPort,
  type RealtimeAvatarAppearance,
  type RealtimeClassroomControls,
  type RealtimeEquippedCodes,
  type RealtimeConnectionStatus,
  type RealtimeFailureReason,
  type RealtimeParticipant,
  type RealtimeRoomLike,
  type RealtimeSdkClientLike,
  type RealtimeSnapshot,
} from './client';
export {
  createClassroomRealtimeManager,
  type ClassroomRealtimeLease,
  type ClassroomRealtimeManager,
  type CreateClassroomRealtimeManagerOptions,
} from './classroom-realtime-manager';
export {
  ClassroomRealtimeProvider,
  useClassroomRealtimeManager,
  type ClassroomRealtimeProviderProps,
} from './classroom-realtime-provider';
export {
  useClassroomRealtime,
  type UseClassroomRealtimeOptions,
  type UseClassroomRealtimeResult,
} from './use-classroom-realtime';
export {
  AVATAR_INPUT_MESSAGE,
  AVATAR_STATUSES,
  AVATAR_SPEED_UNITS_PER_SECOND,
  CLASSROOM_DESK_ROW_SPACING,
  CLASSROOM_ROOM_NAME,
  CLOSE_CODE_ACCESS_REVOKED,
  CLOSE_CODE_TOO_MANY_CONNECTIONS,
  CLOSE_CODE_VERIFICATION_UNAVAILABLE,
  CLOSE_REASON_ACCESS_REVOKED,
  CLOSE_REASON_TOO_MANY_CONNECTIONS,
  CLOSE_REASON_VERIFICATION_UNAVAILABLE,
  INPUT_RATE_LIMIT_PER_SECOND,
  MAX_CLASSROOM_DESKS,
  MAX_CONNECTIONS_PER_USER,
  MIN_CLASSROOM_DESKS,
  NPC_IDS,
  NPC_INTERACT_MESSAGE,
  NPC_EMOTES,
  TUTOR_BOT_IDLE_CLIP,
  TUTOR_BOT_PHRASES,
  TUTOR_BOT_SLEEP_CLIP,
  buildClassroomLayout,
  npcInteractSchema,
  type NpcId,
  type NpcInteract,
  type PropObstacle,
  type PropObstacleId,
  PATCH_RATE_HZ,
  SIMULATION_TICK_RATE_HZ,
  avatarInputSchema,
  type AvatarInput,
  type AvatarStatus,
  type ClassroomJoinOptions,
  type ClassroomLayout,
  type LayoutBox,
} from './contracts.generated';
export { ClassroomState } from './room-state.generated';
export { CLASSROOM_LAYOUT } from './classroom-layout';
export { Avatar } from './avatar.generated';
export { Npc } from './npc.generated';
