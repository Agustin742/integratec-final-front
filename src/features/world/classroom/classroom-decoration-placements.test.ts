import { describe, expect, it } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { deriveDesks } from './classroom-desks';
import {
  deriveDecorationFloorFootprints,
  deriveDecorationPlacements,
} from './classroom-decoration-placements';
import { deriveFurniturePlacements } from './classroom-furniture-placements';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import { deriveInteractivePlacements } from './classroom-interactive-placements';
import {
  getKitModuleUrl,
  type ClassroomKitModuleId,
} from './kit/classroom-kit-manifest';
import { glbBounds } from './kit/glb-materials.test-utils';
import {
  groupPlacementsByModule,
  type KitPlacement,
} from './kit/kit-placement';

const layout = CLASSROOM_LAYOUT;
const { bounds } = layout;
const specs = deriveClassroomPropSpecs(layout);
const placements = deriveDecorationPlacements(layout);
const byModule = groupPlacementsByModule(placements);
const footprints = deriveDecorationFloorFootprints(layout);
/** Distance kept between a wall and anything standing or hanging near it. */
const MARGIN = 0.28;
const AVATAR = layout.avatarRadius;

const of = (id: ClassroomKitModuleId) => byModule.get(id) ?? [];
const only = (id: ClassroomKitModuleId) => {
  expect(of(id)).toHaveLength(1);
  return of(id)[0]!;
};

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
const overlap = (a: Rect, b: Rect) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const grow = (r: Rect, by: number): Rect => ({
  minX: r.minX - by,
  maxX: r.maxX + by,
  minZ: r.minZ - by,
  maxZ: r.maxZ + by,
});

/** World rect of a GLB placed at a multiple of a quarter turn. */
function worldRect(placement: KitPlacement): Rect {
  const { min, max } = glbBounds(getKitModuleUrl(placement.moduleId));
  const [x, , z] = placement.position;
  const turn = ((Math.round(placement.rotationY / (Math.PI / 2)) % 4) + 4) % 4;
  const [x0, x1, z0, z1] = [min[0], max[0], min[2], max[2]] as const;
  const local = [
    [x0, x1, z0, z1],
    [z0, z1, -x1, -x0],
    [-x1, -x0, -z1, -z0],
    [-z1, -z0, x0, x1],
  ][turn]!;
  return {
    minX: x + local[0]!,
    maxX: x + local[1]!,
    minZ: z + local[2]!,
    maxZ: z + local[3]!,
  };
}

const fp = (id: (typeof footprints)[number]['id']) =>
  footprints.find((f) => f.id === id)!;

const teacher = deriveDesks(layout).find((d) => d.kind === 'teacher')!;
const teacherRect: Rect = {
  minX: teacher.centerX - teacher.width / 2,
  maxX: teacher.centerX + teacher.width / 2,
  minZ: teacher.centerZ - teacher.depth / 2,
  maxZ: teacher.centerZ + teacher.depth / 2,
};

