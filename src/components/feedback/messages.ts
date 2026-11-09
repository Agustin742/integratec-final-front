/**
 * Centralized Spanish (Argentina, es-AR) messages for shared feedback primitives (FD10).
 */
export const feedbackMessages = {
  loading: 'Cargando contenido...',
  errorTitle: 'No pudimos completar la operación',
  errorFallbackDescription:
    'Ocurrió un problema al cargar la información. Intentá de nuevo.',
  retry: 'Reintentar',
  retrying: 'Reintentando...',
  staleTitle: 'Mostrando los últimos datos disponibles',
  staleDescription:
    'No pudimos actualizar la información más reciente. Podés seguir trabajando con los datos en pantalla o volver a intentar.',
  refresh: 'Actualizar datos',
  refreshing: 'Actualizando...',
} as const;
