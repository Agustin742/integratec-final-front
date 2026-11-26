import type { Avatar } from '@/features/profile/avatar-options';
import type { AvatarEquipped } from '@/features/world/avatar/avatar-part-plan';
import { pitchMessages as copy } from './messages';

export type PitchActorId = 'sofia' | 'lucas' | 'mateo' | 'docente';
export type PitchSceneMode =
  'meet-call' | 'classroom-wide' | 'station-focus' | 'showcase-trio';

export type PitchPropKey =
  | 'board'
  | 'bookshelf'
  | 'bulletinBoard'
  | 'shopKiosk'
  | 'teacherDesk'
  | 'trophyShelf'
  | 'reportCardStand'
  | 'arcadeConsole'
  | 'garlands'
  | 'spaceTheme';
export type PitchGridState = 'closed' | 'peek' | 'fading' | 'broken';

export type PitchHudMode =
  | 'call-grid'
  | 'call-grid-solo'
  | 'call-grid-fade'
  | 'break-reveal'
  | 'sofia-intro'
  | 'peers-chat'
  | 'room-zones'
  | 'exam-points'
  | 'shop-carousel'
  | 'motivation-balance'
  | 'sdt-autonomy'
  | 'sdt-competence'
  | 'sdt-belonging'
  | 'effort-helmet'
  | 'habit-streak'
  | 'school-bot'
  | 'closing-manifesto';

export interface PitchActorState {
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  readonly animation: string;
  readonly equipped?: AvatarEquipped;
  readonly avatarOverride?: Partial<Avatar>;
  readonly speech?: string;
  readonly turntable?: boolean;
}

export type PitchFocusKey =
  | 'board'
  | 'bookshelf'
  | 'workTables'
  | 'bulletinBoard'
  | 'trophyShelf'
  | 'shopKiosk';

export interface PitchBeat {
  readonly id: string;
  readonly act: 1 | 2 | 3 | 4;
  readonly sceneMode: PitchSceneMode;
  readonly speaker: string;
  readonly timeRange: string;
  readonly chapterTag?: string;
  readonly title: string;
  readonly supportText: string;
  readonly lighting: 'cold' | 'warm';
  readonly gridState: PitchGridState;
  readonly camera: {
    readonly target: readonly [number, number, number];
    readonly visibleHeight: number;
    readonly elevationDeg: number;
    readonly azimuthDeg: number;
  };
  readonly props: readonly PitchPropKey[];
  readonly actors: Partial<Record<PitchActorId, PitchActorState>>;
  readonly hud: PitchHudMode;
  /** Props or zones the presenter can click for a brief close-up on this beat. */
  readonly focusables?: readonly PitchFocusKey[];
}

export interface PitchFocusSpec {
  readonly label: string;
  readonly where: string;
  readonly purpose: string;
  readonly camera: PitchBeat['camera'];
}

/** Brief close-up framings for the most representative classroom props and zones. */
export const PITCH_FOCUS_SPECS: Readonly<
  Record<PitchFocusKey, PitchFocusSpec>
> = {
  board: {
    label: 'Pizarrón',
    where: 'Frente del aula',
    purpose:
      'Consignas del día, recursos del docente y exámenes de opción múltiple con corrección inmediata.',
    camera: {
      target: [0, 1.45, -3.45],
      visibleHeight: 2.45,
      elevationDeg: 10,
      azimuthDeg: 0,
    },
  },
  bookshelf: {
    label: 'Biblioteca',
    where: 'Pared izquierda (sector norte)',
    purpose:
      'Material de estudio y apuntes subidos por el docente que alimentan al asistente con fuentes citadas.',
    camera: {
      target: [-4.75, 1.0, -1.95],
      visibleHeight: 2.4,
      elevationDeg: 13,
      azimuthDeg: 36,
    },
  },
  workTables: {
    label: 'Mesas de trabajo',
    where: 'Zona central de pupitres',
    purpose:
      'El pupitre propio de cada alumno para resolver actividades, mantener su racha diaria y estudiar con pares.',
    camera: {
      target: [-1.85, 0.82, 1.25],
      visibleHeight: 2.35,
      elevationDeg: 18,
      azimuthDeg: 22,
    },
  },
  bulletinBoard: {
    label: 'Cartelera y foro',
    where: 'Frente del aula, a la derecha',
    purpose:
      'Tablera activa con tareas pendientes, entregas, avisos del curso y el foro de dudas de cada actividad.',
    camera: {
      target: [3.55, 1.45, -3.45],
      visibleHeight: 2.35,
      elevationDeg: 10,
      azimuthDeg: 8,
    },
  },
  trophyShelf: {
    label: 'Vitrina de logros',
    where: 'Pared izquierda (sector central)',
    purpose:
      'Trofeos, medallas y rachas desbloqueadas por constancia y esfuerzo académico real, sin azar.',
    camera: {
      target: [-4.75, 1.0, 0.45],
      visibleHeight: 2.35,
      elevationDeg: 13,
      azimuthDeg: 36,
    },
  },
  shopKiosk: {
    label: 'Tienda del aula',
    where: 'Sector derecho del aula',
    purpose:
      'Kiosco donde los alumnos canjean puntos ganados en tareas por ropa, peinados, mochilas y accesorios.',
    camera: {
      target: [4.15, 1.1, -1.55],
      visibleHeight: 2.55,
      elevationDeg: 13,
      azimuthDeg: 14,
    },
  },
};

