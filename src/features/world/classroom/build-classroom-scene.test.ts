import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  Box3,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  Raycaster,
  Vector3,
  type BufferGeometry,
} from 'three';
import { CLASSROOM_LAYOUT } from '@/realtime';
import { isWalkable } from '../movement';
import { DESK_HEIGHT, deriveDesks } from './classroom-desks';
import { deriveClassroomPropSpecs } from './classroom-interactables';
import {
  buildClassroomScene,
  type ClassroomScene,
} from './build-classroom-scene';

const layout = CLASSROOM_LAYOUT;
let built: ClassroomScene | undefined;
const build = () => (built = buildClassroomScene(layout));
afterEach(() => built?.dispose());

const named = (root: Object3D, name: string) => {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`missing object ${name}`);
  return found;
};
const worldBox = (object: Object3D) => {
  object.updateWorldMatrix(true, true);
  return new Box3().setFromObject(object);
};
/** Footprint of every instance of an instanced unit box. */
const instanceBoxes = (mesh: InstancedMesh) =>
  Array.from({ length: mesh.count }, (_, index) => {
    const matrix = new Matrix4();
    mesh.getMatrixAt(index, matrix);
    const position = new Vector3();
    const scale = new Vector3();
    matrix.decompose(position, new Quaternion(), scale);
    const half = scale.clone().multiplyScalar(0.5);
    return new Box3(position.clone().sub(half), position.clone().add(half));
  });
const meshes = (root: Object3D) => {
  const found: Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof Mesh) found.push(child);
  });
  return found;
};

describe('floor', () => {
  test('is the walkable surface and flagged for later pointer wiring', () => {
    const { root } = build();
    const floor = named(root, 'walkable-floor');
    expect(floor.userData.walkableFloor).toBe(true);
    const box = worldBox(floor);
    expect(box.min.x).toBeCloseTo(layout.bounds.minX);
    expect(box.max.x).toBeCloseTo(layout.bounds.maxX);
    expect(box.min.z).toBeCloseTo(layout.bounds.minZ);
    expect(box.max.z).toBeCloseTo(layout.bounds.maxZ);
    expect(box.max.y).toBeCloseTo(0);
  });

  test('registers no pointer handlers yet', () => {
    const { root } = build();
    const floor = named(root, 'walkable-floor');
    expect(Object.keys(floor.userData)).toEqual(['walkableFloor']);
  });
});

describe('shell ownership', () => {
  test('floor, walls and skirting come from the modular kit, not primitives', () => {
    const { root } = build();
    for (const name of ['wall-far-z', 'wall-far-x', 'skirting-near']) {
      expect(root.getObjectByName(name)).toBeUndefined();
    }
  });

  test('walkable floor and entrance are invisible but raycastable planes', () => {
    const { root } = build();
    for (const name of ['walkable-floor', 'entrance']) {
      const mesh = named(root, name) as Mesh;
      expect((mesh.material as Material).visible).toBe(false);
    }
    const entrance = named(root, 'entrance');
    expect(entrance.userData.placeholder).toBe('entrance');
  });

  test('keeps the entrance raycastable while decorative floor zones let floor rays pass', () => {
    const { root } = build();
    root.updateMatrixWorld(true);
    const [entranceX, , entranceZ] =
      deriveClassroomPropSpecs(layout).entrance.interactablePosition;
    const raycaster = new Raycaster(
      // Beside the door proxy (|x| > 0.72) so the ray reaches the floor quad.
      new Vector3(entranceX + 0.9, 5, entranceZ),
      new Vector3(0, -1, 0),
    );
    const entranceHits = raycaster.intersectObject(root, true);
    expect(entranceHits[0]?.object.name).toBe('entrance');

    raycaster.set(
      new Vector3(2, 5, layout.bounds.minZ + 1.35),
      new Vector3(0, -1, 0),
    );
    const zoneHits = raycaster.intersectObject(root, true);
    expect(zoneHits[0]?.object.name).toBe('walkable-floor');
  });
});

