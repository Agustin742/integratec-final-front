export const gradesMessages = {
  error: {
    unexpected:
      'Ocurrió un problema inesperado al consultar los datos del aula.',
  },
  context: {
    errorTitle: 'No pudimos cargar las calificaciones',
    forbiddenTitle: 'No tenés acceso a este panel',
    forbiddenDescription:
      'No tenés permiso para consultar las calificaciones o métricas de esta aula.',
    notFoundTitle: 'Aula no encontrada',
    notFoundDescription:
      'No encontramos el aula o ya no tenés permiso para ver este panel.',
    retryLabel: 'Reintentar',
  },
  parent: {
    title: 'Vista para madres, padres y tutores',
    description:
      'La vista de calificaciones para responsables se ofrece en el área familiar; este panel del aula está disponible para alumnos y docentes.',
  },
  student: {
    heading: 'Boletín de calificaciones',
    subtitle:
      'Tus calificaciones, devoluciones y puntos ganados por actividad.',
    loadingLabel: 'Cargando el boletín',
    emptyTitle: 'Todavía no hay calificaciones',
    emptyDescription:
      'Cuando el docente corrija una actividad o examen, la calificación va a aparecer acá con su devolución.',
    emptyPageTitle: 'No hay más calificaciones en esta página',
    emptyPageDescription: 'Volvé a la primera página para ver el boletín.',
    backToFirstPageLabel: 'Volver a la primera página',
    errorTitle: 'No pudimos cargar el boletín',
    errorDescription:
      'Ocurrió un problema al consultar el boletín. Reintentá en unos segundos.',
    forbiddenTitle: 'No tenés acceso al boletín',
    forbiddenDescription:
      'El boletín está disponible únicamente para el alumno del aula.',
    notFoundTitle: 'Aula no encontrada',
    notFoundDescription:
      'No encontramos el aula o ya no tenés permiso para ver tu boletín.',
    retryLabel: 'Reintentar',
    staleTitle: 'Mostrando la última información confirmada',
    staleDescription:
      'Falló la actualización automática; el boletín puede no estar al día.',
    activityLabel: 'Actividad',
    typeLabels: {
      TP: 'Trabajo práctico',
      EXAM: 'Examen',
    },
    scoreLabel: 'Calificación',
    meterLabel: (score: number, max: number) =>
      `Calificación: ${score} de ${max}`,
    reportCardListLabel: 'Calificaciones por actividad',
    feedbackLabel: 'Devolución',
    pointsLabel: 'Puntos ganados',
    lateBadge: 'Entrega tarde',
    gradedLabel: 'Corregida',
    metrics: {
      heading: 'Tu participación',
      subtitle:
        'Señales por día calendario (UTC), tal como las registra el servidor.',
      loadingLabel: 'Cargando tu participación',
      dayColumn: 'Día',
      connectedColumn: 'Tiempo conectado',
      submissionsColumn: 'Entregas',
      messagesColumn: 'Mensajes',
      emptyTitle: 'Todavía no hay participación registrada',
      emptyDescription:
        'Tu tiempo conectado, entregas y mensajes van a aparecer acá a medida que uses el aula.',
      errorTitle: 'No pudimos cargar tu participación',
      errorDescription:
        'Ocurrió un problema al consultar tus métricas. Reintentá en unos segundos.',
      forbiddenDescription:
        'Tus métricas de participación están disponibles únicamente para el alumno del aula.',
      notFoundDescription:
        'No encontramos el aula o ya no tenés permiso para ver tu participación.',
      tableCaption: 'Participación diaria en el aula',
      retryLabel: 'Reintentar',
    },
    wallet: {
      heading: 'Billetera de puntos',
      subtitle: 'Saldo y movimientos confirmados por el servidor.',
    },
  },
  teacher: {
    heading: 'Seguimiento del aula',
    subtitle:
      'Valores crudos por alumno, tal como los expone el servidor; ninguna combinación se calcula en el navegador.',
    loadingLabel: 'Cargando el seguimiento',
    emptyTitle: 'No hay alumnos para mostrar',
    emptyDescription:
      'Cuando haya alumnos matriculados con actividad registrada, sus métricas van a aparecer acá.',
    emptyPageTitle: 'No hay más alumnos en esta página',
    emptyPageDescription: 'Volvé a la primera página para ver el seguimiento.',
    backToFirstPageLabel: 'Volver a la primera página',
    errorTitle: 'No pudimos cargar el seguimiento',
    errorDescription:
      'Ocurrió un problema al consultar las métricas del aula. Reintentá en unos segundos.',
    forbiddenTitle: 'No tenés acceso al seguimiento',
    forbiddenDescription:
      'Este panel está disponible únicamente para el equipo docente del aula.',
    notFoundTitle: 'Aula no encontrada',
    notFoundDescription:
      'No encontramos el aula o ya no tenés permiso para ver su seguimiento.',
    retryLabel: 'Reintentar',
    staleTitle: 'Mostrando la última información confirmada',
    staleDescription:
      'Falló la actualización automática; el seguimiento puede no estar al día.',
    tableCaption: 'Seguimiento de participación por alumno',
    studentCount: (count: number) =>
      count === 1 ? '1 alumno' : `${count} alumnos`,
    columns: {
      student: 'Alumno',
      connected: 'Tiempo conectado',
      submissions: 'Entregas',
      messages: 'Mensajes',
      graded: 'Entregas calificadas',
      ungraded: 'Entregas sin calificar',
    },
  },
  format: {
    durationHourUnit: 'h',
    durationMinuteUnit: 'min',
  },
} as const;
