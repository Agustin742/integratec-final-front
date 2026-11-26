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
    'Armá el material por módulos (una unidad, un tema, una semana) y subí ahí los archivos para que el grupo los encuentre ordenados.',
  emptyStudentDescription:
    'Cuando tu docente suba bibliografía o guías de estudio, van a aparecer acá.',
  emptyPageTitle: 'No hay material en esta página',
  emptyPageDescription:
    'Volvé a una página anterior para ver los archivos publicados.',
  goToFirstPageAction: 'Volver a la primera página',
  modules: {
    createAction: 'Nuevo módulo',
    createFirstAction: 'Crear el primer módulo',
    regionLabel: 'Módulos de material',
    unassignedTitle: 'Sin módulo',
    unassignedDescription: 'Archivos que todavía no están en ningún módulo.',
    fileCount: (count: number) =>
      count === 1 ? '1 archivo' : `${count} archivos`,
    emptyModule: 'Este módulo todavía no tiene archivos',
    emptyModuleTeacher:
      'Agregá un archivo desde el botón de este módulo, o movelo desde otro con el menú de cada archivo.',
    emptyModuleStudent:
      'Cuando tu docente suba archivos a este módulo, van a aparecer acá.',
    filesErrorTitle: 'No pudimos cargar los archivos',
    filesErrorDescription: 'Revisá tu conexión e intentá de nuevo.',
    capReachedMessage:
      'Llegaste al máximo de 100 módulos por aula. Eliminá alguno para crear otro.',
    moreActionsAriaLabel: (name: string) => `Más acciones de «${name}»`,
    editAction: 'Editar módulo',
    deleteAction: 'Eliminar módulo',
    addFileAction: 'Agregar archivo',
    addFileAriaLabel: (name: string) => `Agregar archivo a «${name}»`,
    moveUpAriaLabel: (name: string) => `Mover «${name}» hacia arriba`,
    moveDownAriaLabel: (name: string) => `Mover «${name}» hacia abajo`,
    movedNotice: (name: string, position: number, total: number) =>
      `«${name}» ahora está en la posición ${position} de ${total}.`,
    reorderedTitle: 'Orden actualizado',
    reorderErrorTitle: 'No pudimos reordenar los módulos',
    createdTitle: 'Módulo creado',
    createdDescription: (name: string) => `Creamos el módulo «${name}».`,
    updatedTitle: 'Módulo actualizado',
    updatedDescription: (name: string) => `Guardamos los cambios de «${name}».`,
    deletedTitle: 'Módulo eliminado',
    deletedDescription: (name: string) =>
      `Eliminamos «${name}». Sus archivos quedaron en «Sin módulo».`,
    deleteErrorTitle: 'No pudimos eliminar el módulo',
    paginationLabel: (title: string) => `Paginación de ${title}`,
    uncertainAction:
      'No pudimos confirmar si el cambio se guardó en el servidor. Actualizamos la lista para verificarlo antes de reintentar.',
    unexpected: 'Ocurrió un error inesperado. Intentá de nuevo.',
    form: {
      createTitle: 'Nuevo módulo',
      editTitle: 'Editar módulo',
      description:
        'Los módulos ordenan el material del aula: una unidad, un tema o una semana.',
      nameLabel: 'Nombre del módulo',
      descriptionLabel: 'Descripción (opcional)',
      nameRequired: 'Escribí un nombre para el módulo.',
      nameTooLong: 'El nombre puede tener hasta 80 caracteres.',
      descriptionTooLong: 'La descripción puede tener hasta 500 caracteres.',
      createSubmit: 'Crear módulo',
      editSubmit: 'Guardar cambios',
      submitting: 'Guardando…',
      cancel: 'Cancelar',
    },
    deleteDialog: {
      title: (name: string) => `¿Eliminar el módulo «${name}»?`,
      description: (count: number) =>
        count === 0
          ? 'El módulo está vacío. Podés crear otro cuando quieras.'
          : count === 1
            ? 'El archivo no se borra: pasa a «Sin módulo».'
            : `Los ${count} archivos no se borran: pasan a «Sin módulo».`,
      submit: 'Sí, eliminar módulo',
      submitting: 'Eliminando…',
      cancel: 'Cancelar',
    },
    uploadDialog: {
      title: (name: string) => `Subir material a «${name}»`,
    },
    moveDialog: {
      title: (filename: string) => `Mover «${filename}»`,
      description: 'Elegí a qué módulo va este archivo.',
      targetLabel: 'Módulo de destino',
      submit: 'Mover archivo',
      submitting: 'Moviendo…',
      cancel: 'Cancelar',
      movedTitle: 'Archivo movido',
      movedDescription: (filename: string, target: string) =>
        `Movimos «${filename}» a «${target}».`,
    },
  },
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
    moreActionsAriaLabel: (filename: string) => `Más acciones de «${filename}»`,
    moveAction: 'Mover a otro módulo',
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
      uncertain:
        'No pudimos confirmar si el archivo se quitó en el servidor. Actualizamos la lista para verificarlo antes de reintentar.',
      unexpected: 'Ocurrió un error inesperado al quitar el material.',
    },
    bot: {
      sectionLabel: 'Asistente de estudio (IA)',
      switchLabel: (filename: string) =>
        `Habilitar «${filename}» para el asistente de estudio`,
      enabledHint: 'Disponible como fuente para el asistente del aula.',
      pendingIndexingHint:
        'El servidor está procesando este archivo para el asistente.',
      failedIndexingHint:
        'No pudo indexarse para el asistente. Podés reintentar o desactivarlo.',
      disabledHint: 'No incluido en las fuentes del asistente.',
      pendingConfigHint: 'Consultando estado del asistente…',
      errorConfigHint: 'No pudimos confirmar el estado actual en el servidor.',
      updatingHint: 'Guardando cambio en el servidor…',
      statuses: {
        disabled: 'Desactivado para el bot',
        pending: 'Indexando…',
        ready: 'Listo para el bot',
        failed: 'Error de indexación',
      },
      loadErrorTitle: 'No pudimos consultar el asistente',
      loadErrorNotice:
        'No pudimos consultar qué materiales tiene habilitados el asistente. Podés reintentar.',
      retryLoadAction: 'Reintentar estado del asistente',
      retryIndexAction: 'Reintentar indexación',
      retryIndexLabel: (filename: string) =>
        `Reintentar indexación de «${filename}»`,
      indexFailedTitle: 'No pudimos indexar el material',
      indexFailedDescription: (filename: string) =>
        `«${filename}» quedó habilitado, pero el asistente todavía no puede usarlo. Podés reintentar la indexación.`,
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
        cleanupPending:
          'El material ya quedó excluido del asistente, pero la limpieza de su índice quedó pendiente.',
        unexpected:
          'Ocurrió un error inesperado al actualizar el estado del material para el asistente.',
      },
    },
  },
} as const;
