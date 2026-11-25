export const authMessages = {
  page: {
    subtitle:
      'Creá tu cuenta y elegí el recorrido con el que vas a empezar en IntegrarTec.',
  },
  paths: {
    legend: '¿Cómo vas a usar IntegrarTec?',
    description: 'Elegí el punto de partida que mejor describe tu ingreso.',
    options: {
      INDEPENDENT_TEACHER: {
        title: 'Profesor independiente',
        badge: 'Personal',
        description:
          'Creás tu propio espacio de trabajo para gestionar tus aulas por cuenta propia.',
      },
      SCHOOL: {
        title: 'Escuela o institución',
        badge: 'Institucional',
        description:
          'Creás la escuela en la plataforma para organizar sus docentes y aulas.',
      },
      INVITEE: {
        title: 'Estudiante o invitado',
        badge: 'Con código',
        description:
          'Creás tu cuenta para unirte a un aula o escuela con una invitación o código.',
      },
      INVITATION: {
        title: 'Estudiante o invitado',
        badge: 'Con código',
        description:
          'Creás tu cuenta para unirte a un aula o escuela con una invitación o código.',
      },
    },
  },
  fields: {
    displayName: {
      label: 'Nombre y apellido',
      placeholder: 'Ej. Sofía Martínez',
      description: 'Así te van a ver tus estudiantes y colegas.',
    },
    email: {
      label: 'Correo electrónico',
      placeholder: 'nombre@ejemplo.com',
      description: 'Vas a usar este correo cada vez que inicies sesión.',
    },
    password: {
      label: 'Contraseña',
      placeholder: 'Mínimo 8 caracteres',
      description: 'Entre 8 y 72 caracteres (máximo 72 bytes UTF-8).',
    },
    schoolName: {
      label: 'Nombre de la escuela',
      placeholder: 'Ej. Escuela Técnica N.º 4',
      description:
        'Nombre oficial o visible de la institución que vas a crear.',
    },
  },
  validation: {
    pathRequired: 'Elegí cómo vas a usar IntegrarTec.',
    displayNameRequired: 'Ingresá tu nombre y apellido.',
    displayNameTooLong: 'El nombre no puede superar los 100 caracteres.',
    emailRequired: 'Ingresá tu correo electrónico.',
    emailInvalid: 'Ingresá un correo electrónico válido.',
    emailTooLong: 'El correo no puede superar los 255 caracteres.',
    passwordMin: 'La contraseña debe tener al menos 8 caracteres.',
    passwordMax: 'La contraseña no puede superar los 72 caracteres.',
    passwordMaxBytes: 'La contraseña no puede superar los 72 bytes en UTF-8.',
    schoolNameRequired: 'Ingresá el nombre de la escuela.',
    schoolNameTooLong:
      'El nombre de la escuela no puede superar los 150 caracteres.',
  },
  invitationNotice: {
    heading: 'Cuenta de estudiante o invitado',
    body: 'Completá tus datos para registrarte y continuar directamente a tu invitación o código de aula.',
    cta: 'Ir a aceptar invitación',
  },
  actions: {
    submit: 'Crear cuenta',
    submitting: 'Creando cuenta...',
    alreadyHaveAccount: '¿Ya tenés una cuenta?',
    loginLink: 'Iniciá sesión',
    unsavedChanges:
      'Tenés datos sin enviar en el registro. Si salís ahora, se van a perder.',
  },
  errors: {
    rootTitle: 'No pudimos completar el registro',
    emailConflict:
      'Ya existe una cuenta con ese correo electrónico, por lo que no se creó una cuenta nueva. Iniciá sesión con tu cuenta actual o usá otro correo.',
    slugConflict:
      'No pudimos reservar el identificador de la escuela por un registro simultáneo. Intentá de nuevo en un momento.',
    genericConflict:
      'Los datos ingresados entran en conflicto con un registro existente. Revisalos e intentá otra vez.',
    validationFailed:
      'Revisá los campos marcados antes de volver a enviar el formulario.',
    invalidResponse:
      'La respuesta del servidor no coincide con el formato esperado. No pudimos confirmar si se completó el registro; probá iniciar sesión con tu correo antes de volver a enviar el formulario.',
    unexpected:
      'No pudimos confirmar si se completó el registro por un error inesperado. Probá iniciar sesión con tu correo antes de volver a enviar el formulario.',
    networkUncertain:
      'No pudimos confirmar si se completó el registro por una falla de conexión. Probá iniciar sesión con tu correo antes de volver a enviar el formulario.',
  },
  confirmed: {
    title: 'Cuenta creada',
    badge: 'Confirmado por el servidor',
    subtitle:
      'Registramos tu cuenta y dejamos lista tu estructura inicial. Iniciá sesión con tu correo y contraseña para entrar.',
    accountLabel: 'Cuenta registrada',
    structureLabel: 'Estructura inicial',
    independentTitle: 'Espacio de profesor independiente',
    independentDetail:
      'Tu espacio personal quedó habilitado para empezar a organizar aulas al iniciar sesión.',
    schoolTitlePrefix: 'Escuela creada:',
    schoolTimeZonePrefix: 'Zona horaria asignada:',
    loginCta: 'Ir a iniciar sesión',
  },
  login: {
    subtitle: 'Ingresá con tu correo y contraseña para entrar a tus aulas.',
    returnContextNotice:
      'Iniciá sesión para continuar hacia la página que solicitaste.',
    fields: {
      email: {
        label: 'Correo electrónico',
        placeholder: 'nombre@ejemplo.com',
      },
      password: {
        label: 'Contraseña',
        placeholder: 'Tu contraseña',
      },
    },
    validation: {
      emailRequired: 'Ingresá tu correo electrónico.',
      emailInvalid: 'Ingresá un correo electrónico válido.',
      emailTooLong: 'El correo no puede superar los 255 caracteres.',
      passwordRequired: 'Ingresá tu contraseña.',
      passwordMaxBytes: 'La contraseña no puede superar los 72 bytes en UTF-8.',
    },
    actions: {
      submit: 'Iniciar sesión',
      submitting: 'Iniciando sesión...',
      forgotPasswordLink: '¿Olvidaste tu contraseña?',
      noAccountPrompt: '¿Todavía no tenés una cuenta?',
      registerLink: 'Crear cuenta',
    },
    errors: {
      rootTitle: 'No pudimos iniciar sesión',
      invalidCredentials:
        'El correo o la contraseña no son correctos. Revisá los datos e intentá de nuevo.',
      rateLimited:
        'Realizaste demasiados intentos seguidos. Esperá unos minutos antes de volver a intentar.',
      network:
        'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
      unexpected:
        'Ocurrió un problema inesperado al iniciar sesión. Intentá de nuevo en unos instantes.',
    },
  },
  passwordReset: {
    request: {
      subtitle:
        'Ingresá tu correo y te enviamos un enlace temporal si corresponde a una cuenta activa.',
      fields: {
        email: {
          label: 'Correo electrónico',
          placeholder: 'nombre@ejemplo.com',
          description:
            'El enlace de restablecimiento es de un solo uso y vence automáticamente.',
        },
      },
      validation: {
        emailRequired: 'Ingresá tu correo electrónico.',
        emailInvalid: 'Ingresá un correo electrónico válido.',
        emailTooLong: 'El correo no puede superar los 255 caracteres.',
      },
      actions: {
        submit: 'Enviar enlace de recuperación',
        submitting: 'Enviando enlace...',
        backToLogin: 'Volver a iniciar sesión',
        sendAnother: 'Enviar a otro correo',
      },
      confirmation: {
        badge: 'Solicitud procesada',
        title: 'Revisá tu correo electrónico',
        body: 'Si el correo ingresado pertenece a una cuenta registrada, te enviamos un enlace temporal de un solo uso para definir una contraseña nueva.',
      },
      errors: {
        rootTitle: 'No pudimos procesar tu solicitud',
        validationFailed:
          'Revisá el correo ingresado antes de volver a enviarlo.',
        rateLimited:
          'Realizaste demasiadas solicitudes seguidas. Esperá unos minutos e intentá de nuevo.',
        network:
          'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
        unexpected:
          'Ocurrió un problema inesperado al procesar la solicitud. Intentá de nuevo en unos instantes.',
      },
    },
    confirm: {
      subtitle:
        'Elegí una contraseña nueva para recuperar el acceso a tu cuenta.',
      fields: {
        newPassword: {
          label: 'Contraseña nueva',
          placeholder: 'Mínimo 8 caracteres',
          description: 'Entre 8 y 72 caracteres (máximo 72 bytes UTF-8).',
        },
      },
      validation: {
        passwordMin: 'La contraseña debe tener al menos 8 caracteres.',
        passwordMax: 'La contraseña no puede superar los 72 caracteres.',
        passwordMaxBytes:
          'La contraseña no puede superar los 72 bytes en UTF-8.',
      },
      actions: {
        submit: 'Guardar nueva contraseña',
        submitting: 'Guardando contraseña...',
        requestNewLink: 'Solicitar un nuevo enlace',
        goToLogin: 'Ir a iniciar sesión',
      },
      invalidToken: {
        title: 'El enlace ya no es válido o venció',
        body: 'Este enlace de restablecimiento no es válido, ya fue utilizado o expiró. Solicitá uno nuevo para continuar.',
      },
      confirmed: {
        badge: 'Contraseña actualizada',
        title: 'Actualizamos tu contraseña',
        body: 'Cerramos todas tus sesiones anteriores por seguridad. Iniciá sesión nuevamente con tu contraseña nueva.',
      },
      errors: {
        rootTitle: 'No pudimos actualizar tu contraseña',
        invalidOrExpiredToken:
          'El enlace de restablecimiento no es válido, ya fue utilizado o expiró. Solicitá un enlace nuevo.',
        validationFailed:
          'Revisá la contraseña ingresada antes de volver a enviar el formulario.',
        rateLimited:
          'Realizaste demasiados intentos seguidos. Esperá unos minutos antes de volver a intentar.',
        network:
          'No pudimos confirmar si se actualizó tu contraseña por una falla de conexión. Probá iniciar sesión con tu nueva contraseña antes de pedir otro enlace.',
        unexpected:
          'No pudimos confirmar si se actualizó tu contraseña por un error inesperado. Probá iniciar sesión o solicitá un enlace nuevo.',
      },
    },
  },
} as const;
