/**
 * Centralized Spanish (Argentina, es-AR, voseo) messages for the daily review
 * (#55, HU-BOT-003). Every user-facing string of the dialog lives here,
 * mirroring `features/points/messages.ts`.
 */
export const dailyReviewMessages = {
  errors: {
    unexpected:
      'No pudimos interpretar tu repaso diario. Intentá de nuevo más tarde.',
    network: 'No pudimos conectar para traer tu repaso diario.',
  },
  dialog: {
    title: 'Tu repaso diario',
    description:
      'Un resumen de tus pendientes y novedades para organizar tu jornada.',
    structuredNotice:
      'Resumen estructurado con tus datos guardados, sin texto generado por IA.',
    sections: {
      pending: 'Pendientes',
      news: 'Novedades',
      emptyTitle: 'No tenés pendientes ni novedades',
      emptyDescription:
        'Cuando haya actividades, calificaciones o avisos nuevos, van a aparecer en tu repaso diario.',
      duePrefix: 'Vence:',
    },
    question: {
      title: 'Pregunta diaria de repaso',
      description:
        'Respondé correctamente para sumar un día a tu racha de estudio.',
      materialPrefix: 'Material de referencia:',
      optionsLegend: 'Opciones de respuesta',
      submit: 'Responder',
      submitting: 'Enviando…',
      correctTitle: '¡Respuesta correcta!',
      incorrectTitle: 'Respuesta incorrecta',
      streakFeedback: (days: number) =>
        `¡Sumaste un día! Tu racha llegó a ${
          days === 1 ? '1 día' : `${days} días`
        }.`,
      alreadyAnswered: 'Ya respondiste la pregunta de hoy.',
      submitFailed:
        'No pudimos enviar tu respuesta. Revisá tu conexión e intentá de nuevo.',
    },
  },
} as const;
