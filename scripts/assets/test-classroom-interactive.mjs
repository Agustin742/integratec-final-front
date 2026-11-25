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
    id: 'own-student-desk-kit',
    prefix: 'IntOwnDesk_',
    expectedMeshes: 9,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntLeafGreen',
      'IntSlateDark',
      'IntTerracotta',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.6 && b.max[0] <= 0.6,
        'own-student-desk-kit fits inside 1.6m desk X',
      );
      assert.ok(
        Math.abs(b.min[1]) <= 0.003,
        'own-student-desk-kit tabletop Y=0',
      );
      assert.ok(
        b.max[1] >= 0.25 && b.max[1] <= 0.32,
        'own-student-desk-kit height',
      );
      assert.ok(
        b.min[2] >= -0.25 && b.max[2] <= 0.27,
        'own-student-desk-kit fits inside 0.8m desk Z',
      );
    },
  },
  {
    id: 'teacher-desk-controls',
    prefix: 'IntTeacherControls_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntSkyBlue',
      'IntSlateDark',
      'IntTerracotta',
      'IntTurquoise',
      'IntWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.62 && b.max[0] <= 0.62,
        'teacher-desk-controls X width',
      );
      assert.ok(
        Math.abs(b.min[1]) <= 0.003,
        'teacher-desk-controls tabletop Y=0',
      );
      assert.ok(
        b.max[1] >= 0.18 && b.max[1] <= 0.25,
        'teacher-desk-controls height',
      );
      assert.ok(
        b.min[2] >= -0.25 && b.max[2] <= 0.22,
        'teacher-desk-controls Z depth',
      );
    },
  },
  {
    id: 'board-collaborative',
    prefix: 'IntBoardCollab_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntPeach',
      'IntSkyBlue',
      'IntSlateDark',
      'IntTurquoise',
      'IntWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -1.65 && b.max[0] <= 1.65,
        'board-collaborative fits within board frame X',
      );
      assert.ok(
        b.min[1] >= 1.02 && b.max[1] <= 2.53,
        'board-collaborative tray to header Y',
      );
      assert.ok(
        b.min[2] >= -0.002 && b.max[2] <= 0.26,
        'board-collaborative wall-mounted Z=0',
      );
    },
  },
  {
    id: 'door',
    prefix: 'IntDoor_',
    expectedMeshes: 7,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntGlassTeal',
      'IntSlateDark',
      'IntTerracotta',
      'IntWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.72, 0.72], 'door 1.44m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'door grounded Y=0');
      assert.ok(
        b.max[1] >= 2.28 && b.max[1] <= 2.34,
        'door height clears 2.37m upper wall band',
      );
      assert.ok(
        b.min[2] >= -0.002 && b.max[2] <= 0.26,
        'door wall-flush at Z=0',
      );
    },
  },
  {
    id: 'bulletin-board',
    prefix: 'IntBulletin_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntLavender',
      'IntPeach',
      'IntTerracotta',
      'IntTurquoise',
      'IntWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -1.02 && b.max[0] <= 1.02,
        'bulletin-board 2.0m bay X',
      );
      assert.ok(
        b.min[1] >= 0.98 && b.max[1] <= 2.35,
        'bulletin-board clears chair rail & top dash',
      );
      assert.ok(
        b.min[2] >= -0.002 && b.max[2] <= 0.24,
        'bulletin-board wall-mounted Z=0',
      );
    },
  },
  {
    id: 'report-card-stand',
    prefix: 'IntReportCard_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntLeafGreen',
      'IntSlateDark',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      closeVec(
        [b.min[0], b.max[0]],
        [-0.39, 0.39],
        'report-card-stand 0.78m X',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'report-card-stand grounded Y=0');
      assert.ok(
        b.max[1] >= 1.32 && b.max[1] <= 1.38,
        'report-card-stand height',
      );
      assert.ok(
        b.min[2] >= -0.24 && b.max[2] <= 0.27,
        'report-card-stand depth',
      );
    },
  },
  {
    id: 'shop-kiosk',
    prefix: 'IntShopKiosk_',
    expectedMeshes: 9,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntGlassTeal',
      'IntPeach',
      'IntSlateDark',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.98, 0.98], 'shop-kiosk 1.96m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'shop-kiosk grounded Y=0');
      assert.ok(
        b.max[1] >= 2.12 && b.max[1] <= 2.2,
        'shop-kiosk awning height',
      );
      assert.ok(b.min[2] >= -0.36 && b.max[2] <= 0.39, 'shop-kiosk Z depth');
    },
  },
  {
    id: 'chat-computer',
    prefix: 'IntChatComputer_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntSkyBlue',
      'IntSlateDark',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.44, 0.44], 'chat-computer 0.88m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'chat-computer grounded Y=0');
      assert.ok(
        b.max[1] >= 1.22 && b.max[1] <= 1.26,
        'chat-computer monitor height',
      );
      assert.ok(b.min[2] >= -0.29 && b.max[2] <= 0.29, 'chat-computer Z depth');
    },
  },
  {
    id: 'arcade-console',
    prefix: 'IntArcade_',
    expectedMeshes: 9,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntLeafGreen',
      'IntPeach',
      'IntSkyBlue',
      'IntSlateDark',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.38, 0.38], 'arcade-console 0.76m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'arcade-console grounded Y=0');
      assert.ok(
        b.max[1] >= 1.54 && b.max[1] <= 1.58,
        'arcade-console marquee height',
      );
      assert.ok(
        b.min[2] >= -0.32 && b.max[2] <= 0.38,
        'arcade-console Z depth',
      );
    },
  },
  {
    id: 'pet-bed',
    prefix: 'IntPetBed_',
    expectedMeshes: 9,
    expectedMaterials: [
      'IntButter',
      'IntCreamPale',
      'IntDeepGreen',
      'IntLeafGreen',
      'IntPeach',
      'IntSkyBlue',
      'IntTerracotta',
      'IntTurquoise',
      'IntWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.52, 0.52], 'pet-bed 1.04m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'pet-bed grounded Y=0');
      assert.ok(b.max[1] >= 0.21 && b.max[1] <= 0.26, 'pet-bed height');
      closeVec([b.min[2], b.max[2]], [-0.4, 0.4], 'pet-bed 0.80m Z');
    },
  },
  {
    id: 'trophy-shelf',
    prefix: 'IntTrophyShelf_',
    expectedMeshes: 8,
    expectedMaterials: [
      'IntButter',
      'IntCoral',
      'IntCreamPale',
      'IntSlateDark',
      'IntTerracotta',
      'IntTurquoise',
      'IntWood',
      'IntWoodLight',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.62, 0.62], 'trophy-shelf 1.24m X');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'trophy-shelf grounded Y=0');
      assert.ok(b.max[1] >= 1.52 && b.max[1] <= 1.56, 'trophy-shelf height');
      closeVec([b.min[2], b.max[2]], [-0.22, 0.22], 'trophy-shelf 0.44m Z');
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/interactive/${spec.id}.glb`;
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
  `total modular interactive kit ${totalBytes} <= 512 KiB`,
);

console.log(
  `[test-classroom-interactive] PASS: ${MODULE_SPECS.length}/11 modular interactive GLBs validated (${totalBytes} bytes total).`,
);
