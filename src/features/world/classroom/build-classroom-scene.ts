import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { ClassroomLayout } from '@/realtime';
import { CLASSROOM_WALL_HEIGHT } from '../camera';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';
import {
  ENTRANCE_WIDTH,
  deriveClassroomPropSpecs,
} from './classroom-interactables';

/** Art-direction palette (`rules/art-direction.md`). */
export const CLASSROOM_COLORS = {
  floor: '#E9C99B',
  wall: '#F2E2C0',
  wood: '#AF7B52',
  butter: '#F7D86B',
  turquoise: '#62CFC7',
  boardGreen: '#3E8654',
  coral: '#E66861',
  peach: '#F5B5AB',
  petGreen: '#65B96A',
  lavender: '#B5A7D6',
  bookSage: '#9DB4A0',
  bookClay: '#C7A98B',
  bookSlate: '#8FA3B8',
} as const;

export type PlaceholderKind =
  | 'board'
  | 'shelf'
  | 'bulletin-board'
  | 'shop'
  | 'pet'
  | 'tutor-bot'
  | 'entrance';

export interface ClassroomScene {
  readonly root: Group;
  /** Releases every geometry, material and instance buffer built here. */
  dispose(): void;
}

const WALL_THICKNESS = 0.2;
const SKIRTING_HEIGHT = 0.15;
const SKIRTING_THICKNESS = 0.1;
const DESK_TOP_THICKNESS = 0.06;
const LEG_SIZE = 0.06;
const LEG_INSET = 0.05;

type Vec3 = readonly [number, number, number];

/**
 * Builds the placeholder classroom from the shared layout using unit-sized
 * shared geometries and one matte material per colour. Desks come from the
 * layout obstacles, so what is drawn is exactly what collides. Front of the
 * room = negative z (board, shelf, shop, pet); the entrance is at the back.
 * The camera sits at +x,+z, so full-height walls exist only on the far sides.
 */