/** Contract-valid base avatar profiles aligned with `src/features/profile/messages.ts`. */
export const PITCH_CAST: Readonly<Record<PitchActorId, Avatar>> = {
  sofia: {
    bodyId: 'female',
    hairId: 'long-wavy',
    topId: 'hoodie',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
  },
  lucas: {
    bodyId: 'male',
    hairId: 'classic-short',
    topId: 'school-sweatshirt',
    hairColor: '#353849',
    clothingColor: '#75B7DA',
  },
  mateo: {
    bodyId: 'male',
    hairId: 'short-curls',
    topId: 'track-jacket',
    hairColor: '#AF6D63',
    clothingColor: '#7EBA8B',
  },
  docente: {
    bodyId: 'male',
    hairId: 'side-part',
    topId: 'shirt-and-tie',
    hairColor: '#6C4D48',
    clothingColor: '#F4E6D2',
  },
};

export interface PitchPropSpec {
  readonly url: string;
  readonly position: readonly [number, number, number];
  readonly rotationY: number;
  /** True when flush-mounted on a wall (`Z = 0` local backing) so it never sways into the wall. */
  readonly wallMounted?: boolean;
  /** Optional interactive focus key triggered when clicking this 3D prop directly. */
  readonly focusKey?: PitchFocusKey;
}

/**
 * Collision-free furniture placements calibrated to the exact Blender GLB
 * dimensions in `docs/art/classroom-{furniture,interactive,decoration,themes}.md`
 * inside the 12.8 m × 8.4 m pitch diorama (North wall inner face at `Z = -4.11`,
 * West wall inner face at `X = -6.26`).
 */
export const PITCH_PROP_SPECS: Readonly<Record<PitchPropKey, PitchPropSpec>> = {
  board: {
    url: '/models/scenes/classroom/furniture/board.glb',
    position: [0, 0, -3.82],
    rotationY: 0,
    wallMounted: true,
    focusKey: 'board',
  },
  bulletinBoard: {
    url: '/models/scenes/classroom/interactive/bulletin-board.glb',
    position: [3.55, 0, -3.82],
    rotationY: 0,
    wallMounted: true,
    focusKey: 'bulletinBoard',
  },
  teacherDesk: {
    url: '/models/scenes/classroom/furniture/teacher-desk.glb',
    position: [-2.55, 0, -2.35],
    rotationY: 0.14,
  },
  bookshelf: {
    url: '/models/scenes/classroom/furniture/bookshelf.glb',
    position: [-5.25, 0, -1.95],
    rotationY: Math.PI / 2,
    focusKey: 'bookshelf',
  },
  trophyShelf: {
    url: '/models/scenes/classroom/interactive/trophy-shelf.glb',
    position: [-5.22, 0, 0.45],
    rotationY: Math.PI / 2,
    focusKey: 'trophyShelf',
  },
  reportCardStand: {
    url: '/models/scenes/classroom/interactive/report-card-stand.glb',
    position: [-4.45, 0, 1.65],
    rotationY: 1.25,
    focusKey: 'trophyShelf',
  },
  shopKiosk: {
    url: '/models/scenes/classroom/interactive/shop-kiosk.glb',
    position: [4.25, 0, -1.65],
    rotationY: -0.42,
    focusKey: 'shopKiosk',
  },
  arcadeConsole: {
    url: '/models/scenes/classroom/interactive/arcade-console.glb',
    position: [4.55, 0, 0.25],
    rotationY: -0.52,
  },
  garlands: {
    url: '/models/scenes/classroom/decoration/garlands.glb',
    position: [0, 2.52, -3.81],
    rotationY: 0,
    wallMounted: true,
  },
  spaceTheme: {
    url: '/models/scenes/classroom/themes/space.glb',
    position: [4.25, 0, 1.95],
    rotationY: -0.55,
  },
};

export interface PitchShopTryOnItem {
  readonly id: 'crown' | 'sunglasses' | 'wings' | 'helmet';
  readonly label: string;
  readonly cost: string;
  readonly summary: string;
  readonly equipped: AvatarEquipped;
  readonly lucasEquipped: AvatarEquipped;
  readonly mateoEquipped: AvatarEquipped;
  readonly sofiaAvatar?: Partial<Avatar>;
  readonly lucasAvatar?: Partial<Avatar>;
  readonly mateoAvatar?: Partial<Avatar>;
}