describe('deriveDecorationPlacements', () => {
  it('places the flags, the tree and the seven decorations once each (garlands twice)', () => {
    expect(
      Object.fromEntries([...byModule].map(([id, list]) => [id, list.length])),
    ).toEqual({
      'flag-argentina': 1,
      'flag-integrar': 1,
      'christmas-tree': 1,
      'plants-and-pots': 1,
      globe: 1,
      rug: 1,
      'wall-clock': 1,
      'wall-map': 1,
      'wall-posters': 1,
      garlands: 2,
    });
  });

  it('stands one flag at each front corner of the teacher desk, cloth facing outward', () => {
    const front = teacherRect.maxZ;
    const cases = [
      { flag: only('flag-argentina'), id: 'flagArgentina', side: -1 },
      { flag: only('flag-integrar'), id: 'flagIntegrar', side: 1 },
    ] as const;
    for (const { flag, id, side } of cases) {
      const base = fp(id);
      // Right next to the desk side, straddling its front edge.
      const gap =
        side === 1
          ? base.minX - teacherRect.maxX
          : teacherRect.minX - base.maxX;
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(0.15);
      expect(base.minZ).toBeLessThan(front);
      expect(base.maxZ).toBeGreaterThan(front);
      // The cloth hangs towards +x (yaw 0) or -x (half turn), away from the desk.
      expect(flag.rotationY).toBeCloseTo(side === 1 ? 0 : Math.PI);
      expect(flag.position[1]).toBe(0);
      expect(overlap(base, teacherRect)).toBe(false);
      expect(Math.sign(flag.position[0] - teacher.centerX)).toBe(side);
    }
  });

  it('derives the freestanding footprints from the GLB bounds', () => {
    for (const [id, module] of [
      ['christmasTree', 'christmas-tree'],
      ['plantsAndPots', 'plants-and-pots'],
    ] as const) {
      const actual = worldRect(only(module));
      for (const edge of ['minX', 'maxX', 'minZ', 'maxZ'] as const) {
        expect(fp(id)[edge], `${id} ${edge}`).toBeCloseTo(actual[edge], 1);
      }
    }
    for (const [flag, id] of [
      [only('flag-argentina'), 'flagArgentina'],
      [only('flag-integrar'), 'flagIntegrar'],
    ] as const) {
      // Only the stand touches the floor; the cloth hangs inside the GLB bounds above it.
      const whole = worldRect(flag);
      const base = fp(id);
      expect(base.minX).toBeGreaterThanOrEqual(whole.minX - 1e-6);
      expect(base.maxX).toBeLessThanOrEqual(whole.maxX + 1e-6);
      expect(base.minZ).toBeGreaterThanOrEqual(whole.minZ - 1e-6);
      expect(base.maxZ).toBeLessThanOrEqual(whole.maxZ + 1e-6);
    }
  });

  it('keeps freestanding decorations inside the wall margin and off desks, props and furniture', () => {
    const furniture = [
      ...deriveFurniturePlacements(layout),
      ...deriveInteractivePlacements(layout),
    ].filter(
      (p) =>
        !['student-chair', 'student-desk', 'teacher-desk'].includes(p.moduleId),
    );
    const others: [string, Rect][] = [
      ...layout.obstacles.map((o, i): [string, Rect] => [`desk ${i}`, o]),
      ...layout.props.map((p): [string, Rect] => [p.id, p]),
      ...furniture.map((p): [string, Rect] => [p.moduleId, worldRect(p)]),
    ];
    for (const item of footprints) {
      expect(item.minX, item.id).toBeGreaterThanOrEqual(
        bounds.minX + MARGIN - 1e-6,
      );
      expect(item.maxX, item.id).toBeLessThanOrEqual(
        bounds.maxX - MARGIN + 1e-6,
      );
      expect(item.minZ, item.id).toBeGreaterThanOrEqual(
        bounds.minZ + MARGIN - 1e-6,
      );
      expect(item.maxZ, item.id).toBeLessThanOrEqual(
        bounds.maxZ - MARGIN + 1e-6,
      );
      for (const [name, rect] of others) {
        expect(overlap(item, rect), `${item.id} vs ${name}`).toBe(false);
      }
      for (const other of footprints) {
        if (other.id === item.id) continue;
        expect(overlap(item, other), `${item.id} vs ${other.id}`).toBe(false);
      }
    }
  });

  it('keeps walk-up points, NPC homes and spawn points clear of them', () => {
    const points: [string, number, number][] = [
      ...Object.entries(specs).map((entry): [string, number, number] => [
        entry[0],
        entry[1].interactablePosition[0],
        entry[1].interactablePosition[2],
      ]),
      ...layout.spawnPoints.map((s, i): [string, number, number] => [
        `spawn ${i}`,
        s.x,
        s.z,
      ]),
      // The teacher desk is approached from the student side, in front of its centre.
      ['teacher desk approach', teacher.centerX, teacherRect.maxZ + AVATAR],
    ];
    for (const item of footprints) {
      const area = grow(item, AVATAR);
      for (const [name, x, z] of points) {
        const inside =
          x > area.minX && x < area.maxX && z > area.minZ && z < area.maxZ;
        expect(inside, `${name} inside ${item.id}`).toBe(false);
      }
    }
  });

  it('hangs wall items on the front and left walls, inside the margin and clear of wall props', () => {
    const wall = placements.filter((p) =>
      ['wall-clock', 'wall-map', 'wall-posters', 'garlands'].includes(
        p.moduleId,
      ),
    );
    expect(wall).toHaveLength(5);
    const boxes = wall.map((p) => {
      const { min, max } = glbBounds(getKitModuleUrl(p.moduleId));
      const [x, y, z] = p.position;
      const onFront = p.rotationY === 0;
      if (onFront) {
        expect(z).toBe(bounds.minZ);
      } else {
        expect(p.rotationY).toBeCloseTo(Math.PI / 2);
        expect(x).toBe(bounds.minX);
      }
      // u runs along the wall, v is height.
      const u0 = onFront ? x + min[0] : z - max[0];
      const u1 = onFront ? x + max[0] : z - min[0];
      expect(u0, p.moduleId).toBeGreaterThanOrEqual(
        (onFront ? bounds.minX : bounds.minZ) + MARGIN - 1e-6,
      );
      expect(u1, p.moduleId).toBeLessThanOrEqual(
        (onFront ? bounds.maxX : bounds.maxZ) - MARGIN + 1e-6,
      );
      return {
        id: p.moduleId,
        wall: onFront ? 'front' : 'left',
        u0,
        u1,
        v0: y + min[1],
        v1: y + max[1],
      };
    });
    // [name, wall, u0, u1, v0, v1]: extents read from each prop's GLB.
    const wallProps: [string, string, number, number, number, number][] = [
      ['board', 'front', -2.2, 2.2, 0.97, 2.37],
      ['board-collaborative', 'front', -1.6, 1.62, 1.03, 2.51],
      ['shop-kiosk', 'front', 3.82, 5.78, 0, 2.15],
      ['report-card-stand', 'front', 2.56, 3.34, 0, 1.36],
      ['pet-bed', 'front', 6.33, 7.37, 0, 0.23],
      ['bulletin-board', 'left', 3.2, 5.2, 0.99, 2.33],
      ['window -3', 'left', -4.01, -1.99, 0.81, 2.4],
      ['window 1', 'left', -0.01, 2.01, 0.81, 2.4],
    ];
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        if (a.wall !== b.wall) continue;
        const clash = a.u0 < b.u1 && a.u1 > b.u0 && a.v0 < b.v1 && a.v1 > b.v0;
        expect(clash, `${a.id} vs ${b.id}`).toBe(false);
      }
      for (const [name, side, u0, u1, v0, v1] of wallProps) {
        if (a.wall !== side) continue;
        const clash = a.u0 < u1 && a.u1 > u0 && a.v0 < v1 && a.v1 > v0;
        expect(clash, `${a.id} vs ${name}`).toBe(false);
      }
    });
  });

  it('rests the globe on the cabinet top with the map hanging above it', () => {
    const globe = only('globe');
    const cabinet = worldRect(
      deriveFurniturePlacements(layout).find((p) => p.moduleId === 'cabinet')!,
    );
    const rect = worldRect(globe);
    expect(globe.position[1]).toBeCloseTo(1.14);
    expect(rect.minX).toBeGreaterThanOrEqual(cabinet.minX);
    expect(rect.maxX).toBeLessThanOrEqual(cabinet.maxX);
    expect(rect.minZ).toBeGreaterThanOrEqual(cabinet.minZ);
    expect(rect.maxZ).toBeLessThanOrEqual(cabinet.maxZ);
    const map = only('wall-map');
    const mapBottom =
      map.position[1] + glbBounds(getKitModuleUrl('wall-map')).min[1];
    expect(mapBottom).toBeGreaterThan(globe.position[1]);
  });

  it('lays the rug flat in the free entrance area and never as an obstacle', () => {
    const rug = only('rug');
    expect(rug.position[1]).toBe(0);
    const rect = worldRect(rug);
    // Clear of every desk and chair, inside the room.
    for (const desk of layout.obstacles) {
      expect(overlap(rect, desk)).toBe(false);
    }
    for (const chair of deriveFurniturePlacements(layout).filter(
      (p) => p.moduleId === 'student-chair',
    )) {
      expect(overlap(rect, worldRect(chair))).toBe(false);
    }
    expect(rect.minX).toBeGreaterThanOrEqual(bounds.minX + MARGIN);
    expect(rect.maxX).toBeLessThanOrEqual(bounds.maxX - MARGIN);
    expect(rect.maxZ).toBeLessThanOrEqual(bounds.maxZ - MARGIN + 1e-6);
    expect(footprints.map((f) => f.id)).not.toContain('rug');
  });

  it('reports exactly the freestanding footprints the back must add as props', () => {
    expect(footprints.map((f) => f.id).sort()).toEqual([
      'christmasTree',
      'flagArgentina',
      'flagIntegrar',
      'plantsAndPots',
    ]);
  });
});
