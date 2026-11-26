/**
 * Public STUN only: peers discover their own address, no media is relayed.
 * Two peers behind symmetric NATs or strict firewalls may fail to connect
 * (no TURN, see back `docs/voice-calls.md`). The peer manager takes the list
 * as an argument, so a deployment can override it later without code changes
 * here.
 */
export const DEFAULT_ICE_SERVERS: readonly RTCIceServer[] = Object.freeze([
  Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
]);

/** Roles the server lets moderate a class call (`isCallModerator` in the realtime app). */
export const CALL_MODERATOR_ROLES: readonly string[] = [
  'OWNER',
  'ADMIN',
  'TEACHER',
];

/** A classroom call that failed once is rejoined once; the server never holds a dropped seat. */
export const MAX_REJOIN_ATTEMPTS = 1;