export const PITCH_SHOP_ITEMS: readonly PitchShopTryOnItem[] = [
  {
    id: 'crown',
    label: 'Corona y Gorras',
    cost: '180 pts',
    summary: 'Corona dorada, gorra urbana, guitarra, lentes redondos y mochila',
    equipped: { head: 'head_crown', back: 'back_backpack' },
    lucasEquipped: { head: 'head_cap', back: 'back_guitar' },
    mateoEquipped: { face: 'face_round_glasses', back: 'back_backpack' },
    sofiaAvatar: {
      hairId: 'long-wavy',
      topId: 'hoodie',
      clothingColor: '#5B4F96',
    },
    lucasAvatar: {
      hairId: 'classic-short',
      topId: 'denim-jacket',
      clothingColor: '#75B7DA',
    },
    mateoAvatar: {
      hairId: 'short-curls',
      topId: 'school-polo',
      clothingColor: '#F2C85C',
    },
  },
  {
    id: 'sunglasses',
    label: 'Anteojos y Auriculares',
    cost: '120 pts',
    summary: 'Lentes de sol, auriculares, gorra hacia atrás y raqueta',
    equipped: {
      face: 'face_sunglasses',
      head: 'head_headband',
      back: 'back_racket',
    },
    lucasEquipped: {
      face: 'face_sunglasses',
      head: 'head_backwards_cap',
      back: 'back_backpack',
    },
    mateoEquipped: {
      head: 'head_headphones',
      face: 'face_square_glasses',
      back: 'back_racket',
    },
    sofiaAvatar: {
      hairId: 'ponytail',
      topId: 'national-team-jersey',
      clothingColor: '#75B7DA',
    },
    lucasAvatar: {
      hairId: 'soft-mohawk',
      topId: 'track-jacket',
      clothingColor: '#7EBA8B',
    },
    mateoAvatar: {
      hairId: 'box-braids',
      topId: 'hoodie',
      clothingColor: '#5B4F96',
    },
  },
  {
    id: 'wings',
    label: 'Mochilas, Capa y Alas',
    cost: '220 pts',
    summary: 'Alas, capa de superhéroe, gorro de lana, galera y mochila',
    equipped: {
      head: 'head_crown',
      face: 'face_round_glasses',
      back: 'back_wings',
    },
    lucasEquipped: {
      head: 'head_beanie',
      face: 'face_square_glasses',
      back: 'back_superhero_cape',
    },
    mateoEquipped: {
      head: 'head_top_hat',
      face: 'face_masquerade_mask',
      back: 'back_rolling_backpack',
    },
    sofiaAvatar: {
      hairId: 'two-pigtails',
      topId: 'flannel-shirt',
      clothingColor: '#EFA5AE',
    },
    lucasAvatar: {
      hairId: 'dreads',
      topId: 'winter-coat',
      clothingColor: '#F2C85C',
    },
    mateoAvatar: {
      hairId: 'messy',
      topId: 'vest',
      clothingColor: '#5B4F96',
    },
  },
  {
    id: 'helmet',
    label: 'Casco de astronauta',
    cost: '250 pts',
    summary: 'Casco espacial completo, corona, guitarra, auriculares y mochila',
    equipped: { head: 'head_astronaut_helmet', back: 'back_wings' },
    lucasEquipped: {
      head: 'head_crown',
      face: 'face_sunglasses',
      back: 'back_guitar',
    },
    mateoEquipped: {
      head: 'head_headphones',
      face: 'face_sunglasses',
      back: 'back_backpack',
    },
    sofiaAvatar: {
      hairId: 'long-wavy',
      topId: 'hoodie',
      clothingColor: '#5B4F96',
    },
    lucasAvatar: {
      hairId: 'classic-short',
      topId: 'denim-jacket',
      clothingColor: '#75B7DA',
    },
    mateoAvatar: {
      hairId: 'short-curls',
      topId: 'track-jacket',
      clothingColor: '#7EBA8B',
    },
  },
];

export interface PitchAutonomySwatch {
  readonly id: string;
  readonly label: string;
  readonly badge: string;
  readonly isTeacherFocus?: boolean;
  readonly hairColor: Avatar['hairColor'];
  readonly clothingColor: Avatar['clothingColor'];
  readonly sofiaHair: Avatar['hairId'];
  readonly sofiaTop: Avatar['topId'];
  readonly sofiaEquipped: AvatarEquipped;
  readonly lucasHair: Avatar['hairId'];
  readonly lucasTop: Avatar['topId'];
  readonly lucasColor: Avatar['clothingColor'];
  readonly lucasEquipped: AvatarEquipped;
  readonly mateoHair: Avatar['hairId'];
  readonly mateoTop: Avatar['topId'];
  readonly mateoColor: Avatar['clothingColor'];
  readonly mateoEquipped: AvatarEquipped;
  readonly docenteHair: Avatar['hairId'];
  readonly docenteTop: Avatar['topId'];
  readonly docenteColor: Avatar['clothingColor'];
  readonly docenteEquipped: AvatarEquipped;
}

