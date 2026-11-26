import type { ClassroomLayout } from '@/realtime';
import { deriveDesks } from './classroom-desks';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';
import type { KitPlacement } from './kit/kit-placement';

/**
 * Half the side of a ceremonial flag's square stand (`flag-*.glb` is 1.20 m
 * wide with the pole at its origin; only the 0.42 m stand touches the floor).
 */
const FLAG_STAND_HALF = 0.21;
/** Clear floor between the teacher desk side and the flag stand. */
const FLAG_DESK_GAP = 0.06;
/** `christmas-tree.glb` extents at yaw 0: 1.12 x 1.07 m, pivot at the centre. */
const TREE_HALF = { x: 0.56, z: 0.54 } as const;
/** `plants-and-pots.glb` extents at yaw 0: x -0.34..0.36, z -0.33..0.27. */
const PLANTS_EXTENTS = { minX: -0.34, maxX: 0.36, minZ: -0.33, maxZ: 0.27 };
/** Nothing stands closer than this to a wall (`docs/art/classroom-decoration.md`). */
const WALL_MARGIN = 0.28;
/** The bookshelf is 1.8 m wide, centred on `shelf.position`. */
const BOOKSHELF_HALF_WIDTH = 0.9;
/** The board is 4.4 m wide, centred on `board.position`. */
const BOARD_HALF_WIDTH = 2.2;
/** Gap between the tree and the wall margin. */
const TREE_WALL_GAP = 0.2;
/** Plants z on the left wall, between the bot station and the bulletin board. */
const PLANTS_Z = 2.55;
/** Cabinet (`classroom-furniture-placements`): centre z and top height. */
const CABINET_Z = -1;
const CABINET_TOP = 1.14;
/** The globe sits towards the room side of the cabinet, forward of the map. */
const GLOBE_Z = -0.65;
const GLOBE_WALL_OFFSET = 0.31;
/** Rug centre in the entrance gathering zone, behind the last desk row and chairs. */
const RUG_Z = 4.65;
/** Wall mounting heights (m), from `docs/art/classroom-decoration.md`. */
const CLOCK_Y = 1.98;
const MAP_Y = 1.8;
const POSTERS_Y = 1.66;
const FRONT_GARLAND_Y = 2.52;
const LEFT_GARLAND_Y = 2.54;
/** The posters hang above the pet bed (centred 0.15 m left of the pet home). */
const POSTERS_X_OFFSET = -0.15;
/** The front garlands hang slightly left of the kiosk centre. */
const GARLAND_X_OFFSET = -0.05;
/** The left garland hangs towards the room corner above the bulletin board. */
const LEFT_GARLAND_Z_OFFSET = -0.6;

const place = (
  moduleId: ClassroomKitModuleId,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): KitPlacement => ({ moduleId, position: [x, y, z], rotationY });

export type DecorationFloorFootprintId =
  'flagArgentina' | 'flagIntegrar' | 'christmasTree' | 'plantsAndPots';

/**
 * A freestanding decoration's floor footprint in world axes. The scene draws
 * it but only the server blocks avatars, so these are the boxes the back lists
 * as layout props.
 */
