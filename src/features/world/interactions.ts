import { Group, Mesh, type Object3D, type Raycaster } from 'three';

export interface WorldIntent {
  type: 'select';
  targetId: string;
}

export function selectionIntent(
  object: Object3D,
  roots: ReadonlyMap<Object3D, string>,
): WorldIntent | undefined {
  for (
    let current: Object3D | null = object;
    current;
    current = current.parent
  ) {
    const targetId = roots.get(current);
    if (targetId && (current instanceof Mesh || current instanceof Group)) {
      return { type: 'select', targetId };
    }
  }
  return undefined;
}

export function raycastInteractables(
  raycaster: Raycaster,
  roots: ReadonlyMap<Object3D, string>,
): WorldIntent | undefined {
  const interactive = [...roots.keys()].filter(
    (object) => object instanceof Mesh || object instanceof Group,
  );
  for (const hit of raycaster.intersectObjects(interactive, true)) {
    const intent = selectionIntent(hit.object, roots);
    if (intent) return intent;
  }
  return undefined;
}
