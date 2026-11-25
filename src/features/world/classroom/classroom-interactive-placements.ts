import type { ClassroomLayout } from '@/realtime';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import type { ClassroomKitModuleId } from './kit/classroom-kit-manifest';
import type { KitPlacement } from './kit/kit-placement';

/** Floor pivots sit at the footprint centre, so their depth is offset from the wall. */
const SHOP_KIOSK_WALL_OFFSET = 0.44;
const PET_BED_WALL_OFFSET = 0.62;
/** The bed's rug is centred slightly left of the pet home so it stays clear of the kiosk. */
const PET_BED_X_OFFSET = -0.15;

const place = (
  moduleId: ClassroomKitModuleId,
  x: number,
  z: number,
  rotationY = 0,
): KitPlacement => ({ moduleId, position: [x, 0, z], rotationY });

/**
 * The door is centred in the back-wall entrance gap and drawn outside the
 * batched kit (it fades when it hides the local avatar), so it is not part of
 * `deriveInteractivePlacements`. `door.glb` faces +z with its pivot flush on
 * the wall line, so it stands just outside the room. Pure.
 */
export function deriveDoorPlacement(layout: ClassroomLayout): KitPlacement {
  return place('door', 0, layout.bounds.maxZ);
}

/**
 * Derives the interactive prop placements from the layout, following the
 * assembly contract in `docs/art/classroom-interactive.md` and
 * `docs/art/tutor-bot.md`. Positions come from `deriveClassroomPropSpecs`, the
 * same source as the picking proxies and highlights, so what is drawn is what
 * is picked. The collaborative board overlays the furniture board at the same
 * origin. Pure.
 */
export function deriveInteractivePlacements(
  layout: ClassroomLayout,
): KitPlacement[] {
  const { minZ } = layout.bounds;
  const specs = deriveClassroomPropSpecs(layout);
  const { bulletinBoard, botStation } = specs;

  return [
    place('board-collaborative', specs.board.position[0], minZ),
    place(
      'bulletin-board',
      bulletinBoard.position[0],
      bulletinBoard.position[2],
      bulletinBoard.rotationY,
    ),
    place('shop-kiosk', specs.shop.position[0], minZ + SHOP_KIOSK_WALL_OFFSET),
    place(
      'pet-bed',
      specs.pet.position[0] + PET_BED_X_OFFSET,
      minZ + PET_BED_WALL_OFFSET,
    ),
    place(
      'bot-station',
      botStation.position[0],
      botStation.position[2],
      botStation.rotationY,
    ),
  ];
}
