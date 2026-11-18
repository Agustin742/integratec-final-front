export const classroomMessages = {
  loading: 'Cargando aula…',
  title: 'Aula',
  panelDescription:
    'Panel del aula actual. Cerralo para volver al espacio de trabajo.',
  pendingPanelTitle: 'Funcionalidad pendiente',
  pendingPanelDescription:
    'Este panel todavía no incluye su contenido. Podés cerrarlo y volver al aula.',
  panels: {
    activities: 'Actividades',
    material: 'Material',
    grades: 'Calificaciones',
    chat: 'Chat',
    notices: 'Avisos',
    shop: 'Tienda',
    bot: 'Asistente de estudio',
    members: 'Integrantes',
    settings: 'Configuración',
  },
  role: 'Tu rol en esta aula',
  errorTitle: 'No pudimos cargar el aula',
  errorDescription: 'Revisá tu conexión e intentá de nuevo.',
  roles: {
    TEACHER: 'Docente',
    STUDENT: 'Estudiante',
    PARENT: 'Familiar',
    OWNER: 'Titular de la escuela',
    ADMIN: 'Administración escolar',
  },
  list: {
    subtitle:
      'Entrá a tus aulas virtuales o creá y configurá una nueva según tu rol.',
    loading: 'Cargando tus aulas…',
    errorTitle: 'No pudimos cargar tus aulas',
    errorDescription:
      'Revisá tu conexión e intentá actualizar el listado de aulas.',
    staleTitle: 'Lista pendiente de sincronización',
    staleDescription:
      'Mostrando las últimas aulas confirmadas. Falló la actualización en segundo plano.',
    emptyTitle: 'Todavía no tenés aulas',
    emptyTeacherDescription:
      'Si sos docente o administrás una escuela, podés crear tu primera aula virtual. Si sos estudiante o familiar, esperá una invitación o un código de acceso.',
    emptyForbiddenDescription:
      'Tu rol actual no permite crear aulas. Cuando te matriculen o recibas una invitación confirmada, vas a ver tus aulas acá.',
    emptyFilteredTitle: 'No hay aulas en este contexto',
    emptyFilteredDescription:
      'Probá cambiar el filtro de contexto para ver el resto de tus aulas.',
    emptyPageTitle: 'No hay aulas en esta página',
    emptyPageDescription:
      'Probá volver a una página anterior para ver tus aulas.',
    createAction: 'Crear aula',
    createFirstAction: 'Crear mi primera aula',
    enterAction: 'Entrar al aula',
    configureAction: 'Configurar aula',
    noSubject: 'Sin materia ni descripción cargada',
    paths: {
      school: 'Escuela',
      independent: 'Docente independiente',
    },
    modes: {
      school: 'Modalidad escolar (con familias)',
      adult: 'Educación de adultos',
    },
    contextSwitcher: {
      regionLabel: 'Contexto organizacional activo',
      heading: 'Contexto activo',
      allLabel: 'Todas mis aulas',
      independentLabel: 'Docente independiente',
      schoolSingleLabel: 'Escuela',
      schoolIndexedLabel: (index: number) => `Escuela ${index}`,
      activeSummaryPrefix: 'Viendo:',
      clearFilterAction: 'Ver todas mis aulas',
      discardNotice:
        'Al cambiar de contexto se descartan los cambios sin guardar en el formulario.',
    },
    forbiddenAlertTitle: 'No tenés permiso para crear aulas',
    forbiddenAlertDescription:
      'Solo docentes o personal directivo autorizado de una escuela pueden crear o configurar aulas.',
    confirmedCreatedTitle: 'Aula creada',
    confirmedCreatedDescription: (name: string) =>
      `Confirmamos el alta de «${name}» en el servidor.`,
    confirmedUpdatedTitle: 'Configuración guardada',
    confirmedUpdatedDescription: (name: string) =>
      `Confirmamos los cambios de «${name}» en el servidor.`,
  },
  form: {
    createTitle: 'Crear aula virtual',
    createDescription:
      'Definí el nombre, la materia opcional y la modalidad del aula. Se guardará en tu escuela o en tu espacio independiente según tu cuenta.',
    editTitle: 'Configurar aula virtual',
    editDescription:
      'Actualizá el nombre, la materia o la modalidad del aula. Los cambios aplican en cuanto el servidor los confirme.',
    fields: {
      name: {
        label: 'Nombre del aula',
        description:
          'Visible para estudiantes y personal del aula (hasta 120 caracteres).',
        placeholder: 'Ej. 3.º Año B - Matemática',
      },
      subject: {
        label: 'Materia o descripción (opcional)',
        description:
          'Ayuda a identificar el curso o programa (hasta 200 caracteres).',
        placeholder: 'Ej. Matemática y Geometría',
      },
      adultMode: {
        legend: 'Modalidad del aula',
        description:
          'Elegí si el curso incluye seguimiento de madres, padres o tutores.',
        options: {
          school: {
            title: 'Modalidad escolar (con familias)',
            badge: 'Con seguimiento familiar',
            description:
              'Permite vincular hasta 2 adultos responsables por estudiante para consultar calificaciones y notificaciones.',
          },
          adult: {
            title: 'Educación de adultos',
            badge: 'Sin acciones parentales',
            description:
              'No ofrece nuevas invitaciones familiares y desactiva las acciones de vínculos parentales existentes sin borrar su historial.',
          },
        },
      },
      schoolId: {
        label: 'Escuela de destino',
        description:
          'Pertenecés a más de una escuela o necesitás indicar el identificador de la escuela donde se creará el aula.',
        selectPlaceholder: 'Elegí una escuela',
        independentOption: 'Docente independiente (sin escuela)',
        uuidPlaceholder: 'Ej. 3f6c2d9e-0000-4000-8000-000000000000',
      },
    },
    validation: {
      nameRequired: 'Ingresá el nombre del aula.',
      nameTooLong: 'El nombre del aula no puede superar los 120 caracteres.',
      nameControlChars:
        'El nombre del aula no puede incluir saltos de línea ni caracteres de control.',
      nameVisibleRequired:
        'El nombre del aula debe contener al menos un carácter visible.',
      subjectTooLong:
        'La materia o descripción no puede superar los 200 caracteres.',
      subjectControlChars:
        'La materia o descripción no puede incluir saltos de línea ni caracteres de control.',
      subjectVisibleRequired:
        'Si completás la materia o descripción, incluí al menos un carácter visible.',
      schoolIdInvalid: 'Indicá un identificador UUID válido para la escuela.',
    },
    errors: {
      rootTitle: 'No pudimos guardar el aula',
      validationFailed:
        'Revisá los campos marcados antes de enviar el formulario.',
      forbidden:
        'Tu rol actual no tiene permisos para crear ni configurar aulas.',
      notFound:
        'No encontramos el aula o la escuela indicada, o ya no tenés acceso.',
      uncertainWrite:
        'No pudimos confirmar si los cambios se guardaron en el servidor. Actualizamos el listado para verificar el estado real antes de que vuelvas a intentar.',
    },
    actions: {
      createSubmit: 'Crear aula',
      createPending: 'Creando aula…',
      editSubmit: 'Guardar cambios',
      editPending: 'Guardando cambios…',
      cancel: 'Cancelar',
      unsavedChanges:
        'Tenés cambios sin guardar en el formulario del aula. ¿Querés descartarlos?',
    },
  },
} as const;
