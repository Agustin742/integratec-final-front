export const announcementMessages = {
  heading: 'Tablón de anuncios',
  subtitle: 'Novedades y avisos publicados para los integrantes del aula.',
  loadingTitle: 'Cargando anuncios',
  loadingDescription: 'Estamos consultando el tablón del aula.',
  emptyTitle: 'Todavía no hay anuncios',
  emptyDescription:
    'Cuando un docente publique un aviso, va a aparecer acá en orden cronológico.',
  emptyPageTitle: 'No hay más anuncios en esta página',
  emptyPageDescription: 'Volvé a la primera página para ver los avisos.',
  errorTitle: 'No pudimos cargar el tablón de anuncios',
  errorDescription:
    'Ocurrió un problema al consultar los anuncios del aula. Reintentá en unos segundos.',
  forbiddenTitle: 'No tenés acceso a los anuncios',
  forbiddenDescription:
    'Este tablón está disponible únicamente para integrantes autorizados del aula.',
  notFoundTitle: 'Aula no encontrada',
  notFoundDescription:
    'No encontramos el aula o ya no tenés permiso para ver sus anuncios.',
  retryLabel: 'Reintentar',
  staleBannerTitle: 'Mostrando la última lista confirmada',
  staleBannerDescription:
    'Falló la actualización automática; los anuncios pueden no estar al día.',
  list: {
    regionLabel: 'Anuncios publicados en el aula',
    publishedAtLabel: 'Publicado:',
    updatedAtLabel: 'Editado:',
    mentionsLabel: (count: number) =>
      count === 1 ? '1 mención' : `${count} menciones`,
    editLabel: 'Editar',
    removeLabel: 'Eliminar',
    removingLabel: 'Eliminando…',
    confirmRemovePrompt: (title: string) =>
      `¿Eliminar el anuncio "${title}"? Esta acción no se puede deshacer.`,
    confirmRemoveLabel: 'Confirmar eliminación',
    cancelRemoveLabel: 'Cancelar',
    removedNoticeTitle: 'Anuncio eliminado',
    removedNoticeDescription: (title: string) =>
      `Se eliminó "${title}" del tablón del aula.`,
    removeErrorTitle: 'No pudimos eliminar el anuncio',
    paginationPrevious: 'Anterior',
    paginationNext: 'Siguiente',
    paginationPageOf: (page: number, totalPages: number) =>
      `Página ${page} de ${totalPages}`,
  },
  form: {
    publishHeading: 'Publicar anuncio',
    editHeading: 'Editar anuncio',
    titleLabel: 'Título',
    titlePlaceholder: 'Ej. Fecha de evaluación',
    titleRequired: 'Ingresá un título para el anuncio.',
    titleSingleLine: 'El título debe tener una sola línea.',
    titleMaxLength: 'El título no puede superar los 200 caracteres.',
    contentLabel: 'Contenido',
    contentPlaceholder:
      'Escribí el aviso en texto plano. Podés mencionar integrantes con @Nombre.',
    contentHelper:
      'Se publica como texto plano seguro. Las menciones (@Nombre) se resuelven en el servidor.',
    contentRequired: 'Ingresá el contenido del anuncio.',
    contentMaxLength: 'El contenido no puede superar los 5000 caracteres.',
    submitPublish: 'Publicar anuncio',
    submittingPublish: 'Publicando…',
    submitEdit: 'Guardar cambios',
    submittingEdit: 'Guardando…',
    cancelEdit: 'Cancelar edición',
    publishedNoticeTitle: 'Anuncio publicado',
    publishedNoticeDescription: (title: string) =>
      `"${title}" ya está visible en el tablón del aula.`,
    updatedNoticeTitle: 'Anuncio actualizado',
    updatedNoticeDescription: (title: string) =>
      `Se guardaron los cambios en "${title}".`,
    serverErrors: {
      validationFailed:
        'Revisá el título y el contenido antes de volver a enviar.',
      forbidden: 'No tenés permiso para realizar esta acción sobre el anuncio.',
      notFound:
        'El anuncio o el aula ya no existen o dejaron de ser accesibles.',
      uncertain:
        'No pudimos confirmar si el servidor guardó el cambio. Actualizamos el tablón para verificarlo antes de reintentar.',
    },
  },
} as const;
