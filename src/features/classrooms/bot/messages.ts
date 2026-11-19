export const botMessages = {
  heading: 'Asistente de estudio',
  subtitle:
    'Consultá dudas sobre el material habilitado por tu docente. El asistente guía tu estudio sin resolver actividades ni evaluaciones.',
  loading: 'Consultando disponibilidad del asistente…',
  loadErrorTitle: 'No pudimos consultar el asistente',
  loadErrorDescription: 'Revisá tu conexión e intentá de nuevo.',
  retryAction: 'Reintentar',
  staleTitle: 'Estado del asistente pendiente de sincronización',
  staleDescription:
    'Mostrando la última disponibilidad confirmada. Falló la actualización en segundo plano.',
  parentDeniedTitle: 'Acceso no disponible',
  parentDeniedDescription:
    'Las cuentas de madres, padres o tutores no tienen acceso al asistente de estudio.',
  examLockedTitle: 'Asistente pausado durante el examen',
  examLockedDefault:
    'El asistente no está disponible mientras tenés un examen en curso según el servidor.',
  unavailableTitle: 'Asistente no disponible',
  unavailableDefault:
    'El asistente de estudio no está disponible en este momento para esta aula.',
  emptyHistoryTitle: 'Todavía no hiciste consultas en esta sesión',
  emptyHistoryDescription:
    'Escribí una pregunta sobre los apuntes o guías del aula. Vas a ver las fuentes citadas junto a cada respuesta.',
  conversationRegionLabel: 'Historial de conversación con el asistente',
  userAuthorLabel: 'Vos',
  botAuthorLabel: 'Asistente de estudio',
  citationsLabel: 'Fuentes citadas',
  outOfScopeBadge: 'Fuera del material aprobado',
  guidedOnlyBadge: 'Guía sin solución directa',
  composerLabel: 'Tu consulta para el asistente',
  composerPlaceholder: 'Preguntá sobre un tema o concepto del material…',
  sendAction: 'Enviar consulta',
  sendingAction: 'Consultando al asistente…',
  emptyQuestionError: 'Escribí una consulta antes de enviar.',
  tooLongQuestionError: (max: number) =>
    `La consulta no puede superar los ${max} caracteres.`,
  errors: {
    examLockedTitle: 'Consulta bloqueada por examen en curso',
    rateLimitedTitle: 'Límite de consultas alcanzado',
    rateLimitedDescription:
      'Alcanzaste el límite de consultas por ahora. Esperá un momento antes de volver a preguntar.',
    providerUnavailableTitle: 'Servicio de IA no disponible',
    providerUnavailableDescription:
      'El servicio de inteligencia artificial no pudo responder en este momento. Intentá de nuevo más tarde.',
    forbiddenTitle: 'Sin permiso para consultar el asistente',
    forbiddenDescription:
      'No tenés permiso para usar el asistente de estudio en esta aula.',
    notFoundTitle: 'Aula o asistente no disponible',
    notFoundDescription:
      'No encontramos esta aula o el recurso ya no está disponible.',
    networkDescription:
      'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
    unexpectedTitle: 'No pudimos obtener una respuesta',
    unexpectedDescription:
      'Ocurrió un error inesperado al consultar el asistente. Intentá de nuevo.',
  },
} as const;
