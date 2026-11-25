import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildBatchedKit } from './build-batched-kit';
import type { ClassroomKitModuleId } from './classroom-kit-manifest';
import { countBatchedDrawCalls, estimateKitDrawCalls } from './kit-draw-calls';
import type { KitPlacement } from './kit-placement';

/** Named materials get a colour derived from the name, so they differ unless a test says otherwise. */
function material(name: string, color?: string, transparent = false) {
  const m = new MeshStandardMaterial({
    color:
      color ??
      `hsl(${String(((name.charCodeAt(0) || 0) * 37) % 360)}, 70%, 50%)`,
    transparent,
  });
  m.name = name;
  return m;
}

function moduleScene(
  parts: readonly { name: string; material: MeshStandardMaterial }[],
) {
  const scene = new Group();
  const geometries: BoxGeometry[] = [];
  parts.forEach((part, index) => {
    const geometry = new BoxGeometry(1, 1, 1);
    geometries.push(geometry);
    const mesh = new Mesh(geometry, part.material);
    mesh.name = part.name;
    mesh.position.set(0, index * 2, 0);
    scene.add(mesh);
  });
  return { scene, geometries };
}

const modules = (entries: [ClassroomKitModuleId, Object3D][]) =>
  new Map(entries);

const place = (
  moduleId: ClassroomKitModuleId,
  position: [number, number, number],
  rotationY = 0,
): KitPlacement => ({ moduleId, position, rotationY });