export interface DecorationFloorFootprint {
  readonly id: DecorationFloorFootprintId;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

interface DecorationPlan {
  readonly placements: KitPlacement[];
  readonly footprints: DecorationFloorFootprint[];
}

function planDecorations(layout: ClassroomLayout): DecorationPlan {
  const { bounds } = layout;
  const specs = deriveClassroomPropSpecs(layout);
  const teacher = deriveDesks(layout).find((desk) => desk.kind === 'teacher');
  const placements: KitPlacement[] = [];
  const footprints: DecorationFloorFootprint[] = [];

  // One flag at each front corner of the teacher desk, standing beside its
  // side with the cloth hanging outward (away from the desk, over open floor).
  if (teacher) {
    const front = teacher.centerZ + teacher.depth / 2;
    const reach = teacher.width / 2 + FLAG_DESK_GAP + FLAG_STAND_HALF;
    const flags = [
      { id: 'flagArgentina', moduleId: 'flag-argentina', side: -1 },
      { id: 'flagIntegrar', moduleId: 'flag-integrar', side: 1 },
    ] as const;
    for (const { id, moduleId, side } of flags) {
      const x = teacher.centerX + side * reach;
      placements.push(place(moduleId, x, 0, front, side === 1 ? 0 : Math.PI));
      footprints.push({
        id,
        minX: x - FLAG_STAND_HALF,
        maxX: x + FLAG_STAND_HALF,
        minZ: front - FLAG_STAND_HALF,
        maxZ: front + FLAG_STAND_HALF,
      });
    }
  }

  // Christmas tree against the front wall, in the free span between the
  // bookshelf and the board; it never hides the board from the camera.
  const treeX =
    (specs.shelf.position[0] +
      BOOKSHELF_HALF_WIDTH +
      (specs.board.position[0] - BOARD_HALF_WIDTH)) /
    2;
  const treeZ = bounds.minZ + WALL_MARGIN + TREE_HALF.z + TREE_WALL_GAP;
  placements.push(place('christmas-tree', treeX, 0, treeZ));
  footprints.push({
    id: 'christmasTree',
    minX: treeX - TREE_HALF.x,
    maxX: treeX + TREE_HALF.x,
    minZ: treeZ - TREE_HALF.z,
    maxZ: treeZ + TREE_HALF.z,
  });

  // Plants on the left wall, between the bot station and the bulletin board.
  const plantsX = bounds.minX + WALL_MARGIN - PLANTS_EXTENTS.minX;
  placements.push(place('plants-and-pots', plantsX, 0, PLANTS_Z));
  footprints.push({
    id: 'plantsAndPots',
    minX: plantsX + PLANTS_EXTENTS.minX,
    maxX: plantsX + PLANTS_EXTENTS.maxX,
    minZ: PLANTS_Z + PLANTS_EXTENTS.minZ,
    maxZ: PLANTS_Z + PLANTS_EXTENTS.maxZ,
  });

  // Globe on the cabinet top, turned to face into the room.
  placements.push(
    place(
      'globe',
      bounds.minX + GLOBE_WALL_OFFSET,
      CABINET_TOP,
      GLOBE_Z,
      Math.PI / 2,
    ),
  );

  // Walkable rug in the entrance gathering zone (decorative, never an obstacle).
  placements.push(place('rug', 0, 0, RUG_Z));

  // Front wall (far from the camera): clock above the report card stand,
  // posters above the pet bed, garlands above the kiosk.
  const { minX, minZ } = bounds;
  placements.push(
    place('wall-clock', specs.reportCardStand.position[0], CLOCK_Y, minZ),
    place(
      'wall-posters',
      specs.pet.position[0] + POSTERS_X_OFFSET,
      POSTERS_Y,
      minZ,
    ),
    place(
      'garlands',
      specs.shop.position[0] + GARLAND_X_OFFSET,
      FRONT_GARLAND_Y,
      minZ,
    ),
  );

  // Left wall, facing +x: map between the window bays above the cabinet,
  // garland above the bulletin board.
  placements.push(
    place('wall-map', minX, MAP_Y, CABINET_Z, Math.PI / 2),
    place(
      'garlands',
      minX,
      LEFT_GARLAND_Y,
      specs.bulletinBoard.position[2] + LEFT_GARLAND_Z_OFFSET,
      Math.PI / 2,
    ),
  );

  return { placements, footprints };
}

/**
 * Derives the flag, tree and decoration placements from the layout, following
 * `docs/art/classroom-decoration.md` except where the room says otherwise: the
 * flags stand at the teacher desk corners, the tree and plants take free
 * wall-side spots clear of every prop. Wall items stay inside the 0.28 m
 * margin. Pure.
 */
export function deriveDecorationPlacements(
  layout: ClassroomLayout,
): KitPlacement[] {
  return planDecorations(layout).placements;
}

/**
 * Floor footprints of the freestanding decorations (flag stands, tree,
 * plants). They are the boxes the server needs as layout props for avatars to
 * collide with what the scene draws. Pure.
 */
export function deriveDecorationFloorFootprints(
  layout: ClassroomLayout,
): DecorationFloorFootprint[] {
  return planDecorations(layout).footprints;
}
