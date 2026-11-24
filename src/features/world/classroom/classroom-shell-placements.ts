import type { ClassroomLayout } from '@/realtime';
import {
  ENTRANCE_WIDTH,
  deriveClassroomPropSpecs,
} from './classroom-interactables';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';
import type { KitPlacement } from './kit/kit-placement';

/** Wall, baseboard and cutaway modules are 2 m long (`docs/art/classroom-shell.md`). */
const BAY = 2;
const CEILING_LIGHT_Y = 2.65;
const CEILING_LIGHT_X = [-4.2, 0, 4.2] as const;
const CEILING_LIGHT_Z = [-3, 1.8] as const;
/** Centres of the far-X (left) wall bays that get a window. */
const WINDOW_BAYS_Z = [-3, 1] as const;
/** Doorway posts sit just outside the entrance gap, on the back skirting line. */
const DOORWAY_POST_OFFSET = 0.08;
const DOORWAY_POST_DEPTH = 0.06;

const place = (
  moduleId: ClassroomKitModuleId,
  x: number,
  y: number,
  z: number,
  rotationY = 0,
): KitPlacement => ({ moduleId, position: [x, y, z], rotationY });

/** Centres of the 2 m bays that fill `[from, to]`; the last one is clamped to end at `to`. */
function bayCentres(from: number, to: number): number[] {
  const count = Math.ceil((to - from) / BAY - 1e-9);
  return Array.from({ length: count }, (_, i) =>
    Math.min(from + BAY / 2 + i * BAY, to - BAY / 2),
  );
}

/**
 * Derives the classroom shell placements from the layout, following the
 * placement recipe in `docs/art/classroom-shell.md`: floor tiles, full-height
 * walls on the two far sides only (window bays keep the bulletin board span
 * solid), corners, wall baseboards, a low cutaway skirting on the two near
 * sides with the entrance gap and doorway posts, and ceiling lights. Pure.
 */
export function deriveShellPlacements(layout: ClassroomLayout): KitPlacement[] {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const placements: KitPlacement[] = [];

  for (let x = minX; x < maxX; x += 1) {
    for (let z = minZ; z < maxZ; z += 1) {
      placements.push(place('floor-tile', x + 0.5, 0, z + 0.5));
    }
  }
  placements.push(place('floor-threshold', 0, 0, maxZ));

  const bulletin = deriveClassroomPropSpecs(layout).bulletinBoard;
  const bulletinFrom = bulletin.position[2] - bulletin.footprint[1] / 2;
  const isWindowBay = (z: number) =>
    WINDOW_BAYS_Z.some((bay) => bay === z) && z + BAY / 2 <= bulletinFrom;

  // Far-Z wall (front, board side): solid bays at z = minZ.
  for (const x of bayCentres(minX, maxX)) {
    placements.push(place('wall-solid', x, 0, minZ));
    placements.push(place('baseboard-wall', x, 0, minZ));
  }
  // Far-X wall (left side): windows with curtains, bulletin span stays solid.
  for (const z of bayCentres(minZ, maxZ)) {
    const rotationY = Math.PI / 2;
    if (isWindowBay(z)) {
      placements.push(place('wall-window', minX, 0, z, rotationY));
      placements.push(place('window', minX, 0, z, rotationY));
      placements.push(place('window-curtains', minX, 0, z, rotationY));
    } else {
      placements.push(place('wall-solid', minX, 0, z, rotationY));
    }
    placements.push(place('baseboard-wall', minX, 0, z, rotationY));
  }

  placements.push(
    place('wall-corner', minX, 0, minZ, 0),
    place('wall-corner', maxX, 0, minZ, -Math.PI / 2),
    place('wall-corner', minX, 0, maxZ, Math.PI / 2),
  );

  // Near sides stay low so the camera at +x,+z sees in: cutaway skirting only.
  for (const z of bayCentres(minZ, maxZ)) {
    placements.push(place('baseboard-cutaway', maxX, 0, z, -Math.PI / 2));
  }
  const gap = ENTRANCE_WIDTH / 2;
  for (const [from, to] of [
    [minX, -gap],
    [gap, maxX],
  ] as const) {
    for (const x of bayCentres(from, to)) {
      placements.push(place('baseboard-cutaway', x, 0, maxZ));
    }
  }
  for (const side of [-1, 1]) {
    placements.push(
      place(
        'baseboard-doorway-post',
        side * (gap + DOORWAY_POST_OFFSET),
        0,
        maxZ + DOORWAY_POST_DEPTH,
      ),
    );
  }

  for (const z of CEILING_LIGHT_Z) {
    for (const x of CEILING_LIGHT_X) {
      placements.push(place('ceiling-light', x, CEILING_LIGHT_Y, z));
    }
  }
  return placements;
}
