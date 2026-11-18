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
    joinWithCodeAction: 'Unirme con un código',
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
  roster: {
    heading: 'Nómina de estudiantes',
    subtitle:
      'Consultá el estado de matrícula, los adultos responsables vinculados y gestioná bajas lógicas conservando el historial académico.',
    loading: 'Cargando nómina de estudiantes…',
    errorTitle: 'No pudimos cargar la nómina del aula',
    errorDescription:
      'Revisá tu conexión e intentá actualizar el listado de integrantes.',
    forbiddenTitle: 'Sin permisos para ver la nómina',
    forbiddenDescription:
      'Solo docentes o personal directivo autorizado de esta aula pueden consultar la nómina y gestionar bajas.',
    notFoundTitle: 'No encontramos la nómina del aula',
    notFoundDescription:
      'El aula no existe o ya no tenés acceso para consultar sus integrantes.',
    staleTitle: 'Nómina pendiente de sincronización',
    staleDescription:
      'Mostrando la última nómina confirmada. Falló la actualización en segundo plano.',
    emptyTitle: 'Todavía no hay estudiantes en el aula',
    emptyDescription:
      'Cuando los estudiantes se unan mediante invitación o código, van a aparecer en esta nómina.',
    emptyFilteredTitle: 'No encontramos estudiantes con ese filtro',
    emptyFilteredDescription:
      'Probá ajustar la búsqueda por nombre o el filtro de estado de matrícula.',
    emptyPageTitle: 'No hay estudiantes en esta página',
    emptyPageDescription:
      'Volvé a una página anterior para ver el resto de la nómina.',
    clearFiltersAction: 'Limpiar filtros',
    searchLabel: 'Buscar estudiante',
    searchPlaceholder: 'Buscar por nombre…',
    searchClearAction: 'Limpiar búsqueda',
    stateFilterLabel: 'Estado de matrícula',
    stateOptions: {
      ALL: 'Todos',
      ACTIVE: 'Activos',
      INACTIVE: 'Dados de baja',
    },
    states: {
      ACTIVE: 'Activo',
      INACTIVE: 'Dado de baja',
    },
    removedAt: (formattedDate: string) => `Baja lógica: ${formattedDate}`,
    guardiansHeading: 'Adultos responsables vinculados',
    guardiansEmpty: 'Sin adultos responsables vinculados',
    guardianStates: {
      ACTIVE: 'Vínculo activo',
      INACTIVE: 'Vínculo inactivo',
    },
    guardianHistoricalNote: 'Estado histórico del vínculo familiar',
    removeAction: 'Dar de baja',
    removeAriaLabel: (name: string) => `Dar de baja a ${name}`,
    confirmTitle: (name: string) => `Confirmar baja lógica de «${name}»`,
    confirmDescription:
      'El estudiante perderá el acceso al aula, se liberará su pupitre y se desactivarán sus vínculos familiares activos. Su historial académico (entregas, calificaciones y actividad previa) se conserva.',
    confirmSubmit: 'Confirmar baja',
    confirmPending: 'Dando de baja…',
    confirmCancel: 'Cancelar',
    removedTitle: 'Estudiante dado de baja',
    removedDescription: (name: string) =>
      `Confirmamos la baja lógica de «${name}». Su historial académico fue conservado.`,
    removeErrorTitle: 'No pudimos completar la baja',
    removeForbidden:
      'Tu rol actual no tiene permisos para dar de baja a estudiantes en esta aula.',
    removeNotFound:
      'No encontramos al estudiante o el aula indicada, o ya no tenés acceso.',
    removeUncertain:
      'No pudimos confirmar si la baja lógica se completó en el servidor. Actualizamos la nómina para verificar el estado real antes de volver a intentar.',
    removeUnexpected:
      'No pudimos procesar la baja del estudiante. Intentá nuevamente en unos segundos.',
  },
  activities: {
    validation: {
      titleRequired: 'Ingresá un título para la actividad.',
      instantInvalid: 'Ingresá una fecha y hora válidas.',
      opensAtOnlyForExams:
        'La fecha de apertura solo aplica a exámenes, no a trabajos prácticos.',
      opensAtBeforeDueAt:
        'La apertura del examen debe ser anterior a la fecha límite.',
      questionsRequired:
        'Las actividades de opción múltiple necesitan al menos una pregunta.',
      questionsForbiddenForFile:
        'Las actividades con entrega de archivo no admiten preguntas de opción múltiple.',
      exactlyOneCorrectOption:
        'Cada pregunta debe tener exactamente una opción marcada como correcta.',
      questionPromptRequired: 'Ingresá el enunciado de la pregunta.',
      optionLabelRequired: 'Ingresá el texto de la opción.',
      weightMultiplierPositive:
        'La ponderación debe ser un número mayor que cero.',
      weightMultiplierDecimals: 'La ponderación admite hasta dos decimales.',
      maxScorePositive: 'El puntaje máximo debe ser un número mayor que cero.',
    },
    list: {
      errorDescription: 'No pudimos cargar las actividades del aula.',
      forbidden:
        'Tu rol actual no tiene permisos para ver las actividades de esta aula.',
      notFound: 'No encontramos el aula indicada o ya no tenés acceso.',
    },
    detail: {
      errorDescription: 'No pudimos cargar la actividad.',
      forbidden: 'Tu rol actual no tiene permisos para ver esta actividad.',
      notFound: 'No encontramos la actividad o ya no tenés acceso.',
    },
    write: {
      uncertain:
        'No pudimos confirmar la operación en el servidor. Verificá el estado real de la actividad antes de volver a intentar.',
      validation:
        'El servidor rechazó los datos de la actividad. Revisá los campos marcados.',
      forbidden:
        'Tu rol actual no tiene permisos para gestionar actividades en esta aula.',
      notFound:
        'No encontramos la actividad o el aula indicada, o ya no tenés acceso.',
      updateQuestionsLocked:
        'Las preguntas ya no pueden modificarse porque existe al menos una entrega de la actividad.',
      publishNotPublishable:
        'La actividad no se puede publicar: revisá que la fecha límite sea futura y que las preguntas de opción múltiple estén completas.',
      publishAlreadyPublished: 'La actividad ya estaba publicada.',
      deactivateHasSubmissions:
        'No se puede eliminar la actividad porque tiene entregas asociadas. Su historial académico se conserva.',
      deactivateUnexpected:
        'No pudimos desactivar la actividad. Intentá nuevamente en unos segundos.',
    },
    panel: {
      heading: 'Actividades',
      subtitle:
        'Consultá los trabajos prácticos y exámenes del aula con su estado, fechas y puntajes.',
      loading: 'Cargando las actividades del aula…',
      errorTitle: 'No pudimos cargar las actividades',
      staleTitle: 'Actividades pendientes de sincronización',
      staleDescription:
        'Mostramos la última lista confirmada. Falló la actualización en segundo plano.',
      forbiddenTitle: 'Sin permisos para ver las actividades',
      forbiddenDescription:
        'Tu rol actual no tiene acceso a las actividades de esta aula.',
      notFoundTitle: 'No encontramos el aula indicada',
      notFoundDescription:
        'El aula no existe o ya no tenés acceso para consultar sus actividades.',
      emptyTitleStaff: 'Todavía no hay actividades en el aula',
      emptyDescriptionStaff:
        'Cuando crees un trabajo práctico o un examen, va a aparecer acá con su estado.',
      emptyTitleStudent: 'Todavía no hay actividades publicadas',
      emptyDescriptionStudent:
        'Cuando tu docente publique una actividad, va a aparecer acá.',
      emptyFilteredTitle: 'No encontramos actividades con ese filtro',
      emptyFilteredDescription:
        'Probá cambiando el filtro de estado de publicación.',
      emptyPageTitle: 'No hay actividades en esta página',
      emptyPageDescription:
        'Volvé a una página anterior para ver el resto de las actividades.',
      clearFiltersAction: 'Limpiar filtros',
      stateFilterLabel: 'Estado de publicación',
      stateOptions: {
        ALL: 'Todas',
        DRAFT: 'Borradores',
        PUBLISHED: 'Publicadas',
      },
      types: {
        TP: 'Trabajo práctico',
        EXAM: 'Examen',
      },
      formats: {
        FILE: 'Entrega de archivo',
        MULTIPLE_CHOICE: 'Opción múltiple',
      },
      states: {
        DRAFT: 'Borrador',
        PUBLISHED: 'Publicada',
      },
      dueAtLabel: 'Fecha límite',
      opensAtLabel: 'Apertura',
      allowLateLabel: 'Acepta entregas tardías',
      questionCountLabel: (count: number) =>
        count === 1 ? '1 pregunta' : `${count} preguntas`,
      maxScoreLabel: (score: number) =>
        `Puntaje máximo: ${score.toLocaleString('es-AR')}`,
      weightLabel: (weight: number) =>
        `Ponderación: ×${weight.toLocaleString('es-AR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}`,
      deactivateAction: 'Desactivar',
      deactivateAriaLabel: (title: string) => `Desactivar «${title}»`,
      deactivateConfirmTitle: (title: string) =>
        `Confirmar desactivación de «${title}»`,
      deactivateConfirmDescription:
        'La actividad deja de aparecer para los estudiantes, pero su historial académico (entregas y calificaciones) se conserva en el servidor.',
      deactivateConfirmSubmit: 'Confirmar desactivación',
      deactivateConfirmPending: 'Desactivando…',
      deactivateConfirmCancel: 'Cancelar',
      deactivatedTitle: 'Actividad desactivada',
      deactivatedDescription: (title: string) =>
        `Confirmamos la desactivación de «${title}». El historial académico se conservó.`,
      deactivateErrorTitle: 'No pudimos completar la desactivación',
      createAction: 'Crear actividad',
      editAction: 'Editar',
      editAriaLabel: (title: string) => `Editar «${title}»`,
      publishAction: 'Publicar',
      publishAriaLabel: (title: string) => `Publicar «${title}»`,
    },
    editor: {
      createTitle: 'Crear actividad',
      createDescription:
        'Definí el tipo, el formato y los datos de la actividad. Se guarda como borrador hasta que la publiques.',
      editTitle: 'Editar actividad',
      editDescription:
        'Actualizá los datos de la actividad. Los cambios aplican en cuanto el servidor los confirme.',
      loadingDetail: 'Cargando la actividad…',
      detailErrorTitle: 'No pudimos cargar la actividad',
      detailNotTeacherView:
        'Tu rol actual ya no permite editar actividades de esta aula.',
      fields: {
        type: {
          legend: 'Tipo de actividad',
          description: 'Elegí si es un trabajo práctico o un examen.',
          immutableNotice:
            'El tipo se define al crear la actividad y no se puede cambiar después.',
          options: {
            TP: {
              label: 'Trabajo práctico',
              description:
                'Una entrega con fecha límite, sin ventana de apertura.',
            },
            EXAM: {
              label: 'Examen',
              description:
                'Puede tener una ventana de apertura además de la fecha límite.',
            },
          },
        },
        format: {
          legend: 'Formato de entrega',
          description:
            'Elegí cómo entregan los estudiantes. El formato no se puede cambiar después de crear la actividad.',
          immutableNotice:
            'El formato es definitivo desde la creación de la actividad.',
          options: {
            FILE: {
              label: 'Entrega de archivo',
              description: 'Los estudiantes suben un archivo como entrega.',
            },
            MULTIPLE_CHOICE: {
              label: 'Opción múltiple',
              description: 'Los estudiantes responden preguntas con opciones.',
            },
          },
        },
        title: {
          label: 'Título',
          description: 'Visible para el aula una vez publicada la actividad.',
          placeholder: 'Ej. TP Fracciones',
        },
        description: {
          label: 'Descripción (opcional)',
          description: 'Consigna o indicaciones para los estudiantes.',
          placeholder: 'Ej. Resolver los ejercicios del capítulo 3.',
        },
        dueAt: {
          label: 'Fecha límite',
          timezoneNote: (timeZone: string) =>
            `Ingresala en la zona horaria del colegio (${timeZone}).`,
        },
        opensAt: {
          label: 'Apertura del examen (opcional)',
          timezoneNote: (timeZone: string) =>
            `Momento en que el examen se habilita, en la zona horaria del colegio (${timeZone}).`,
          tpHint:
            'La apertura solo aplica a exámenes: los trabajos prácticos quedan visibles para los estudiantes desde que se publican.',
          tpStoredValue: (formattedInstant: string) =>
            `Tenés una apertura cargada: ${formattedInstant}.`,
          removeAction: 'Quitar apertura',
          immutableHint:
            'La apertura no se puede quitar una vez definida; podés cambiarla de fecha y hora.',
        },
        allowLate: {
          label: 'Aceptar entregas tardías',
          description:
            'Permite que los estudiantes entreguen después de la fecha límite.',
        },
        maxScore: {
          label: 'Puntaje máximo',
          description: 'Puntaje con el que se califica la actividad.',
          placeholder: 'Ej. 10',
        },
        weightMultiplier: {
          label: 'Ponderación',
          description:
            'Peso de la actividad en el promedio del período, con hasta dos decimales.',
          placeholder: 'Ej. 1.5',
        },
      },
      validation: {
        dueAtRequired: 'Ingresá la fecha límite.',
        maxScoreRequired: 'Ingresá el puntaje máximo.',
        weightMultiplierRequired: 'Ingresá la ponderación.',
        opensAtCannotBeRemoved:
          'La apertura no se puede quitar una vez definida. Cambiala de fecha y hora, o dejala como está.',
      },
      questions: {
        heading: 'Preguntas de opción múltiple',
        description:
          'Armá las preguntas y sus opciones, y marcá la opción correcta de cada una. Las respuestas correctas solo se ven en vistas docentes.',
        addQuestion: 'Agregar pregunta',
        questionLegend: (position: number) => `Pregunta ${position}`,
        removeQuestion: (position: number) => `Quitar la pregunta ${position}`,
        moveQuestionUp: (position: number) => `Subir la pregunta ${position}`,
        moveQuestionDown: (position: number) => `Bajar la pregunta ${position}`,
        prompt: {
          label: 'Enunciado',
          placeholder: 'Ej. ¿Cuánto es 2 + 2?',
        },
        optionsLegend: (position: number) =>
          `Opciones de la pregunta ${position}`,
        optionLabel: (position: number) => `Texto de la opción ${position}`,
        optionPlaceholder: 'Ej. 4',
        correctGroup: (position: number) =>
          `Respuesta correcta de la pregunta ${position}`,
        markCorrect: (position: number) =>
          `Marcar la opción ${position} como correcta`,
        correctHint:
          'Marcá con el selector la opción correcta de esta pregunta.',
        addOption: 'Agregar opción',
        removeOption: (position: number) => `Quitar la opción ${position}`,
        moveOptionUp: (position: number) => `Subir la opción ${position}`,
        moveOptionDown: (position: number) => `Bajar la opción ${position}`,
        correctOptionLabel: 'Correcta',
        fileFormatHint:
          'Las actividades con entrega de archivo no admiten preguntas de opción múltiple.',
        fileFormatStored: (count: number) =>
          count === 1
            ? 'Quedó 1 pregunta cargada de la etapa de opción múltiple.'
            : `Quedaron ${count} preguntas cargadas de la etapa de opción múltiple.`,
        removeQuestionsAction: 'Quitar todas las preguntas',
      },
      errors: {
        rootTitle: 'No pudimos guardar la actividad',
      },
      actions: {
        cancel: 'Cancelar',
        createSubmit: 'Crear actividad',
        createPending: 'Creando actividad…',
        editSubmit: 'Guardar cambios',
        editPending: 'Guardando cambios…',
        unsavedChanges:
          'Tenés cambios sin guardar en la actividad. ¿Querés descartarlos?',
      },
      createdTitle: 'Borrador guardado',
      createdDescription: (title: string) =>
        `Confirmamos el borrador «${title}» en el servidor.`,
      updatedTitle: 'Cambios guardados',
      updatedDescription: (title: string) =>
        `Confirmamos los cambios de «${title}» en el servidor.`,
      publishedTitle: 'Actividad publicada',
      publishedDescription: (title: string) =>
        `Confirmamos la publicación de «${title}». Los estudiantes ya pueden verla.`,
      publish: {
        title: (title: string) => `Publicar «${title}»`,
        description:
          'Publicar es definitivo: la actividad pasa de borrador a publicada y los estudiantes la ven de inmediato. Confirmá que la fecha límite sea futura antes de publicar.',
        dueAtLabel: 'Fecha límite a publicar',
        submit: 'Publicar actividad',
        pending: 'Publicando…',
        cancel: 'Seguir como borrador',
        errorTitle: 'No pudimos publicar la actividad',
      },
    },
  },
} as const;
