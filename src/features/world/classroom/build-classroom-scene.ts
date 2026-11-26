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
  Vector3,
  type BufferGeometry,
} from 'three';
import type { ClassroomLayout } from '@/realtime';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';

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
  | 'bot-station'
  | 'chat-computer'
  | 'report-card-stand'
  | 'entrance';

export interface ClassroomScene {
  readonly root: Group;
  setFailedModules(ids: ReadonlySet<ClassroomKitModuleId>): void;
  /** Releases every geometry, material and instance buffer built here. */
  dispose(): void;
}

const DESK_TOP_THICKNESS = 0.06;
const LEG_SIZE = 0.06;
const LEG_INSET = 0.05;

type Vec3 = readonly [number, number, number];

/**
 * Builds the placeholder classroom from the shared layout using unit-sized
 * shared geometries and one matte material per colour. Desks come from the
 * layout obstacles, so what is drawn is exactly what collides. Front of the
 * room = negative z (board, shelf, shop, pet); the entrance is at the back.
 * The shell and the furniture (desks, board, shelf) are the modular kit
 * rendered by `<ClassroomKit>`; this scene keeps the invisible walkable-floor
 * and entrance raycast planes, invisible picking proxies for desks, board,
 * shelf, shop, bulletin board, door and bot station, and the teaching zone. The
 * roaming tutor bot and pet are drawn and picked by `<TutorBot>` and
 * `<ClassroomPet>`, which mount their own proxy under this root.
 */
