import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial } from 'three';
import { CLASSROOM_LAYOUT } from '@/realtime';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  resolveInteractableHit,
} from './classroom-interactables';
import { buildClassroomScene } from './build-classroom-scene';

describe('classroom asset recovery', () => {
  it('reveals only failed essential proxies and preserves picking identity', () => {
    const scene = buildClassroomScene(CLASSROOM_LAYOUT);
    const floor = scene.root.getObjectByName('walkable-floor') as Mesh;
    const desks = scene.root.getObjectByName('student-desks') as Mesh;
    const teacher = scene.root.getObjectByName('teacher-desk') as Mesh;
    scene.setFailedModules(new Set(['floor-tile', 'student-desk']));
    expect((floor.material as MeshStandardMaterial).visible).toBe(true);
    expect((desks.material as MeshStandardMaterial).visible).toBe(true);
    expect((teacher.material as MeshStandardMaterial).visible).toBe(false);
    expect(floor.userData.walkableFloor).toBe(true);
    scene.setFailedModules(new Set());
    expect((floor.material as MeshStandardMaterial).visible).toBe(false);
    expect((desks.material as MeshStandardMaterial).visible).toBe(false);
    const interactables = indexClassroomInteractables(
      deriveClassroomInteractables(CLASSROOM_LAYOUT),
    );
    expect(
      resolveInteractableHit(
        [{ object: scene.root.getObjectByName('desk-legs')!, instanceId: 0 }],
        interactables,
      )?.id,
    ).toBe('student-desk:1');
    expect(
      resolveInteractableHit(
        [
          {
            object: scene.root.getObjectByName('teacher-desk-legs')!,
            instanceId: 0,
          },
        ],
        interactables,
      )?.id,
    ).toBe('teacher-desk');
    scene.dispose();
  });
});
