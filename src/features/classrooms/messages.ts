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
  backToList: 'Volver a mis aulas',
  errorTitle: 'No pudimos cargar el aula',
  errorDescription: 'Revisá tu conexión e intentá de nuevo.',
  roles: {
    TEACHER: 'Docente',
    STUDENT: 'Estudiante',
    PARENT: 'Familiar',
    OWNER: 'Titular de la escuela',
    ADMIN: 'Administración escolar',
  },
  viewMode: {
    switchTo2d: 'Cambiar a Modo 2D Clásico',
    switchTo3d: 'Cambiar a Vista 3D',
    shortcutHint: 'Atajo: Alt+M',
    stage3dHeading: 'Vista 3D del aula',
    stage3dDescription:
      'Entorno tridimensional del aula. Podés pasar al Modo 2D Clásico en cualquier momento sin cerrar sesión ni perder tu contexto.',
    canvasLabel: 'Escena 3D del aula',
    mode2dHeading: 'Modo 2D Clásico',
    mode2dDescription:
      'Accedé por teclado o pantalla táctil a todas las herramientas disponibles de esta aula con las mismas validaciones del servidor.',
    mode2dNavLabel: 'Paneles del aula en Modo 2D Clásico',
    openPanelAction: 'Abrir panel',
    mode2dEmptyTitle: 'No hay paneles disponibles',
    mode2dEmptyDescription:
      'El servidor todavía no habilitó paneles para tu cuenta en esta aula. Si cambia tu disponibilidad, los vas a ver acá al instante.',
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
  members: {
    tabsLabel: 'Secciones de integrantes',
    rosterTab: 'Nómina',
    invitationsTab: 'Invitaciones y código',
  },
  chat: {
    heading: 'Chat del aula',
    subtitle: (name: string) =>
      `Conversación de «${name}» con el historial confirmado por el servidor.`,
    newestFirstNote: 'Los mensajes más recientes aparecen primero.',
    loading: 'Cargando el chat del aula…',
    listRegionLabel: 'Historial de mensajes del chat',
    resultsSummary: (shown: number, total: number) =>
      `Mostrando ${shown} de ${total} mensajes.`,
    createdAtPrefix: 'Enviado',
    authorFallback: 'Integrante del aula',
    authorSelf: 'Vos',
    roleTeacherBadge: 'Docente',
    hiddenBadge: 'Ocultado',
    hiddenAudit: (moderator: string, formattedDate: string) =>
      `Ocultado por ${moderator} el ${formattedDate}`,
    hiddenModeratorFallback: 'personal del aula',
    states: {
      emptyTitle: 'Todavía no hay mensajes en el chat',
      emptyDescription:
        'Cuando alguien del aula escriba, vas a ver el mensaje acá.',
      loadErrorTitle: 'No pudimos cargar el chat',
      loadErrorDescription: 'Revisá tu conexión e intentá actualizar el chat.',
      forbiddenTitle: 'Sin acceso al chat del aula',
      forbiddenDescription: 'No tenés permiso para leer el chat de este aula.',
      notFoundTitle: 'No encontramos el chat del aula',
      notFoundDescription:
        'El aula ya no está disponible o perdiste el acceso.',
      staleTitle: 'Chat pendiente de sincronización',
      staleDescription:
        'Mostrando los últimos mensajes confirmados. Falló la actualización en segundo plano.',
      outOfRangeTitle: 'No hay mensajes en esta página',
      outOfRangeDescription:
        'Volvé a la primera página para ver los mensajes del chat.',
      backToFirstPage: 'Volver a la primera página',
      parentDeniedTitle: 'El chat del aula no está disponible para tu rol',
      parentDeniedDescription:
        'El chat es para estudiantes y personal del aula. Las familias no participan de esta conversación.',
    },
    composer: {
      heading: 'Escribir en el chat',
      regionLabel: 'Redactar un mensaje del chat',
      bodyLabel: 'Mensaje del chat',
      bodyPlaceholder:
        'Escribí tu mensaje. Usá @ para mencionar a integrantes del aula.',
      charCounter: (used: number, max: number) => `${used}/${max} caracteres`,
      submit: 'Enviar',
      submitting: 'Enviando…',
      pendingNotice: 'Enviando el mensaje…',
      sentToast: 'Mensaje enviado.',
      mentionListboxLabel: 'Integrantes sugeridos para mencionar',
      mentionAvailableNotice:
        'Hay sugerencias de mención disponibles abajo. Usá las flechas para recorrerlas y Enter para elegir.',
      mutedTitle: 'El chat está silenciado',
      mutedDescription:
        'El personal del aula silenció el chat por ahora. No podés enviar mensajes, pero el historial sigue visible.',
    },
  },
  invitations: {
    forbiddenTitle: 'Sin permisos para gestionar invitaciones',
    forbiddenDescription:
      'Solo docentes o personal directivo autorizado de esta aula pueden emitir o revocar invitaciones y códigos de acceso.',
    notFoundTitle: 'No encontramos las invitaciones del aula',
    notFoundDescription:
      'El aula no existe o ya no tenés acceso para gestionar sus invitaciones.',
    errorTitle: 'No pudimos cargar las invitaciones',
    errorDescription:
      'Revisá tu conexión e intentá actualizar la vista de invitaciones.',
    joinCode: {
      heading: 'Código de acceso al aula',
      description:
        'Compartí un código para que estudiantes se unan al aula. Otorga únicamente el rol de estudiante.',
      oneTimeNotice:
        'El código se muestra una sola vez al crearlo o regenerarlo. No se guarda localmente ni vuelve a consultarse al regresar a este panel.',
      regenerateWarning:
        'Al regenerar, el código anterior queda invalidado de inmediato.',
      maxUsesLabel: 'Límite de usos (opcional)',
      maxUsesDescription:
        'Dejá este campo vacío para permitir usos ilimitados, o indicá un entero entre 1 y 1000.',
      maxUsesPlaceholder: 'Ilimitado',
      expiresLabel: 'Vigencia del código',
      expiresDescription:
        'Elegí cuánto tiempo permanecerá vigente antes de vencer.',
      expiresOptions: {
        default: 'Por defecto del servidor',
        '1h': '1 hora',
        '24h': '24 horas',
        '7d': '7 días',
        '30d': '30 días',
      },
      generateSubmit: 'Generar código',
      regenerateSubmit: 'Regenerar código',
      generatingPending: 'Generando código…',
      confirmRegenerateTitle: 'Confirmar regeneración de código',
      confirmRegenerateDescription:
        'Al regenerar, el código anterior queda invalidado de inmediato. Quienes intenten unirse con el código previo ya no podrán hacerlo.',
      confirmRegenerateSubmit: 'Confirmar regeneración',
      confirmRegenerateCancel: 'Cancelar',
      activeCardTitle: 'Código generado (visible solo esta vez)',
      codeLabel: 'Código de acceso',
      copyAction: 'Copiar código',
      copiedAnnouncement: 'Código de acceso copiado al portapapeles.',
      copyFallbackInstruction:
        'No pudimos copiar automáticamente. Seleccioná y copiá el código manualmente:',
      usesLabel: (useCount: number, maxUses: number | null) =>
        maxUses === null
          ? `Usos: ${useCount} (ilimitado)`
          : `Usos: ${useCount} de ${maxUses}`,
      expiresAtLabel: (formattedDate: string) => `Vence: ${formattedDate}`,
      revokeCurrentAction: 'Revocar código',
      revokeActiveAction: 'Revocar código activo',
      revokeActiveHelp:
        'Si ya generaste un código en una sesión anterior y necesitás anularlo, podés revocar el código activo actual desde acá.',
      revokingPending: 'Revocando código…',
      generatedTitle: 'Código generado',
      generatedDescription:
        'Copiá el código ahora: no volverá a mostrarse al salir de esta vista.',
      revokedTitle: 'Código revocado',
      revokedDescription:
        'El código activo del aula quedó anulado y ya no admite nuevas incorporaciones.',
      validation: {
        maxUsesInvalid:
          'Ingresá un número entero entre 1 y 1000, o dejalo vacío.',
        expiresInvalid: 'Elegí una vigencia válida para el código.',
      },
      errors: {
        generateTitle: 'No pudimos generar el código',
        revokeTitle: 'No pudimos revocar el código',
        validationFailed: 'Revisá los parámetros del código antes de enviar.',
        forbidden:
          'Tu rol actual no tiene permisos para gestionar códigos de acceso en esta aula.',
        notFoundGenerate:
          'No encontramos el aula indicada o ya no tenés acceso.',
        notFoundRevoke:
          'No hay ningún código activo vigente para revocar o ya no tenés acceso al aula.',
        uncertain:
          'No pudimos confirmar si el cambio sobre el código se aplicó en el servidor. Verificá el estado antes de volver a intentar.',
        unexpected:
          'No pudimos completar la operación sobre el código. Intentá nuevamente en unos segundos.',
      },
    },
    email: {
      heading: 'Invitaciones por correo electrónico',
      description:
        'Enviá una invitación de un solo uso para sumar a un estudiante por correo electrónico.',
      roleLabel: 'Rol asignado',
      roleValue: 'Estudiante',
      nonDisclosureNote:
        'Esta invitación solo permite sumar cuentas con rol Estudiante. Emitirla nunca revela si la dirección ya tiene una cuenta registrada.',
      emailLabel: 'Correo electrónico del estudiante',
      emailPlaceholder: 'estudiante@ejemplo.edu.ar',
      emailDescription:
        'El destinatario recibirá un enlace de un solo uso y podrá aceptarlo tras iniciar sesión.',
      submitAction: 'Enviar invitación',
      submitPending: 'Enviando invitación…',
      createdTitle: 'Invitación creada',
      createdDescription:
        'La invitación quedó programada. Si necesitás compartirla en forma directa, copiá el enlace o el token ahora: se muestran una sola vez.',
      inviteLinkLabel: 'Enlace de invitación',
      tokenLabel: 'Token de invitación',
      copyLinkAction: 'Copiar enlace de invitación',
      copyTokenAction: 'Copiar token',
      copiedLinkAnnouncement: 'Enlace de invitación copiado al portapapeles.',
      copiedTokenAnnouncement: 'Token de invitación copiado al portapapeles.',
      copyLinkFallbackInstruction:
        'No pudimos copiar automáticamente. Seleccioná y copiá el enlace manualmente:',
      copyTokenFallbackInstruction:
        'No pudimos copiar automáticamente. Seleccioná y copiá el token manualmente:',
      validation: {
        emailRequired: 'Ingresá una dirección de correo electrónico.',
        emailTooLong:
          'El correo electrónico no puede superar los 320 caracteres.',
        emailInvalid: 'Ingresá un correo electrónico válido.',
        emailControlChars:
          'El correo electrónico no puede incluir saltos de línea ni caracteres de control.',
      },
      errors: {
        createTitle: 'No pudimos enviar la invitación',
        validationFailed:
          'Revisá el correo electrónico ingresado antes de enviar.',
        forbidden:
          'Tu rol actual no tiene permisos para enviar invitaciones en esta aula.',
        notFound: 'No encontramos el aula indicada o ya no tenés acceso.',
        uncertain:
          'No pudimos confirmar si la invitación se emitió en el servidor. Actualizamos el listado para verificar el estado real antes de volver a intentar.',
        unexpected:
          'No pudimos procesar la invitación. Intentá nuevamente en unos segundos.',
      },
    },
    list: {
      heading: 'Historial de invitaciones',
      loading: 'Cargando invitaciones del aula…',
      errorTitle: 'No pudimos cargar las invitaciones',
      errorDescription:
        'Revisá tu conexión e intentá actualizar el listado de invitaciones.',
      staleTitle: 'Invitaciones pendientes de sincronización',
      staleDescription:
        'Mostrando las últimas invitaciones confirmadas. Falló la actualización en segundo plano.',
      filterLabel: 'Filtrar por estado',
      filters: {
        PENDING: 'Pendientes',
        USED: 'Usadas',
        REVOKED: 'Revocadas',
        EXPIRED: 'Vencidas',
        ALL: 'Todas',
      },
      states: {
        PENDING: 'Pendiente',
        USED: 'Usada',
        REVOKED: 'Revocada',
        EXPIRED: 'Vencida',
      },
      kinds: {
        EMAIL: 'Por correo',
        JOIN_CODE: 'Código de aula',
      },
      emptyTitle: 'No hay invitaciones en este estado',
      emptyDescription:
        'Cuando emitas invitaciones por correo o códigos de aula, vas a poder consultar su estado acá.',
      emptyPageTitle: 'No hay invitaciones en esta página',
      emptyPageDescription:
        'Volvé a una página anterior para ver el resto de las invitaciones.',
      targetJoinCodeFallback: 'Código de acceso del aula',
      createdAtLabel: (formattedDate: string) => `Creada: ${formattedDate}`,
      expiresAtLabel: (formattedDate: string) => `Vence: ${formattedDate}`,
      usesLabel: (useCount: number, maxUses: number | null) =>
        maxUses === null
          ? `Usos: ${useCount} (ilimitado)`
          : `Usos: ${useCount} de ${maxUses}`,
      revokeAction: 'Revocar',
      revokeAriaLabel: (label: string) => `Revocar invitación ${label}`,
      confirmRevokeTitle: (label: string) =>
        `Confirmar revocación de «${label}»`,
      confirmRevokeDescription:
        'Esta invitación dejará de ser válida de inmediato y no podrá volver a usarse.',
      confirmRevokeSubmit: 'Confirmar revocación',
      confirmRevokePending: 'Revocando…',
      confirmRevokeCancel: 'Cancelar',
      revokedTitle: 'Invitación revocada',
      revokedDescription: (label: string) =>
        `Confirmamos la revocación de «${label}».`,
      revokeErrorTitle: 'No pudimos revocar la invitación',
      revokeBadRequest:
        'La invitación ya no está pendiente (fue usada, revocada o venció). Actualizamos el listado para mostrar su estado actual.',
      revokeForbidden:
        'Tu rol actual no tiene permisos para revocar invitaciones en esta aula.',
      revokeNotFound:
        'No encontramos la invitación o el aula indicada, o ya no tenés acceso.',
      revokeUncertain:
        'No pudimos confirmar si la revocación se aplicó en el servidor. Actualizamos el listado para verificar el estado real antes de volver a intentar.',
      revokeUnexpected:
        'No pudimos revocar la invitación. Intentá nuevamente en unos segundos.',
    },
  },
} as const;
