import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { buildClassroomScene } from './build-classroom-scene';
import { deriveFurniturePlacements } from './classroom-furniture-placements';
import {
  ENTRANCE_WIDTH,
  deriveClassroomPropSpecs,
} from './classroom-interactables';
import {
  deriveDoorPlacement,
  deriveInteractivePlacements,
} from './classroom-interactive-placements';
import { deriveShellPlacements } from './classroom-shell-placements';
import {
  getKitModuleUrl,
  type ClassroomKitModuleId,
} from './kit/classroom-kit-manifest';
import { glbMaterialNames } from './kit/glb-materials.test-utils';
import { estimateKitDrawCalls } from './kit/kit-draw-calls';
import { groupPlacementsByModule } from './kit/kit-placement';

const layout = CLASSROOM_LAYOUT;
const { bounds } = layout;
const specs = deriveClassroomPropSpecs(layout);
const interactive = deriveInteractivePlacements(layout);
const byModule = groupPlacementsByModule(interactive);
const only = (id: ClassroomKitModuleId) => {
  const list = byModule.get(id) ?? [];
  expect(list).toHaveLength(1);
  return list[0]!;
};

/** GLB extents [minX, maxX, minZ, maxZ] at yaw 0, read from each GLB's POSITION accessor bounds. */
const EXTENTS = {
  'shop-kiosk': [-0.98, 0.98, -0.34, 0.37],
  'pet-bed': [-0.52, 0.52, -0.4, 0.4],
  'bot-station': [-0.75, 0.79, -0.62, 0.66],
  'chat-computer': [-0.44, 0.44, -0.27, 0.28],
  'report-card-stand': [-0.39, 0.39, -0.22, 0.26],
} as const;
type FloorProp = keyof typeof EXTENTS;
const FLOOR_PROPS = Object.keys(EXTENTS) as FloorProp[];

/** World footprint of a placed prop (yaw is 0 or a quarter turn: x' = z, z' = -x). */
function rect(id: FloorProp) {
  const placement = only(id);
  const [x0, x1, z0, z1] = EXTENTS[id];
  const quarterTurn = Math.abs(Math.sin(placement.rotationY)) > 0.5;
  const [lx0, lx1, lz0, lz1] = quarterTurn
    ? [z0, z1, -x1, -x0]
    : [x0, x1, z0, z1];
  const [x, , z] = placement.position;
  return { minX: x + lx0, maxX: x + lx1, minZ: z + lz0, maxZ: z + lz1 };
}
type Rect = ReturnType<typeof rect>;
const overlap = (a: Rect, b: Rect) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

