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
  viewMode: {
    labels: {
      '3d': 'Vista 3D',
      '2d': 'Modo 2D Clásico',
    },
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
} as const;
