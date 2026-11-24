import type { ClassroomLayout } from '@/realtime';
import { deriveDesks } from './classroom-desks';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';
import type { KitPlacement } from './kit/kit-placement';

/** A tucked chair sits this far behind its desk centre (+z), facing the board. */
const CHAIR_OFFSET_Z = 0.56;
/** Clears the 0.066 m wall baseboard (`docs/art/classroom-furniture.md`). */
const BOOKSHELF_WALL_GAP = 0.25;
const CABINET_WALL_GAP = 0.31;
const CABINET_Z = -1;
const COAT_RACK_POSITION = [-7.35, 0, 5.35] as const;
const TRASH_BIN_POSITION = [2.05, 0, -4.55] as const;

const place = (
  moduleId: ClassroomKitModuleId,
  x: number,
  z: number,
  rotationY = 0,
): KitPlacement => ({ moduleId, position: [x, 0, z], rotationY });

/**
 * Derives the classroom furniture placements from the layout, following the
 * assembly contract in `docs/art/classroom-furniture.md`. Desks come from the
 * layout obstacles (the first is the teacher desk), so what is drawn is what
 * collides; chairs, storage and accessories are decorative. Pure.
 */
export function deriveFurniturePlacements(
  layout: ClassroomLayout,
): KitPlacement[] {
  const { minX, minZ } = layout.bounds;
  const specs = deriveClassroomPropSpecs(layout);
  const placements: KitPlacement[] = [];

  const desks = deriveDesks(layout);
  for (const desk of desks) {
    if (desk.kind === 'teacher') {
      placements.push(place('teacher-desk', desk.centerX, desk.centerZ));
    }
  }
  const students = desks.filter((desk) => desk.kind === 'student');
  for (const desk of students) {
    placements.push(place('student-desk', desk.centerX, desk.centerZ));
  }
  for (const desk of students) {
    placements.push(
      place(
        'student-chair',
        desk.centerX,
        desk.centerZ + CHAIR_OFFSET_Z,
        Math.PI,
      ),
    );
  }

  placements.push(
    place('board', specs.board.position[0], specs.board.position[2]),
    place('bookshelf', specs.shelf.position[0], minZ + BOOKSHELF_WALL_GAP),
    place('cabinet', minX + CABINET_WALL_GAP, CABINET_Z, Math.PI / 2),
    place('coat-rack', COAT_RACK_POSITION[0], COAT_RACK_POSITION[2]),
    place('trash-bin', TRASH_BIN_POSITION[0], TRASH_BIN_POSITION[2]),
  );
  return placements;
}
