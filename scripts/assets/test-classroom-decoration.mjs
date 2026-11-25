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
    id: 'christmas-tree',
    prefix: 'DecChristmasTree_',
    expectedMeshes: 11,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecDeepGreen',
      'DecGrassGreen',
      'DecLeafGreen',
      'DecPeach',
      'DecSlateDark',
      'DecTerracotta',
      'DecTurquoise',
      'DecWood',
    ],
    checkBounds(b) {
      closeVec(
        [b.min[0], b.max[0]],
        [-0.562, 0.562],
        'christmas-tree 1.12m X skirt',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'christmas-tree grounded Y=0');
      assert.ok(
        b.max[1] >= 2.15 && b.max[1] <= 2.22,
        'christmas-tree height with star topper',
      );
      closeVec(
        [b.min[2], b.max[2]],
        [-0.537, 0.537],
        'christmas-tree 1.07m Z skirt',
      );
    },
  },
  {
    id: 'flag-argentina',
    prefix: 'DecFlagArgentina_',
    expectedMeshes: 6,
    expectedMaterials: [
      'DecArgentinaBlue',
      'DecButter',
      'DecCreamPale',
      'DecSlateDark',
      'DecWood',
      'DecWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.22 && b.min[0] <= -0.21,
        'flag-argentina stand base min X',
      );
      assert.ok(
        b.max[0] >= 0.97 && b.max[0] <= 0.99,
        'flag-argentina banner fly max X',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'flag-argentina grounded Y=0');
      assert.ok(
        b.max[1] >= 2.27 && b.max[1] <= 2.31,
        'flag-argentina finial height',
      );
      closeVec(
        [b.min[2], b.max[2]],
        [-0.215, 0.215],
        'flag-argentina stand base Z',
      );
    },
  },
  {
    id: 'flag-integrar',
    prefix: 'DecFlagIntegrar_',
    expectedMeshes: 8,
    expectedMaterials: [
      'DecButter',
      'DecCreamPale',
      'DecIntegrarOrange',
      'DecSlateDark',
      'DecWood',
      'DecWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.22 && b.min[0] <= -0.21,
        'flag-integrar stand base min X',
      );
      assert.ok(
        b.max[0] >= 0.97 && b.max[0] <= 0.99,
        'flag-integrar banner fly max X',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'flag-integrar grounded Y=0');
      assert.ok(
        b.max[1] >= 2.27 && b.max[1] <= 2.31,
        'flag-integrar finial height',
      );
      closeVec(
        [b.min[2], b.max[2]],
        [-0.215, 0.215],
        'flag-integrar stand base Z',
      );
    },
  },
  {
    id: 'wall-clock',
    prefix: 'DecWallClock_',
    expectedMeshes: 5,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecSlateDark',
      'DecWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.27, 0.27], 'wall-clock 0.54m X');
      closeVec([b.min[1], b.max[1]], [-0.27, 0.27], 'wall-clock 0.54m Y');
      assert.ok(Math.abs(b.min[2]) <= 0.002, 'wall-clock back flush Z=0');
      assert.ok(
        b.max[2] >= 0.095 && b.max[2] <= 0.11,
        'wall-clock depth <= 0.11m',
      );
    },
  },
  {
    id: 'wall-map',
    prefix: 'DecWallMap_',
    expectedMeshes: 10,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecGrassGreen',
      'DecLeafGreen',
      'DecSkyBlue',
      'DecSlateDark',
      'DecTerracotta',
      'DecWood',
      'DecWoodLight',
    ],
    checkBounds(b) {
      closeVec(
        [b.min[0], b.max[0]],
        [-0.7075, 0.7075],
        'wall-map 1.42m roller width',
      );
      assert.ok(
        b.min[1] >= -0.48 && b.max[1] <= 0.53,
        'wall-map vertical height span',
      );
      assert.ok(Math.abs(b.min[2]) <= 0.002, 'wall-map back flush Z=0');
      assert.ok(b.max[2] >= 0.06 && b.max[2] <= 0.08, 'wall-map relief depth');
    },
  },
  {
    id: 'globe',
    prefix: 'DecGlobe_',
    expectedMeshes: 7,
    expectedMaterials: [
      'DecButter',
      'DecGrassGreen',
      'DecLeafGreen',
      'DecSkyBlue',
      'DecSlateDark',
      'DecWood',
      'DecWoodLight',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.16 && b.max[0] <= 0.19,
        'globe X width with C-meridian',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'globe grounded Y=0');
      assert.ok(
        b.max[1] >= 0.45 && b.max[1] <= 0.49,
        'globe total height ~0.47m',
      );
      assert.ok(b.min[2] >= -0.17 && b.max[2] <= 0.17, 'globe Z depth ~0.31m');
    },
  },
  {
    id: 'wall-posters',
    prefix: 'DecWallPosters_',
    expectedMeshes: 10,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecLavender',
      'DecLeafGreen',
      'DecPeach',
      'DecSlateDark',
      'DecTerracotta',
      'DecTurquoise',
      'DecWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.78 && b.max[0] <= 0.78,
        'wall-posters 3-frame cluster X',
      );
      assert.ok(
        b.min[1] >= -0.35 && b.max[1] <= 0.45,
        'wall-posters vertical span',
      );
      assert.ok(Math.abs(b.min[2]) <= 0.002, 'wall-posters back flush Z=0');
      assert.ok(b.max[2] >= 0.06 && b.max[2] <= 0.08, 'wall-posters depth');
    },
  },
  {
    id: 'plants-and-pots',
    prefix: 'DecPlants_',
    expectedMeshes: 11,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecDeepGreen',
      'DecGrassGreen',
      'DecLeafGreen',
      'DecPeach',
      'DecSlateDark',
      'DecTerracotta',
      'DecTurquoise',
      'DecWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.36 && b.max[0] <= 0.38,
        'plants-and-pots cluster X',
      );
      assert.ok(Math.abs(b.min[1]) <= 0.003, 'plants-and-pots grounded Y=0');
      assert.ok(
        b.max[1] >= 1.1 && b.max[1] <= 1.16,
        'plants-and-pots tall plant height',
      );
      assert.ok(
        b.min[2] >= -0.36 && b.max[2] <= 0.3,
        'plants-and-pots cluster Z',
      );
    },
  },
  {
    id: 'rug',
    prefix: 'DecRug_',
    expectedMeshes: 7,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecLavender',
      'DecPeach',
      'DecSlateDark',
      'DecTurquoise',
    ],
    checkBounds(b) {
      closeVec(
        [b.min[0], b.max[0]],
        [-1.2401, 1.2401],
        'rug 2.48m X with fringe',
      );
      assert.ok(
        b.min[1] >= -0.004 && b.max[1] <= 0.026,
        'rug low walkable floor profile',
      );
      closeVec([b.min[2], b.max[2]], [-0.9, 0.9], 'rug 1.80m Z depth');
    },
  },
  {
    id: 'garlands',
    prefix: 'DecGarlands_',
    expectedMeshes: 9,
    expectedMaterials: [
      'DecButter',
      'DecCoral',
      'DecCreamPale',
      'DecLavender',
      'DecLeafGreen',
      'DecPeach',
      'DecSlateDark',
      'DecTurquoise',
      'DecWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.284, 1.284], 'garlands 2.57m span X');
      assert.ok(
        b.min[1] >= -0.2 && b.max[1] <= 0.07,
        'garlands catenary sag span',
      );
      assert.ok(Math.abs(b.min[2]) <= 0.002, 'garlands wall cleats Z=0');
      assert.ok(
        b.max[2] >= 0.095 && b.max[2] <= 0.115,
        'garlands depth <= 0.115m',
      );
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/decoration/${spec.id}.glb`;
  const { bytes, json: g } = readGlb(rel);
  totalBytes += bytes;

  assert.ok(
    bytes <= 128 * 1024,
    `${spec.id}: compact modular GLB (${bytes} <= 128 KiB)`,
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
  `total modular decoration kit ${totalBytes} <= 512 KiB`,
);

console.log(
  `[test-classroom-decoration] PASS: ${MODULE_SPECS.length}/10 modular decoration GLBs validated (${totalBytes} bytes total).`,
);
