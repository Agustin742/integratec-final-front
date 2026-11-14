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
      INVITATION: {
        title: 'Aceptar una invitación',
        badge: 'Con código',
        description:
          'Ya recibiste una invitación a una escuela o aula y querés sumarte desde ahí.',
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
    heading: 'Usá tu enlace o código de invitación',
    body: 'Para sumarte con una invitación no necesitás crear un espacio ni una escuela desde acá. Seguí al flujo dedicado para validar tu código o enlace.',
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
} as const;
