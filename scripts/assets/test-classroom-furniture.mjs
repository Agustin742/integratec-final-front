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
    id: 'student-desk',
    prefix: 'FurnStudentDesk_',
    expectedMeshes: 6,
    expectedMaterials: [
      'FurnButter',
      'FurnSlateDark',
      'FurnTerracotta',
      'FurnTurquoise',
      'FurnWood',
      'FurnWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.8, 0.8], 'student-desk 1.6m X');
      closeVec([b.min[2], b.max[2]], [-0.4, 0.4], 'student-desk 0.8m Z');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'student-desk grounded Y=0');
      assert.ok(
        Math.abs(b.max[1] - 0.75) <= 0.003,
        'student-desk top Y=0.75 (DESK_HEIGHT)',
      );
    },
  },
  {
    id: 'student-chair',
    prefix: 'FurnStudentChair_',
    expectedMeshes: 4,
    expectedMaterials: [
      'FurnButter',
      'FurnSlateDark',
      'FurnWood',
      'FurnWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.27 && b.max[0] <= 0.27,
        'student-chair width <= 0.54m',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'student-chair grounded Y=0');
      assert.ok(
        b.max[1] >= 0.75 && b.max[1] <= 0.82,
        'student-chair backrest height',
      );
      assert.ok(b.min[2] >= -0.27 && b.max[2] <= 0.24, 'student-chair depth');
    },
  },
  {
    id: 'teacher-desk',
    prefix: 'FurnTeacherDesk_',
    expectedMeshes: 6,
    expectedMaterials: [
      'FurnCreamPale',
      'FurnSlateDark',
      'FurnTerracotta',
      'FurnTurquoise',
      'FurnWood',
      'FurnWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.5, 1.5], 'teacher-desk 3.0m X');
      closeVec([b.min[2], b.max[2]], [-0.4, 0.4], 'teacher-desk 0.8m Z');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'teacher-desk grounded Y=0');
      assert.ok(
        Math.abs(b.max[1] - 0.75) <= 0.003,
        'teacher-desk top Y=0.75 (DESK_HEIGHT)',
      );
    },
  },
  {
    id: 'board',
    prefix: 'FurnBoard_',
    expectedMeshes: 7,
    expectedMaterials: [
      'FurnBoardGreen',
      'FurnButter',
      'FurnCreamPale',
      'FurnSlateDark',
      'FurnTerracotta',
      'FurnTurquoise',
      'FurnWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-2.2, 2.2], 'board 4.4m X');
      assert.ok(
        b.min[1] >= 0.96 && b.max[1] <= 2.38,
        'board clears chair rail (0.96) & top dash (2.37)',
      );
      assert.ok(
        b.min[2] >= -0.002 && b.max[2] <= 0.21,
        'board wall-mounted at Z=0 projecting <= 0.21m',
      );
    },
  },
  {
    id: 'bookshelf',
    prefix: 'FurnBookshelf_',
    expectedMeshes: 10,
    expectedMaterials: [
      'FurnBoardGreen',
      'FurnButter',
      'FurnCoral',
      'FurnCreamPale',
      'FurnLavender',
      'FurnSlateDark',
      'FurnTerracotta',
      'FurnTurquoise',
      'FurnWood',
      'FurnWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.9, 0.9], 'bookshelf 1.8m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'bookshelf grounded Y=0');
      assert.ok(b.max[1] >= 1.5 && b.max[1] <= 1.56, 'bookshelf height');
      closeVec([b.min[2], b.max[2]], [-0.18, 0.18], 'bookshelf 0.36m Z');
    },
  },
  {
    id: 'cabinet',
    prefix: 'FurnCabinet_',
    expectedMeshes: 7,
    expectedMaterials: [
      'FurnButter',
      'FurnCreamPale',
      'FurnSlateDark',
      'FurnTerracotta',
      'FurnTurquoise',
      'FurnWood',
      'FurnWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.65, 0.65], 'cabinet 1.3m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'cabinet grounded Y=0');
      assert.ok(b.max[1] >= 1.12 && b.max[1] <= 1.15, 'cabinet height');
      assert.ok(
        b.min[2] >= -0.25 && b.max[2] <= 0.28,
        'cabinet depth + handles',
      );
    },
  },
  {
    id: 'coat-rack',
    prefix: 'FurnCoatRack_',
    expectedMeshes: 6,
    expectedMaterials: [
      'FurnButter',
      'FurnCoral',
      'FurnCreamPale',
      'FurnSlateDark',
      'FurnTurquoise',
      'FurnWood',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.28 && b.max[0] <= 0.28, 'coat-rack X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'coat-rack grounded Y=0');
      assert.ok(b.max[1] >= 1.52 && b.max[1] <= 1.58, 'coat-rack height');
      assert.ok(b.min[2] >= -0.28 && b.max[2] <= 0.28, 'coat-rack Z');
    },
  },
  {
    id: 'trash-bin',
    prefix: 'FurnTrashBin_',
    expectedMeshes: 4,
    expectedMaterials: [
      'FurnButter',
      'FurnCreamPale',
      'FurnSlateDark',
      'FurnTurquoise',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.21 && b.max[0] <= 0.21, 'trash-bin X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'trash-bin grounded Y=0');
      assert.ok(b.max[1] >= 0.46 && b.max[1] <= 0.49, 'trash-bin height');
      assert.ok(b.min[2] >= -0.21 && b.max[2] <= 0.21, 'trash-bin Z');
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/furniture/${spec.id}.glb`;
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
  totalBytes <= 512 * 1024,
  `total modular furniture kit ${totalBytes} <= 512 KiB`,
);

console.log(
  `[test-classroom-furniture] PASS: ${MODULE_SPECS.length}/8 modular furniture GLBs validated (${totalBytes} bytes total).`,
);
