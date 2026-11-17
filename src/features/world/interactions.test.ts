import { expect, test, vi } from 'vitest';
import { Group, Mesh, Object3D, Raycaster } from 'three';
import { raycastInteractables, selectionIntent } from './interactions';

test('reports a typed intent only from explicit mesh/group ancestry', () => {
  const root = new Group();
  const mesh = new Mesh();
  root.add(mesh);
  expect(selectionIntent(mesh, new Map([[root, 'reference']]))).toEqual({
    type: 'select',
    targetId: 'reference',
  });
});
test('ignores decoration, unregistered userData and non-mesh/group roots', () => {
  const object = new Object3D();
  object.userData.targetId = 'forged';
  expect(selectionIntent(object, new Map())).toBeUndefined();
  expect(
    selectionIntent(object, new Map([[object, 'forged']])),
  ).toBeUndefined();
});
test('raycasts only registered interactive roots and their descendants', () => {
  const root = new Group();
  const mesh = new Mesh();
  root.add(mesh);
  const raycaster = new Raycaster();
  const intersect = vi
    .spyOn(raycaster, 'intersectObjects')
    .mockReturnValue([{ distance: 1, point: mesh.position, object: mesh }]);
  expect(
    raycastInteractables(raycaster, new Map([[root, 'reference']])),
  ).toEqual({ type: 'select', targetId: 'reference' });
  expect(intersect).toHaveBeenCalledWith([root], true);
});
