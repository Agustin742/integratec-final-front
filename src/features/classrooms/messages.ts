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
} as const;
