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
    id: 'notebooks',
    prefix: 'ClutterNotebooks_',
    expectedMeshes: 7,
    expectedMaterials: [
      'DeskButter',
      'DeskCoral',
      'DeskCreamPale',
      'DeskLeafGreen',
      'DeskSkyBlue',
      'DeskSlateDark',
      'DeskTurquoise',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.25 && b.max[0] <= 0.28,
        'notebooks ~0.50m X span',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'notebooks grounded Y=0');
      assert.ok(
        b.max[1] >= 0.035 && b.max[1] <= 0.045,
        'notebooks tabletop height ~0.039m',
      );
      assert.ok(
        b.min[2] >= -0.18 && b.max[2] <= 0.16,
        'notebooks ~0.31m Z span',
      );
    },
  },
  {
    id: 'pencil-case',
    prefix: 'ClutterPencilCase_',
    expectedMeshes: 6,
    expectedMaterials: [
      'DeskButter',
      'DeskCoral',
      'DeskCreamPale',
      'DeskPeach',
      'DeskSlateDark',
      'DeskTurquoise',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.17 && b.max[0] <= 0.16,
        'pencil-case ~0.30m X width',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'pencil-case grounded Y=0');
      assert.ok(
        b.max[1] >= 0.1 && b.max[1] <= 0.12,
        'pencil-case height ~0.11m',
      );
      assert.ok(
        b.min[2] >= -0.07 && b.max[2] <= 0.07,
        'pencil-case ~0.12m Z depth',
      );
    },
  },
  {
    id: 'pencils',
    prefix: 'ClutterPencils_',
    expectedMeshes: 9,
    expectedMaterials: [
      'DeskButter',
      'DeskCoral',
      'DeskCreamPale',
      'DeskLeafGreen',
      'DeskPeach',
      'DeskSkyBlue',
      'DeskSlateDark',
      'DeskTurquoise',
      'DeskWoodLight',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.13 && b.max[0] <= 0.13, 'pencils ~0.24m X span');
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'pencils grounded Y=0');
      assert.ok(
        b.max[1] >= 0.035 && b.max[1] <= 0.05,
        'pencils stacked height ~0.042m',
      );
      assert.ok(
        b.min[2] >= -0.085 && b.max[2] <= 0.09,
        'pencils ~0.15m Z span',
      );
    },
  },
  {
    id: 'stacked-books',
    prefix: 'ClutterStackedBooks_',
    expectedMeshes: 8,
    expectedMaterials: [
      'DeskButter',
      'DeskCoral',
      'DeskCreamPale',
      'DeskDeepGreen',
      'DeskLavender',
      'DeskSlateDark',
      'DeskTerracotta',
      'DeskWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.17 && b.max[0] <= 0.17,
        'stacked-books ~0.31m X span',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'stacked-books grounded Y=0');
      assert.ok(
        b.max[1] >= 0.2 && b.max[1] <= 0.23,
        'stacked-books 4-book height ~0.212m',
      );
      assert.ok(
        b.min[2] >= -0.17 && b.max[2] <= 0.17,
        'stacked-books ~0.31m Z span',
      );
    },
  },
  {
    id: 'backpack-floor',
    prefix: 'ClutterBackpackFloor_',
    expectedMeshes: 7,
    expectedMaterials: [
      'DeskButter',
      'DeskCoral',
      'DeskCreamPale',
      'DeskSkyBlue',
      'DeskSlateDark',
      'DeskTerracotta',
      'DeskTurquoise',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.22 && b.max[0] <= 0.22,
        'backpack-floor ~0.41m X span',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'backpack-floor grounded Y=0');
      assert.ok(
        b.max[1] >= 0.44 && b.max[1] <= 0.49,
        'backpack-floor height ~0.464m',
      );
      assert.ok(
        b.min[2] >= -0.22 && b.max[2] <= 0.17,
        'backpack-floor ~0.35m Z depth',
      );
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/desk-clutter/${spec.id}.glb`;
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
  totalBytes <= 256 * 1024,
  `total modular desk clutter kit ${totalBytes} <= 256 KiB`,
);

console.log(
  `[test-classroom-desk-clutter] PASS: ${MODULE_SPECS.length}/5 modular desk-clutter GLBs validated (${totalBytes} bytes total).`,
);
