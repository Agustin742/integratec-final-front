/**
 * Spanish (`es-AR`, voseo) copy of the floating chat dock. Chat conversation
 * copy itself lives in `classroomMessages.chat`.
 */
const unreadText = (count: number) =>
  count === 1 ? '1 mensaje sin leer' : `${count} mensajes sin leer`;

export const chatDockMessages = {
  region: 'Mensajes',
  launcherText: 'Mensajes',
  launcherLabel: (totalUnread: number) =>
    totalUnread > 0 ? `Mensajes, ${unreadText(totalUnread)}` : 'Mensajes',
  unreadText,
  listLabel: 'Chats de tus aulas',
  listTitle: 'Mensajes',
  closeList: 'Cerrar la lista de chats',
  noMessagesYet: 'Todavía no hay mensajes',
  lastMessage: (author: string, preview: string) => `${author}: ${preview}`,
  you: 'Vos',
  windowLabel: (classroomName: string) => `Chat de ${classroomName}`,
  back: 'Volver a la lista de chats',
  minimize: 'Minimizar el chat',
  restore: 'Expandir el chat',
  close: 'Cerrar el chat',
} as const;
