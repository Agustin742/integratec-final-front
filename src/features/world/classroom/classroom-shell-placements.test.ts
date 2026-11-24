import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { buildClassroomScene } from './build-classroom-scene';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import { deriveShellPlacements } from './classroom-shell-placements';
import { getKitModuleUrl } from './kit/classroom-kit-manifest';
import { estimateKitDrawCalls } from './kit/kit-draw-calls';
import { groupPlacementsByModule } from './kit/kit-placement';

const layout = CLASSROOM_LAYOUT;
const { bounds } = layout;
const placements = deriveShellPlacements(layout);
const byModule = groupPlacementsByModule(placements);
const of = (id: Parameters<typeof byModule.get>[0]) => byModule.get(id) ?? [];

/** Primitive count of a shell GLB = draw calls of its instanced module. */
function glbPrimitiveCount(url: string): number {
  const buffer = readFileSync(resolve(process.cwd(), 'public', url.slice(1)));
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
    meshes: { primitives: unknown[] }[];
  };
  return json.meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0);
}

describe('deriveShellPlacements', () => {
  it('places the documented count of every shell module', () => {
    const counts = Object.fromEntries(
      [...byModule].map(([id, list]) => [id, list.length]),
    );
    expect(counts).toEqual({
      'floor-tile': 192,
      'floor-threshold': 1,
      'wall-solid': 12,
      'wall-window': 2,
      'wall-corner': 3,
      window: 2,
      'window-curtains': 2,
      'baseboard-wall': 14,
      'baseboard-cutaway': 14,
      'baseboard-doorway-post': 2,
      'ceiling-light': 6,
    });
  });

  it('tiles the whole floor on a 1 m grid', () => {
    const tiles = of('floor-tile');
    const keys = new Set(tiles.map((t) => `${t.position[0]},${t.position[2]}`));
    expect(keys.size).toBe(192);
    for (const tile of tiles) {
      expect(tile.position[1]).toBe(0);
      expect(tile.position[0]).toBeGreaterThan(bounds.minX);
      expect(tile.position[0]).toBeLessThan(bounds.maxX);
      expect(tile.position[2]).toBeGreaterThan(bounds.minZ);
      expect(tile.position[2]).toBeLessThan(bounds.maxZ);
    }
  });

  it('builds the far walls only and never a full-height near wall', () => {
    const fullHeight = [
      ...of('wall-solid'),
      ...of('wall-window'),
      ...of('wall-corner'),
    ];
    for (const wall of fullHeight) {
      const [x, , z] = wall.position;
      expect(x <= bounds.minX + 1e-6 || z <= bounds.minZ + 1e-6).toBe(true);
    }
    for (const near of of('baseboard-cutaway')) {
      const [x, , z] = near.position;
      expect(
        Math.abs(x - bounds.maxX) < 1e-6 || Math.abs(z - bounds.maxZ) < 1e-6,
      ).toBe(true);
    }
  });

  it('covers every far wall bay with a wall and a baseboard', () => {
    const walls = [...of('wall-solid'), ...of('wall-window')];
    const farZ = walls.filter((w) => w.position[2] === bounds.minZ);
    const farX = walls.filter((w) => w.position[0] === bounds.minX);
    expect(farZ.map((w) => w.position[0]).sort((a, b) => a - b)).toEqual([
      -7, -5, -3, -1, 1, 3, 5, 7,
    ]);
    expect(farX.map((w) => w.position[2]).sort((a, b) => a - b)).toEqual([
      -5, -3, -1, 1, 3, 5,
    ]);
    expect(farX.every((w) => w.rotationY === Math.PI / 2)).toBe(true);
    expect(of('baseboard-wall')).toHaveLength(walls.length);
  });

  it('puts windows and curtains on window bays, away from the bulletin board', () => {
    const { bulletinBoard } = deriveClassroomPropSpecs(layout);
    const boardZ = bulletinBoard.position[2];
    const half = bulletinBoard.footprint[1] / 2;
    const windowBays = of('wall-window').map((w) => w.position);
    expect(windowBays).toEqual([
      [bounds.minX, 0, -3],
      [bounds.minX, 0, 1],
    ]);
    for (const [, , z] of windowBays) {
      expect(z + 1).toBeLessThanOrEqual(boardZ - half);
    }
    expect(of('window')).toEqual(
      of('wall-window').map((w) => ({ ...w, moduleId: 'window' })),
    );
    expect(of('window-curtains')).toEqual(
      of('wall-window').map((w) => ({ ...w, moduleId: 'window-curtains' })),
    );
  });

  it('closes the far corners', () => {
    expect(of('wall-corner')).toEqual([
      { moduleId: 'wall-corner', position: [-8, 0, -6], rotationY: 0 },
      {
        moduleId: 'wall-corner',
        position: [8, 0, -6],
        rotationY: -Math.PI / 2,
      },
      {
        moduleId: 'wall-corner',
        position: [-8, 0, 6],
        rotationY: Math.PI / 2,
      },
    ]);
  });

  it('leaves the entrance gap in the back cutaway and frames it with posts', () => {
    const back = of('baseboard-cutaway').filter(
      (p) => p.position[2] === bounds.maxZ,
    );
    for (const piece of back) {
      const x = piece.position[0];
      expect(Math.abs(x) - 1).toBeGreaterThanOrEqual(1 - 1e-6);
    }
    const side = of('baseboard-cutaway').filter(
      (p) => p.position[0] === bounds.maxX,
    );
    expect(side).toHaveLength(6);
    expect(side.every((p) => p.rotationY === -Math.PI / 2)).toBe(true);
    expect(of('baseboard-doorway-post').map((p) => p.position)).toEqual([
      [-1.08, 0, bounds.maxZ + 0.06],
      [1.08, 0, bounds.maxZ + 0.06],
    ]);
    expect(of('floor-threshold')[0]?.position).toEqual([0, 0, bounds.maxZ]);
  });

  it('hangs the ceiling lights at 2.65 m', () => {
    const lights = of('ceiling-light');
    expect(lights.map((l) => l.position[1])).toEqual(Array(6).fill(2.65));
    expect(new Set(lights.map((l) => l.position[0]))).toEqual(
      new Set([-4.2, 0, 4.2]),
    );
  });

  it('keeps the shell plus the primitive scene well under 100 draw calls', () => {
    const meshCounts = Object.fromEntries(
      [...byModule.keys()].map((id) => [
        id,
        glbPrimitiveCount(getKitModuleUrl(id)),
      ]),
    );
    const shell = estimateKitDrawCalls(placements, meshCounts);
    const scene = buildClassroomScene(layout);
    let primitive = 0;
    scene.root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (!(node.material as { visible: boolean }).visible) return;
      primitive += 1;
    });
    scene.dispose();
    expect(shell).toBeLessThanOrEqual(40);
    expect(shell + primitive).toBeLessThan(80);
  });
});
