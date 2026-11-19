/**
 * Centralized Spanish (`es-AR`) copy for the per-activity query forum tab.
 * Never expose internal story IDs, backend stack traces, or raw error codes.
 */
export const forumMessages = {
  header: {
    title: 'Foro de consultas',
    subtitle:
      'Hacé preguntas sobre esta actividad y seguí las respuestas de tus docentes y compañeros.',
    liveUpdated: 'Foro de consultas actualizado.',
  },
  access: {
    deniedTitle: 'Sin acceso al foro de consultas',
    deniedDescription:
      'Solo estudiantes inscriptos y docentes del aula pueden participar en el foro de esta actividad.',
  },
  composer: {
    newThreadTitle: 'Nueva consulta',
    newThreadLabel: 'Tu pregunta sobre esta actividad',
    newThreadPlaceholder:
      'Escribí tu duda con claridad para que el docente o el curso puedan ayudarte…',
    newThreadSubmit: 'Publicar consulta',
    newThreadSubmitting: 'Publicando consulta…',
    replyTitle: 'Responder en este hilo',
    replyLabel: 'Tu respuesta',
    replyPlaceholder: 'Escribí una respuesta para continuar la conversación…',
    replySubmit: 'Enviar respuesta',
    replySubmitting: 'Enviando respuesta…',
    charCounter: (count: number, max: number) => `${count}/${max} caracteres`,
    pendingNotice:
      'Enviando al servidor… Tu mensaje quedará visible al confirmarse.',
    uncertainNotice:
      'No pudimos confirmar si tu mensaje se publicó. Conservamos tu borrador y actualizamos el foro para que lo verifiques antes de reintentar.',
    threadCreatedToast: 'Consulta publicada en el foro.',
    replyCreatedToast: 'Respuesta publicada en el hilo.',
  },
  threads: {
    sectionTitle: 'Consultas de la actividad',
    loading: 'Cargando consultas de la actividad…',
    emptyTitle: 'Todavía no hay consultas en esta actividad',
    emptyDescription:
      'Si tenés alguna duda sobre la consigna, podés abrir la primera consulta desde el formulario.',
    outOfRangeTitle: 'No hay consultas en esta página',
    outOfRangeDescription:
      'La lista cambió y esta página quedó fuera de rango. Volvé a la primera página.',
    backToFirstPage: 'Volver a la primera página',
    staleTitle: 'Mostrando las últimas consultas conocidas',
    staleDescription:
      'No pudimos actualizar las consultas de esta actividad. Podés reintentar sin perder tu borrador.',
    loadErrorTitle: 'No pudimos cargar el foro',
    loadErrorDescription:
      'Ocurrió un problema al consultar los hilos de esta actividad. Intentá nuevamente.',
    notFoundTitle: 'Actividad o foro no disponible',
    notFoundDescription:
      'Esta actividad ya no está disponible para tu cuenta o perdió el acceso.',
    forbiddenTitle: 'Sin permiso para ver este foro',
    forbiddenDescription:
      'Tu rol actual en el aula no habilita acceder a las consultas de esta actividad.',
    sortLabel: 'Ordenar hilos',
    sortNewest: 'Más recientes primero',
    sortOldest: 'Más antiguas primero',
    resultsSummary: (shown: number, total: number) =>
      total === 1
        ? '1 hilo de consulta'
        : `Mostrando ${shown} de ${total} hilos`,
    replyCountLabel: (count: number) =>
      count === 1 ? '1 respuesta' : `${count} respuestas`,
    openThreadAction: 'Ver hilo',
    createdAtPrefix: 'Publicada:',
  },
  posts: {
    backToList: 'Volver a todas las consultas',
    threadHeading: 'Hilo de consulta',
    loading: 'Cargando mensajes del hilo…',
    emptyTitle: 'Este hilo todavía no tiene respuestas',
    emptyDescription:
      'Podés sumar la primera respuesta desde el formulario inferior.',
    outOfRangeTitle: 'No hay mensajes en esta página',
    outOfRangeDescription:
      'El hilo cambió y esta página quedó fuera de rango. Volvé a la primera página.',
    backToFirstPage: 'Volver a la primera página',
    staleTitle: 'Mostrando los últimos mensajes conocidos',
    staleDescription:
      'No pudimos actualizar los mensajes del hilo. Podés reintentar sin perder tu borrador.',
    loadErrorTitle: 'No pudimos cargar el hilo',
    loadErrorDescription:
      'Ocurrió un problema al obtener los mensajes de esta consulta.',
    notFoundTitle: 'Hilo no disponible',
    notFoundDescription:
      'Este hilo ya no está disponible o perdiste acceso a la actividad.',
    sortLabel: 'Orden de mensajes',
    sortOldest: 'Orden cronológico (más antiguos primero)',
    sortNewest: 'Más recientes primero',
    summary: (shown: number, total: number) =>
      total === 1
        ? '1 mensaje en el hilo'
        : `Mostrando ${shown} de ${total} mensajes`,
    authorSelf: 'Vos',
    authorFallback: 'Integrante del aula',
    roleTeacherBadge: 'Docente',
    roleStudentBadge: 'Estudiante',
  },
  validation: {
    bodyRequired: 'Escribí un mensaje antes de enviar.',
    bodyMaxLength: (max: number) =>
      `El mensaje no puede superar los ${max} caracteres.`,
    bodyControlChars:
      'El mensaje contiene caracteres de control no permitidos.',
  },
  errors: {
    validation: 'Revisá el mensaje ingresado antes de volver a enviarlo.',
    sessionExpired:
      'Tu sesión venció. Iniciá sesión nuevamente para participar en el foro.',
    forbidden: 'No tenés permiso para publicar mensajes en esta actividad.',
    notFound:
      'La actividad o el hilo ya no está disponible. Actualizamos la vista.',
    rateLimited:
      'Enviaste varios mensajes en poco tiempo. Esperá unos instantes antes de reintentar.',
    uncertain:
      'No pudimos confirmar si el mensaje quedó guardado en el servidor. Conservamos tu borrador mientras verificamos el foro.',
    invalidResponse:
      'Recibimos una respuesta inesperada del servidor al consultar el foro.',
  },
} as const;
