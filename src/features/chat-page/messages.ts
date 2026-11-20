/**
 * Spanish (`es-AR`, voseo) copy of the all-chats page and its navbar entry.
 * Conversation copy lives in `classroomMessages.chat`; list rows reuse the
 * chat dock copy.
 */
const unreadText = (count: number) =>
  count === 1 ? '1 mensaje sin leer' : `${count} mensajes sin leer`;

export const chatPageMessages = {
  title: 'Mensajes',
  documentTitle: (classroomName: string) => `Chat de ${classroomName}`,
  navLabel: (totalUnread: number) =>
    totalUnread > 0 ? `Mensajes, ${unreadText(totalUnread)}` : 'Mensajes',
  listLabel: 'Chats de tus aulas',
  loading: 'Cargando tus chats',
  errorTitle: 'No pudimos cargar tus chats',
  errorDescription:
    'Ocurrió un problema al consultar tus conversaciones. Reintentá en unos segundos.',
  emptyTitle: 'Todavía no tenés chats',
  emptyDescription:
    'Cuando estés en un aula con chat, la conversación va a aparecer acá.',
  pickTitle: 'Elegí un chat',
  pickDescription: 'Seleccioná un aula de la lista para ver la conversación.',
  notFoundTitle: 'No encontramos ese chat',
  notFoundDescription:
    'No existe o no tenés acceso a ese chat. Elegí otro de la lista.',
  backToList: 'Volver a los chats',
} as const;
