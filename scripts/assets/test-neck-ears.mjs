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
const names = canonical.skins[0].joints
  .map((i) => canonical.nodes[i].name)
  .sort();
assert.equal(names.length, 34);

function binding(g, skin) {
  const parents = new Map();
  g.nodes.forEach((n, i) =>
    (n.children ?? []).forEach((c) => parents.set(c, i)),
  );
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

const NECK_EARS_ACCESSORIES = [
  { id: 'scarf', pascal: 'Scarf', expectedMeshes: 2, shared: false },
  { id: 'necklace', pascal: 'Necklace', expectedMeshes: 2, shared: false },
  { id: 'earrings', pascal: 'Earrings', expectedMeshes: 2, shared: true },
  { id: 'bow-tie', pascal: 'BowTie', expectedMeshes: 2, shared: false },
  {
    id: 'lanyard-badge',
    pascal: 'LanyardBadge',
    expectedMeshes: 2,
    shared: false,
  },
  { id: 'bandana', pascal: 'Bandana', expectedMeshes: 2, shared: false },
  {
    id: 'achievement-medal',
    pascal: 'AchievementMedal',
    expectedMeshes: 2,
    shared: false,
  },
  {
    id: 'star-earrings',
    pascal: 'StarEarrings',
    expectedMeshes: 2,
    shared: true,
  },
  { id: 'ear-cuffs', pascal: 'EarCuffs', expectedMeshes: 2, shared: true },
];

for (const acc of NECK_EARS_ACCESSORIES) {
  const targets = acc.shared
    ? [`public/models/avatars/shared/neck-${acc.id}.glb`]
    : [
        `public/models/avatars/male/neck-${acc.id}.glb`,
        `public/models/avatars/female/neck-${acc.id}.glb`,
      ];

  for (const rel of targets) {
    const { bytes, json: g } = glb(rel);
    assert.ok(bytes <= 1048576, `${rel}: budget (${bytes})`);
    assert.equal(g.animations?.length ?? 0, 0, `${rel}: zero animations`);
    assert.equal(g.cameras?.length ?? 0, 0, `${rel}: zero cameras`);
    assert.equal(
      g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
      0,
      `${rel}: zero lights`,
    );
    assert.ok(g.skins?.length > 0, `${rel}: skin required`);

    for (const skin of g.skins) {
      assert.deepEqual(
        skin.joints.map((i) => g.nodes[i].name).sort(),
        names,
        `${rel}: canonical34 joints`,
      );
      binding(g, skin).forEach((joint, i) => {
        const expected = reference[i];
        assert.equal(joint.name, expected.name);
        assert.equal(joint.parent, expected.parent);
        for (const key of ['translation', 'rotation', 'scale']) {
          close(joint[key], expected[key], `${rel} ${joint.name} ${key}`);
        }
        assert.equal(joint.matrix === null, expected.matrix === null);
        if (joint.matrix) {
          close(joint.matrix, expected.matrix, `${rel} ${joint.name} matrix`);
        }
      });
    }

    const meshes = g.nodes.filter((n) => n.mesh !== undefined);
    assert.equal(
      meshes.length,
      acc.expectedMeshes,
      `${rel}: expected ${acc.expectedMeshes} meshes`,
    );

    for (const node of g.nodes) {
      assert.equal(node.camera, undefined);
      assert.equal(node.extensions?.KHR_lights_punctual, undefined);
    }

    const prefixRe = new RegExp(`^Neck${acc.pascal}_`);
    for (const node of meshes) {
      assert.match(node.name, prefixRe, `${rel}: mesh name ${node.name}`);
      assert.ok(
        node.skin !== undefined,
        `${rel}: ${node.name} must be skinned`,
      );
      close(
        node.translation ?? [0, 0, 0],
        [0, 0, 0],
        `${rel} mesh translation`,
      );
      close(
        node.rotation ?? [0, 0, 0, 1],
        [0, 0, 0, 1],
        `${rel} mesh rotation`,
      );
      close(node.scale ?? [1, 1, 1], [1, 1, 1], `${rel} mesh scale`);
      assert.equal(node.matrix, undefined);
      for (const primitive of g.meshes[node.mesh].primitives) {
        assert.ok(primitive.attributes.JOINTS_0 !== undefined);
        assert.ok(primitive.attributes.WEIGHTS_0 !== undefined);
        const posAccessor = g.accessors[primitive.attributes.POSITION];
        assert.ok(
          posAccessor?.min && posAccessor.min[1] >= 0.45,
          `${rel}: ${node.name} stray low geometry (min Y=${posAccessor?.min?.[1]})`,
        );
        assert.ok(
          primitive.extensions?.KHR_draco_mesh_compression,
          `${rel}: Draco required`,
        );
      }
    }

    assert.equal(
      g.materials.length,
      2,
      `${rel}: expected 2 materials (AvatarAccessoryTint + AvatarDetail)`,
    );
    const tintMat = g.materials.find((m) => m.name === 'AvatarAccessoryTint');
    assert.ok(tintMat, `${rel}: AvatarAccessoryTint material required`);
    close(
      tintMat.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1],
      [1, 1, 1, 1],
      `${rel}: neutral accessory tint`,
    );
    const tintRough = tintMat.pbrMetallicRoughness?.roughnessFactor ?? 0.78;
    assert.ok(
      tintRough >= 0.4 && tintRough <= 0.95,
      `${rel}: tint roughness ${tintRough}`,
    );
    assert.equal(
      tintMat.pbrMetallicRoughness?.metallicFactor ?? 0,
      0,
      `${rel}: tint non-metallic`,
    );

    const detailMat = g.materials.find((m) => m.name === 'AvatarDetail');
    assert.ok(detailMat, `${rel}: AvatarDetail material required`);
    const detailRough = detailMat.pbrMetallicRoughness?.roughnessFactor ?? 0.78;
    assert.ok(
      detailRough >= 0.4 && detailRough <= 0.95,
      `${rel}: detail roughness ${detailRough}`,
    );
    assert.equal(
      detailMat.pbrMetallicRoughness?.metallicFactor ?? 0,
      0,
      `${rel}: detail non-metallic`,
    );

    console.log(
      `PASS ${rel}: ${bytes} bytes, ${meshes.length} mesh(es), canonical34 hierarchy/rest, isolated skinned Draco neck/ear accessory`,
    );
  }
}
