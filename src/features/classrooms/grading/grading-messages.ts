/**
 * Centralized Spanish (`es-AR`) copy for teacher grading queue, submission
 * viewer, and grading / regrading workflow.
 * Never expose internal story IDs, backend stack traces, or raw error codes.
 */
export const gradingMessages = {
  panel: {
    heading: 'Cola de corrección',
    description:
      'Revisá las entregas enviadas por estudiantes del aula, abrí sus archivos adjuntos y registrá calificaciones con devolución.',
    activityScopedHeading: 'Entregas de esta actividad',
    activityScopedDescription:
      'Revisá las entregas enviadas para esta actividad y cargá o actualizá cada calificación.',
    nonStaffTitle: 'Calificaciones en preparación',
    nonStaffDescription:
      'Tu boletín de calificaciones e historial académico estará disponible pronto en este espacio.',
    loading: 'Cargando cola de corrección…',
    emptyTitle: 'Todavía no hay entregas para revisar',
    emptyDescription:
      'Cuando tus estudiantes envíen trabajos en el aula, van a aparecer acá listos para corregir.',
    filteredEmptyTitle: 'No hay entregas con los filtros actuales',
    filteredEmptyDescription:
      'Probá cambiar la actividad o el estado seleccionado para ver otras entregas.',
    outOfRangeTitle: 'No hay entregas en esta página',
    outOfRangeDescription:
      'La lista cambió y esta página quedó fuera de rango. Volvé a la primera página para ver las entregas disponibles.',
    backToFirstPage: 'Volver a la primera página',
    clearFilters: 'Limpiar filtros',
    staleTitle: 'Mostrando la última lista conocida',
    staleDescription:
      'No pudimos actualizar la cola de corrección. Podés reintentar sin perder tu ubicación actual.',
    retry: 'Reintentar',
    forbiddenTitle: 'Sin permiso para revisar entregas',
    forbiddenDescription:
      'Tu rol actual en esta aula no habilita la cola de corrección docente.',
    notFoundTitle: 'No encontramos las entregas solicitadas',
    notFoundDescription:
      'El aula o la actividad filtrada ya no está disponible para tu cuenta.',
    loadErrorTitle: 'No pudimos cargar la cola de corrección',
    loadErrorDescription:
      'Ocurrió un problema al consultar las entregas. Intentá nuevamente en unos segundos.',
    resultsSummary: (shown: number, total: number) =>
      total === 1
        ? '1 entrega en la cola'
        : `Mostrando ${shown} de ${total} entregas`,
    fileCount: (count: number) =>
      count === 1 ? '1 archivo adjunto' : `${count} archivos adjuntos`,
    submittedAtLabel: 'Enviada:',
    gradedAtLabel: 'Calificada:',
    scoreSummary: (score: number) => `Nota: ${score}/100`,
    pointsAwardedSummary: (points: number) =>
      points === 1 ? '1 punto acreditado' : `${points} puntos acreditados`,
    versionLabel: (version: number) => `Versión ${version}`,
    openReviewAction: 'Revisar y calificar',
    openRegradeAction: 'Ver y recalificar',
    liveQueueUpdated: 'Cola de corrección actualizada.',
  },
  filters: {
    activityLabel: 'Actividad',
    allActivities: 'Todas las actividades',
    stateLabel: 'Estado',
    stateAll: 'Todos los estados',
    stateSubmitted: 'Pendientes de corrección',
    stateGraded: 'Calificadas',
    sortLabel: 'Ordenar por',
    sortSubmittedAsc: 'Envío más antiguo primero',
    sortSubmittedDesc: 'Envío más reciente primero',
    sortGradedDesc: 'Calificación más reciente primero',
    sortGradedAsc: 'Calificación más antigua primero',
  },
  badges: {
    tp: 'Trabajo práctico',
    exam: 'Examen',
    submitted: 'Pendiente',
    graded: 'Calificada',
    late: 'Entrega tardía',
  },
  dialog: {
    titleGrade: 'Revisar y calificar entrega',
    titleRegrade: 'Revisar y recalificar entrega',
    description: (studentName: string, activityTitle: string) =>
      `Entrega de ${studentName} para «${activityTitle}».`,
    close: 'Cerrar',
    unsavedConfirm:
      'Tenés cambios sin guardar en la calificación. ¿Querés descartarlos y cerrar?',
    keepEditing: 'Seguir editando',
    discardAndClose: 'Descartar y cerrar',
  },
  viewer: {
    sectionTitle: 'Archivos y detalle de la entrega',
    loading: 'Cargando detalle y enlaces seguros de la entrega…',
    refreshLinks: 'Renovar enlaces',
    refreshingLinks: 'Renovando enlaces…',
    linksRefreshed: 'Se renovaron los enlaces de descarga de la entrega.',
    linkExpiresPrefix: 'Enlace válido hasta:',
    openFileAction: 'Abrir archivo',
    emptyFilesTitle: 'No hay archivos adjuntos visibles',
    emptyFilesDescription:
      'Esta entrega no incluye archivos descargables en este momento.',
    mcqPendingTitle: 'Evaluación de opción múltiple en integración',
    mcqPendingDescription:
      'Las respuestas y el resultado automático de actividades de opción múltiple se mostrarán acá cuando se habilite el evaluador del servidor. Esta actividad no admite calificación manual por archivo.',
    notFoundTitle: 'Entrega no disponible',
    notFoundDescription:
      'No pudimos acceder a esta entrega. Puede haber sido eliminada o ya no pertenecer a un aula habilitada para tu cuenta.',
    loadErrorTitle: 'No pudimos cargar la entrega',
    loadErrorDescription:
      'No fue posible obtener los archivos de la entrega. Podés reintentar.',
    signedLinkHint:
      'Los enlaces de descarga son privados y vencen automáticamente. Si alguno expiró, usá «Renovar enlaces».',
    studentLabel: 'Estudiante',
    activityLabel: 'Actividad',
    submittedAtLabel: 'Fecha de envío',
    statusLabel: 'Estado',
  },
  form: {
    sectionTitleGrade: 'Calificar entrega',
    sectionTitleRegrade: 'Actualizar calificación',
    currentGradeTitle: 'Calificación confirmada actual',
    regradeCompensatingNoticeTitle: 'Recalificación con ajuste compensatorio',
    regradeCompensatingNoticeBody:
      'Actualizar esta nota modifica la calificación vigente sin sobrescribir el movimiento original de puntos: el servidor registra un ajuste compensatorio en el libro contable y confirma el nuevo total acreditado.',
    scoreLabel: 'Nota (0 a 100)',
    scoreHelper: (maxScore?: number) =>
      maxScore !== undefined && maxScore < 100
        ? `Ingresá un número entero entre 0 y ${maxScore} (puntaje máximo de esta actividad).`
        : 'Ingresá un número entero entre 0 y 100. El servidor calcula y confirma los puntos correspondientes.',
    feedbackLabel: 'Devolución para el estudiante',
    feedbackPlaceholder:
      'Escribí comentarios claros sobre logros, errores y aspectos a mejorar…',
    feedbackHelper: (count: number, max: number) =>
      `Usá texto continuo en una sola línea (sin saltos de línea ni tabulaciones). ${count}/${max} caracteres.`,
    submitGrade: 'Guardar calificación',
    submittingGrade: 'Guardando calificación…',
    submitRegrade: 'Guardar recalificación',
    submittingRegrade: 'Guardando recalificación…',
    reloadLatestAction: 'Cargar versión actual',
    reloadingLatest: 'Cargando versión actual…',
    conflictAlertTitle: 'Conflicto de versión al recalificar',
    conflictReloadedNotice:
      'Se actualizó la calificación vigente desde el servidor. Revisá los valores actuales antes de guardar nuevamente.',
    conflictReloadFailed:
      'No pudimos recuperar la última versión de la calificación. Reintentá en unos segundos.',
    uncertainReconciledGraded:
      'El servidor confirmó que la calificación quedó guardada. Revisá los valores actualizados.',
    uncertainStillPending:
      'No pudimos confirmar el resultado del envío. Tu borrador sigue intacto; revisá el estado y volvé a intentar.',
    gradeConfirmedToast: (score: number, pointsAwarded: number) =>
      `Calificación guardada: ${score}/100 (${pointsAwarded} ${pointsAwarded === 1 ? 'punto acreditado' : 'puntos acreditados'}).`,
    regradeConfirmedToast: (
      score: number,
      pointsAwarded: number,
      changedPoints: boolean,
    ) =>
      changedPoints
        ? `Recalificación guardada: ${score}/100. El servidor aplicó el ajuste compensatorio (${pointsAwarded} ${pointsAwarded === 1 ? 'punto acreditado neto' : 'puntos acreditados netos'}).`
        : `Recalificación guardada: ${score}/100 (${pointsAwarded} ${pointsAwarded === 1 ? 'punto acreditado' : 'puntos acreditados'}).`,
    regradeNoOpToast:
      'La calificación y la devolución coinciden con la versión vigente; no fue necesario registrar cambios.',
    nonGradableNotice:
      'Solo se pueden calificar manualmente entregas de actividades con formato de archivo.',
  },
  validation: {
    scoreRequired: 'Ingresá una nota entre 0 y 100.',
    scoreInteger: 'La nota debe ser un número entero sin decimales.',
    scoreRange: 'La nota debe estar entre 0 y 100.',
    scoreExceedsActivityMax: (maxScore: number) =>
      `La nota no puede superar el puntaje máximo de la actividad (${maxScore}).`,
    feedbackRequired: 'Escribí una devolución para el estudiante.',
    feedbackMaxLength: (max: number) =>
      `La devolución no puede superar los ${max} caracteres.`,
    feedbackControlChars:
      'La devolución no puede contener saltos de línea, tabulaciones ni caracteres de control.',
  },
  errors: {
    validation: 'Revisá los datos ingresados antes de guardar la calificación.',
    sessionExpired:
      'Tu sesión venció. Iniciá sesión nuevamente para continuar.',
    forbidden: 'No tenés permiso para calificar entregas en esta aula.',
    notFound:
      'La entrega o la actividad ya no está disponible para calificación.',
    conflictVersion:
      'Otra persona o sesión modificó esta calificación mientras la editabas. Tu borrador sigue acá: cargá la versión actual antes de reintentar.',
    conflictAlreadyGradedOrInactive:
      'Esta entrega ya fue calificada o el estudiante ya no está activo en el aula. Actualizamos la cola para mostrar el estado vigente.',
    conflictStudentInactive:
      'No se pudo recalificar porque el estudiante ya no está activo en el aula.',
    conflictNotGradable:
      'Esta actividad no admite calificación manual desde este formulario.',
    conflictGeneric:
      'El estado de la entrega cambió en el servidor. Actualizamos los datos para que puedas revisar antes de continuar.',
    uncertain:
      'No pudimos confirmar si la calificación se guardó en el servidor. Conservamos tu borrador y estamos verificando el estado actual.',
    invalidResponse:
      'Recibimos una respuesta inesperada del servidor al consultar las entregas.',
  },
} as const;