export const PITCH_AUTONOMY_SWATCHES: readonly PitchAutonomySwatch[] = [
  {
    id: 'violet',
    label: 'Urbano + Auriculares',
    badge: 'Buzo, campera de jean, auriculares y mochila',
    hairColor: '#6C4D48',
    clothingColor: '#5B4F96',
    sofiaHair: 'long-wavy',
    sofiaTop: 'hoodie',
    sofiaEquipped: {
      head: 'head_headphones',
      face: 'face_round_glasses',
      back: 'back_backpack',
    },
    lucasHair: 'classic-short',
    lucasTop: 'denim-jacket',
    lucasColor: '#75B7DA',
    lucasEquipped: { head: 'head_cap', back: 'back_guitar' },
    mateoHair: 'short-curls',
    mateoTop: 'school-polo',
    mateoColor: '#F2C85C',
    mateoEquipped: { face: 'face_sunglasses', back: 'back_backpack' },
    docenteHair: 'side-part',
    docenteTop: 'shirt-and-tie',
    docenteColor: '#F4E6D2',
    docenteEquipped: { face: 'face_round_glasses' },
  },
  {
    id: 'sky',
    label: 'Deporte + Anteojos',
    badge: 'Selección, colitas, trenzas, lentes de sol y raqueta',
    hairColor: '#E5AD58',
    clothingColor: '#75B7DA',
    sofiaHair: 'ponytail',
    sofiaTop: 'national-team-jersey',
    sofiaEquipped: {
      head: 'head_headband',
      face: 'face_sunglasses',
      back: 'back_racket',
    },
    lucasHair: 'soft-mohawk',
    lucasTop: 'track-jacket',
    lucasColor: '#7EBA8B',
    lucasEquipped: {
      head: 'head_backwards_cap',
      face: 'face_sunglasses',
      back: 'back_backpack',
    },
    mateoHair: 'box-braids',
    mateoTop: 'vest',
    mateoColor: '#5B4F96',
    mateoEquipped: {
      head: 'head_headphones',
      face: 'face_square_glasses',
      back: 'back_rolling_backpack',
    },
    docenteHair: 'classic-short',
    docenteTop: 'school-smock',
    docenteColor: '#F4E6D2',
    docenteEquipped: { face: 'face_square_glasses' },
  },
  {
    id: 'green',
    label: 'Invierno + Mochilas',
    badge: 'Leñadora, abrigo, gorro de lana, corona y guitarra',
    hairColor: '#AF6D63',
    clothingColor: '#7EBA8B',
    sofiaHair: 'two-pigtails',
    sofiaTop: 'flannel-shirt',
    sofiaEquipped: {
      head: 'head_beanie',
      face: 'face_square_glasses',
      back: 'back_rolling_backpack',
    },
    lucasHair: 'dreads',
    lucasTop: 'winter-coat',
    lucasColor: '#F2C85C',
    lucasEquipped: { head: 'head_crown', back: 'back_guitar' },
    mateoHair: 'afro',
    mateoTop: 'holiday-sweater',
    mateoColor: '#EFA5AE',
    mateoEquipped: {
      head: 'head_headband',
      face: 'face_round_glasses',
      back: 'back_backpack',
    },
    docenteHair: 'side-part',
    docenteTop: 'winter-coat',
    docenteColor: '#5B4F96',
    docenteEquipped: { face: 'face_round_glasses' },
  },
  {
    id: 'pink',
    label: 'Premios + Corona',
    badge: 'Casco espacial, alas, corona, capa y lentes',
    hairColor: '#C77DAA',
    clothingColor: '#EFA5AE',
    sofiaHair: 'half-up',
    sofiaTop: 'sweater',
    sofiaEquipped: { head: 'head_astronaut_helmet', back: 'back_wings' },
    lucasHair: 'messy',
    lucasTop: 'hoodie',
    lucasColor: '#F4E6D2',
    lucasEquipped: {
      head: 'head_crown',
      face: 'face_sunglasses',
      back: 'back_superhero_cape',
    },
    mateoHair: 'short-curls',
    mateoTop: 'denim-jacket',
    mateoColor: '#75B7DA',
    mateoEquipped: {
      head: 'head_top_hat',
      face: 'face_round_glasses',
      back: 'back_guitar',
    },
    docenteHair: 'side-part',
    docenteTop: 'shirt-and-tie',
    docenteColor: '#75B7DA',
    docenteEquipped: {
      head: 'head_graduation_cap',
      face: 'face_round_glasses',
    },
  },
  {
    id: 'teacher',
    label: 'Vista Docente',
    badge: 'Profesor con guardapolvo, camisa, birrete y anteojos',
    isTeacherFocus: true,
    hairColor: '#353849',
    clothingColor: '#F4E6D2',
    sofiaHair: 'bun',
    sofiaTop: 'school-smock',
    sofiaEquipped: {
      face: 'face_round_glasses',
      back: 'back_backpack',
    },
    lucasHair: 'classic-short',
    lucasTop: 'school-polo',
    lucasColor: '#75B7DA',
    lucasEquipped: {
      face: 'face_square_glasses',
      back: 'back_rolling_backpack',
    },
    mateoHair: 'side-part',
    mateoTop: 'school-sweatshirt',
    mateoColor: '#7EBA8B',
    mateoEquipped: {
      head: 'head_headphones',
      back: 'back_backpack',
    },
    docenteHair: 'side-part',
    docenteTop: 'school-smock',
    docenteColor: '#F4E6D2',
    docenteEquipped: {
      head: 'head_graduation_cap',
      face: 'face_square_glasses',
      back: 'back_backpack',
    },
  },
];