describe('deriveInteractivePlacements', () => {
  it('places only the props that have an existing feature', () => {
    expect(
      Object.fromEntries([...byModule].map(([id, list]) => [id, list.length])),
    ).toEqual({
      'board-collaborative': 1,
      'bulletin-board': 1,
      'shop-kiosk': 1,
      'pet-bed': 1,
      'bot-station': 1,
      'chat-computer': 1,
      'report-card-stand': 1,
    });
  });

  it('overlays the collaborative board on the board origin', () => {
    expect(only('board-collaborative')).toEqual({
      moduleId: 'board-collaborative',
      position: [0, 0, bounds.minZ],
      rotationY: 0,
    });
  });

  it('mounts the bulletin board on the left wall at the prop spec', () => {
    expect(only('bulletin-board')).toEqual({
      moduleId: 'bulletin-board',
      position: specs.bulletinBoard.position,
      rotationY: Math.PI / 2,
    });
  });

  it('stands the shop kiosk and pet bed against the front wall near their specs', () => {
    expect(only('shop-kiosk').position).toEqual([
      specs.shop.position[0],
      0,
      bounds.minZ + 0.44,
    ]);
    expect(only('pet-bed').position[0]).toBeCloseTo(
      specs.pet.position[0] - 0.15,
    );
    expect(only('pet-bed').position[2]).toBeCloseTo(bounds.minZ + 0.62);
  });

  it('centres the door in the back-wall entrance gap, outside the batched kit', () => {
    expect(byModule.has('door')).toBe(false);
    expect(deriveDoorPlacement(layout)).toEqual({
      moduleId: 'door',
      position: [0, 0, bounds.maxZ],
      rotationY: 0,
    });
    // door.glb is 1.44 m wide, z in [0, 0.24] from its wall-flush pivot: it
    // fits the 2 m gap and clears the doorway posts at |x| = 1.08.
    expect(1.44 / 2).toBeLessThan(ENTRANCE_WIDTH / 2);
    expect(1.44 / 2).toBeLessThan(1.08);
  });

  it('puts the bot station under the left window bay facing into the room', () => {
    const station = only('bot-station');
    expect(station.position).toEqual(specs.botStation.position);
    // The walk-up target is the floor in front (+x side) of the prop, not its centre.
    const front = specs.botStation.interactablePosition;
    expect(front[0]).toBeGreaterThan(rect('bot-station').maxX);
    expect(front[2]).toBeCloseTo(specs.botStation.position[2]);
    for (const obstacle of layout.obstacles) {
      expect(
        front[0] > obstacle.minX - 0.28 &&
          front[0] < obstacle.maxX + 0.28 &&
          front[2] > obstacle.minZ - 0.28 &&
          front[2] < obstacle.maxZ + 0.28,
      ).toBe(false);
    }
    expect(station.rotationY).toBe(Math.PI / 2);
    expect(rect('bot-station').minX).toBeGreaterThanOrEqual(bounds.minX + 0.28);
  });

  it('stands the report card stand against the front wall between the board and the kiosk', () => {
    const stand = only('report-card-stand');
    expect(stand.position).toEqual(specs.reportCardStand.position);
    expect(stand.rotationY).toBe(0);
    const r = rect('report-card-stand');
    // Clear of the 0.066 m baseboard, board overlay (|x| <= 2.2) and kiosk.
    expect(r.minZ).toBeGreaterThan(bounds.minZ + 0.066);
    expect(r.minX).toBeGreaterThan(2.2);
    expect(r.maxX).toBeLessThan(rect('shop-kiosk').minX);
    expect(specs.reportCardStand.interactablePosition[2]).toBeGreaterThan(
      r.maxZ,
    );
  });

  it('stands the chat computer on the left wall facing into the room', () => {
    const chat = only('chat-computer');
    expect(chat.position).toEqual(specs.chatComputer.position);
    expect(chat.rotationY).toBe(Math.PI / 2);
    const r = rect('chat-computer');
    expect(r.minX).toBeGreaterThan(bounds.minX + 0.066);
    // Walk-up target on the floor in front (+x) of the prop; cabinet ends at z = -1.65.
    expect(specs.chatComputer.interactablePosition[0]).toBeGreaterThan(r.maxX);
    expect(r.maxZ).toBeLessThan(-1 - 1.3 / 2);
  });

  it('keeps the new interactable walk-up points off every desk', () => {
    for (const spec of [specs.reportCardStand, specs.chatComputer]) {
      const [x, , z] = spec.interactablePosition;
      for (const obstacle of layout.obstacles) {
        expect(
          x > obstacle.minX - 0.28 &&
            x < obstacle.maxX + 0.28 &&
            z > obstacle.minZ - 0.28 &&
            z < obstacle.maxZ + 0.28,
        ).toBe(false);
      }
    }
  });

  it('keeps floor props inside the room and off every desk obstacle', () => {
    for (const id of FLOOR_PROPS) {
      const r = rect(id);
      expect(r.minX, id).toBeGreaterThanOrEqual(bounds.minX - 1e-6);
      expect(r.maxX, id).toBeLessThanOrEqual(bounds.maxX + 1e-6);
      expect(r.minZ, id).toBeGreaterThanOrEqual(bounds.minZ - 1e-6);
      expect(r.maxZ, id).toBeLessThanOrEqual(bounds.maxZ + 1e-6);
      for (const obstacle of layout.obstacles) {
        expect(overlap(r, obstacle), `${id} overlaps a desk`).toBe(false);
      }
    }
  });

  it('does not overlap each other or the cabinet and bookshelf', () => {
    FLOOR_PROPS.forEach((a, i) => {
      FLOOR_PROPS.slice(i + 1).forEach((b) => {
        expect(overlap(rect(a), rect(b)), `${a} vs ${b}`).toBe(false);
      });
    });
    // Cabinet: centre z = -1, 1.30 m long on the left wall; bookshelf: x = -6.7, 1.8 m wide.
    expect(rect('bot-station').minZ).toBeGreaterThan(-1 + 1.3 / 2);
  });

  it('keeps shell + furniture + interactive kit and the scene within the draw-call ceiling', () => {
    const all = [
      ...deriveShellPlacements(layout),
      ...deriveFurniturePlacements(layout),
      ...interactive,
    ];
    // The door is drawn outside the batch with its own materials.
    const doorDrawCalls = glbMaterialNames(
      getKitModuleUrl(deriveDoorPlacement(layout).moduleId),
    ).length;
    const meshCounts = Object.fromEntries(
      [...groupPlacementsByModule(all).keys()].map((id) => [
        id,
        glbMaterialNames(getKitModuleUrl(id)),
      ]),
    );
    const kit = estimateKitDrawCalls(all, meshCounts);
    const scene = buildClassroomScene(layout);
    let primitive = 0;
    scene.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!(node.material as { visible: boolean }).visible) return;
      primitive += 1;
    });
    scene.dispose();
    expect(kit + doorDrawCalls + primitive).toBeLessThanOrEqual(60);
  });
});
