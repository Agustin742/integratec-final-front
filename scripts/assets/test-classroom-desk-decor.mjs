import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);

function readGlb(relPath) {
  const bytes = fs.readFileSync(new URL(relPath, root));
  assert.equal(
    bytes.readUInt32LE(0),
    0x46546c67,
    `${relPath}: valid glTF magic`,
  );
  assert.equal(bytes.readUInt32LE(4), 2, `${relPath}: glTF v2`);
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.length,
    `${relPath}: exact byteLength`,
  );
  const jsonLen = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${relPath}: JSON chunk`);
  return {
    bytes: bytes.length,
    json: JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8')),
  };
}

function closeVec(a, b, label, eps = 1e-3) {
  assert.equal(a.length, b.length, label);
  a.forEach((v, i) =>
    assert.ok(Math.abs(v - b[i]) <= eps, `${label}[${i}]: ${v} != ${b[i]}`),
  );
}

function unionGltfBounds(g) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of g.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const pos = g.accessors?.[prim.attributes?.POSITION];
      assert.ok(pos?.min && pos?.max, 'POSITION accessor bounds required');
      for (let i = 0; i < 3; i += 1) {
        min[i] = Math.min(min[i], pos.min[i]);
        max[i] = Math.max(max[i], pos.max[i]);
      }
    }
  }
  return { min, max };
}

const MODULE_SPECS = [
  {
    id: 'plant',
    prefix: 'ShopPlant_',
    expectedMeshes: 9,
    expectedMaterials: [
      'ShopButter',
      'ShopCreamPale',
      'ShopDeepGreen',
      'ShopGrassGreen',
      'ShopLeafGreen',
      'ShopPeach',
      'ShopSlateDark',
      'ShopTerracotta',
      'ShopTurquoise',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.09 && b.max[0] <= 0.09,
        'plant ~0.15m X diameter',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'plant grounded Y=0');
      assert.ok(b.max[1] >= 0.17 && b.max[1] <= 0.21, 'plant height ~0.187m');
      assert.ok(b.min[2] >= -0.09 && b.max[2] <= 0.09, 'plant ~0.15m Z depth');
    },
  },
  {
    id: 'lamp',
    prefix: 'ShopLamp_',
    expectedMeshes: 6,
    expectedMaterials: [
      'ShopBulbWarm',
      'ShopButter',
      'ShopCoral',
      'ShopCreamPale',
      'ShopSlateDark',
      'ShopWood',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.09 && b.max[0] <= 0.09, 'lamp ~0.16m X span');
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'lamp grounded Y=0');
      assert.ok(b.max[1] >= 0.28 && b.max[1] <= 0.33, 'lamp height ~0.304m');
      assert.ok(b.min[2] >= -0.12 && b.max[2] <= 0.15, 'lamp ~0.24m Z depth');
    },
  },
  {
    id: 'photo-frame',
    prefix: 'ShopPhotoFrame_',
    expectedMeshes: 9,
    expectedMaterials: [
      'ShopButter',
      'ShopCoral',
      'ShopCreamPale',
      'ShopGrassGreen',
      'ShopLeafGreen',
      'ShopSkyBlue',
      'ShopSlateDark',
      'ShopTerracotta',
      'ShopWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.11 && b.max[0] <= 0.11,
        'photo-frame ~0.19m X width',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'photo-frame grounded Y=0');
      assert.ok(
        b.max[1] >= 0.21 && b.max[1] <= 0.25,
        'photo-frame height ~0.228m',
      );
      assert.ok(
        b.min[2] >= -0.11 && b.max[2] <= 0.05,
        'photo-frame ~0.13m Z easel footprint',
      );
    },
  },
  {
    id: 'puzzle-cube',
    prefix: 'ShopPuzzleCube_',
    expectedMeshes: 7,
    expectedMaterials: [
      'ShopButter',
      'ShopCoral',
      'ShopCreamPale',
      'ShopLavender',
      'ShopLeafGreen',
      'ShopSlateDark',
      'ShopTurquoise',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.08 && b.max[0] <= 0.08,
        'puzzle-cube ~0.14m X span',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'puzzle-cube grounded Y=0');
      assert.ok(
        b.max[1] >= 0.11 && b.max[1] <= 0.13,
        'puzzle-cube height ~0.119m',
      );
      assert.ok(
        b.min[2] >= -0.08 && b.max[2] <= 0.08,
        'puzzle-cube ~0.14m Z span',
      );
    },
  },
  {
    id: 'figurine',
    prefix: 'ShopFigurine_',
    expectedMeshes: 6,
    expectedMaterials: [
      'ShopButter',
      'ShopCoral',
      'ShopCreamPale',
      'ShopSlateDark',
      'ShopTurquoise',
      'ShopWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.07 && b.max[0] <= 0.07,
        'figurine ~0.11m X width',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'figurine grounded Y=0');
      assert.ok(
        b.max[1] >= 0.19 && b.max[1] <= 0.22,
        'figurine height ~0.203m',
      );
      assert.ok(
        b.min[2] >= -0.07 && b.max[2] <= 0.07,
        'figurine ~0.11m Z depth',
      );
    },
  },
  {
    id: 'mug',
    prefix: 'ShopMug_',
    expectedMeshes: 5,
    expectedMaterials: [
      'ShopButter',
      'ShopCoral',
      'ShopCreamPale',
      'ShopSlateDark',
      'ShopWood',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.07 && b.max[0] <= 0.095, 'mug ~0.14m X span');
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'mug grounded Y=0');
      assert.ok(b.max[1] >= 0.105 && b.max[1] <= 0.13, 'mug height ~0.118m');
      assert.ok(b.min[2] >= -0.07 && b.max[2] <= 0.07, 'mug ~0.12m Z depth');
    },
  },
  {
    id: 'mini-globe',
    prefix: 'ShopMiniGlobe_',
    expectedMeshes: 7,
    expectedMaterials: [
      'ShopButter',
      'ShopCoral',
      'ShopGrassGreen',
      'ShopLeafGreen',
      'ShopSkyBlue',
      'ShopSlateDark',
      'ShopWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.08 && b.max[0] <= 0.095,
        'mini-globe ~0.15m X span',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.002, 'mini-globe grounded Y=0');
      assert.ok(
        b.max[1] >= 0.19 && b.max[1] <= 0.23,
        'mini-globe height ~0.211m',
      );
      assert.ok(
        b.min[2] >= -0.08 && b.max[2] <= 0.08,
        'mini-globe ~0.13m Z depth',
      );
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/desk-decor/${spec.id}.glb`;
  const { bytes, json: g } = readGlb(rel);
  totalBytes += bytes;

  assert.ok(
    bytes <= 64 * 1024,
    `${spec.id}: compact modular GLB (${bytes} <= 64 KiB)`,
  );
  assert.equal(g.animations?.length ?? 0, 0, `${spec.id}: zero animations`);
  assert.equal(g.cameras?.length ?? 0, 0, `${spec.id}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${spec.id}: zero punctual lights`,
  );
  assert.equal(
    g.skins?.length ?? 0,
    0,
    `${spec.id}: static module needs no skins`,
  );

  const meshNodes = (g.nodes ?? []).filter((n) => n.mesh !== undefined);
  assert.equal(meshNodes.length, spec.expectedMeshes, `${spec.id}: mesh count`);

  const prefixRe = new RegExp(`^${spec.prefix}`);
  for (const node of meshNodes) {
    assert.match(
      node.name,
      prefixRe,
      `${spec.id}: semantic mesh name ${node.name}`,
    );
    closeVec(
      node.translation ?? [0, 0, 0],
      [0, 0, 0],
      `${spec.id} ${node.name} translation`,
    );
    closeVec(
      node.rotation ?? [0, 0, 0, 1],
      [0, 0, 0, 1],
      `${spec.id} ${node.name} rotation`,
    );
    closeVec(
      node.scale ?? [1, 1, 1],
      [1, 1, 1],
      `${spec.id} ${node.name} scale`,
    );
    assert.equal(
      node.matrix,
      undefined,
      `${spec.id} ${node.name} no raw matrix`,
    );

    for (const prim of g.meshes[node.mesh].primitives) {
      assert.ok(
        prim.extensions?.KHR_draco_mesh_compression,
        `${spec.id} ${node.name}: Draco compression required`,
      );
    }
  }

  for (const node of g.nodes ?? []) {
    assert.equal(node.camera, undefined, `${spec.id}: no camera nodes`);
    assert.equal(
      node.extensions?.KHR_lights_punctual,
      undefined,
      `${spec.id}: no light nodes`,
    );
  }

  const matNames = (g.materials ?? []).map((m) => m.name).sort();
  assert.deepEqual(
    matNames,
    [...spec.expectedMaterials].sort(),
    `${spec.id}: semantic material names`,
  );
  for (const mat of g.materials ?? []) {
    const pbr = mat.pbrMetallicRoughness ?? {};
    const metallic = pbr.metallicFactor ?? 0;
    assert.equal(
      metallic,
      0,
      `${spec.id} ${mat.name}: matte/satin non-metallic (${metallic})`,
    );
  }

  const bounds = unionGltfBounds(g);
  spec.checkBounds(bounds);
}

assert.ok(
  totalBytes <= 320 * 1024,
  `total modular desk decor kit ${totalBytes} <= 320 KiB`,
);

console.log(
  `[test-classroom-desk-decor] PASS: ${MODULE_SPECS.length}/7 modular desk-decor GLBs validated (${totalBytes} bytes total).`,
);