describe('desks', () => {
  test('student desk tops match the student obstacle boxes exactly', () => {
    const { root } = build();
    const tops = named(root, 'student-desks') as InstancedMesh;
    expect(tops.count).toBe(layout.obstacles.length - 1);
    const boxes = instanceBoxes(tops);
    layout.obstacles.slice(1).forEach((obstacle, index) => {
      const box = boxes[index]!;
      expect(box.min.x).toBeCloseTo(obstacle.minX);
      expect(box.max.x).toBeCloseTo(obstacle.maxX);
      expect(box.min.z).toBeCloseTo(obstacle.minZ);
      expect(box.max.z).toBeCloseTo(obstacle.maxZ);
      expect(box.max.y).toBeCloseTo(DESK_HEIGHT);
    });
  });

  test('the teacher desk is obstacle 0 and keeps the same footprint', () => {
    const { root } = build();
    const box = worldBox(named(root, 'teacher-desk'));
    const obstacle = layout.obstacles[0]!;
    expect(box.min.x).toBeCloseTo(obstacle.minX);
    expect(box.max.x).toBeCloseTo(obstacle.maxX);
    expect(box.min.z).toBeCloseTo(obstacle.minZ);
    expect(box.max.z).toBeCloseTo(obstacle.maxZ);
    expect(box.max.y).toBeCloseTo(DESK_HEIGHT);
  });

  test('legs sit inside their desk footprint, four per desk', () => {
    const { root } = build();
    const legs = named(root, 'desk-legs') as InstancedMesh;
    const desks = deriveDesks(layout);
    expect(legs.count).toBe(desks.length * 4);
    instanceBoxes(legs).forEach((leg, index) => {
      const obstacle = layout.obstacles[Math.floor(index / 4)]!;
      expect(leg.min.x).toBeGreaterThanOrEqual(obstacle.minX - 1e-6);
      expect(leg.max.x).toBeLessThanOrEqual(obstacle.maxX + 1e-6);
      expect(leg.min.z).toBeGreaterThanOrEqual(obstacle.minZ - 1e-6);
      expect(leg.max.z).toBeLessThanOrEqual(obstacle.maxZ + 1e-6);
      expect(leg.min.y).toBeCloseTo(0);
    });
  });
});

describe('furniture ownership', () => {
  test('desks, board and shelf are invisible picking proxies; the kit draws them', () => {
    const { root } = build();
    for (const name of ['student-desks', 'desk-legs', 'teacher-desk']) {
      expect(((named(root, name) as Mesh).material as Material).visible).toBe(
        false,
      );
    }
    for (const name of ['classroom-board', 'classroom-shelf']) {
      const group = named(root, name);
      expect(group.userData.placeholder).toBeDefined();
      const proxies = meshes(group);
      expect(proxies.length).toBeGreaterThan(0);
      for (const mesh of proxies) {
        expect((mesh.material as Material).visible).toBe(false);
      }
    }
  });

  test('rays still hit the invisible proxies (desk instance, board, shelf)', () => {
    const { root } = build();
    root.updateMatrixWorld(true);
    const hit = (x: number, y: number, z: number) =>
      new Raycaster(new Vector3(x, y, z), new Vector3(0, -1, 0))
        .intersectObject(root, true)
        .find((h) => h.object.name !== 'walkable-floor');
    const desk = hit(-4.5, 5, -1.8);
    expect(desk?.object.name).toBe('student-desks');
    expect(desk?.instanceId).toBe(0);

    const front = (x: number, y: number) =>
      new Raycaster(
        new Vector3(x, y, layout.bounds.minZ + 3),
        new Vector3(0, 0, -1),
      ).intersectObject(root, true)[0];
    expect(front(0, 1.6)?.object.parent?.name).toBe('classroom-board');
    expect(front(-6.7, 0.8)?.object.parent?.name).toBe('classroom-shelf');
  });
});

