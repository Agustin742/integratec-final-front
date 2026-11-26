export const settingsMessages = {
  formLabel: 'Configuración del aula',
  loading: 'Cargando la configuración del aula…',
  loadErrorTitle: 'No pudimos cargar la configuración',
  loadErrorDescription:
    'Revisá tu conexión e intentá de nuevo. Tus cambios no se pierden: todavía no editaste nada.',
  forbiddenTitle: 'Sin permisos para configurar el aula',
  forbiddenDescription:
    'Solo el personal docente o directivo autorizado puede cambiar la configuración de esta aula.',
  stale: {
    title: 'La configuración cambió mientras editabas',
    description:
      'Otra persona del equipo guardó cambios en esta aula. Tus ediciones siguen acá; podés cargar los valores del servidor para empezar de nuevo.',
    reload: 'Cargar valores del servidor',
  },
  sections: {
    general: {
      title: 'General',
      description:
        'El nombre y la materia que ven estudiantes y docentes en la barra del aula y en el listado.',
    },
    mode: {
      title: 'Modalidad',
      description: 'Define si el aula incluye seguimiento de las familias.',
    },
    controls: {
      title: 'Chat del aula',
      description:
        'Frená el chat de estudiantes de forma temporal. Podés volver a habilitarlo cuando quieras.',
    },
    tutorBot: {
      title: 'Robot tutor',
      description: 'Cómo se ve el robot del aula en la vista 3D.',
      legend: 'Apariencia del robot',
      options: {
        none: 'Original',
        boca: 'Boca',
        seleccion: 'Selección',
        folklore: 'Folklore',
        guardapolvo: 'Guardapolvo',
        scientist: 'Ciencias',
        graduate: 'Graduación',
        gamer: 'Gamer',
      },
    },
    access: {
      title: 'Acceso e invitaciones',
      description:
        'Cómo se suman estudiantes al aula: código de acceso e invitaciones por correo.',
      toggle: 'Códigos e invitaciones',
      toggleHint:
        'Generá o revocá el código de acceso y gestioná las invitaciones pendientes.',
    },
  },
  fields: {
    adultMode: {
      label: 'Educación de adultos',
      description:
        'Desactiva el acceso de familiares y las invitaciones de vínculos parentales. Los vínculos existentes se conservan, solo quedan en pausa.',
    },
    chatMuted: {
      label: 'Silenciar el chat de estudiantes',
      description:
        'Las y los estudiantes pueden leer el chat pero no enviar mensajes. El equipo docente sigue escribiendo.',
    },
  },
  saveBar: {
    label: 'Estado de la configuración',
    clean: 'Todo guardado',
    dirty: 'Tenés cambios sin guardar',
    saved: 'Cambios guardados',
    save: 'Guardar cambios',
    saving: 'Guardando cambios…',
    discard: 'Descartar cambios',
  },
  toastSavedTitle: 'Configuración guardada',
  toastSavedDescription: (name: string) =>
    `Los cambios de «${name}» ya están activos en el aula.`,
} as const;
