import type { CallEmote } from '@/realtime/call-contracts.generated';
import type { MicCaptureErrorCode } from './mic-capture';
import type { CallEndReason } from './call-room-client';

export const callMessages = {
  viewLabel: 'Llamada',
  directTitle: (name: string) => `Llamada con ${name}`,
  classTitle: (classroomName: string) => `Clase en llamada: ${classroomName}`,
  controlsLabel: 'Controles de la llamada',
  mute: 'Silenciar mi micrófono',
  unmute: 'Activar mi micrófono',
  forcedMuteHint:
    'Tu profe te silenció y todavía no habilitó que actives tu micrófono.',
  noMicHint: 'No hay micrófono disponible: seguís la llamada como oyente.',
  emotes: 'Reacción',
  openChat: 'Abrir el chat',
  closeChat: 'Cerrar el chat',
  chatTitle: 'Chat de la clase',
  participantCount: (count: number) => `${count} en la llamada`,
  leave: 'Salir de la llamada',
  endClass: 'Finalizar clase',
  unlockAudio: 'Activar audio',
  unlockAudioHint: 'Tu navegador bloqueó el audio. Activalo para escuchar.',
  micErrors: {
    denied:
      'No pudimos usar tu micrófono porque el permiso está bloqueado. Seguís en la llamada como oyente.',
    'not-found':
      'No encontramos un micrófono. Seguís en la llamada como oyente.',
    'insecure-context':
      'El micrófono necesita una conexión segura. Seguís en la llamada como oyente.',
    unsupported:
      'Tu navegador no permite usar el micrófono. Seguís en la llamada como oyente.',
    unknown:
      'No pudimos activar tu micrófono. Seguís en la llamada como oyente.',
  } satisfies Record<MicCaptureErrorCode, string>,
  emoteLabels: {
    wave: 'Saludar',
    happy: 'Alegría',
    sad: 'Tristeza',
    angry: 'Enojo',
    think: 'Pensar',
    celebrate: 'Celebrar',
  } satisfies Record<CallEmote, string>,
  emoteIcons: {
    wave: '👋',
    happy: '😄',
    sad: '😢',
    angry: '😠',
    think: '🤔',
    celebrate: '🎉',
  } satisfies Record<CallEmote, string>,
  panel: {
    title: 'Controles de la clase',
    muteAll: 'Silenciar a todos',
    mutedAllAnnouncement: 'Silenciaste a todos los alumnos.',
    allowSelfUnmute: 'Permitir que activen su micrófono',
    focusMode: 'Modo foco: ocultar el aula 3D a los alumnos',
    studentsHeading: 'Alumnos en la llamada',
    noStudents: 'Todavía no hay alumnos en la llamada.',
    forcedMutedBadge: 'Silenciado por vos',
    selfMutedBadge: 'Se silenció solo',
    muteOne: (name: string) => `Silenciar a ${name}`,
    unmuteOne: (name: string) => `Permitir hablar a ${name}`,
    mutedOneAnnouncement: (name: string) => `Silenciaste a ${name}.`,
    unmutedOneAnnouncement: (name: string) => `Le permitiste hablar a ${name}.`,
    allowOnAnnouncement: 'Los alumnos pueden activar su micrófono.',
    allowOffAnnouncement: 'Los alumnos no pueden activar su micrófono.',
    focusOnAnnouncement: 'Modo foco activado.',
    focusOffAnnouncement: 'Modo foco desactivado.',
  },
  entry: {
    startClass: 'Iniciar clase en llamada',
    joinShort: 'Unirse a la llamada',
    callMember: (name: string) => `Llamar a ${name}`,
    callAction: 'Llamar',
  },
  incoming: {
    title: (name: string) => `${name} te está llamando`,
    accept: 'Aceptar',
    decline: 'Rechazar',
    group: 'Llamadas entrantes',
  },
  focus: {
    title: 'Tu profe activó el modo foco durante la clase',
    body: 'El aula 3D vuelve apenas termine el modo foco. Mientras tanto podés usar los paneles del aula.',
  },
  ended: {
    moderator_ended: 'La clase en llamada terminó.',
    host_left: 'La clase en llamada terminó porque tu profe salió.',
    peer_left: 'La otra persona salió de la llamada.',
    unavailable: 'No pudimos llamar: la otra persona no está conectada.',
    timeout: 'No respondieron la llamada.',
    declined: 'Rechazaron tu llamada.',
    ended: 'La llamada terminó.',
    full: 'La llamada está llena.',
    replaced: 'Te uniste a la llamada desde otra pestaña.',
    'not-started': 'La clase todavía no está en llamada.',
    forbidden: 'No tenés permiso para unirte a esta llamada.',
    'access-revoked': 'Ya no tenés acceso a esta llamada.',
    unexpected: 'Se cortó la llamada. Probá unirte de nuevo.',
  },
} as const;

/** Spanish message for the way a call ended; `null` when the user left on their own. */
export function endReasonMessage(reason: CallEndReason | null): string | null {
  if (reason === null) return null;
  const known = callMessages.ended as Record<string, string>;
  return known[reason] ?? callMessages.ended.unexpected;
}