export function buildClassroomScene(layout: ClassroomLayout): ClassroomScene {
  const { bounds } = layout;
  const propSpecs = deriveClassroomPropSpecs(layout);
  const box = new BoxGeometry(1, 1, 1);
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

  // Furniture is drawn by the modular kit; these meshes only keep the picking
  // contract (names, instance ids, placeholder tags), so their material is
  // invisible yet still raycast.
  const proxyMaterial = new MeshStandardMaterial({
    color: CLASSROOM_COLORS.wood,
    metalness: 0,
    roughness: 0.88,
    visible: false,
  });
  materials.set('picking-proxy', proxyMaterial);
  const proxy = (parent: Object3D, size: Vec3, position: Vec3) => {
    const mesh = new Mesh(box, proxyMaterial);
    mesh.scale.set(...size);
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };

  const flat = (
    color: string,
    width: number,
    depth: number,
    position: Vec3,
    interactive = false,
  ) => {
    // Interactive flats are raycast targets whose look comes from the modular
    // kit (floor tiles, threshold): invisible material, still hit by rays.
    const mesh = new Mesh(
      plane,
      interactive
        ? new MeshStandardMaterial({ color, visible: false })
        : material(color),
    );
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

  // Desks: one footprint per layout obstacle.
  const desks = deriveDesks(layout);
  const students = desks.filter((desk) => desk.kind === 'student');
  const teacher = desks.find((desk) => desk.kind === 'teacher');
  const topY = DESK_HEIGHT - DESK_TOP_THICKNESS / 2;
  const matrix = new Matrix4();
  const identity = new Quaternion();
  const studentTops = new InstancedMesh(box, proxyMaterial, students.length);
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
    const top = proxy(
      root,
      [teacher.width, DESK_TOP_THICKNESS, teacher.depth],
      [teacher.centerX, topY, teacher.centerZ],
    );
    top.name = 'teacher-desk';
  }

  const legHeight = DESK_HEIGHT - DESK_TOP_THICKNESS;
  const legs = new InstancedMesh(box, proxyMaterial, students.length * 4);
  legs.name = 'desk-legs';
  legs.userData.deskKind = 'student';
  const teacherLegs = new InstancedMesh(box, proxyMaterial, teacher ? 4 : 0);
  teacherLegs.name = 'teacher-desk-legs';
  teacherLegs.userData.deskKind = 'teacher';
  desks.forEach((desk) => {
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
      const target = desk.kind === 'student' ? legs : teacherLegs;
      const index = desk.kind === 'student' ? students.indexOf(desk) : 0;
      target.setMatrixAt(index * 4 + corner, matrix);
    });
  });
  legs.instanceMatrix.needsUpdate = true;
  root.add(legs, teacherLegs);
  teacherLegs.instanceMatrix.needsUpdate = true;

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

  // Board and shelf: the kit models draw them; the groups keep an invisible
  // hit box matching the kit dimensions (4.4 x 1.5 m; 1.8 x 1.54 m).
  const board = prop('classroom-board', 'board', propSpecs.board.position);
  proxy(board, [4.4, 1.5, 0.2], [0, 1.7, 0.1]);

  const shelf = prop('classroom-shelf', 'shelf', propSpecs.shelf.position);
  proxy(shelf, [1.8, 1.54, 0.3], [0, 0.77, 0.15]);

  // Shop kiosk (1.96 x 2.15 m), front wall right of the board: drawn by the kit.
  const shop = prop('classroom-shop', 'shop', propSpecs.shop.position);
  proxy(shop, [1.96, 2.15, 0.28], [0, 1.075, 0.14]);

  // Exit door (1.44 x 2.3 m) in the back-wall gap, drawn outside the batched
  // kit (it fades over the local avatar); this proxy owns its hit box and stays
  // pickable while it is faded. Local z points out of the room here.
  const door = prop('classroom-door', 'entrance', [0, 0, bounds.maxZ]);
  proxy(door, [1.44, 2.3, 0.24], [0, 1.15, 0.12]);

  // Tutor Corner station: a free-standing kit prop (1.28 x 1.35 x 1.53 m once
  // rotated); the proxy keeps its world-aligned hit box.
  const station = prop(
    'classroom-bot-station',
    'bot-station',
    propSpecs.botStation.position,
  );
  proxy(station, [1.28, 1.35, 1.53], [0, 0.675, 0]);

  // Report card stand (0.78 x 1.36 x 0.48 m) on the front wall: drawn by the kit.
  const reportCards = prop(
    'classroom-report-card-stand',
    'report-card-stand',
    propSpecs.reportCardStand.position,
  );
  proxy(reportCards, [0.78, 1.36, 0.48], [0, 0.68, 0.02]);

  // Chat computer (0.88 x 1.24 x 0.55 m) on the left wall, facing +x.
  const chatComputer = prop(
    'classroom-chat-computer',
    'chat-computer',
    propSpecs.chatComputer.position,
    propSpecs.chatComputer.rotationY ?? 0,
  );
  proxy(chatComputer, [0.88, 1.24, 0.55], [0, 0.62, 0]);

  // Bulletin board on the left wall near the entrance (local z points into the room).
  const bulletin = prop(
    'classroom-bulletin-board',
    'bulletin-board',
    propSpecs.bulletinBoard.position,
    propSpecs.bulletinBoard.rotationY ?? 0,
  );
  proxy(bulletin, [2.01, 1.34, 0.23], [0, 1.66, 0.115]);

  const dispose = () => {
    const geometries = new Set<BufferGeometry>();
    const owned = new Set<Material>();
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      geometries.add(child.geometry as BufferGeometry);
      owned.add(child.material as Material);
      if (child instanceof InstancedMesh) child.dispose();
    });
    owned.add(proxyMaterial);
    geometries.forEach((geometry) => geometry.dispose());
    owned.forEach((item) => item.dispose());
  };

  // Each recoverable target owns a material: revealing one module must never
  // reveal another module's proxy or mutate a cached GLB material.
  const recoveryTargets = [
    ['floor-tile', floor],
    ['floor-threshold', entrance],
    ['student-desk', studentTops],
    ['student-desk', legs],
    ['teacher-desk', teacherLegs],
    ['teacher-desk', root.getObjectByName('teacher-desk')],
    ['board', board.children[0]],
    ['bookshelf', shelf.children[0]],
    ['door', door.children[0]],
  ] as const;
  const setFailedModules = (ids: ReadonlySet<ClassroomKitModuleId>) => {
    for (const [id, target] of recoveryTargets) {
      if (!(target instanceof Mesh)) continue;
      if (ids.has(id) && target.material === proxyMaterial) {
        target.material = proxyMaterial.clone();
      }
      if (target.material !== proxyMaterial) {
        (target.material as Material).visible = ids.has(id);
      }
    }
  };
  return { root, dispose, setFailedModules };
}
