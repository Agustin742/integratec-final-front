export const messages = {
  title: 'IntegrarTec',
  pages: {
    login: {
      title: 'Iniciar sesión',
      description:
        'Acá vas a poder ingresar con tu cuenta. Pantalla en construcción.',
    },
    register: {
      title: 'Crear cuenta',
      description: 'Acá vas a poder registrarte. Pantalla en construcción.',
    },
    passwordReset: {
      title: 'Restablecer contraseña',
      description:
        'Acá vas a poder recuperar el acceso a tu cuenta. Pantalla en construcción.',
    },
    invitationAccept: {
      title: 'Aceptar invitación',
      description:
        'Acá vas a poder aceptar una invitación a un aula. Pantalla en construcción.',
    },
    home: {
      title: 'Inicio',
      description:
        'Acá vas a ver tus aulas y tu actividad. Pantalla en construcción.',
    },
    notFound: {
      title: 'Página no encontrada',
      description: 'La dirección que buscás no existe o fue movida.',
    },
  },
  session: {
    verifying: 'Verificando tu sesión...',
    unableTitle: 'No pudimos verificar tu sesión',
    unableDescription:
      'No pudimos comprobar si tu sesión sigue activa. Revisá tu conexión e intentá de nuevo.',
  },
  showcase: {
    title: 'Componentes de interfaz',
    navigation: 'Ejemplos de interfaz',
    localOnly: 'Ejemplos locales de componentes. No envían ni guardan datos.',
    states: 'Estados de ejemplo',
    loading: 'Ejemplo: cargando',
    empty: 'Ejemplo vacío: no hay elementos para mostrar.',
    success: 'Ejemplo de éxito: componente listo.',
    validation: 'Ejemplo de validación: completá este campo.',
    error: 'Ejemplo de error: contenido no disponible.',
    errorHelp:
      'Este estado es ilustrativo. Podés seguir probando los otros componentes.',
    controls: 'Controles',
    overlays: 'Paneles y avisos',
    tabs: 'Grupos de componentes',
    fieldLabel: 'Texto de prueba',
    fieldHelp: 'Campo editable con un error ilustrativo fijo; no se envía.',
    disabled: 'Ejemplo deshabilitado',
    tableRegion: 'Tabla de ejemplo desplazable',
    tableCaption: 'Tabla vacía de ejemplo',
    column: 'Contenido',
    openDialog: 'Abrir diálogo de ejemplo',
    dialogTitle: 'Diálogo de ejemplo',
    dialogDescription:
      'Panel modal local. Cerralo con Escape o con el botón de cierre.',
    dialogBody: 'El foco permanece en este panel hasta que lo cierres.',
    openSheet: 'Abrir panel lateral de ejemplo',
    sheetTitle: 'Panel lateral de ejemplo',
    sheetDescription:
      'Este panel es modal; no es la barra lateral permanente del diseño.',
    showToast: 'Mostrar aviso de ejemplo',
    toast: 'Aviso local de ejemplo. No se guardaron datos.',
    loadingStateLabel: 'Ejemplo de estado cargando...',
    emptyStateTitle: 'Ejemplo de estado vacío',
    emptyStateDescription: 'Todavía no hay entregas registradas en esta vista.',
    errorStateTitle: 'Ejemplo de estado de error con reintento',
    errorStateDescription: 'No pudimos sincronizar los datos de ejemplo.',
    errorStateNextAction: 'Podés volver a intentar con el botón de abajo.',
    staleTitle: 'Ejemplo de datos en caché',
    staleDescription:
      'Falló la actualización en segundo plano; se conservan los datos visibles.',
    formRootErrorTitle: 'Ejemplo de error general de formulario',
    formRootErrorDescription:
      'Error del servidor no asociado a un campo individual.',
    deadlineLabel: 'Vencimiento escolar de ejemplo:',
    dateOnlyLabel: 'Fecha calendario de ejemplo:',
  },
} as const;
