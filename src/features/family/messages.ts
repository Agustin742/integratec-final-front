export const familyMessages = {
  title: 'Área familiar',
  subtitle:
    'Consultá las calificaciones y la participación de los estudiantes vinculados a tu cuenta.',
  backToClassrooms: 'Mis aulas',
  loadingLinks: 'Cargando tus vínculos familiares…',
  loadingReportCard: 'Cargando el boletín y las métricas del estudiante…',
  empty: {
    title: 'Todavía no tenés estudiantes vinculados',
    description:
      'Tu cuenta todavía no tiene vínculos familiares activos. Si recibiste una invitación por correo de un docente o escuela, podés aceptarla para comenzar el seguimiento.',
    acceptInvitationCta: 'Aceptar invitación',
  },
  selector: {
    regionLabel: 'Estudiantes vinculados',
    heading: 'Elegí un estudiante',
    adultModeBadge: 'Educación de adultos',
    schoolModeBadge: 'Modalidad escolar',
    activeContextLabel: (childName: string, classroomName: string) =>
      `Viendo el seguimiento de ${childName} en ${classroomName}`,
  },
  adultMode: {
    title: 'Seguimiento familiar desactivado',
    badge: 'Educación de adultos',
    description:
      'Esta aula funciona en modalidad de educación de adultos. El vínculo se conserva en el historial, pero la consulta de calificaciones y las acciones familiares están desactivadas.',
  },
  metrics: {
    heading: 'Métricas de participación',
    subtitle:
      'Totales acumulados confirmados por el servidor para este estudiante en el aula.',
    averageScoreLabel: 'Promedio general',
    averageScoreEmpty: 'Sin calificar',
    gradedCountLabel: 'Actividades calificadas',
    pendingCountLabel: 'Pendientes',
    ungradedCountLabel: 'Entregadas sin calificar',
    connectedTimeLabel: 'Tiempo conectado',
    submissionCountLabel: 'Total de entregas',
  },
  reportCard: {
    heading: 'Boletín de calificaciones',
    subtitle:
      'Actividades calificadas y devoluciones docentes, ordenadas desde la más reciente.',
    listLabel: 'Calificaciones publicadas del estudiante',
    emptyTitle: 'Todavía no hay calificaciones publicadas',
    emptyDescription:
      'Cuando el equipo docente publique la corrección de una actividad o examen, va a aparecer acá con su devolución.',
    emptyPageTitle: 'No hay calificaciones en esta página',
    emptyPageDescription:
      'Volvé a la primera página para consultar el boletín completo.',
    backToFirstPage: 'Volver a la primera página',
    typeLabels: {
      TP: 'TP',
      EXAM: 'Examen',
    },
    lateBadge: 'Entrega tarde',
    scoreLabel: 'Calificación',
    percentageLabel: (percent: number) => `${percent}%`,
    meterLabel: (score: number, maxScore: number) =>
      `Calificación: ${score} de ${maxScore}`,
    feedbackLabel: 'Devolución docente',
    gradedAtLabel: 'Corregida:',
  },
  messaging: {
    defaultTitle: 'Mensajes con el docente',
    parentSubtitle:
      'Conversación privada sobre el seguimiento del estudiante en esta aula.',
    staffTitle: 'Mensajes con el tutor',
    staffSubtitle: (parentName: string, childName: string) =>
      `Conversación privada con ${parentName} sobre ${childName}.`,
    loading: 'Cargando mensajes de la conversación…',
    listLabel: 'Historial de mensajes privados',
    emptyTitle: 'Todavía no hay mensajes en esta conversación',
    emptyDescriptionParent:
      'Escribí un mensaje para comunicarte en privado con el equipo docente del aula.',
    emptyDescriptionStaff:
      'Escribí un mensaje para comunicarte en privado con el padre o tutor vinculado.',
    emptyPageTitle: 'No hay mensajes en esta página',
    emptyPageDescription:
      'Volvé a la primera página para consultar la conversación.',
    backToFirstPage: 'Volver a la primera página',
    roleBadges: {
      PARENT: 'Familiar',
      STAFF: 'Docente',
    },
    composer: {
      label: 'Escribí un mensaje',
      placeholder: 'Escribí tu mensaje para esta conversación privada…',
      description: 'Solo texto plano, hasta 2000 caracteres.',
      submitAction: 'Enviar mensaje',
      submittingAction: 'Enviando…',
      sentAnnouncement: 'Mensaje enviado.',
      validation: {
        required: 'Escribí un mensaje antes de enviarlo.',
        tooLong: 'El mensaje no puede superar los 2000 caracteres.',
      },
    },
    errors: {
      loadTitle: 'No pudimos cargar los mensajes',
      loadDescription:
        'Ocurrió un problema al consultar la conversación. Revisá tu conexión e intentá nuevamente.',
      staleTitle: 'Mostrando los últimos mensajes confirmados',
      staleDescription:
        'Falló la actualización automática; la conversación puede no estar al día.',
      sendTitle: 'No pudimos enviar el mensaje',
      sendValidation:
        'El mensaje no es válido. Revisá que no esté vacío, no supere los 2000 caracteres y no incluya caracteres no permitidos.',
      sendAdultMode:
        'Esta aula pasó a modalidad de educación de adultos. La mensajería familiar quedó desactivada.',
      sendNotFound:
        'Este vínculo familiar ya no está disponible o el estudiante dejó de estar activo en el aula.',
      sendUncertain:
        'No pudimos confirmar si el mensaje llegó al servidor. Conservamos tu borrador y actualizamos la conversación para que lo verifiques antes de reintentar.',
      sendUnexpected:
        'Ocurrió un problema inesperado al enviar el mensaje. Conservamos tu borrador para que puedas reintentar.',
    },
  },
  errors: {
    linksTitle: 'No pudimos cargar el área familiar',
    linksDescription:
      'Ocurrió un problema al consultar tus vínculos familiares. Revisá tu conexión e intentá nuevamente.',
    linksStaleTitle: 'Mostrando los últimos vínculos confirmados',
    linksStaleDescription:
      'Falló la actualización automática; la lista de vínculos puede no estar al día.',
    reportCardTitle: 'No pudimos cargar el boletín',
    reportCardDescription:
      'Ocurrió un problema al consultar las calificaciones y métricas del estudiante. Intentá nuevamente en unos segundos.',
    reportCardStaleTitle: 'Mostrando la última información confirmada',
    reportCardStaleDescription:
      'Falló la actualización automática; el boletín puede no estar al día.',
    notFoundTitle: 'Este vínculo familiar ya no está disponible',
    notFoundDescription:
      'El vínculo fue desactivado, el estudiante ya no está activo en el aula o el recurso no existe.',
    notFoundBackToFamily: 'Ver mis vínculos activos',
    adultModeTitle: 'Seguimiento familiar desactivado',
    adultModeDescription:
      'Esta aula pasó a modalidad de educación de adultos. Las vistas y acciones familiares quedaron desactivadas.',
    unauthorized:
      'Tu sesión venció. Iniciá sesión nuevamente para acceder al área familiar.',
    network:
      'No pudimos conectarnos con el servidor. Revisá tu conexión e intentá nuevamente.',
    unexpected:
      'Ocurrió un problema inesperado al consultar el área familiar. Intentá nuevamente en unos segundos.',
    retryAction: 'Reintentar',
  },
} as const;
