import {
  Bone,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { composeAvatar } from './compose-avatar';

interface Rig {
  readonly scene: Group;
  readonly mesh: SkinnedMesh;
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardMaterial;
}

/** Synthetic GLTF scene: a bone chain plus one skinned mesh (no WebGL). */
function makeRig(
  boneNames: readonly string[],
  materialName: string,
  meshName: string,
  skeletonOrder: readonly string[] = boneNames,
): Rig {
  const scene = new Group();
  const bones = boneNames.map((name, index) => {
    const bone = new Bone();
    bone.name = name;
    bone.position.set(0, index, 0);
    return bone;
  });
  bones.forEach((bone, index) => {
    if (index > 0) bones[index - 1].add(bone);
  });
  const geometry = new BufferGeometry();
  const material = new MeshStandardMaterial({
    name: materialName,
    color: '#ffffff',
  });
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = meshName;
  scene.add(bones[0], mesh);
  scene.updateMatrixWorld(true);
  const ordered = skeletonOrder.map(
    (name) => bones.find((bone) => bone.name === name) as Bone,
  );
  mesh.bind(new Skeleton(ordered));
  return { scene, mesh, geometry, material };
}

const BONES = ['root', 'spine', 'head'] as const;
const colorOf = (material: unknown) =>
  `#${(material as MeshStandardMaterial).color.getHexString().toUpperCase()}`;

function skinnedMeshes(root: Object3D): SkinnedMesh[] {
  const found: SkinnedMesh[] = [];
  root.traverse((node) => {
    if (node instanceof SkinnedMesh) found.push(node);
  });
  return found;
}

describe('composeAvatar', () => {
  it('re-binds a part to the body clone bones by name', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    // Same bones, different joint order in the part skeleton.
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair', [
      'head',
      'root',
      'spine',
    ]);

    const avatar = composeAvatar({ body: body.scene, hair: hair.scene });
    const [bodyMesh, hairMesh] = skinnedMeshes(avatar.root);

    expect(avatar.skippedParts).toEqual([]);
    expect(hairMesh.name).toBe('Hair');
    expect(hairMesh.parent).toBe(avatar.root);
    expect(hairMesh.skeleton).not.toBe(hair.mesh.skeleton);
    expect(hairMesh.skeleton.bones.map((bone) => bone.name)).toEqual([
      'head',
      'root',
      'spine',
    ]);
    hairMesh.skeleton.bones.forEach((bone) => {
      const bodyBone = bodyMesh.skeleton.bones.find(
        (candidate) => candidate.name === bone.name,
      );
      expect(bone).toBe(bodyBone);
      expect(body.mesh.skeleton.bones).not.toContain(bone);
    });
    expect(hairMesh.skeleton.boneInverses).toHaveLength(3);
    // Inverses stay in the part's own joint order.
    expect(
      hairMesh.skeleton.boneInverses[0].equals(
        hair.mesh.skeleton.boneInverses[0],
      ),
    ).toBe(true);
  });

  it('moves a part when the body bones move', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const avatar = composeAvatar({ body: body.scene, hair: hair.scene });
    const [bodyMesh, hairMesh] = skinnedMeshes(avatar.root);

    bodyMesh.skeleton.bones[0].position.x = 7;
    avatar.root.updateMatrixWorld(true);
    hairMesh.skeleton.update();

    // boneMatrices[12] is the x translation of joint 0.
    expect(hairMesh.skeleton.boneMatrices[12]).toBeCloseTo(7);
  });

  it('skips a part whose bone is missing from the body', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const top = makeRig([...BONES, 'tail'], 'AvatarTopTint', 'Top');

    const avatar = composeAvatar({ body: body.scene, top: top.scene });

    expect(avatar.skippedParts).toEqual(['top']);
    expect(skinnedMeshes(avatar.root)).toHaveLength(1);
  });

  it('tints cloned materials and leaves the cached source untouched', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const top = makeRig(BONES, 'AvatarTopTint', 'Top');

    const avatar = composeAvatar({
      body: body.scene,
      hair: hair.scene,
      top: top.scene,
      hairColor: '#FF0000',
      clothingColor: '#0000FF',
    });
    const [, hairMesh, topMesh] = skinnedMeshes(avatar.root);

    expect(hairMesh.material).not.toBe(hair.material);
    expect(colorOf(hairMesh.material)).toBe('#FF0000');
    expect(colorOf(topMesh.material)).toBe('#0000FF');
    expect(colorOf(hair.material)).toBe('#FFFFFF');
    expect(colorOf(top.material)).toBe('#FFFFFF');
    expect(hairMesh.geometry).toBe(hair.geometry);
  });

  it('gives each instance independent materials', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const red = composeAvatar({
      body: body.scene,
      hair: hair.scene,
      hairColor: '#FF0000',
    });
    const green = composeAvatar({
      body: body.scene,
      hair: hair.scene,
      hairColor: '#00FF00',
    });
    const redHair = skinnedMeshes(red.root)[1].material;
    const greenHair = skinnedMeshes(green.root)[1].material;

    expect(redHair).not.toBe(greenHair);
    expect(colorOf(redHair)).toBe('#FF0000');
    expect(colorOf(greenHair)).toBe('#00FF00');
  });

  it('does not touch materials that are not tint targets', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const avatar = composeAvatar({ body: body.scene, hairColor: '#FF0000' });
    expect(skinnedMeshes(avatar.root)[0].material).toBe(body.material);
  });

  it('carries a static mesh of a part with its authored placement', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const band = new Mesh(
      new BufferGeometry(),
      new MeshStandardMaterial({ name: 'AvatarHairTint' }),
    );
    band.position.set(0, 3, 0);
    hair.scene.add(band);
    hair.scene.updateMatrixWorld(true);

    const avatar = composeAvatar({
      body: body.scene,
      hair: hair.scene,
      hairColor: '#FF0000',
    });
    const statics: Mesh[] = [];
    avatar.root.traverse((node) => {
      if (node instanceof Mesh && !(node instanceof SkinnedMesh))
        statics.push(node);
    });

    expect(avatar.skippedParts).toEqual([]);
    expect(statics).toHaveLength(1);
    expect(statics[0].parent).toBe(avatar.root);
    expect(statics[0].position.y).toBeCloseTo(3);
    expect(colorOf(statics[0].material)).toBe('#FF0000');
  });

  it('keeps a nested part mesh at its authored world placement', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const wrapper = new Group();
    wrapper.position.set(2, 1, 0);
    hair.scene.add(wrapper);
    hair.mesh.position.set(3, 0, 0);
    wrapper.add(hair.mesh);
    hair.scene.updateMatrixWorld(true);

    const avatar = composeAvatar({ body: body.scene, hair: hair.scene });
    const hairMesh = skinnedMeshes(avatar.root)[1];

    expect(hairMesh.parent).toBe(avatar.root);
    avatar.root.updateMatrixWorld(true);
    expect(hairMesh.matrixWorld.elements[12]).toBeCloseTo(5);
    expect(hairMesh.matrixWorld.elements[13]).toBeCloseTo(1);
  });

  it('carries a part that has only static meshes', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const scene = new Group();
    const hat = new Mesh(
      new BufferGeometry(),
      new MeshStandardMaterial({ name: 'AvatarHairTint' }),
    );
    scene.add(hat);
    scene.updateMatrixWorld(true);

    const avatar = composeAvatar({ body: body.scene, hair: scene });
    const statics: Mesh[] = [];
    avatar.root.traverse((node) => {
      if (node instanceof Mesh && !(node instanceof SkinnedMesh))
        statics.push(node);
    });

    expect(avatar.skippedParts).toEqual([]);
    expect(statics).toHaveLength(1);
    expect(statics[0].parent).toBe(avatar.root);
  });

  it('disposes only what the instance created', () => {
    const body = makeRig(BONES, 'skin', 'Body');
    const hair = makeRig(BONES, 'AvatarHairTint', 'Hair');
    const avatar = composeAvatar({ body: body.scene, hair: hair.scene });
    const [bodyMesh, hairMesh] = skinnedMeshes(avatar.root);

    const shared = [
      vi.spyOn(body.material, 'dispose'),
      vi.spyOn(hair.material, 'dispose'),
      vi.spyOn(hair.geometry, 'dispose'),
      vi.spyOn(body.geometry, 'dispose'),
      vi.spyOn(hair.mesh.skeleton, 'dispose'),
      vi.spyOn(body.mesh.skeleton, 'dispose'),
    ];
    const cloneDispose = vi.spyOn(
      hairMesh.material as MeshStandardMaterial,
      'dispose',
    );
    const hairSkeletonDispose = vi.spyOn(hairMesh.skeleton, 'dispose');
    const bodySkeletonDispose = vi.spyOn(bodyMesh.skeleton, 'dispose');
    const geometryDispose = vi.spyOn(hairMesh.geometry, 'dispose');

    avatar.dispose();

    expect(cloneDispose).toHaveBeenCalledTimes(1);
    expect(hairSkeletonDispose).toHaveBeenCalledTimes(1);
    expect(bodySkeletonDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).not.toHaveBeenCalled();
    shared.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
});
