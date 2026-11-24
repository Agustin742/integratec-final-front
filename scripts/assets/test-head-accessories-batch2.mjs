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

const ACCESSORIES = [
  { id: 'astronaut-helmet', pascal: 'AstronautHelmet', expectedMeshes: 4, hasGlass: true },
  { id: 'top-hat', pascal: 'TopHat', expectedMeshes: 3, hasGlass: false },
  { id: 'crown', pascal: 'Crown', expectedMeshes: 2, hasGlass: false },
  { id: 'graduation-cap', pascal: 'GraduationCap', expectedMeshes: 3, hasGlass: false },
];

for (const acc of ACCESSORIES) {
  const rel = `public/models/avatars/shared/head-${acc.id}.glb`;
  const { bytes, json: g } = glb(rel);
  assert.ok(bytes <= 1048576, `${acc.id}: budget (${bytes})`);
  assert.equal(g.animations?.length ?? 0, 0, `${acc.id}: zero animations`);
  assert.equal(g.cameras?.length ?? 0, 0, `${acc.id}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${acc.id}: zero lights`,
  );
  assert.ok(g.skins?.length > 0, `${acc.id}: skin required`);

  for (const skin of g.skins) {
    assert.deepEqual(
      skin.joints.map((i) => g.nodes[i].name).sort(),
      names,
      `${acc.id}: canonical34 joints`,
    );
    binding(g, skin).forEach((joint, i) => {
      const expected = reference[i];
      assert.equal(joint.name, expected.name);
      assert.equal(joint.parent, expected.parent);
      for (const key of ['translation', 'rotation', 'scale']) {
        close(joint[key], expected[key], `${acc.id} ${joint.name} ${key}`);
      }
      assert.equal(joint.matrix === null, expected.matrix === null);
      if (joint.matrix) {
        close(joint.matrix, expected.matrix, `${acc.id} ${joint.name} matrix`);
      }
    });
  }

  const meshes = g.nodes.filter((n) => n.mesh !== undefined);
  assert.equal(meshes.length, acc.expectedMeshes, `${acc.id}: expected ${acc.expectedMeshes} meshes`);

  for (const node of g.nodes) {
    assert.equal(node.camera, undefined);
    assert.equal(node.extensions?.KHR_lights_punctual, undefined);
  }

  const prefixRe = new RegExp(`^Head${acc.pascal}_`);
  for (const node of meshes) {
    assert.match(node.name, prefixRe, `${acc.id}: mesh name ${node.name}`);
    assert.ok(node.skin !== undefined, `${acc.id}: ${node.name} must be skinned`);
    close(node.translation ?? [0, 0, 0], [0, 0, 0], `${acc.id} mesh translation`);
    close(node.rotation ?? [0, 0, 0, 1], [0, 0, 0, 1], `${acc.id} mesh rotation`);
    close(node.scale ?? [1, 1, 1], [1, 1, 1], `${acc.id} mesh scale`);
    assert.equal(node.matrix, undefined);
    for (const primitive of g.meshes[node.mesh].primitives) {
      assert.ok(primitive.attributes.JOINTS_0 !== undefined);
      assert.ok(primitive.attributes.WEIGHTS_0 !== undefined);
      const posAccessor = g.accessors[primitive.attributes.POSITION];
      assert.ok(posAccessor?.min && posAccessor.min[1] >= 0.72, `${acc.id}: ${node.name} stray low geometry (min Y=${posAccessor?.min?.[1]})`);
      assert.ok(
        primitive.extensions?.KHR_draco_mesh_compression,
        `${acc.id}: Draco required`,
      );
    }
  }

  const expectedMatCount = acc.hasGlass ? 3 : 2;
  assert.equal(
    g.materials.length,
    expectedMatCount,
    `${acc.id}: expected ${expectedMatCount} materials`,
  );
  const tintMat = g.materials.find((m) => m.name === 'AvatarAccessoryTint');
  assert.ok(tintMat, `${acc.id}: AvatarAccessoryTint material required`);
  close(
    tintMat.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
    [1, 1, 1, 1],
    `${acc.id}: neutral accessory tint`,
  );
  const tintRough = tintMat.pbrMetallicRoughness?.roughnessFactor ?? 0.8;
  assert.ok(tintRough >= 0.4 && tintRough <= 0.95, `${acc.id}: tint roughness ${tintRough}`);
  assert.equal(tintMat.pbrMetallicRoughness?.metallicFactor ?? 0, 0, `${acc.id}: tint non-metallic`);

  const detailMat = g.materials.find((m) => m.name === 'AvatarDetail');
  assert.ok(detailMat, `${acc.id}: AvatarDetail material required`);
  const detailRough = detailMat.pbrMetallicRoughness?.roughnessFactor ?? 0.85;
  assert.ok(detailRough >= 0.75 && detailRough <= 0.95, `${acc.id}: detail roughness ${detailRough}`);
  assert.equal(detailMat.pbrMetallicRoughness?.metallicFactor ?? 0, 0, `${acc.id}: detail non-metallic`);

  if (acc.hasGlass) {
    const glassMat = g.materials.find((m) => m.name === 'AvatarGlass');
    assert.ok(glassMat, `${acc.id}: AvatarGlass material required`);
    assert.equal(glassMat.alphaMode, 'BLEND', `${acc.id}: AvatarGlass alphaMode BLEND`);
    const glassBase = glassMat.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
    assert.ok(glassBase[3] >= 0.15 && glassBase[3] <= 0.45, `${acc.id}: glass alpha ${glassBase[3]}`);
    const glassRough = glassMat.pbrMetallicRoughness?.roughnessFactor ?? 0.18;
    assert.ok(glassRough >= 0.08 && glassRough <= 0.30, `${acc.id}: glass roughness ${glassRough}`);
    assert.equal(glassMat.pbrMetallicRoughness?.metallicFactor ?? 0, 0, `${acc.id}: glass non-metallic`);
  }

  console.log(
    `PASS ${acc.id}: ${bytes} bytes, ${meshes.length} mesh(es), canonical34 hierarchy/rest, isolated skinned Draco head accessory, materials OK`,
  );
}
