export const pitchMessages = {
  pageTitle: 'Presentación · Bankito',
  deckHeading: 'Bankito · Aula Virtual 3D',
  canvasLabel: 'Escenario 3D interactivo de la presentación de Bankito',
  controls: {
    advanceStage: 'Avanzar al siguiente paso de la presentación',
    liveDemoCta: 'Y ahora se lo mostramos en vivo',
    stepStatus: (
      current: number,
      total: number,
      speaker: string,
      title: string,
    ) => `Diapositiva ${current} de ${total}. ${speaker}: ${title}`,
  },
  intro: {
    eyebrow: 'Proyecto Integrador · Presentación Interactiva',
    title: 'Bankito',
    logoAlt: 'Logo de Bankito, Aula Virtual',
    tagline:
      'Un aula virtual 3D compartida donde volver a clase es algo que da ganas de hacer.',
    highlights: [
      'Presencia en vivo',
      'Espacios con función real',
      'Progreso por mérito',
    ],
    start: 'Comenzar presentación',
  },
  launch: {
    eyebrow: 'Pasando a la demostración real',
    title: 'Cargando Bankito en vivo…',
    subtitle:
      'Preparando escenario 3D, avatares personalizados y sesión interactiva.',
    steps: [
      'Escenario y mobiliario del aula listos',
      'Avatares de alumnos y docente sincronizados',
      'Abriendo acceso a la plataforma en vivo',
    ],
    openNow: 'Entrar ahora',
  },
  focus: {
    badge: 'Recorrido automático en primer plano:',
  },
  chapters: {
    hook: '¿Qué pasa hoy en una clase virtual?',
    problem: '¿Qué problema encontramos?',
    turnaround: 'La pregunta clave',
    dayInLife: '¿Cómo es el día a día?',
    whyItWorks: '¿Por qué funciona?',
    habit: '¿Cómo se construye el hábito?',
    schoolValue: '¿Qué se lleva la escuela?',
  },
  meetTiles: [
    { id: 't1', name: 'Sofía A.', role: 'hand' as const },
    { id: 't2', name: 'Lucas M.', role: 'phone' as const },
    { id: 't3', name: 'Mateo R.', role: 'bored' as const },
    { id: 't4', name: 'Camila S.', role: 'bored' as const },
    { id: 't5', name: 'Prof. Carlos', role: 'teacher' as const },
    { id: 't6', name: 'Bruno L.', role: 'bored' as const },
    { id: 't7', name: 'Martina P.', role: 'off' as const },
    { id: 't8', name: 'Valentina R.', role: 'bored' as const },
    { id: 't9', name: 'Nicolás D.', role: 'off' as const },
  ],
  meetChrome: {
    meetingTitle: 'Clase de Matemática · 2° B',
    meetingTime: '08:42',
    participantsCount: '9 participantes',
    silenceNotice: 'Sin interacción en el chat',
    disconnectedNotice: '8 de 9 cámaras apagadas',
  },
  meetStatuses: {
    handRaised: 'Mano levantada',
    watchingPhone: 'Mirando el celular',
    cameraOn: 'Cámara encendida',
    cameraOff: 'Cámara apagada',
    micMuted: 'Micrófono silenciado',
    missingWork: 'No entrega',
    absent: 'No aparece',
    teacherSpeaking: 'Explicando a cámaras apagadas',
  },
  cascadeSteps: ['1. Apaga la cámara', '2. No entrega', '3. No aparece'],
  sofiaBadge: {
    name: 'Sofía · 2do año',
    tags: [
      'Peinado y ropa elegidos',
      'Mochila y accesorios',
      'Identidad propia',
    ],
  },
  peersChat: {
    presence: 'En vivo · Compañeros caminando y conversando en el aula',
  },
  taskBoard: {
    heading: 'Tablera de tareas · En vivo',
    livePill: 'Actualizada ahora',
    items: [
      {
        id: 'tb1',
        title: 'Examen de fracciones',
        status: 'Publicada · Opción múltiple',
        accent: 'teal' as const,
      },
      {
        id: 'tb2',
        title: 'Entrega: problemas',
        status: 'Foro activo · 4 consultas',
        accent: 'butter' as const,
      },
      {
        id: 'tb3',
        title: 'Material de estudio',
        status: 'PDF habilitado para asistente',
        accent: 'coral' as const,
      },
    ],
  },
  roomZones: [
    {
      id: 'board',
      title: 'Pizarrón',
      detail: 'Actividades y exámenes',
      tone: 'teal' as const,
    },
    {
      id: 'bookshelf',
      title: 'Biblioteca',
      detail: 'Apuntes y fuentes del bot',
      tone: 'butter' as const,
    },
    {
      id: 'bulletin',
      title: 'Cartelera y foro',
      detail: 'Tareas y dudas de clase',
      tone: 'coral' as const,
    },
    {
      id: 'desks',
      title: 'Mesas de trabajo',
      detail: 'Pupitre propio de cada alumno',
      tone: 'peach' as const,
    },
  ],
  examCard: {
    title: 'Examen de fracciones',
    badge: 'Corrección automática al instante',
    items: [
      'Pregunta 1 · Correcta',
      'Pregunta 2 · Correcta',
      'Pregunta 3 · Correcta',
    ],
    score: '100 / 100',
    footnote: 'Puntos vinculados a entregas y evaluaciones reales',
  },
  shopTryOn: {
    heading: 'Personalización ágil 360° · Ropa, peinados, accesorios y docente',
    prompt: 'Rotación en vivo (tocá un pack para probarlo):',
    items: [
      { id: 'crown', label: 'Corona y Gorras', cost: '180 pts' },
      { id: 'sunglasses', label: 'Anteojos y Auriculares', cost: '120 pts' },
      { id: 'wings', label: 'Mochilas, Capa y Alas', cost: '220 pts' },
      { id: 'helmet', label: 'Casco de astronauta', cost: '250 pts' },
    ],
  },
  psychology: {
    extrinsicTitle: 'Motivación extrínseca',
    extrinsicText: 'Recompensa externa · Nunca por solo conectarse',
    intrinsicTitle: 'Motivación intrínseca',
    intrinsicText: 'Reconocimiento directo al aprendizaje y la constancia',
    pillars: [
      {
        id: 'autonomy' as const,
        title: 'Autonomía',
        description: 'Identidad visual propia en alumnos y docentes.',
        tone: 'coral' as const,
      },
      {
        id: 'competence' as const,
        title: 'Sentirse capaz',
        description: 'Avance visible en puntos, rachas y medallas.',
        tone: 'butter' as const,
      },
      {
        id: 'belonging' as const,
        title: 'Pertenencia',
        description: 'Aula compartida en tiempo real con el curso.',
        tone: 'teal' as const,
      },
    ],
    autonomyPickerLabel:
      'Variaciones rápidas de looks (Alumnos + Vista Docente):',
    teacherViewBadge:
      'Vista Docente activa · Guardapolvo, camisa, anteojos y birrete personalizables',
    effortCard: {
      title: 'Meta alcanzada',
      subtitle: 'Casco de astronauta · 250 / 250 pts',
      quote: 'Desbloqueado por progreso académico acumulado',
    },
  },
  habitStreak: {
    title: 'Racha de estudio semanal',
    days: ['Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5', 'Día 6', 'Día 7'],
    integrityBadge: 'Sin azar · 100% actividad escolar',
  },
  schoolValue: {
    cards: [
      {
        title: 'Docentes',
        detail: 'Actividades, entregas y avisos centralizados.',
      },
      {
        title: 'Alumnos',
        detail: 'Convivencia diaria en un entorno compartido.',
      },
      {
        title: 'Asistente de estudio',
        detail: 'Respuestas basadas en material oficial con fuentes citadas.',
      },
    ],
  },
  closing: {
    manifesto: 'Bankito · Enseñar, aprender y convivir en vivo',
    handoffNote:
      'Al avanzar o tocar el botón se inicia la carga rápida del aula hacia el deploy en vivo',
  },
} as const;
