/**
 * Centralized Spanish (`es-AR`) copy for the classroom chat contract layer
 * (`HU-COM-002`). Never expose internal story IDs, backend stack traces, or
 * raw error codes. Panel/composer copy beyond the contract layer is owned by
 * the follow-up panel tasks.
 */
export const chatMessages = {
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
      'Tu sesión venció. Iniciá sesión nuevamente para participar en el chat.',
    forbidden: 'No tenés permiso para usar el chat de este aula.',
    notFound:
      'El aula o el mensaje ya no está disponible. Actualizamos la vista.',
    rateLimited:
      'Enviaste varios mensajes en poco tiempo. Esperá unos instantes antes de reintentar.',
    uncertain:
      'No pudimos confirmar si el mensaje quedó guardado en el servidor. Conservamos tu borrador mientras verificamos el chat.',
    invalidResponse:
      'Recibimos una respuesta inesperada del servidor al consultar el chat.',
  },
} as const;
