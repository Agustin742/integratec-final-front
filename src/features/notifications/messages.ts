import type { NotificationKind } from './notification-schema';

export const notificationMessages = {
  bellLabel: (unreadCount: number) =>
    unreadCount > 0
      ? `Notificaciones, ${unreadCount} sin leer`
      : 'Notificaciones',
  unreadBadgeCap: '99+',
  trayTitle: 'Notificaciones',
  trayDescription:
    'Avisos recientes de tus aulas. Al abrir o marcar como leída se sincroniza con el servidor.',
  loadingLabel: 'Cargando notificaciones',
  emptyTitle: 'No tenés notificaciones',
  emptyDescription: 'Cuando haya novedades en tus aulas, van a aparecer acá.',
  errorTitle: 'No pudimos cargar las notificaciones',
  errorDescription:
    'Ocurrió un problema al consultar tus notificaciones. Reintentá en unos segundos.',
  retryLabel: 'Reintentar',
  staleTitle: 'Mostrando la última lista confirmada',
  staleDescription:
    'Falló la actualización automática; algunas notificaciones pueden no estar al día.',
  markAllLabel: 'Marcar todas como leídas',
  markingAllLabel: 'Marcando todas…',
  markReadLabel: 'Marcar como leída',
  markingReadLabel: 'Marcando…',
  readBadge: 'Leída',
  unreadBadge: 'Nueva',
  openTargetLabel: 'Ir al aula',
  studentContextLabel: (studentId: string) =>
    `Estudiante vinculado (${studentId.slice(0, 8)})`,
  liveUnreadAnnouncement: (unreadCount: number) =>
    unreadCount === 1
      ? 'Tenés 1 notificación sin leer.'
      : `Tenés ${unreadCount} notificaciones sin leer.`,
  liveNewArrivalAnnouncement: 'Llegó una nueva notificación.',
  actionErrorTitle: 'No pudimos actualizar el estado de lectura',
  actionUncertainDescription:
    'No pudimos confirmar el cambio con el servidor. Actualizamos la lista para verificarlo.',
  notFoundDescription:
    'Esta notificación ya no existe o dejaste de tener acceso al aula.',
  kindTitles: {
    activity_published: 'Nueva actividad publicada',
    grade_posted: 'Nueva calificación publicada',
    announcement: 'Nuevo anuncio en el tablón',
    mention: 'Te mencionaron en el aula',
    activity_forum_reply: 'Nueva respuesta en el foro',
  } satisfies Record<NotificationKind, string>,
} as const;
