export const joinMessages = {
  pageTitle: 'Aceptar invitación',
  eyebrow: 'Ingreso al aula',
  gate: {
    subtitle:
      'Necesitás una cuenta activa para aceptar la invitación o ingresar con un código de aula.',
    badge: 'Sesión requerida',
    title: 'Iniciá sesión para continuar',
    body: 'Para proteger tus aulas y asignarte tu lugar, primero tenés que ingresar con tu cuenta o crear una nueva. Al terminar, volvés automáticamente a esta pantalla.',
    loginCta: 'Iniciar sesión para continuar',
    registerCta: 'Crear cuenta',
    backHomeCta: 'Volver al inicio',
  },
  invitation: {
    subtitle:
      'Confirmá el ingreso al aula usando el enlace de invitación que recibiste por correo.',
    badge: 'Invitación por correo',
    readyTitle: 'Invitación lista para confirmar',
    readyDescription:
      'Al confirmar, tu cuenta actual se inscribirá en el aula asociada a esta invitación.',
    signedInAccountPrefix: 'Cuenta activa:',
    emailMismatchHint:
      'El correo donde recibiste la invitación no necesita coincidir con el de tu cuenta actual.',
    acceptAction: 'Aceptar invitación y entrar al aula',
    acceptingAction: 'Aceptando invitación...',
    switchToCodeAction: 'Ingresar con un código de aula',
    invalidTokenTitle: 'Enlace de invitación inválido',
    invalidTokenDescription:
      'El enlace de invitación no es válido o está incompleto. Pedile un enlace nuevo a tu docente o ingresá con un código de aula.',
  },
  code: {
    subtitle:
      'Ingresá el código que te compartió tu docente para sumarte a un aula como Estudiante.',
    badge: 'Código de aula',
    fieldLabel: 'Código de aula',
    fieldDescription:
      'Ingresá el código alfanumérico que te compartió tu docente (por ejemplo, K7P9X2M). El ingreso con código te inscribe siempre con rol de Estudiante.',
    fieldPlaceholder: 'Ej. K7P9X2M',
    submitAction: 'Unirme al aula',
    submittingAction: 'Uniéndote al aula...',
    switchToInvitationAction: 'Volver a la invitación por correo',
    privacyHint:
      'Por seguridad, el código no se guarda en el navegador ni otorga acceso sin sesión activa.',
    unsavedChangesConfirm:
      'Ingresaste un código sin enviar. ¿Seguro que querés salir sin completar el ingreso?',
  },
  validation: {
    tokenRequired: 'Falta el token de la invitación.',
    tokenTooLong: 'El token de la invitación supera la longitud permitida.',
    tokenInvalid: 'El enlace de invitación contiene caracteres inválidos.',
    codeRequired: 'Ingresá el código del aula.',
    codeTooShort: 'El código del aula debe tener al menos 4 caracteres.',
    codeTooLong: 'El código del aula no puede superar los 32 caracteres.',
    codeFormat: 'El código solo puede contener letras y números sin espacios.',
  },
  errors: {
    rootTitle: 'No pudimos completar el ingreso al aula',
    invitationInvalidOrExpired:
      'La invitación no es válida, venció, fue revocada o ya fue utilizada. Pedile una nueva invitación a tu docente.',
    invitationConflict:
      'No se pudo aceptar la invitación con tu cuenta actual (puede que ya haya sido utilizada o que ya tengas un rol docente en ese espacio).',
    codeInvalidOrExpired:
      'El código ingresado no es válido, venció o fue revocado. Verificá que esté bien escrito o pedile uno nuevo a tu docente.',
    codeExhaustedOrConflict:
      'Este código de aula ya alcanzó su límite de usos o no puede utilizarse con tu rol actual.',
    rateLimited:
      'Realizaste demasiados intentos seguidos. Esperá unos minutos antes de volver a intentar.',
    unauthenticated:
      'Tu sesión expiró. Iniciá sesión nuevamente para completar el ingreso al aula.',
    network:
      'Se perdió la conexión y no pudimos confirmar si te uniste al aula. Revisá tus aulas antes de volver a intentarlo.',
    unexpected:
      'Ocurrió un problema inesperado al procesar tu solicitud. Intentá de nuevo en unos instantes.',
  },
  outcome: {
    joinedTitle: 'Inscripción confirmada',
    joinedBody: 'Te inscribiste en el aula como Estudiante.',
    alreadyMemberTitle: 'Ya formabas parte de esta aula',
    alreadyMemberBody:
      'Ya formabas parte de esta aula como Estudiante. Conservamos tu inscripción existente sin duplicarla.',
    teacherJoinedBody: 'Tu acceso docente al aula quedó confirmado.',
    teacherAlreadyMemberBody:
      'Ya formabas parte de esta aula. Conservamos tu inscripción existente sin duplicarla.',
    parentBadge: 'Vínculo familiar',
    parentJoinedTitle: 'Vínculo familiar confirmado',
    parentJoinedBody:
      'Tu cuenta quedó vinculada como padre o tutor en esta aula. Ya podés hacer el seguimiento del estudiante desde tu espacio.',
    parentAlreadyMemberTitle: 'El vínculo familiar ya estaba activo',
    parentAlreadyMemberBody:
      'Tu cuenta ya estaba vinculada como padre o tutor para este estudiante. Conservamos tu vínculo existente sin duplicarlo.',
    parentContinueCta: 'Ir al inicio',
    formatAssignedDesk: (deskIndex: number) =>
      `Pupitre asignado: #${deskIndex}.`,
    noDeskAssigned: 'Tu inscripción quedó activa en el aula.',
  },
} as const;
