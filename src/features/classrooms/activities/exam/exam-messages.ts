export const examMessages = {
  validation: {
    answers: 'Respondé todas las preguntas antes de enviar el examen.',
    answerShape: 'Cada pregunta necesita al menos una opción seleccionada.',
    duplicateQuestion: 'Cada pregunta admite una única respuesta.',
    idempotencyKey:
      'No se pudo identificar el envío. Reintentá en unos segundos.',
  },
  serverErrors: {
    forbidden: 'El examen está disponible únicamente para alumnos del aula.',
    notFound: 'No encontramos la actividad del examen.',
    windowClosed:
      'La fecha límite del examen ya pasó y la actividad no admite entregas tardías.',
    windowNotOpen:
      'El examen todavía no abrió. Podés responder desde la fecha de apertura.',
    notExamActivity: 'Esta actividad no se responde con opciones múltiples.',
    duplicate:
      'Tu examen ya está registrado con otro envío. Estás viendo la confirmación.',
    uncertain:
      'No pudimos confirmar tu envío. Estamos verificando el resultado con el servidor.',
    unexpected:
      'No pudimos leer la respuesta del servidor. Reintentá en unos segundos.',
  },
} as const;
