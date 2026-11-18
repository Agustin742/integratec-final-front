import type {
  ActivityFormat,
  ActivityState,
  ActivityType,
} from './activity-schema';

export const activityMessages = {
  heading: 'Actividades',
  subtitle: 'Trabajos prácticos y exámenes publicados en el aula.',
  loadingLabel: 'Cargando actividades',
  emptyTitle: 'Todavía no hay actividades',
  emptyDescription:
    'Cuando el docente publique una actividad o examen, va a aparecer acá con su fecha límite.',
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
