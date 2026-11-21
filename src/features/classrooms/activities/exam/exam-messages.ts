export const examMessages = {
  validation: {
    answers: 'Respondé todas las preguntas antes de enviar el examen.',
    answerShape: 'Cada pregunta necesita una opción seleccionada.',
    duplicateQuestion: 'Cada pregunta admite una única respuesta.',
    idempotencyKey:
      'No se pudo identificar el envío. Reintentá en unos segundos.',
  },
  serverErrors: {
    forbidden: 'El examen está disponible únicamente para alumnos del aula.',
    notFound: 'No encontramos la actividad del examen.',
    conflict:
      'No pudimos registrar tu envío: el examen todavía no abrió, ya cerró sin admitir entregas tardías o ya tenés un envío registrado.',
    tooLarge: 'El envío es demasiado grande para el servidor.',
    uncertain:
      'No pudimos confirmar tu envío. Estamos verificando el resultado con el servidor.',
    unexpected:
      'No pudimos leer la respuesta del servidor. Reintentá en unos segundos.',
  },
  panel: {
    heading: 'Tu examen',
    loadingLabel: 'Consultando tu examen',
    errorTitle: 'No pudimos cargar tu examen',
    notAttemptedDescription:
      'Todavía no enviaste tus respuestas. Elegí una opción por pregunta y confirmá el envío; después vas a ver acá la calificación automática confirmada por el servidor.',
    noQuestionsTitle: 'El examen no tiene preguntas publicadas',
    noQuestionsDescription:
      'No hay preguntas para responder en esta actividad. Consultá con tu docente.',
    statusLabels: {
      submitted: 'Entregado',
      graded: 'Calificado',
    } satisfies Record<'submitted' | 'graded', string>,
    lateBadge: 'Entrega tardía',
    submittedAtTerm: 'Fecha de envío',
    scoreTerm: 'Calificación automática',
    scoreValue: (score: number, maxScore: number) =>
      `${score} de ${maxScore} puntos`,
    questionLegend: (position: number, total: number) =>
      `Pregunta ${position} de ${total}`,
    submitLabel: 'Enviar examen',
    confirm: {
      title: 'Confirmar envío',
      description:
        'Una vez enviado, no vas a poder cambiar tus respuestas. Tu calificación la calcula el servidor.',
      action: 'Confirmar envío',
      cancel: 'Seguir respondiendo',
    },
    uncertainTitle: 'Estamos verificando tu envío',
    uncertainChecking:
      'No pudimos confirmar tu envío. Estamos verificando el resultado con el servidor.',
    uncertainNothingStored:
      'Verificamos con el servidor que tu examen no se guardó. Podés volver a enviar las mismas respuestas.',
    uncertainUnverified:
      'No pudimos verificar el resultado con el servidor. Verificá de nuevo antes de reintentar; no reenvíes a ciegas.',
    reconciledNotice:
      'Tu examen ya está registrado. Estás viendo la confirmación del servidor.',
    retryAction: 'Reintentar envío',
    verifyAgainAction: 'Verificar de nuevo',
    window: {
      dueAtLabel: 'Fecha límite',
      latePolicyTerm: 'Entrega tardía',
      lateAllowedTerm: 'Admite entregas tardías',
      lateNotAllowedTerm: 'No admite entregas tardías',
      notOpenReason:
        'El examen todavía no abrió. Podés responder desde la fecha de apertura.',
      closedReason:
        'La fecha límite ya pasó y el examen no admite entregas tardías.',
    },
  },
} as const;
