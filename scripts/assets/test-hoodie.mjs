import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../../', import.meta.url);
function glb(path) {
  const b = fs.readFileSync(new URL(path, root));
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  assert.equal(b.readUInt32LE(4), 2);
  assert.equal(b.readUInt32LE(8), b.length);
  return { bytes: b.length, json: JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) };
}
const canonical = glb('public/models/avatars/male/body.glb').json;
const names = canonical.skins[0].joints.map(i => canonical.nodes[i].name).sort();
assert.equal(names.length, 34);
function binding(g, skin) {
  const parents = new Map();
  g.nodes.forEach((n, i) => (n.children ?? []).forEach(c => parents.set(c, i)));
  return skin.joints.map(i => {
    const n = g.nodes[i];
    return { name: n.name, parent: g.nodes[parents.get(i)]?.name ?? null,
      translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1],
      scale: n.scale ?? [1, 1, 1], matrix: n.matrix ?? null };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
const reference = binding(canonical, canonical.skins[0]);
function close(a, b, label) {
  assert.equal(a.length, b.length, label);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-4, `${label}[${i}]: ${v} != ${b[i]}`));
}
for (const gender of ['male', 'female']) {
  const { bytes, json: g } = glb(`public/models/avatars/${gender}/top-hoodie.glb`);
  assert.ok(bytes <= 1048576, `${gender}: budget`);
  assert.equal(g.animations?.length ?? 0, 0);
  assert.equal(g.cameras?.length ?? 0, 0);
  assert.equal(g.extensions?.KHR_lights_punctual?.lights?.length ?? 0, 0);
  assert.ok(g.skins?.length > 0);
  for (const skin of g.skins) {
    assert.deepEqual(skin.joints.map(i => g.nodes[i].name).sort(), names);
    binding(g, skin).forEach((joint, i) => {
      const expected = reference[i];
      assert.equal(joint.name, expected.name);
      assert.equal(joint.parent, expected.parent);
      for (const key of ['translation', 'rotation', 'scale']) close(joint[key], expected[key], `${joint.name} ${key}`);
      assert.equal(joint.matrix === null, expected.matrix === null);
      if (joint.matrix) close(joint.matrix, expected.matrix, `${joint.name} matrix`);
    });
  }
  const meshes = g.nodes.filter(n => n.mesh !== undefined);
  assert.ok(meshes.length > 0);
  for (const node of g.nodes) {
    assert.equal(node.camera, undefined);
    assert.equal(node.extensions?.KHR_lights_punctual, undefined);
  }
  for (const node of meshes) {
    assert.match(node.name, /^Hoodie_/);
    assert.ok(node.skin !== undefined);
    close(node.translation ?? [0, 0, 0], [0, 0, 0], 'mesh translation');
    close(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1], 'mesh rotation');
    close(node.scale ?? [1, 1, 1], [1, 1, 1], 'mesh scale');
    assert.equal(node.matrix, undefined);
    for (const primitive of g.meshes[node.mesh].primitives) {
      assert.ok(primitive.attributes.JOINTS_0 !== undefined);
      assert.ok(primitive.attributes.WEIGHTS_0 !== undefined);
      assert.ok(primitive.extensions?.KHR_draco_mesh_compression, 'Draco required');
    }
  }
  assert.ok(g.materials.some(m => m.name === 'AvatarTopTint'));
  for (const m of g.materials) assert.match(m.name, /^Avatar(TopTint|Detail)$/);
  for (const m of g.materials.filter(m => m.name === 'AvatarTopTint')) {
    close(m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1], [1, 1, 1, 1], 'neutral tint');
  }
  console.log(`PASS ${gender}: ${bytes} bytes, canonical34 hierarchy/rest, isolated skinned Draco garment, zero clips`);
}
