import {
  AnimationClip,
  AnimationMixer,
  Bone,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { composeAvatar, type AvatarPartKind } from './compose-avatar';

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

/** A face mesh shipped, like the body GLBs, with the Sad morph switched on. */
function makeSadBody() {
  const body = makeRig(BONES, 'skin', 'eyes');
  body.mesh.morphTargetDictionary = { Blink: 0, Happy: 1, Sad: 2, Angry: 3 };
  body.mesh.morphTargetInfluences = [0, 0, 0.72, 0];
  return body;
}

describe('resting face', () => {
  it('is neutral by default, leaving the cached body untouched', () => {
    const body = makeSadBody();

    const avatar = composeAvatar({ body: body.scene });
    const [face] = skinnedMeshes(avatar.root);

    expect(face!.morphTargetInfluences).toEqual([0, 0, 0, 0]);
    expect(body.mesh.morphTargetInfluences).toEqual([0, 0, 0.72, 0]);
  });

  it('can be slightly happy', () => {
    const avatar = composeAvatar({ body: makeSadBody().scene, face: 'happy' });
    const [blink, happy, sad, angry] = skinnedMeshes(avatar.root)[0]!
      .morphTargetInfluences!;

    expect([blink, sad, angry]).toEqual([0, 0, 0]);
    expect(happy).toBeGreaterThan(0);
    expect(happy).toBeLessThan(0.7);
  });

  it('still plays a facial clip and returns to rest when it stops', () => {
    const avatar = composeAvatar({ body: makeSadBody().scene });
    const [face] = skinnedMeshes(avatar.root);
    const mixer = new AnimationMixer(avatar.root);
    const action = mixer.clipAction(
      new AnimationClip('Sad', 1, [
        new NumberKeyframeTrack(
          'eyes.morphTargetInfluences',
          [0, 1],
          [0, 0, 0.9, 0, 0, 0, 0.9, 0],
        ),
      ]),
    );

    action.play();
    mixer.update(0.5);
    expect(face!.morphTargetInfluences![2]).toBeCloseTo(0.9);

    mixer.stopAllAction();
    expect(face!.morphTargetInfluences).toEqual([0, 0, 0, 0]);
  });
});

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

  describe('generic parts', () => {
    const attach = (key: AvatarPartKind, rig: Rig, extra = {}) => ({
      key,
      scene: rig.scene,
      ...extra,
    });

    it('composes any number of parts in order', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const head = makeRig(BONES, 'AvatarAccessoryTint', 'Cap');
      const face = makeRig(BONES, 'AvatarDetail', 'Mask');
      const back = makeRig([...BONES, 'tail'], 'AvatarDetail', 'Pack');

      const avatar = composeAvatar({
        body: body.scene,
        parts: [
          attach('head', head),
          attach('face', face),
          attach('back', back),
        ],
      });

      expect(skinnedMeshes(avatar.root).map((mesh) => mesh.name)).toEqual([
        'Body',
        'Cap',
        'Mask',
      ]);
      expect(avatar.skippedParts).toEqual(['back']);
    });

    it('tints each material by name and never mutates the source', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const head = makeRig(BONES, 'AvatarAccessoryTint', 'Cap');
      const avatar = composeAvatar({
        body: body.scene,
        parts: [
          attach('head', head, {
            tints: { AvatarAccessoryTint: '#00FF00', Unrelated: '#123456' },
          }),
        ],
      });
      const cap = skinnedMeshes(avatar.root)[1];

      expect(cap.material).not.toBe(head.material);
      expect(colorOf(cap.material)).toBe('#00FF00');
      expect(colorOf(head.material)).toBe('#FFFFFF');
    });

    it('ignores an invalid tint value', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const head = makeRig(BONES, 'AvatarAccessoryTint', 'Cap');
      const avatar = composeAvatar({
        body: body.scene,
        parts: [
          attach('head', head, { tints: { AvatarAccessoryTint: 'red' } }),
        ],
      });

      expect(skinnedMeshes(avatar.root)[1].material).toBe(head.material);
    });

    it('hides named meshes and their subtree on the clone only', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const head = makeRig(BONES, 'AvatarAccessoryTint', 'Cap');
      const group = new Group();
      group.name = 'Visor';
      const lens = new Mesh(new BufferGeometry(), new MeshStandardMaterial());
      lens.name = 'VisorLens';
      group.add(lens);
      head.scene.add(group);
      head.scene.updateMatrixWorld(true);

      const avatar = composeAvatar({
        body: body.scene,
        parts: [attach('head', head, { hiddenMeshes: ['Cap', 'Visor'] })],
      });
      const visible = new Map<string, boolean>();
      avatar.root.traverse((node) => visible.set(node.name, node.visible));

      expect(visible.get('Cap')).toBe(false);
      expect(visible.get('VisorLens')).toBe(false);
      expect(visible.get('Body')).toBe(true);
      expect(head.mesh.visible).toBe(true);
      expect(lens.visible).toBe(true);
    });

    it('sets morph influences by name on the clone and ignores missing ones', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const back = makeRig(BONES, 'AvatarDetail', 'Pack');
      back.mesh.morphTargetDictionary = { BackTuck: 1 };
      back.mesh.morphTargetInfluences = [0, 0];

      const avatar = composeAvatar({
        body: body.scene,
        parts: [attach('back', back, { morphs: { BackTuck: 1, Missing: 1 } })],
      });
      const pack = skinnedMeshes(avatar.root)[1];

      expect(pack.morphTargetInfluences).toEqual([0, 1]);
      expect(back.mesh.morphTargetInfluences).toEqual([0, 0]);
    });

    it('draws AvatarGlass translucent, without depth writes, after opaque parts', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const face = makeRig(BONES, 'AvatarGlass', 'Lenses');
      const avatar = composeAvatar({
        body: body.scene,
        parts: [attach('face', face)],
      });
      const [bodyMesh, lenses] = skinnedMeshes(avatar.root);
      const material = lenses.material as MeshStandardMaterial;

      expect(material).not.toBe(face.material);
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(lenses.renderOrder).toBeGreaterThan(bodyMesh.renderOrder);
      expect(face.material.transparent).toBe(false);
      expect(face.material.depthWrite).toBe(true);
      expect(face.mesh.renderOrder).toBe(0);
    });

    it('disposes every cloned material, including glass', () => {
      const body = makeRig(BONES, 'skin', 'Body');
      const head = makeRig(BONES, 'AvatarAccessoryTint', 'Cap');
      const face = makeRig(BONES, 'AvatarGlass', 'Lenses');
      const avatar = composeAvatar({
        body: body.scene,
        parts: [
          attach('head', head, { tints: { AvatarAccessoryTint: '#00FF00' } }),
          attach('face', face),
        ],
      });
      const [, cap, lenses] = skinnedMeshes(avatar.root);
      const spies = [cap, lenses].map((mesh) =>
        vi.spyOn(mesh.material as MeshStandardMaterial, 'dispose'),
      );
      const shared = [head.material, face.material].map((material) =>
        vi.spyOn(material, 'dispose'),
      );

      avatar.dispose();

      spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
      shared.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    });
  });
});
