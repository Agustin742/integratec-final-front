export const submissionMessages = {
  validation: {
    count: 'Elegí entre 1 y 5 archivos para tu entrega.',
    type: 'Uno de los archivos no es un PDF, PNG, JPEG o DOCX válido.',
    size: 'Cada archivo puede pesar hasta 10 MB.',
    idempotencyKey:
      'No se pudo identificar el envío. Reintentá en unos segundos.',
  },
  serverErrors: {
    forbidden: 'La entrega está disponible únicamente para alumnos del aula.',
    windowClosed:
      'La fecha límite de entrega ya pasó y la actividad no admite entregas tardías.',
    windowNotOpen:
      'La actividad todavía no abrió. Podés entregar desde la fecha de apertura.',
    notFileActivity: 'Esta actividad no se resuelve con archivos.',
    duplicate:
      'Tu entrega ya está registrada con otro envío. Estás viendo la confirmación.',
    network:
      'No pudimos confirmar tu entrega. Estamos verificando el resultado con el servidor.',
    unexpected:
      'No pudimos leer la respuesta del servidor. Reintentá en unos segundos.',
  },
} as const;
