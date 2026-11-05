/**
 * Centralized Spanish (Argentina, es-AR) user-facing messages for API errors (FD10).
 * Policy:
 * - 404 is shown as resource not found without revealing foreign resources.
 * - 403 is shown as insufficient role permissions.
 * - Network failure is never described as invalid credentials.
 */
export const apiErrorMessages = {
  validation: 'Revisá los campos marcados e intentá de nuevo.',
  badRequest: 'La solicitud no es válida. Revisá los datos ingresados.',
  unauthenticated: 'Tu sesión expiró o no iniciaste sesión. Volvé a ingresar.',
  forbidden:
    'No tenés permisos suficientes con tu rol actual para realizar esta acción.',
  notFound: 'No encontramos el recurso solicitado.',
  conflict: 'La operación entra en conflicto con el estado actual del recurso.',
  rateLimited:
    'Realizaste demasiadas solicitudes. Esperá unos segundos e intentá de nuevo.',
  network:
    'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
  unexpected: 'Ocurrió un problema inesperado. Intentá de nuevo más tarde.',
} as const;
