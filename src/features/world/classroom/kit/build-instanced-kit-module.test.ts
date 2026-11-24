import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildInstancedKitModule } from './build-instanced-kit-module';
import {
  countInstancedDrawCalls,
  estimateKitDrawCalls,
} from './kit-draw-calls';
import type { KitPlacement } from './kit-placement';

function createModuleScene() {
  const geometryA = new BoxGeometry(1, 1, 1);
  const geometryB = new BoxGeometry(2, 1, 1);
  const materialA = new MeshStandardMaterial({ color: 'red' });
  const materialB = new MeshStandardMaterial({ color: 'blue' });
  const scene = new Group();
  const a = new Mesh(geometryA, materialA);
  a.name = 'top';
  const b = new Mesh(geometryB, materialB);
  b.name = 'legs';
  b.position.set(0, 0.5, 0);
  scene.add(a, b);
  return { scene, geometryA, geometryB, materialA, materialB };
}

const placements: KitPlacement[] = [
  { moduleId: 'student-desk', position: [1, 0, 2], rotationY: 0 },
  { moduleId: 'student-desk', position: [4, 0, -1], rotationY: Math.PI / 2 },
];

describe('buildInstancedKitModule', () => {
  it('creates one named InstancedMesh per source mesh sharing geometry and material', () => {
    const m = createModuleScene();
    const built = buildInstancedKitModule('student-desk', m.scene, placements);

    expect(built.group.name).toBe('kit:student-desk');
    expect(built.group.userData).toMatchObject({ kitModuleId: 'student-desk' });
    expect(built.meshes).toHaveLength(2);
    const [first, second] = built.meshes as [InstancedMesh, InstancedMesh];
    expect(first.name).toBe('kit:student-desk:top');
    expect(first.count).toBe(2);
    expect(first.geometry).toBe(m.geometryA);
    expect(first.material).toBe(m.materialA);
    expect(second.geometry).toBe(m.geometryB);
    expect(second.material).toBe(m.materialB);
    expect(first.boundingSphere).not.toBeNull();
  });

  it('composes placement matrix with the mesh matrix inside the scene', () => {
    const m = createModuleScene();
    const built = buildInstancedKitModule('student-desk', m.scene, placements);
    const legs = built.meshes[1] as InstancedMesh;
    const matrix = new Matrix4();

    legs.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([
      1, 0.5, 2,
    ]);

    legs.getMatrixAt(1, matrix);
    const p = new Vector3().setFromMatrixPosition(matrix);
    expect([p.x, p.y, p.z].map((v) => Number(v.toFixed(5)))).toEqual([
      4, 0.5, -1,
    ]);
    // Local +Z rotated 90deg about Y points to +X.
    const z = new Vector3(0, 0, 1).transformDirection(matrix);
    expect(Number(z.x.toFixed(5))).toBe(1);
  });

  it('is independent of the scene root transform', () => {
    const m = createModuleScene();
    m.scene.position.set(10, 0, 0);
    const built = buildInstancedKitModule('student-desk', m.scene, placements);
    const matrix = new Matrix4();
    (built.meshes[0] as InstancedMesh).getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(1);
  });

  it('flags instance matrices for upload', () => {
    const m = createModuleScene();
    const built = buildInstancedKitModule('student-desk', m.scene, placements);
    expect(
      (built.meshes[0] as InstancedMesh).instanceMatrix.version,
    ).toBeGreaterThan(0);
  });

  it('builds an empty group for zero placements', () => {
    const built = buildInstancedKitModule(
      'board',
      createModuleScene().scene,
      [],
    );
    expect(built.meshes).toHaveLength(0);
    expect(built.group.children).toHaveLength(0);
  });

  it('dispose releases only instanced meshes, never cached geometry or material', () => {
    const m = createModuleScene();
    const built = buildInstancedKitModule('student-desk', m.scene, placements);
    const geometrySpy = vi.spyOn(m.geometryA, 'dispose');
    const materialSpy = vi.spyOn(m.materialA, 'dispose');
    const meshSpy = vi.spyOn(built.meshes[0] as InstancedMesh, 'dispose');

    built.dispose();

    expect(meshSpy).toHaveBeenCalledOnce();
    expect(geometrySpy).not.toHaveBeenCalled();
    expect(materialSpy).not.toHaveBeenCalled();
    expect(built.group.children).toHaveLength(0);
  });
});

describe('draw call estimation', () => {
  it('counts one draw call per mesh of each distinct module', () => {
    expect(estimateKitDrawCalls(placements, { 'student-desk': 2 })).toBe(2);
  });

  it('keeps a full room far below the 100 draw call budget', () => {
    const many: KitPlacement[] = Array.from({ length: 300 }, (_, i) => ({
      moduleId: i % 2 ? 'floor-tile' : 'wall-solid',
      position: [i, 0, 0],
      rotationY: 0,
    }));
    const root = new Group();
    for (const id of ['floor-tile', 'wall-solid'] as const) {
      root.add(
        buildInstancedKitModule(
          id,
          createModuleScene().scene,
          many.filter((p) => p.moduleId === id),
        ).group,
      );
    }
    expect(countInstancedDrawCalls(root)).toBe(4);
    expect(
      estimateKitDrawCalls(many, { 'floor-tile': 2, 'wall-solid': 2 }),
    ).toBeLessThan(100);
  });
});