export function buildClassroomScene(layout: ClassroomLayout): ClassroomScene {
  const { bounds } = layout;
  const propSpecs = deriveClassroomPropSpecs(layout);
  const box = new BoxGeometry(1, 1, 1);
  const sphere = new SphereGeometry(0.5, 16, 12);
  const plane = new PlaneGeometry(1, 1);
  const materials = new Map<string, MeshStandardMaterial>();
  const material = (color: string) => {
    let found = materials.get(color);
    if (!found) {
      found = new MeshStandardMaterial({
        color,
        metalness: 0,
        roughness: 0.88,
      });
      materials.set(color, found);
    }
    return found;
  };

  const part = (
    parent: Object3D,
    geometry: BufferGeometry,
    color: string,
    size: Vec3,
    position: Vec3,
  ) => {
    const mesh = new Mesh(geometry, material(color));
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const block = (parent: Object3D, color: string, size: Vec3, position: Vec3) =>
    part(parent, box, color, size, position);
  const flat = (
    color: string,
    width: number,
    depth: number,
    position: Vec3,
    interactive = false,
  ) => {
    const mesh = new Mesh(plane, material(color));
    mesh.scale.set(width, depth, 1);
    mesh.position.set(...position);
    mesh.rotation.x = -Math.PI / 2;
    // Decorative flats must never swallow pointer rays meant for the floor.
    if (!interactive) mesh.raycast = () => undefined;
    return mesh;
  };

  const root = new Group();
  root.name = 'classroom-scene';

  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  const floor = flat(
    CLASSROOM_COLORS.floor,
    width,
    depth,
    [centerX, 0, centerZ],
    true,
  );
  floor.name = 'walkable-floor';
  // T4 attaches click/tap-to-destination to this mesh.
  floor.userData.walkableFloor = true;
  root.add(floor);

  const teachingZone = flat(CLASSROOM_COLORS.turquoise, 6, 2.5, [
    0,
    0.01,
    bounds.minZ + 1.35,
  ]);
  teachingZone.name = 'teaching-zone';
  root.add(teachingZone);

  const entrance = flat(
    CLASSROOM_COLORS.coral,
    propSpecs.entrance.footprint[0],
    propSpecs.entrance.footprint[1],
    propSpecs.entrance.position,
    true,
  );
  entrance.name = 'entrance';
  entrance.userData.placeholder = 'entrance' satisfies PlaceholderKind;
  root.add(entrance);

  // Far walls (x = minX and z = minZ) are full height; the corner belongs to
  // the z wall. Both sit outside the layout bounds.
  const farZ = block(
    root,
    CLASSROOM_COLORS.wall,
    [width + WALL_THICKNESS, CLASSROOM_WALL_HEIGHT, WALL_THICKNESS],
    [
      centerX - WALL_THICKNESS / 2,
      CLASSROOM_WALL_HEIGHT / 2,
      bounds.minZ - WALL_THICKNESS / 2,
    ],
  );
  farZ.name = 'wall-far-z';
  const farX = block(
    root,
    CLASSROOM_COLORS.wall,
    [WALL_THICKNESS, CLASSROOM_WALL_HEIGHT, depth],
    [bounds.minX - WALL_THICKNESS / 2, CLASSROOM_WALL_HEIGHT / 2, centerZ],
  );
  farX.name = 'wall-far-x';

  // Near sides (x = maxX and z = maxZ) are a low skirting so avatars stay
  // visible; the back one leaves the entrance gap.
  const skirting = new Group();
  skirting.name = 'skirting-near';
  const gapMin = -ENTRANCE_WIDTH / 2;
  const gapMax = ENTRANCE_WIDTH / 2;
  block(
    skirting,
    CLASSROOM_COLORS.wood,
    [SKIRTING_THICKNESS, SKIRTING_HEIGHT, depth + SKIRTING_THICKNESS],
    [
      bounds.maxX + SKIRTING_THICKNESS / 2,
      SKIRTING_HEIGHT / 2,
      centerZ + SKIRTING_THICKNESS / 2,
    ],
  );
  for (const [from, to] of [
    [bounds.minX, gapMin],
    [gapMax, bounds.maxX],
  ] as const) {
    block(
      skirting,
      CLASSROOM_COLORS.wood,
      [to - from, SKIRTING_HEIGHT, SKIRTING_THICKNESS],
      [
        (from + to) / 2,
        SKIRTING_HEIGHT / 2,
        bounds.maxZ + SKIRTING_THICKNESS / 2,
      ],
    );
  }
  root.add(skirting);

  // Desks: one footprint per layout obstacle.
  const desks = deriveDesks(layout);
  const students = desks.filter((desk) => desk.kind === 'student');
  const teacher = desks.find((desk) => desk.kind === 'teacher');
  const topY = DESK_HEIGHT - DESK_TOP_THICKNESS / 2;
  const matrix = new Matrix4();
  const identity = new Quaternion();
  const studentTops = new InstancedMesh(
    box,
    material(CLASSROOM_COLORS.butter),
    students.length,
  );
  studentTops.name = 'student-desks';
  students.forEach((desk, index) => {
    matrix.compose(
      new Vector3(desk.centerX, topY, desk.centerZ),
      identity,
      new Vector3(desk.width, DESK_TOP_THICKNESS, desk.depth),
    );
    studentTops.setMatrixAt(index, matrix);
  });
  studentTops.instanceMatrix.needsUpdate = true;
  root.add(studentTops);

  if (teacher) {
    const top = block(
      root,
      CLASSROOM_COLORS.butter,
      [teacher.width, DESK_TOP_THICKNESS, teacher.depth],
      [teacher.centerX, topY, teacher.centerZ],
    );
    top.name = 'teacher-desk';
  }

  const legHeight = DESK_HEIGHT - DESK_TOP_THICKNESS;
  const legs = new InstancedMesh(
    box,
    material(CLASSROOM_COLORS.wood),
    desks.length * 4,
  );
  legs.name = 'desk-legs';
  desks.forEach((desk, deskIndex) => {
    const dx = desk.width / 2 - LEG_INSET - LEG_SIZE / 2;
    const dz = desk.depth / 2 - LEG_INSET - LEG_SIZE / 2;
    [
      [-dx, -dz],
      [dx, -dz],
      [-dx, dz],
      [dx, dz],
    ].forEach(([ox, oz], corner) => {
      matrix.compose(
        new Vector3(desk.centerX + ox!, legHeight / 2, desk.centerZ + oz!),
        identity,
        new Vector3(LEG_SIZE, legHeight, LEG_SIZE),
      );
      legs.setMatrixAt(deskIndex * 4 + corner, matrix);
    });
  });
  legs.instanceMatrix.needsUpdate = true;
  root.add(legs);

  /**
   * A placeholder is its own group, tagged for #38. Local axes: x along the
   * wall, y up, z out of the wall into the room (depth <= 0.28 so it stays
   * inside the wall margin and never contradicts the collisions).
   */
  const prop = (
    name: string,
    kind: PlaceholderKind,
    position: Vec3,
    rotationY = 0,
  ) => {
    const group = new Group();
    group.name = name;
    group.userData.placeholder = kind;
    group.position.set(...position);
    group.rotation.y = rotationY;
    root.add(group);
    return group;
  };

  // Board on the front wall, above the teaching zone.
  const board = prop('classroom-board', 'board', propSpecs.board.position);
  block(board, CLASSROOM_COLORS.turquoise, [4.4, 1.5, 0.08], [0, 1.55, 0.04]);
  block(board, CLASSROOM_COLORS.boardGreen, [4, 1.1, 0.04], [0, 1.55, 0.1]);
  block(board, CLASSROOM_COLORS.wood, [1.6, 0.05, 0.12], [0, 0.78, 0.06]);

  // Shelf with muted books, front wall, left of the board.
  const shelf = prop('classroom-shelf', 'shelf', propSpecs.shelf.position);
  block(shelf, CLASSROOM_COLORS.wood, [1.8, 1.5, 0.03], [0, 0.75, 0.015]);
  for (const x of [-0.88, 0.88])
    block(shelf, CLASSROOM_COLORS.wood, [0.04, 1.5, 0.28], [x, 0.75, 0.14]);
  for (const y of [0.02, 0.5, 1.0, 1.48])
    block(shelf, CLASSROOM_COLORS.wood, [1.72, 0.04, 0.28], [0, y, 0.14]);
  (
    [
      [-0.55, 0.66, CLASSROOM_COLORS.bookSage],
      [-0.4, 0.66, CLASSROOM_COLORS.bookClay],
      [0.3, 0.66, CLASSROOM_COLORS.bookSlate],
      [-0.2, 1.16, CLASSROOM_COLORS.bookClay],
      [0.5, 1.16, CLASSROOM_COLORS.bookSage],
    ] as const
  ).forEach(([x, y, color]) =>
    block(shelf, color, [0.1, 0.28, 0.2], [x, y, 0.14]),
  );

  // Shop corner, front wall, right of the board.
  const shop = prop('classroom-shop', 'shop', propSpecs.shop.position);
  block(shop, CLASSROOM_COLORS.peach, [2, 0.9, 0.28], [0, 0.45, 0.14]);
  block(shop, CLASSROOM_COLORS.wood, [2, 0.05, 0.28], [0, 0.925, 0.14]);
  block(shop, CLASSROOM_COLORS.peach, [1.4, 0.4, 0.05], [0, 1.7, 0.025]);
  block(shop, CLASSROOM_COLORS.butter, [0.2, 0.2, 0.2], [-0.6, 1.05, 0.14]);
  block(shop, CLASSROOM_COLORS.turquoise, [0.25, 0.15, 0.2], [0, 1.0, 0.14]);
  block(shop, CLASSROOM_COLORS.coral, [0.18, 0.25, 0.18], [0.6, 1.075, 0.14]);

  // Pet corner (basket + green pet), front-right corner of the front wall.
  const pet = prop('classroom-pet', 'pet', propSpecs.pet.position);
  block(pet, CLASSROOM_COLORS.wood, [1, 0.14, 0.28], [0, 0.07, 0.14]);
  part(
    pet,
    sphere,
    CLASSROOM_COLORS.petGreen,
    [0.5, 0.26, 0.22],
    [-0.05, 0.27, 0.14],
  );
  part(
    pet,
    sphere,
    CLASSROOM_COLORS.petGreen,
    [0.2, 0.2, 0.2],
    [0.28, 0.32, 0.14],
  );

  // Bulletin board on the left wall near the entrance (local z points into the room).
  const bulletin = prop(
    'classroom-bulletin-board',
    'bulletin-board',
    propSpecs.bulletinBoard.position,
    propSpecs.bulletinBoard.rotationY ?? 0,
  );
  block(bulletin, CLASSROOM_COLORS.wood, [2, 1, 0.06], [0, 1.5, 0.03]);
  block(bulletin, CLASSROOM_COLORS.coral, [1.8, 0.8, 0.03], [0, 1.5, 0.075]);
  (
    [
      [-0.55, CLASSROOM_COLORS.butter],
      [0, CLASSROOM_COLORS.turquoise],
      [0.55, CLASSROOM_COLORS.peach],
    ] as const
  ).forEach(([x, color]) =>
    block(bulletin, color, [0.3, 0.4, 0.01], [x, 1.5, 0.095]),
  );

  // Tutor bot stands on the teacher desk, so its footprint is inside the obstacle.
  const bot = prop(
    'classroom-tutor-bot',
    'tutor-bot',
    propSpecs.tutorBot.position,
  );
  block(bot, CLASSROOM_COLORS.lavender, [0.28, 0.3, 0.2], [0, 0.15, 0]);
  part(
    bot,
    sphere,
    CLASSROOM_COLORS.lavender,
    [0.24, 0.24, 0.24],
    [0, 0.42, 0],
  );
  block(bot, CLASSROOM_COLORS.lavender, [0.02, 0.1, 0.02], [0, 0.59, 0]);

  const dispose = () => {
    const geometries = new Set<BufferGeometry>();
    const owned = new Set<Material>();
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      geometries.add(child.geometry as BufferGeometry);
      owned.add(child.material as Material);
      if (child instanceof InstancedMesh) child.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    owned.forEach((item) => item.dispose());
  };

  return { root, dispose };
}