const FACING_CAMERA = Math.PI / 4;
const ASTRONAUT_HELMET: AvatarEquipped = { head: 'head_astronaut_helmet' };
const ASTRONAUT_WINGS: AvatarEquipped = {
  head: 'head_astronaut_helmet',
  back: 'back_wings',
};
const LUCAS_REWARD: AvatarEquipped = {
  head: 'head_cap',
  back: 'back_guitar',
};
const LUCAS_HERO: AvatarEquipped = {
  head: 'head_crown',
  back: 'back_guitar',
};
const MATEO_REWARD: AvatarEquipped = {
  head: 'head_headphones',
  back: 'back_backpack',
};
const MATEO_HERO: AvatarEquipped = {
  head: 'head_headphones',
  face: 'face_sunglasses',
  back: 'back_superhero_cape',
};
const MATEO_BACKPACK: AvatarEquipped = { back: 'back_backpack' };
const TEACHER_GLASSES: AvatarEquipped = { face: 'face_round_glasses' };

export const PITCH_BEATS: readonly PitchBeat[] = [
  // Act 1 · Persona 1 (0:00 - 1:30): Opaque Meet screen (no 3D behind)
  {
    id: '1.0',
    act: 1,
    sceneMode: 'meet-call',
    speaker: 'Persona 1',
    timeRange: '0:00 – 0:25',
    chapterTag: copy.chapters.hook,
    title: 'La clase virtual tradicional',
    supportText:
      'Cámaras apagadas · Micrófonos silenciados · Mano sin respuesta.',
    lighting: 'cold',
    gridState: 'closed',
    camera: {
      target: [0, 0.9, 0],
      visibleHeight: 5.8,
      elevationDeg: 30,
      azimuthDeg: 38,
    },
    props: [],
    actors: {},
    hud: 'call-grid',
  },
  {
    id: '1.1',
    act: 1,
    sceneMode: 'meet-call',
    speaker: 'Persona 1',
    timeRange: '0:25 – 0:50',
    chapterTag: copy.chapters.problem,
    title: 'Aislamiento frente a la pantalla',
    supportText: 'Sin espacio compartido ni presencia real de compañeros.',
    lighting: 'cold',
    gridState: 'peek',
    camera: {
      target: [0, 0.95, 0],
      visibleHeight: 3.4,
      elevationDeg: 20,
      azimuthDeg: 18,
    },
    props: [],
    actors: {},
    hud: 'call-grid-solo',
  },
  {
    id: '1.2',
    act: 1,
    sceneMode: 'meet-call',
    speaker: 'Persona 1',
    timeRange: '0:50 – 1:15',
    chapterTag: copy.chapters.problem,
    title: 'La desconexión progresiva',
    supportText: 'Falta un entorno pensado para habitar la clase.',
    lighting: 'cold',
    gridState: 'fading',
    camera: {
      target: [0, 0.95, 0],
      visibleHeight: 3.4,
      elevationDeg: 20,
      azimuthDeg: 18,
    },
    props: [],
    actors: {},
    hud: 'call-grid-fade',
  },
  {
    id: '1.3',
    act: 1,
    sceneMode: 'station-focus',
    speaker: 'Persona 1',
    timeRange: '1:15 – 1:30',
    chapterTag: copy.chapters.turnaround,
    title: 'Les presentamos el Aula Virtual',
    supportText: 'Un entorno escolar 3D compartido en tiempo real.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.95, 0.1],
      visibleHeight: 3.4,
      elevationDeg: 14,
      azimuthDeg: 12,
    },
    props: ['board'],
    actors: {
      lucas: {
        position: [0, 0, 0.15],
        rotationY: 0.2,
        animation: 'Wave',
        speech: '¡Volvimos al aula!',
      },
    },
    hud: 'break-reveal',
  },

  // Act 2 · Persona 2 (1:30 - 3:00): Sofía, conversación, enfoque en tablera y showcase 360°
  {
    id: '2.0',
    act: 2,
    sceneMode: 'station-focus',
    speaker: 'Persona 2',
    timeRange: '1:30 – 1:50',
    chapterTag: copy.chapters.dayInLife,
    title: 'Identidad propia en 3D',
    supportText: 'Avatar configurable desde el primer ingreso.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.95, 0.15],
      visibleHeight: 3.1,
      elevationDeg: 13,
      azimuthDeg: 10,
    },
    props: ['board'],
    actors: {
      sofia: {
        position: [0, 0, 0.2],
        rotationY: 0.15,
        animation: 'Wave',
        speech: '¡Mi personaje, con el look que elegí!',
      },
    },
    hud: 'sofia-intro',
  },
  {
    id: '2.1',
    act: 2,
    sceneMode: 'station-focus',
    speaker: 'Persona 2',
    timeRange: '1:50 – 2:10',
    chapterTag: copy.chapters.dayInLife,
    title: 'Presencia sincrónica con el curso',
    supportText: 'Compañeros visibles y comunicación en vivo dentro del aula.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.95, 0.05],
      visibleHeight: 3.7,
      elevationDeg: 15,
      azimuthDeg: 14,
    },
    props: ['board'],
    actors: {
      sofia: {
        position: [0, 0, -0.35],
        rotationY: 0.15,
        animation: 'Wave',
        speech: '¡Hola chicos! Resolvámosla juntos',
      },
      lucas: {
        position: [-1.25, 0, 0.15],
        rotationY: 0.95,
        animation: 'TeacherExplain',
        speech: '¡Hola Sofi! ¿Viste la actividad nueva?',
      },
      mateo: {
        position: [1.25, 0, 0.15],
        rotationY: -0.95,
        animation: 'Nod',
        equipped: MATEO_BACKPACK,
        speech: '¡Vamos a la tablera a verla!',
      },
    },
    hud: 'peers-chat',
  },
  {
    id: '2.2',
    act: 2,
    sceneMode: 'station-focus',
    speaker: 'Persona 2',
    timeRange: '2:10 – 2:30',
    title: 'Estaciones interactivas del aula',
    supportText: 'Pizarrón, biblioteca, cartelera, foro y mesas de trabajo.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0.15, 1.15, -2.0],
      visibleHeight: 4.5,
      elevationDeg: 17,
      azimuthDeg: 18,
    },
    props: ['board', 'bookshelf', 'bulletinBoard'],
    focusables: ['board', 'bookshelf', 'bulletinBoard', 'workTables'],
    actors: {
      sofia: {
        position: [-0.25, 0, -2.25],
        rotationY: 0.35,
        animation: 'RaiseHand',
        speech: 'Acá está la consigna en el pizarrón',
      },
      mateo: {
        position: [2.45, 0, -2.25],
        rotationY: -0.45,
        animation: 'Think',
        equipped: MATEO_BACKPACK,
        speech: 'La tablera y el foro están activos',
      },
      lucas: {
        position: [-3.15, 0, -1.65],
        rotationY: 0.85,
        animation: 'Nod',
        speech: 'También reviso la biblioteca',
      },
    },
    hud: 'room-zones',
  },
  {
    id: '2.3',
    act: 2,
    sceneMode: 'station-focus',
    speaker: 'Persona 2',
    timeRange: '2:30 – 2:45',
    title: 'Evaluación y puntos por mérito',
    supportText: 'Retroalimentación automática al completar cada actividad.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 1.0, -0.55],
      visibleHeight: 3.7,
      elevationDeg: 15,
      azimuthDeg: 10,
    },
    props: ['board', 'bookshelf', 'bulletinBoard'],
    actors: {
      sofia: {
        position: [0, 0, -0.35],
        rotationY: 0.15,
        animation: 'Cheer',
        speech: '¡Corregido al instante! +450 pts',
      },
      lucas: {
        position: [-1.35, 0, -0.65],
        rotationY: 0.75,
        animation: 'Clap',
        speech: '¡Bien ahí, Sofi!',
      },
      mateo: {
        position: [1.35, 0, -0.65],
        rotationY: -0.65,
        animation: 'Clap',
        equipped: MATEO_BACKPACK,
      },
    },
    hud: 'exam-points',
  },
  {
    id: '2.4',
    act: 2,
    sceneMode: 'showcase-trio',
    speaker: 'Persona 2',
    timeRange: '2:45 – 3:00',
    title: 'Tienda y recompensas en 360°',
    supportText: 'Ropa, peinados y accesorios desbloqueables con puntos.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.98, 0.45],
      visibleHeight: 2.65,
      elevationDeg: 11,
      azimuthDeg: 0,
    },
    props: ['board', 'shopKiosk', 'trophyShelf', 'garlands'],
    actors: {
      lucas: {
        position: [-1.5, 0.12, 0.4],
        rotationY: 0,
        animation: 'Clap',
        equipped: LUCAS_REWARD,
        turntable: true,
        speech: '¡Gorra, campera y guitarra!',
      },
      sofia: {
        position: [0, 0.12, 0.55],
        rotationY: 0,
        animation: 'Cheer',
        equipped: ASTRONAUT_HELMET,
        turntable: true,
        speech: '¡Probando premios y peinados en 360°!',
      },
      mateo: {
        position: [1.5, 0.12, 0.4],
        rotationY: 0,
        animation: 'Dance',
        equipped: MATEO_REWARD,
        turntable: true,
        speech: '¡Auriculares, lentes y mochila!',
      },
    },
    hud: 'shop-carousel',
  },

  // Act 3 · Persona 3 (3:00 - 4:30): Alterna Plano General, Showcase 360° (Alumnos + Docente) y Enfoque 2da Persona
  {
    id: '3.0',
    act: 3,
    sceneMode: 'classroom-wide',
    speaker: 'Persona 3',
    timeRange: '3:00 – 3:25',
    chapterTag: copy.chapters.whyItWorks,
    title: 'Diseño motivacional con propósito',
    supportText: 'Equilibrio entre esfuerzo académico y reconocimiento.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 1.0, -0.6],
      visibleHeight: 6.0,
      elevationDeg: 29,
      azimuthDeg: 36,
    },
    props: ['board', 'bookshelf', 'shopKiosk', 'trophyShelf', 'garlands'],
    focusables: ['trophyShelf', 'shopKiosk'],
    actors: {
      sofia: {
        position: [0.35, 0, -0.15],
        rotationY: -0.35,
        animation: 'Think',
        equipped: ASTRONAUT_HELMET,
        speech: 'Cada punto sale de lo que aprendemos',
      },
      lucas: {
        position: [-1.05, 0, -0.35],
        rotationY: 1.15,
        animation: 'Nod',
        equipped: LUCAS_REWARD,
        speech: 'El esfuerzo vale la pena',
      },
    },
    hud: 'motivation-balance',
  },
  {
    id: '3.1',
    act: 3,
    sceneMode: 'showcase-trio',
    speaker: 'Persona 3',
    timeRange: '3:25 – 3:45',
    title: 'Pilar 1 · Autonomía y personalización',
    supportText: 'Variantes de alumnos y vista del profesor en tiempo real.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.98, 0.45],
      visibleHeight: 2.8,
      elevationDeg: 11,
      azimuthDeg: 0,
    },
    props: ['shopKiosk', 'garlands'],
    actors: {
      lucas: {
        position: [-1.95, 0.12, 0.35],
        rotationY: 0,
        animation: 'Wave',
        equipped: LUCAS_REWARD,
        turntable: true,
        avatarOverride: { topId: 'denim-jacket', clothingColor: '#75B7DA' },
      },
      sofia: {
        position: [-0.65, 0.12, 0.55],
        rotationY: 0,
        animation: 'Dance',
        turntable: true,
        speech: '¡Ropa, peinados y accesorios en vivo!',
      },
      mateo: {
        position: [0.65, 0.12, 0.55],
        rotationY: 0,
        animation: 'Wave',
        equipped: MATEO_REWARD,
        turntable: true,
        avatarOverride: { topId: 'school-polo', clothingColor: '#F2C85C' },
      },
      docente: {
        position: [1.95, 0.12, 0.35],
        rotationY: 0,
        animation: 'TeacherExplain',
        equipped: TEACHER_GLASSES,
        turntable: true,
        speech: '¡El profe también personaliza su look!',
      },
    },
    hud: 'sdt-autonomy',
  },
  {
    id: '3.2',
    act: 3,
    sceneMode: 'station-focus',
    speaker: 'Persona 3',
    timeRange: '3:45 – 4:00',
    title: 'Pilar 2 · Sentirse capaz',
    supportText: 'Vitrina de trofeos, boletín y medallas de avance.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [-1.8, 1.0, -0.2],
      visibleHeight: 4.1,
      elevationDeg: 17,
      azimuthDeg: 24,
    },
    props: ['board', 'trophyShelf', 'reportCardStand', 'garlands'],
    actors: {
      sofia: {
        position: [-2.65, 0, 0.35],
        rotationY: 0.55,
        animation: 'Cheer',
        equipped: ASTRONAUT_HELMET,
        speech: '¡Subió mi racha y desbloqueé medalla!',
      },
      lucas: {
        position: [-0.85, 0, -0.55],
        rotationY: -0.35,
        animation: 'Clap',
        equipped: LUCAS_REWARD,
        speech: '¡Se ve todo el progreso!',
      },
    },
    hud: 'sdt-competence',
  },
  {
    id: '3.3',
    act: 3,
    sceneMode: 'station-focus',
    speaker: 'Persona 3',
    timeRange: '4:00 – 4:15',
    title: 'Pilar 3 · Pertenencia',
    supportText: 'Comunidad escolar activa dentro del mismo espacio.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.95, 0],
      visibleHeight: 3.7,
      elevationDeg: 14,
      azimuthDeg: 14,
    },
    props: ['bulletinBoard', 'trophyShelf', 'garlands'],
    actors: {
      sofia: {
        position: [0, 0, 0.15],
        rotationY: 0.15,
        animation: 'Wave',
        equipped: ASTRONAUT_HELMET,
        speech: '¡Qué lindo encontrarnos acá!',
      },
      lucas: {
        position: [-1.15, 0, -0.25],
        rotationY: 1.15,
        animation: 'Dance',
        equipped: LUCAS_REWARD,
        speech: '¡No más pantallas negras!',
      },
      mateo: {
        position: [1.15, 0, -0.25],
        rotationY: -1.15,
        animation: 'Clap',
        equipped: MATEO_REWARD,
        speech: '¡Somos un curso de verdad!',
      },
    },
    hud: 'sdt-belonging',
  },
  {
    id: '3.4',
    act: 3,
    sceneMode: 'showcase-trio',
    speaker: 'Persona 3',
    timeRange: '4:15 – 4:30',
    title: 'Metas y evolución del aula',
    supportText: 'Logros desbloqueados por ahorro y constancia.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 0.98, 0.45],
      visibleHeight: 2.55,
      elevationDeg: 10,
      azimuthDeg: 0,
    },
    props: [
      'shopKiosk',
      'trophyShelf',
      'arcadeConsole',
      'garlands',
      'spaceTheme',
    ],
    actors: {
      lucas: {
        position: [-1.5, 0.12, 0.4],
        rotationY: 0,
        animation: 'Cheer',
        equipped: LUCAS_HERO,
        turntable: true,
        avatarOverride: { topId: 'denim-jacket', clothingColor: '#75B7DA' },
        speech: '¡Corona ganada!',
      },
      sofia: {
        position: [0, 0.12, 0.55],
        rotationY: 0,
        animation: 'Dance',
        equipped: ASTRONAUT_WINGS,
        turntable: true,
        speech: '¡Lo ahorré y lo gané con mi esfuerzo!',
      },
      mateo: {
        position: [1.5, 0.12, 0.4],
        rotationY: 0,
        animation: 'Wave',
        equipped: MATEO_HERO,
        turntable: true,
        avatarOverride: { topId: 'school-polo', clothingColor: '#F2C85C' },
        speech: '¡Capa de héroe!',
      },
    },
    hud: 'effort-helmet',
  },

  // Act 4 · Persona 4 (4:30 - 6:00): Plano General Orgánico, Enfoque Docente y Cierre
  {
    id: '4.0',
    act: 4,
    sceneMode: 'classroom-wide',
    speaker: 'Persona 4',
    timeRange: '4:30 – 5:00',
    chapterTag: copy.chapters.habit,
    title: 'Continuidad y hábito diario',
    supportText: 'Racha semanal vinculada a entregas y evaluaciones.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 1.0, -0.3],
      visibleHeight: 6.0,
      elevationDeg: 28,
      azimuthDeg: 35,
    },
    props: ['board', 'trophyShelf', 'garlands'],
    actors: {
      sofia: {
        position: [-1.85, 0, 1.62],
        rotationY: Math.PI,
        animation: 'SitWrite',
        equipped: ASTRONAUT_HELMET,
        speech: '¡Día 7 de racha cumplido!',
      },
      lucas: {
        position: [1.85, 0, 1.62],
        rotationY: Math.PI,
        animation: 'SitWrite',
        equipped: LUCAS_REWARD,
        speech: '¡Sin cortar la cadena!',
      },
      mateo: {
        position: [0, 0, -0.5],
        rotationY: FACING_CAMERA,
        animation: 'Nod',
        equipped: MATEO_REWARD,
      },
    },
    hud: 'habit-streak',
  },
  {
    id: '4.1',
    act: 4,
    sceneMode: 'station-focus',
    speaker: 'Persona 4',
    timeRange: '5:00 – 5:35',
    chapterTag: copy.chapters.schoolValue,
    title: 'Gestión docente y asistente con fuentes',
    supportText: 'Curso unificado y consultas sobre material oficial.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [-0.45, 1.05, -1.6],
      visibleHeight: 4.6,
      elevationDeg: 18,
      azimuthDeg: 22,
    },
    props: [
      'board',
      'bookshelf',
      'bulletinBoard',
      'teacherDesk',
      'trophyShelf',
      'garlands',
    ],
    actors: {
      docente: {
        position: [-1.45, 0, -1.85],
        rotationY: 0.45,
        animation: 'TeacherExplain',
        equipped: TEACHER_GLASSES,
        speech: 'Actividades, entregas y avisos en un lugar',
      },
      sofia: {
        position: [-1.85, 0, 1.62],
        rotationY: Math.PI,
        animation: 'RaiseHand',
        equipped: ASTRONAUT_HELMET,
        speech: '¡El asistente citó el apunte del profe!',
      },
      lucas: {
        position: [1.85, 0, 1.62],
        rotationY: Math.PI,
        animation: 'SitWrite',
        equipped: LUCAS_REWARD,
      },
      mateo: {
        position: [0.45, 0, -0.55],
        rotationY: -0.6,
        animation: 'Nod',
        equipped: MATEO_REWARD,
      },
    },
    hud: 'school-bot',
  },
  {
    id: '4.2',
    act: 4,
    sceneMode: 'classroom-wide',
    speaker: 'Persona 4',
    timeRange: '5:35 – 6:00',
    title: 'Aula Virtual 3D · Demo en vivo',
    supportText: 'Paso directo a la demostración interactiva.',
    lighting: 'warm',
    gridState: 'broken',
    camera: {
      target: [0, 1.0, -0.45],
      visibleHeight: 6.1,
      elevationDeg: 27,
      azimuthDeg: 32,
    },
    props: [
      'board',
      'bookshelf',
      'bulletinBoard',
      'shopKiosk',
      'teacherDesk',
      'trophyShelf',
      'arcadeConsole',
      'garlands',
      'spaceTheme',
    ],
    actors: {
      docente: {
        position: [-1.85, 0, -0.8],
        rotationY: FACING_CAMERA,
        animation: 'Wave',
        equipped: TEACHER_GLASSES,
        speech: '¡Bienvenidos al Aula Virtual!',
      },
      sofia: {
        position: [-0.55, 0, -0.2],
        rotationY: FACING_CAMERA,
        animation: 'Wave',
        equipped: ASTRONAUT_HELMET,
        speech: '¡Véanlo ahora en vivo!',
      },
      lucas: {
        position: [0.65, 0, -0.2],
        rotationY: FACING_CAMERA,
        animation: 'Cheer',
        equipped: LUCAS_REWARD,
      },
      mateo: {
        position: [1.85, 0, -0.7],
        rotationY: FACING_CAMERA,
        animation: 'Wave',
        equipped: MATEO_REWARD,
      },
    },
    hud: 'closing-manifesto',
  },
];

export function actFirstBeatIndex(act: 1 | 2 | 3 | 4): number {
  const index = PITCH_BEATS.findIndex((beat) => beat.act === act);
  return index >= 0 ? index : 0;
}
