import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);

function glb(path) {
  const b = fs.readFileSync(new URL(path, root));
  assert.equal(b.readUInt32LE(0), 0x46546c67, `${path}: magic`);
  assert.equal(b.readUInt32LE(4), 2, `${path}: version`);
  assert.equal(b.readUInt32LE(8), b.length, `${path}: byteLength`);
  return {
    bytes: b.length,
    json: JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()),
  };
}

const canonical = glb('public/models/avatars/male/body.glb').json;
const names = canonical.skins[0].joints.map((i) => canonical.nodes[i].name).sort();
assert.equal(names.length, 34);

function binding(g, skin) {
  const parents = new Map();
  g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => parents.set(c, i)));
  return skin.joints
    .map((i) => {
      const n = g.nodes[i];
      return {
        name: n.name,
        parent: g.nodes[parents.get(i)]?.name ?? null,
        translation: n.translation ?? [0, 0, 0],
        rotation: n.rotation ?? [0, 0, 0, 1],
        scale: n.scale ?? [1, 1, 1],
        matrix: n.matrix ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

const reference = binding(canonical, canonical.skins[0]);

function close(a, b, label) {
  assert.equal(a.length, b.length, label);
  a.forEach((v, i) =>
    assert.ok(Math.abs(v - b[i]) < 1e-4, `${label}[${i}]: ${v} != ${b[i]}`),
  );
}

const STYLES = [
  { id: 'long-straight', pascal: 'LongStraight' },
  { id: 'long-wavy', pascal: 'LongWavy' },
  { id: 'long-curls', pascal: 'LongCurls' },
];

for (const style of STYLES) {
  const rel = `public/models/avatars/shared/hair-${style.id}.glb`;
  const { bytes, json: g } = glb(rel);
  assert.ok(bytes <= 1048576, `${style.id}: budget (${bytes})`);
  assert.equal(g.animations?.length ?? 0, 0, `${style.id}: zero animations`);
  assert.equal(g.cameras?.length ?? 0, 0, `${style.id}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${style.id}: zero lights`,
  );
  assert.ok(g.skins?.length > 0, `${style.id}: skin required`);

  for (const skin of g.skins) {
    assert.deepEqual(
      skin.joints.map((i) => g.nodes[i].name).sort(),
      names,
      `${style.id}: canonical34 joints`,
    );
    binding(g, skin).forEach((joint, i) => {
      const expected = reference[i];
      assert.equal(joint.name, expected.name);
      assert.equal(joint.parent, expected.parent);
      for (const key of ['translation', 'rotation', 'scale']) {
        close(joint[key], expected[key], `${style.id} ${joint.name} ${key}`);
      }
      assert.equal(joint.matrix === null, expected.matrix === null);
      if (joint.matrix) {
        close(joint.matrix, expected.matrix, `${style.id} ${joint.name} matrix`);
      }
    });
  }

  const meshes = g.nodes.filter((n) => n.mesh !== undefined);
  assert.ok(meshes.length > 0, `${style.id}: at least one mesh`);

  for (const node of g.nodes) {
    assert.equal(node.camera, undefined);
    assert.equal(node.extensions?.KHR_lights_punctual, undefined);
  }

  const prefixRe = new RegExp(`^Hair${style.pascal}_`);
  for (const node of meshes) {
    assert.match(node.name, prefixRe, `${style.id}: mesh name ${node.name}`);
    assert.ok(node.skin !== undefined, `${style.id}: ${node.name} must be skinned`);
    close(node.translation ?? [0, 0, 0], [0, 0, 0], `${style.id} mesh translation`);
    close(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1], `${style.id} mesh rotation`);
    close(node.scale ?? [1, 1, 1], [1, 1, 1], `${style.id} mesh scale`);
    assert.equal(node.matrix, undefined);
    for (const primitive of g.meshes[node.mesh].primitives) {
      assert.ok(primitive.attributes.JOINTS_0 !== undefined);
      assert.ok(primitive.attributes.WEIGHTS_0 !== undefined);
      assert.ok(
        primitive.extensions?.KHR_draco_mesh_compression,
        `${style.id}: Draco required`,
      );
    }
  }

  assert.equal(g.materials.length, 1, `${style.id}: single AvatarHairTint material`);
  const mat = g.materials[0];
  assert.equal(mat.name, 'AvatarHairTint', `${style.id}: material name`);
  close(
    mat.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
    [1, 1, 1, 1],
    `${style.id}: neutral tint`,
  );
  const rough = mat.pbrMetallicRoughness?.roughnessFactor ?? 0.65;
  assert.ok(rough >= 0.55 && rough <= 0.8, `${style.id}: roughness ${rough}`);

  console.log(
    `PASS ${style.id}: ${bytes} bytes, ${meshes.length} mesh(es), canonical34 hierarchy/rest, isolated skinned Draco hair, neutral AvatarHairTint`,
  );
}
