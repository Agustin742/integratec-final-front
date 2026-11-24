import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Object3D,
} from 'three';
import type { ClassroomKitModuleId } from './classroom-kit-manifest';
import type { KitPlacement } from './kit-placement';

export interface InstancedKitModule {
  readonly group: Group;
  readonly meshes: readonly InstancedMesh[];
  /** Disposes only what the builder created (instance buffers). */
  readonly dispose: () => void;
}

export const kitGroupName = (moduleId: string): string => `kit:${moduleId}`;

const UP = new Vector3(0, 1, 0);
const UNIT_SCALE = new Vector3(1, 1, 1);

export function placementMatrix(placement: KitPlacement): Matrix4 {
  const [x, y, z] = placement.position;
  return new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(UP, placement.rotationY),
    UNIT_SCALE,
  );
}

function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh && !(node instanceof SkinnedMesh))
      meshes.push(node);
  });
  return meshes;
}

/**
 * Builds one `InstancedMesh` per source mesh of a loaded module scene. Geometry
 * and material are shared with the cached GLTF (never cloned or mutated); each
 * instance matrix is `placement * meshMatrixInScene`.
 */
export function buildInstancedKitModule(
  moduleId: ClassroomKitModuleId,
  scene: Object3D,
  placements: readonly KitPlacement[],
): InstancedKitModule {
  const group = new Group();
  group.name = kitGroupName(moduleId);
  group.userData = { kitModuleId: moduleId };
  const meshes: InstancedMesh[] = [];

  if (placements.length > 0) {
    scene.updateWorldMatrix(true, true);
    const sceneInverse = scene.matrixWorld.clone().invert();
    const placementMatrices = placements.map(placementMatrix);

    for (const source of collectMeshes(scene)) {
      const local = sceneInverse.clone().multiply(source.matrixWorld);
      const instanced = new InstancedMesh(
        source.geometry,
        source.material,
        placements.length,
      );
      instanced.name = `${kitGroupName(moduleId)}:${source.name}`;
      instanced.userData = { kitModuleId: moduleId };
      placementMatrices.forEach((matrix, index) => {
        instanced.setMatrixAt(index, matrix.clone().multiply(local));
      });
      instanced.instanceMatrix.needsUpdate = true;
      instanced.computeBoundingSphere();
      group.add(instanced);
      meshes.push(instanced);
    }
  }

  return {
    group,
    meshes,
    dispose: () => {
      for (const mesh of meshes) {
        mesh.dispose();
        mesh.removeFromParent();
      }
    },
  };
}