describe('buildBatchedKit', () => {
  it('merges meshes sharing a material across modules and placements into one draw call', () => {
    const wood = material('Wood');
    const paint = material('Paint', 'blue');
    const desk = moduleScene([
      { name: 'top', material: wood },
      { name: 'legs', material: paint },
    ]);
    const chair = moduleScene([{ name: 'seat', material: wood }]);

    const built = buildBatchedKit(
      modules([
        ['student-desk', desk.scene],
        ['student-chair', chair.scene],
      ]),
      [
        place('student-desk', [0, 0, 0]),
        place('student-desk', [3, 0, 0]),
        place('student-chair', [1, 0, 1]),
      ],
    );

    expect(built.meshes).toHaveLength(2);
    expect(countBatchedDrawCalls(built.group)).toBe(2);
    expect(built.group.name).toBe('kit:batch');
    const woodMesh = built.meshes.find(
      (m) => m.name === 'kit:batch:MeshStandardMaterial:Wood',
    );
    expect(woodMesh).toBeDefined();
    // 3 boxes (2 desk tops + 1 seat) of 24 vertices each.
    expect(woodMesh?.geometry.getAttribute('position').count).toBe(72);
    expect(woodMesh?.userData).toEqual({
      kitModuleIds: ['student-chair', 'student-desk'],
    });
    expect(built.group.userData).toEqual({
      kitModuleIds: ['student-chair', 'student-desk'],
    });
  });

  it('reuses the first material instance when different GLBs carry same-named materials', () => {
    const first = material('Shared');
    const second = material('Shared');
    const a = moduleScene([{ name: 'a', material: first }]);
    const b = moduleScene([{ name: 'b', material: second }]);

    const built = buildBatchedKit(
      modules([
        ['board', a.scene],
        ['cabinet', b.scene],
      ]),
      [place('board', [0, 0, 0]), place('cabinet', [2, 0, 0])],
    );

    expect(built.meshes).toHaveLength(1);
    expect(built.meshes[0]?.material).toBe(first);
  });

  it('merges differently named materials that look the same', () => {
    const a = moduleScene([
      { name: 'a', material: material('FurnWood', 'brown') },
    ]);
    const b = moduleScene([
      { name: 'b', material: material('DecWood', 'brown') },
    ]);
    const c = moduleScene([
      { name: 'c', material: material('DecPaint', 'teal') },
    ]);
    const built = buildBatchedKit(
      modules([
        ['board', a.scene],
        ['cabinet', b.scene],
        ['bookshelf', c.scene],
      ]),
      [
        place('board', [0, 0, 0]),
        place('cabinet', [2, 0, 0]),
        place('bookshelf', [4, 0, 0]),
      ],
    );
    expect(built.meshes).toHaveLength(2);
    const wood = built.meshes.find((m) => m.name.endsWith(':FurnWood'));
    expect(wood?.geometry.getAttribute('position').count).toBe(48);
    expect(wood?.userData).toEqual({ kitModuleIds: ['board', 'cabinet'] });
  });

  it('does not merge unnamed materials that are different instances', () => {
    const a = moduleScene([{ name: 'a', material: material('') }]);
    const b = moduleScene([{ name: 'b', material: material('') }]);
    const built = buildBatchedKit(
      modules([
        ['board', a.scene],
        ['cabinet', b.scene],
      ]),
      [place('board', [0, 0, 0]), place('cabinet', [2, 0, 0])],
    );
    expect(built.meshes).toHaveLength(2);
  });

  it('bakes placement and in-scene mesh transforms into world-space vertices', () => {
    const m = moduleScene([
      { name: 'low', material: material('A') },
      { name: 'high', material: material('B') },
    ]);
    m.scene.position.set(10, 0, 0); // scene root transform must be ignored
    const built = buildBatchedKit(modules([['student-desk', m.scene]]), [
      place('student-desk', [1, 0, 2]),
      place('student-desk', [4, 0, -1], Math.PI / 2),
    ]);

    const high = built.meshes.find((x) => x.name.endsWith(':B'));
    const box = new Box3().setFromBufferAttribute(
      high!.geometry.getAttribute('position') as BufferAttribute,
    );
    // Mesh sits 2 m up inside the module; both placements keep it at y=2.
    expect(box.min.y).toBeCloseTo(1.5);
    expect(box.max.y).toBeCloseTo(2.5);
    expect(box.min.x).toBeCloseTo(0.5);
    expect(box.max.x).toBeCloseTo(4.5);
    expect(box.getCenter(new Vector3()).z).toBeCloseTo(0.5);
  });

  it('never mutates or disposes the cached geometry and material', () => {
    const wood = material('Wood');
    const m = moduleScene([{ name: 'top', material: wood }]);
    const original = m.geometries[0]!;
    const before = Array.from(original.getAttribute('position').array);
    const geometrySpy = vi.spyOn(original, 'dispose');
    const materialSpy = vi.spyOn(wood, 'dispose');

    const built = buildBatchedKit(modules([['board', m.scene]]), [
      place('board', [5, 0, 5], 1),
    ]);
    built.dispose();

    expect(Array.from(original.getAttribute('position').array)).toEqual(before);
    expect(built.meshes[0]?.geometry).not.toBe(original);
    expect(geometrySpy).not.toHaveBeenCalled();
    expect(materialSpy).not.toHaveBeenCalled();
  });

  it('dispose releases only the merged geometries and keeps the group attached (StrictMode)', () => {
    const m = moduleScene([
      { name: 'a', material: material('A') },
      { name: 'b', material: material('B') },
    ]);
    const built = buildBatchedKit(modules([['board', m.scene]]), [
      place('board', [0, 0, 0]),
    ]);
    const spies = built.meshes.map((mesh) =>
      vi.spyOn(mesh.geometry, 'dispose'),
    );

    built.dispose();

    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
    expect(built.group.children).toHaveLength(2);
  });

  it('keeps transparent materials transparent', () => {
    const glass = material('Glass', 'cyan', true);
    const m = moduleScene([{ name: 'pane', material: glass }]);
    const built = buildBatchedKit(modules([['window', m.scene]]), [
      place('window', [0, 0, 0]),
    ]);
    expect(
      (built.meshes[0]?.material as MeshStandardMaterial).transparent,
    ).toBe(true);
  });

  it('merges geometries with mismatched attributes and indexing without crashing', () => {
    const wood = material('Wood');
    const withUv = new BoxGeometry(1, 1, 1); // indexed, position+normal+uv
    const bare = new BufferGeometry(); // non-indexed, position+normal only
    bare.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    bare.setAttribute(
      'normal',
      new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3),
    );
    const scene = new Group();
    scene.add(new Mesh(withUv, wood), new Mesh(bare, wood));

    const built = buildBatchedKit(modules([['board', scene]]), [
      place('board', [0, 0, 0]),
    ]);

    expect(built.meshes).toHaveLength(1);
    const geometry = built.meshes[0]!.geometry;
    expect(geometry.getAttribute('uv')).toBeUndefined();
    expect(geometry.getAttribute('position').count).toBe(36 + 3);
    expect(geometry.index).toBeNull();
  });

  it('falls back to separate meshes when attributes cannot be merged', () => {
    const wood = material('Wood');
    const a = new BufferGeometry();
    a.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    a.setAttribute('color', new BufferAttribute(new Float32Array(9), 3));
    const b = new BufferGeometry();
    b.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    b.setAttribute('color', new BufferAttribute(new Float32Array(12), 4));
    const scene = new Group();
    scene.add(new Mesh(a, wood), new Mesh(b, wood));

    const built = buildBatchedKit(modules([['board', scene]]), [
      place('board', [0, 0, 0]),
    ]);

    expect(built.meshes).toHaveLength(2);
    expect(built.meshes.every((mesh) => mesh.material === wood)).toBe(true);
  });

  it('skips modules that are not loaded and builds an empty group for no placements', () => {
    const m = moduleScene([{ name: 'a', material: material('A') }]);
    const partial = buildBatchedKit(modules([['board', m.scene]]), [
      place('board', [0, 0, 0]),
      place('cabinet', [1, 0, 0]),
    ]);
    expect(partial.meshes).toHaveLength(1);
    expect(partial.meshes[0]?.userData).toEqual({ kitModuleIds: ['board'] });

    const empty = buildBatchedKit(modules([['board', m.scene]]), []);
    expect(empty.meshes).toHaveLength(0);
    expect(empty.group.children).toHaveLength(0);
  });
});

describe('draw call estimation', () => {
  it('counts one draw call per distinct material across the modules in use', () => {
    const placements = [
      place('student-desk', [0, 0, 0]),
      place('student-chair', [1, 0, 0]),
    ];
    expect(
      estimateKitDrawCalls(placements, {
        'student-desk': ['Wood', 'Paint'],
        'student-chair': ['Wood', 'Metal'],
        board: ['Unused'],
      }),
    ).toBe(3);
  });

  it('keeps a 300-placement room at one draw call per material', () => {
    const wood = material('Wood');
    const many: KitPlacement[] = Array.from({ length: 300 }, (_, i) => ({
      moduleId: i % 2 ? 'floor-tile' : 'wall-solid',
      position: [i, 0, 0],
      rotationY: 0,
    }));
    const built = buildBatchedKit(
      modules([
        ['floor-tile', moduleScene([{ name: 'a', material: wood }]).scene],
        [
          'wall-solid',
          moduleScene([
            { name: 'a', material: wood },
            { name: 'b', material: material('Paint') },
          ]).scene,
        ],
      ]),
      many,
    );
    expect(countBatchedDrawCalls(built.group)).toBe(2);
  });
});
