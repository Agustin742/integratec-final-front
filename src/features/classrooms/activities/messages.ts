import type {
  ActivityFormat,
  ActivityState,
  ActivityType,
} from './activity-schema';

export const activityMessages = {
  heading: 'Actividades',
  subtitle: 'Trabajos prácticos y exámenes del aula.',
  loadingLabel: 'Cargando actividades',
  emptyTitle: 'Todavía no hay actividades',
  emptyDescription:
    'Cuando el docente publique una actividad o examen, va a aparecer acá con su fecha límite.',
  emptyTitleStaff: 'Todavía no hay actividades en el aula',
  emptyDescriptionStaff:
    'Cuando crees un trabajo práctico o un examen, va a aparecer acá con su estado.',
  emptyPageTitle: 'No hay más actividades en esta página',
  emptyPageDescription: 'Volvé a la primera página para ver las actividades.',
  backToFirstPageLabel: 'Volver a la primera página',
  clearFilterLabel: 'Ver todas las actividades',
  emptyFilteredDescription: 'No hay actividades para el estado seleccionado.',
  errorTitle: 'No pudimos cargar las actividades',
  errorDescription:
    'Ocurrió un problema al consultar las actividades del aula. Reintentá en unos segundos.',
  forbiddenTitle: 'No tenés acceso a las actividades',
  forbiddenDescription:
    'Este listado está disponible únicamente para integrantes autorizados del aula.',
  notFoundTitle: 'Aula no encontrada',
  notFoundDescription:
    'No encontramos el aula o ya no tenés permiso para ver sus actividades.',
  retryLabel: 'Reintentar',
  staleTitle: 'Mostrando la última lista confirmada',
  staleDescription:
    'Falló la actualización automática; las actividades pueden no estar al día.',
  sortLabel: 'Ordenar por',
  sortOptions: {
    dueAt: 'Próximo vencimiento',
    '-dueAt': 'Vencimiento más lejano',
    '-createdAt': 'Más recientes',
    createdAt: 'Más antiguas',
  },
  stateFilterLabel: 'Estado de publicación',
  stateFilterAll: 'Todas',
  typeLabels: {
    TP: 'Trabajo práctico',
    EXAM: 'Examen',
  } satisfies Record<ActivityType, string>,
  formatLabels: {
    FILE: 'Entrega de archivo',
    MULTIPLE_CHOICE: 'Múltiple opción',
  } satisfies Record<ActivityFormat, string>,
  stateLabels: {
    DRAFT: 'Borrador',
    PUBLISHED: 'Publicada',
  } satisfies Record<ActivityState, string>,
  dueAtLabel: 'Entrega:',
  opensAtLabel: 'Apertura:',
  weightLabel: (multiplier: number) => `Peso ×${multiplier}`,
  maxScoreLabel: (maxScore: number) => `Puntaje máx. ${maxScore}`,
  lateAllowedLabel: 'Admite entrega tardía',
  lateDisallowedLabel: 'Sin entrega tardía',
  questionCountLabel: (count: number) =>
    count === 1 ? '1 pregunta' : `${count} preguntas`,
  openDetailLabel: 'Ver actividad',
  listRegionLabel: 'Actividades del aula',
  board: {
    groupLabels: {
      drafts: 'Borradores',
      published: 'Publicadas',
      closed: 'Vencidas',
      todo: 'Pendientes',
      done: 'Entregadas',
    },
    groupHints: {
      drafts: 'Solo las ves vos hasta que las publiques.',
      published: 'Visibles para el aula y con entrega abierta.',
      closed: 'Ya pasó la fecha límite.',
      todo: 'Lo que todavía tenés que entregar.',
      done: 'Lo que ya entregaste o te corrigieron.',
    },
    teacherStatus: {
      DRAFT: 'Borrador',
      PUBLISHED: 'Publicada',
      closed: 'Vencida',
    },
    workStatus: {
      pending: 'Pendiente',
      overdue: 'Atrasada',
      submitted: 'Entregada',
      graded: 'Calificada',
    },
    summary: (count: number) =>
      count === 1 ? '1 actividad' : `${count} actividades`,
    scoreLabel: (maxScore: number) => `${maxScore} pts`,
    moreActionsAriaLabel: (title: string) => `Acciones de «${title}»`,
    emptyAction: 'Crear la primera actividad',
  },
  actions: {
    createAction: 'Nueva actividad',
    editAction: 'Editar',
    editAriaLabel: (title: string) => `Editar «${title}»`,
    publishAction: 'Publicar',
    publishAriaLabel: (title: string) => `Publicar «${title}»`,
    deactivateAction: 'Desactivar',
    deactivateAriaLabel: (title: string) => `Desactivar «${title}»`,
    deactivateConfirmTitle: (title: string) =>
      `Confirmar desactivación de «${title}»`,
    deactivateConfirmDescription:
      'La actividad deja de aparecer para los estudiantes, pero su historial académico (entregas y calificaciones) se conserva en el servidor.',
    deactivateConfirmSubmit: 'Confirmar desactivación',
    deactivateConfirmPending: 'Desactivando…',
    deactivateConfirmCancel: 'Cancelar',
    deactivatedTitle: 'Actividad desactivada',
    deactivatedDescription: (title: string) =>
      `Confirmamos la desactivación de «${title}». El historial académico se conservó.`,
    deactivateErrorTitle: 'No pudimos completar la desactivación',
  },
  validation: {
    titleRequired: 'Ingresá un título para la actividad.',
    titleTooLong: 'El título no puede superar los 120 caracteres.',
    descriptionTooLong: 'La descripción no puede superar los 5000 caracteres.',
    instantInvalid: 'Ingresá una fecha y hora válidas.',
    opensAtOnlyForExams:
      'La fecha de apertura solo aplica a exámenes, no a trabajos prácticos.',
    opensAtBeforeDueAt:
      'La apertura del examen debe ser anterior a la fecha límite.',
    questionsRequired:
      'Las actividades de opción múltiple necesitan al menos una pregunta.',
    questionsTooMany:
      'Las actividades de opción múltiple admiten hasta 50 preguntas.',
    questionsForbiddenForFile:
      'Las actividades con entrega de archivo no admiten preguntas de opción múltiple.',
    optionsMin: 'Cada pregunta debe tener al menos 2 opciones.',
    optionsMax: 'Cada pregunta admite hasta 6 opciones.',
    exactlyOneCorrectOption:
      'Cada pregunta debe tener exactamente una opción marcada como correcta.',
    questionPromptRequired: 'Ingresá el enunciado de la pregunta.',
    questionPromptTooLong:
      'El enunciado de la pregunta no puede superar los 1000 caracteres.',
    optionLabelRequired: 'Ingresá el texto de la opción.',
    optionLabelTooLong:
      'El texto de la opción no puede superar los 500 caracteres.',
    maxScoreRange: 'El puntaje máximo debe ser un número entero entre 0 y 100.',
    weightMultiplierRange: 'La ponderación debe estar entre 0,5 y 3.',
    weightMultiplierDecimals: 'La ponderación admite hasta dos decimales.',
  },
  write: {
    uncertain:
      'No pudimos confirmar la operación en el servidor. Verificá el estado real de la actividad antes de volver a intentar.',
    validation:
      'El servidor rechazó los datos de la actividad. Revisá los campos marcados.',
    forbidden:
      'Tu rol actual no tiene permisos para gestionar actividades en esta aula.',
    notFound:
      'No encontramos la actividad o el aula indicada, o ya no tenés acceso.',
    updateQuestionsLocked:
      'Las preguntas ya no pueden modificarse porque existe al menos una entrega de la actividad.',
    publishNotPublishable:
      'La actividad no se puede publicar: revisá que la fecha límite sea futura y que las preguntas de opción múltiple estén completas.',
    publishAlreadyPublished: 'La actividad ya estaba publicada.',
    deactivateHasSubmissions:
      'No se puede eliminar la actividad porque tiene entregas asociadas. Su historial académico se conserva.',
    deactivateUnexpected:
      'No pudimos desactivar la actividad. Intentá nuevamente en unos segundos.',
  },
  editor: {
    createTitle: 'Crear actividad',
    createDescription:
      'Definí el tipo, el formato y los datos de la actividad. Se guarda como borrador hasta que la publiques.',
    editTitle: 'Editar actividad',
    editDescription:
      'Actualizá los datos de la actividad. Los cambios aplican en cuanto el servidor los confirme.',
    loadingDetail: 'Cargando la actividad…',
    detailErrorTitle: 'No pudimos cargar la actividad',
    detailNotTeacherView:
      'Tu rol actual ya no permite editar actividades de esta aula.',
    fields: {
      type: {
        legend: 'Tipo de actividad',
        description: 'Elegí si es un trabajo práctico o un examen.',
        immutableNotice:
          'El tipo se define al crear la actividad y no se puede cambiar después.',
        options: {
          TP: {
            label: 'Trabajo práctico',
            description:
              'Una entrega con fecha límite, sin ventana de apertura.',
          },
          EXAM: {
            label: 'Examen',
            description:
              'Puede tener una ventana de apertura además de la fecha límite.',
          },
        },
      },
      format: {
        legend: 'Formato de entrega',
        description:
          'Elegí cómo entregan los estudiantes. El formato no se puede cambiar después de crear la actividad.',
        immutableNotice:
          'El formato es definitivo desde la creación de la actividad.',
        options: {
          FILE: {
            label: 'Entrega de archivo',
            description: 'Los estudiantes suben un archivo como entrega.',
          },
          MULTIPLE_CHOICE: {
            label: 'Múltiple opción',
            description: 'Los estudiantes responden preguntas con opciones.',
          },
        },
      },
      title: {
        label: 'Título',
        description: 'Visible para el aula una vez publicada la actividad.',
        placeholder: 'Ej. TP Fracciones',
      },
      description: {
        label: 'Descripción (opcional)',
        description: 'Consigna o indicaciones para los estudiantes.',
        placeholder: 'Ej. Resolver los ejercicios del capítulo 3.',
      },
      dueAt: {
        label: 'Fecha límite',
        timezoneNote: (timeZone: string) =>
          `Ingresala en la zona horaria del colegio (${timeZone}).`,
      },
      opensAt: {
        label: 'Apertura del examen (opcional)',
        timezoneNote: (timeZone: string) =>
          `Momento en que el examen se habilita, en la zona horaria del colegio (${timeZone}).`,
        tpHint:
          'La apertura solo aplica a exámenes: los trabajos prácticos quedan visibles para los estudiantes desde que se publican.',
        tpStoredValue: (formattedInstant: string) =>
          `Tenés una apertura cargada: ${formattedInstant}.`,
        removeAction: 'Quitar apertura',
        immutableHint:
          'La apertura no se puede quitar una vez definida; podés cambiarla de fecha y hora.',
      },
      allowLate: {
        label: 'Aceptar entregas tardías',
        description:
          'Permite que los estudiantes entreguen después de la fecha límite.',
      },
      maxScore: {
        label: 'Puntaje máximo',
        description: 'Número entero entre 0 y 100 para calificar la actividad.',
        placeholder: 'Ej. 10',
      },
      weightMultiplier: {
        label: 'Ponderación',
        description:
          'Peso de la actividad en el promedio del período (entre 0,5 y 3, con hasta dos decimales).',
        placeholder: 'Ej. 1.5',
      },
    },
    validation: {
      dueAtRequired: 'Ingresá la fecha límite.',
      maxScoreRequired: 'Ingresá el puntaje máximo.',
      weightMultiplierRequired: 'Ingresá la ponderación.',
      opensAtCannotBeRemoved:
        'La apertura no se puede quitar una vez definida. Cambiala de fecha y hora, o dejala como está.',
    },
    questions: {
      heading: 'Preguntas de múltiple opción',
      description:
        'Armá las preguntas y sus opciones, y marcá la opción correcta de cada una. Las respuestas correctas solo se ven en vistas docentes.',
      addQuestion: 'Agregar pregunta',
      questionLegend: (position: number) => `Pregunta ${position}`,
      removeQuestion: (position: number) => `Quitar la pregunta ${position}`,
      moveQuestionUp: (position: number) => `Subir la pregunta ${position}`,
      moveQuestionDown: (position: number) => `Bajar la pregunta ${position}`,
      prompt: {
        label: 'Enunciado',
        placeholder: 'Ej. ¿Cuánto es 2 + 2?',
      },
      optionsLegend: (position: number) =>
        `Opciones de la pregunta ${position}`,
      optionLabel: (position: number) => `Texto de la opción ${position}`,
      optionPlaceholder: 'Ej. 4',
      correctGroup: (position: number) =>
        `Respuesta correcta de la pregunta ${position}`,
      markCorrect: (position: number) =>
        `Marcar la opción ${position} como correcta`,
      correctHint: 'Marcá con el selector la opción correcta de esta pregunta.',
      addOption: 'Agregar opción',
      removeOption: (position: number) => `Quitar la opción ${position}`,
      moveOptionUp: (position: number) => `Subir la opción ${position}`,
      moveOptionDown: (position: number) => `Bajar la opción ${position}`,
      correctOptionLabel: 'Correcta',
      fileFormatHint:
        'Las actividades con entrega de archivo no admiten preguntas de opción múltiple.',
      fileFormatStored: (count: number) =>
        count === 1
          ? 'Quedó 1 pregunta cargada de la etapa de opción múltiple.'
          : `Quedaron ${count} preguntas cargadas de la etapa de opción múltiple.`,
      removeQuestionsAction: 'Quitar todas las preguntas',
    },
    errors: {
      rootTitle: 'No pudimos guardar la actividad',
    },
    actions: {
      cancel: 'Cancelar',
      createSubmit: 'Crear actividad',
      createPending: 'Creando actividad…',
      editSubmit: 'Guardar cambios',
      editPending: 'Guardando cambios…',
      unsavedChanges:
        'Tenés cambios sin guardar en la actividad. ¿Querés descartarlos?',
    },
    createdTitle: 'Borrador guardado',
    createdDescription: (title: string) =>
      `Confirmamos el borrador «${title}» en el servidor.`,
    updatedTitle: 'Cambios guardados',
    updatedDescription: (title: string) =>
      `Confirmamos los cambios de «${title}» en el servidor.`,
    publishedTitle: 'Actividad publicada',
    publishedDescription: (title: string) =>
      `Confirmamos la publicación de «${title}». Los estudiantes ya pueden verla.`,
    publish: {
      title: (title: string) => `Publicar «${title}»`,
      description:
        'Publicar es definitivo: la actividad pasa de borrador a publicada y los estudiantes la ven de inmediato. Confirmá que la fecha límite sea futura antes de publicar.',
      dueAtLabel: 'Fecha límite a publicar',
      submit: 'Publicar actividad',
      pending: 'Publicando…',
      cancel: 'Seguir como borrador',
      errorTitle: 'No pudimos publicar la actividad',
    },
  },
  detail: {
    backToClassroomLabel: 'Volver al aula',
    loadingLabel: 'Cargando detalle de la actividad',
    errorTitle: 'No pudimos cargar la actividad',
    forbiddenTitle: 'No tenés acceso a esta actividad',
    forbiddenDescription:
      'No tenés permiso para consultar el detalle de esta actividad.',
    notFoundTitle: 'Actividad no encontrada',
    notFoundDescription:
      'La actividad no existe, todavía no fue publicada o dejó de ser accesible.',
    tabsLabel: 'Secciones de la actividad',
    tabs: {
      overview: 'Consigna',
      submission: 'Entrega',
      forum: 'Foro de consultas',
      review: 'Revisión docente',
    },
    dueAtTerm: 'Fecha límite',
    opensAtTerm: 'Apertura',
    maxScoreTerm: 'Puntaje máximo',
    weightTerm: 'Ponderación',
    weightValue: (multiplier: number) => `×${multiplier}`,
    latePolicyTerm: 'Entrega tardía',
    pendingTabTitle: 'Sección disponible próximamente',
    submissionPendingDescription:
      'Próximamente vas a poder subir tu entrega o resolver el examen desde esta sección.',
    forumPendingDescription:
      'Próximamente vas a poder hacer consultas y leer respuestas sobre esta actividad.',
    reviewPendingDescription:
      'Próximamente vas a poder revisar entregas y calificar esta actividad desde esta sección.',
    questionsHeading: 'Consignas de múltiple opción',
    correctOptionBadge: 'Correcta',
  },
} as const;
