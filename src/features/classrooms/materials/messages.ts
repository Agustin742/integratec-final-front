import type { MaterialContentType } from './material-schema';

export const materialMessages = {
  heading: 'Material de estudio',
  subtitle:
    'Bibliografía y recursos del aula. Las descargas usan enlaces temporales privados.',
  loading: 'Cargando material del aula…',
  errorTitle: 'No pudimos cargar el material',
  errorDescription: 'Revisá tu conexión e intentá actualizar la lista.',
  retryListAction: 'Reintentar',
  staleTitle: 'Lista pendiente de sincronización',
  staleDescription:
    'Mostrando el último material confirmado. Falló la actualización en segundo plano.',
  emptyTitle: 'Todavía no hay material publicado',
  emptyTeacherDescription:
    'Subí un PDF o imagen para que el grupo pueda descargarlo desde el aula.',
  emptyStudentDescription:
    'Cuando tu docente suba bibliografía o guías de estudio, van a aparecer acá.',
  emptyPageTitle: 'No hay material en esta página',
  emptyPageDescription:
    'Volvé a una página anterior para ver los archivos publicados.',
  goToFirstPageAction: 'Volver a la primera página',
  upload: {
    sectionTitle: 'Subir material',
    sectionDescription:
      'Formatos permitidos: PDF, PNG o JPG/JPEG de hasta 10 MiB.',
    dropzoneLabel: 'Seleccioná o arrastrá un archivo para subir',
    dropzoneHint: 'También podés elegir un archivo con el botón de abajo.',
    chooseFileAction: 'Elegir archivo',
    replaceFileAction: 'Cambiar archivo',
    selectedFileLabel: 'Archivo seleccionado',
    submitAction: 'Subir archivo',
    uploadingStatus: (filename: string) => `Subiendo «${filename}»…`,
    progressLabel: 'Progreso de subida',
    cancelAction: 'Cancelar subida',
    cancelledNotice:
      'Cancelaste la subida. Podés reintentar con el mismo archivo o elegir otro.',
    retryAction: 'Reintentar subida',
    confirmedTitle: 'Material publicado',
    confirmedDescription: (filename: string) =>
      `Confirmamos la subida de «${filename}» en el servidor.`,
    uncertainTitle: 'No pudimos confirmar si el archivo se guardó',
    uncertainDescription:
      'Actualizá la lista para verificar si el servidor lo recibió antes de volver a subirlo.',
    refreshListAction: 'Actualizar lista',
    clientErrors: {
      type: 'Formato no permitido. Elegí un archivo PDF, PNG o JPG/JPEG.',
      size: 'El archivo supera el máximo permitido de 10 MiB.',
      empty: 'El archivo está vacío. Elegí un archivo válido.',
    },
    serverErrors: {
      validationFailed:
        'El servidor rechazó el archivo. Revisá el formato y el tamaño e intentá de nuevo.',
      tooLarge:
        'El archivo supera el límite de 10 MiB permitido por el servidor.',
      forbidden: 'No tenés permiso para subir material en esta aula.',
      notFound: 'No encontramos esta aula o ya no está disponible.',
      uncertain:
        'La subida quedó pendiente de confirmación (tiempo de espera o error del servidor). Actualizá la lista antes de reintentar.',
      unexpected: 'Ocurrió un error inesperado al subir el archivo.',
    },
  },
  list: {
    regionLabel: 'Lista de materiales de estudio',
    types: {
      'application/pdf': 'PDF',
      'image/png': 'Imagen PNG',
      'image/jpeg': 'Imagen JPEG',
    } satisfies Record<MaterialContentType, string>,
    uploadedAtPrefix: 'Publicado el',
    downloadAction: 'Descargar',
    downloadingAction: 'Preparando enlace…',
    removeAction: 'Quitar',
    removingAction: 'Quitando…',
    confirmRemoveTitle: (filename: string) =>
      `¿Quitar «${filename}» del material del aula?`,
    confirmRemoveDescription:
      'El archivo dejará de estar disponible para descargar en esta aula.',
    confirmRemoveSubmit: 'Sí, quitar material',
    confirmRemoveCancel: 'Cancelar',
    confirmedRemovedTitle: 'Material quitado',
    confirmedRemovedDescription: (filename: string) =>
      `Quitamos «${filename}» del material del aula.`,
    downloadErrorTitle: 'No pudimos abrir la descarga',
    downloadErrors: {
      forbidden: 'No tenés permiso para descargar material de esta aula.',
      notFound: 'Este archivo ya no está disponible en el aula.',
      unavailable:
        'No pudimos generar el enlace temporal de descarga. Intentá de nuevo.',
      unexpected: 'Ocurrió un error inesperado al preparar la descarga.',
    },
    removeErrorTitle: 'No pudimos quitar el material',
    removeErrors: {
      forbidden: 'No tenés permiso para quitar material de esta aula.',
      notFound: 'Este material ya fue quitado o no está disponible.',
      unexpected: 'Ocurrió un error inesperado al quitar el material.',
    },
    bot: {
      sectionLabel: 'Asistente de estudio (IA)',
      switchLabel: (filename: string) =>
        `Habilitar «${filename}» para el asistente de estudio`,
      enabledHint: 'Disponible como fuente para el asistente del aula.',
      disabledHint: 'No incluido en las fuentes del asistente.',
      updatingHint: 'Guardando cambio en el servidor…',
      statuses: {
        disabled: 'Desactivado para el bot',
        pending: 'Indexando…',
        ready: 'Listo para el bot',
        failed: 'Error de indexación',
      },
      loadErrorNotice:
        'No pudimos consultar qué materiales tiene habilitados el asistente. Podés reintentar.',
      retryLoadAction: 'Reintentar estado del asistente',
      confirmedEnabledTitle: 'Material habilitado para el asistente',
      confirmedEnabledDescription: (filename: string) =>
        `El servidor confirmó la habilitación de «${filename}» para el asistente de estudio.`,
      confirmedDisabledTitle: 'Material deshabilitado para el asistente',
      confirmedDisabledDescription: (filename: string) =>
        `«${filename}» dejó de estar disponible para el asistente de estudio.`,
      toggleErrorTitle: 'No pudimos actualizar el asistente',
      toggleErrors: {
        forbidden:
          'No tenés permiso para configurar el asistente de estudio en esta aula.',
        notFound:
          'No encontramos este material o el aula ya no está disponible.',
        uncertain:
          'No pudimos confirmar si el cambio se guardó en el servidor. Verificá el estado actual antes de reintentar.',
        unexpected:
          'Ocurrió un error inesperado al actualizar el estado del material para el asistente.',
      },
    },
  },
} as const;