describe('placeholders', () => {
  const expected = {
    'classroom-board': 'board',
    'classroom-shelf': 'shelf',
    'classroom-bulletin-board': 'bulletin-board',
    'classroom-shop': 'shop',
    'classroom-pet': 'pet',
    'classroom-tutor-bot': 'tutor-bot',
  } as const;

  test.each(Object.entries(expected))(
    '%s is its own named object tagged %s',
    (name, kind) => {
      const { root } = build();
      const object = named(root, name);
      expect(object.userData.placeholder).toBe(kind);
      expect(object.parent).not.toBeNull();
    },
  );

  test('the pet and the tutor bot are distinct objects with distinct colours', () => {
    const { root } = build();
    const pet = named(root, 'classroom-pet');
    const bot = named(root, 'classroom-tutor-bot');
    expect(pet.getObjectById(bot.id)).toBeUndefined();
    expect(bot.getObjectById(pet.id)).toBeUndefined();
    const colours = (object: Object3D) =>
      new Set(
        meshes(object).map((mesh) =>
          (
            mesh.material as unknown as { color: { getHex(): number } }
          ).color.getHex(),
        ),
      );
    expect(colours(pet).has(0x65b96a)).toBe(true);
    expect(colours(bot).has(0xb5a7d6)).toBe(true);
    expect(colours(pet).has(0xb5a7d6)).toBe(false);
    expect(colours(bot).has(0x65b96a)).toBe(false);
  });

  /**
   * Invariant: no point of a placeholder footprint is a walkable avatar
   * centre. Wall props sit inside the wall margin (`avatarRadius` deep) and the
   * tutor bot stands on the teacher desk, so the visuals never contradict the
   * layout collisions.
   */
  test.each(Object.keys(expected))(
    '%s never occupies walkable space',
    (name) => {
      const { root } = build();
      const box = worldBox(named(root, name));
      for (let x = box.min.x; x <= box.max.x + 1e-9; x += 0.02)
        for (let z = box.min.z; z <= box.max.z + 1e-9; z += 0.02)
          expect(isWalkable(layout, x, z), `${name} at ${x},${z}`).toBe(false);
      expect(box.min.x).toBeGreaterThanOrEqual(layout.bounds.minX - 1e-6);
      expect(box.max.x).toBeLessThanOrEqual(layout.bounds.maxX + 1e-6);
      expect(box.min.z).toBeGreaterThanOrEqual(layout.bounds.minZ - 1e-6);
      expect(box.max.z).toBeLessThanOrEqual(layout.bounds.maxZ + 1e-6);
    },
  );

  test('shop, bulletin board and door keep only invisible pick proxies; the kit draws them', () => {
    const { root } = build();
    for (const name of [
      'classroom-shop',
      'classroom-bulletin-board',
      'classroom-door',
      'classroom-bot-station',
    ]) {
      const proxies = meshes(named(root, name));
      expect(proxies.length, name).toBeGreaterThan(0);
      for (const mesh of proxies) {
        expect((mesh.material as Material).visible, name).toBe(false);
      }
    }
  });

  test('the door proxy sits in the back-wall gap and is tagged as the entrance', () => {
    const { root } = build();
    const door = named(root, 'classroom-door');
    expect(door.userData.placeholder).toBe('entrance');
    const box = worldBox(door);
    expect(box.min.x).toBeCloseTo(-0.72);
    expect(box.max.x).toBeCloseTo(0.72);
    expect(box.min.z).toBeCloseTo(layout.bounds.maxZ);
    expect(box.max.y).toBeCloseTo(2.3);
  });

  test('the bot station is a free-standing prop that opens the bot panel and clears every desk', () => {
    const { root } = build();
    const station = named(root, 'classroom-bot-station');
    expect(station.userData.placeholder).toBe('bot-station');
    const box = worldBox(station);
    expect(box.min.x).toBeGreaterThanOrEqual(layout.bounds.minX + 0.28 - 1e-6);
    for (const o of layout.obstacles) {
      const overlaps =
        box.min.x < o.maxX &&
        box.max.x > o.minX &&
        box.min.z < o.maxZ &&
        box.max.z > o.minZ;
      expect(overlaps).toBe(false);
    }
    const [x, , z] = deriveClassroomPropSpecs(layout).botStation.position;
    root.updateMatrixWorld(true);
    const hit = new Raycaster(new Vector3(x, 5, z), new Vector3(0, -1, 0))
      .intersectObject(root, true)
      .find((h) => h.object.name !== 'walkable-floor');
    expect(hit?.object.parent?.name).toBe('classroom-bot-station');
  });

  test('the tutor bot stands on the teacher desk top', () => {
    const { root } = build();
    const box = worldBox(named(root, 'classroom-tutor-bot'));
    expect(box.min.y).toBeCloseTo(DESK_HEIGHT);
  });

  test('props on the near side stay low enough not to hide avatars', () => {
    const { root } = build();
    for (const name of Object.keys(expected)) {
      const box = worldBox(named(root, name));
      const nearX = box.min.x > layout.bounds.maxX - 1;
      const nearZ = box.min.z > layout.bounds.maxZ - 1;
      if (nearX || nearZ) expect(box.max.y).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('materials, budgets and disposal', () => {
  test('is matte, unshadowed and well under the draw-call and triangle budgets', () => {
    const { root } = build();
    const all = meshes(root);
    expect(all.length).toBeLessThanOrEqual(100);
    const materials = new Set<Material>(
      all.map((mesh) => mesh.material as Material),
    );
    for (const material of materials) {
      const standard = material as Material & {
        metalness: number;
        roughness: number;
      };
      expect(standard.metalness).toBe(0);
      expect(standard.roughness).toBeGreaterThanOrEqual(0.85);
      expect(standard.roughness).toBeLessThanOrEqual(1);
    }
    for (const mesh of all) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
    const triangles = all.reduce((sum, mesh) => {
      const geometry = mesh.geometry;
      const perInstance = geometry.index
        ? geometry.index.count / 3
        : geometry.attributes.position!.count / 3;
      return (
        sum + perInstance * (mesh instanceof InstancedMesh ? mesh.count : 1)
      );
    }, 0);
    expect(triangles).toBeLessThan(5000);
  });

  test('reuses geometries and materials across meshes', () => {
    const { root } = build();
    const all = meshes(root);
    expect(new Set(all.map((mesh) => mesh.geometry)).size).toBeLessThan(
      all.length / 2,
    );
    expect(new Set(all.map((mesh) => mesh.material)).size).toBeLessThan(
      all.length / 2,
    );
  });

  test('dispose releases every geometry and material exactly once', () => {
    const scene = build();
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    for (const mesh of meshes(scene.root)) {
      geometries.add(mesh.geometry);
      materials.add(mesh.material as Material);
    }
    const spies = [...geometries, ...materials].map((resource) =>
      vi.spyOn(resource, 'dispose'),
    );
    scene.dispose();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });
});
