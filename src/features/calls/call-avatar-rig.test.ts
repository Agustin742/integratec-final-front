import { BufferGeometry, Group, Bone, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createAvatarRig } from './call-avatar-rig';

function build() {
  const root = new Group();
  const chest = new Bone();
  chest.name = 'DEF-spine.003';
  const neck = new Bone();
  neck.name = 'DEF-spine.005';
  const head = new Bone();
  head.name = 'DEF-spine.006';
  root.add(chest, neck, head);
  const face = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  face.morphTargetDictionary = { Blink: 0, Happy: 1, Sad: 2, Angry: 3 };
  face.morphTargetInfluences = [0, 0, 0, 0];
  root.add(face);
  return { root, chest, head, face };
}

describe('createAvatarRig', () => {
  it('breathes by scaling the chest only while animated', () => {
    const { root, chest } = build();
    const rig = createAvatarRig(root);
    rig.update({ dt: 0.5, level: 0, animated: true, blink: 0 });
    expect(chest.scale.y).not.toBe(1);
    expect(Math.abs(chest.scale.y - 1)).toBeLessThan(0.03);
    rig.update({ dt: 0.5, level: 0, animated: false, blink: 0 });
    expect(chest.scale.y).toBe(1);
  });

  it('nods the head with the voice level', () => {
    const { root, head } = build();
    const rig = createAvatarRig(root);
    rig.update({ dt: 0.1, level: 0, animated: true, blink: 0 });
    expect(head.quaternion.angleTo(new Group().quaternion)).toBe(0);
    rig.update({ dt: 0.1, level: 1, animated: true, blink: 0 });
    expect(head.quaternion.angleTo(new Group().quaternion)).toBeGreaterThan(0);
  });

  it('does not nod when not animated', () => {
    const { root, head } = build();
    const rig = createAvatarRig(root);
    rig.update({ dt: 0.1, level: 1, animated: false, blink: 0 });
    expect(head.quaternion.angleTo(new Group().quaternion)).toBe(0);
  });

  it('drives the Blink morph', () => {
    const { root, face } = build();
    const rig = createAvatarRig(root);
    rig.update({ dt: 0.016, level: 0, animated: true, blink: 0.8 });
    expect(face.morphTargetInfluences?.[0]).toBeCloseTo(0.8);
  });

  it('eases an expression morph in and back out', () => {
    const { root, face } = build();
    const rig = createAvatarRig(root);
    rig.setExpression('Happy');
    rig.update({ dt: 0.05, level: 0, animated: false, blink: 0 });
    const early = face.morphTargetInfluences?.[1] ?? 0;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(1);
    for (let i = 0; i < 60; i += 1)
      rig.update({ dt: 0.05, level: 0, animated: false, blink: 0 });
    expect(face.morphTargetInfluences?.[1]).toBeCloseTo(1, 1);
    rig.setExpression(null);
    for (let i = 0; i < 60; i += 1)
      rig.update({ dt: 0.05, level: 0, animated: false, blink: 0 });
    expect(face.morphTargetInfluences?.[1]).toBeCloseTo(0, 1);
  });

  it('tolerates a rig without the expected bones or morphs', () => {
    const rig = createAvatarRig(new Group());
    expect(() => {
      rig.setExpression('Sad');
      rig.update({ dt: 0.1, level: 1, animated: true, blink: 1 });
    }).not.toThrow();
  });
});
