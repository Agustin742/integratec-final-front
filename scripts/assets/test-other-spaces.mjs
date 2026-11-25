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

function checkGroundedBounds(
  id,
  b,
  expectedW,
  expectedH,
  expectedD,
  topZ0 = false,
) {
  const w = b.max[0] - b.min[0];
  const h = b.max[1] - b.min[1];
  const d = b.max[2] - b.min[2];
  assert.ok(
    Math.abs(w - expectedW) <= 0.12,
    `${id}: expected width ~${expectedW}m (got ${w.toFixed(3)})`,
  );
  assert.ok(
    Math.abs(h - expectedH) <= 0.12,
    `${id}: expected height ~${expectedH}m (got ${h.toFixed(3)})`,
  );
  assert.ok(
    Math.abs(d - expectedD) <= 0.12,
    `${id}: expected depth ~${expectedD}m (got ${d.toFixed(3)})`,
  );
  if (topZ0) {
    assert.ok(
      Math.abs(b.max[1]) <= 0.002,
      `${id}: walkable top at Y=0 (${b.max[1]})`,
    );
    assert.ok(
      b.min[1] >= -0.23 && b.min[1] <= -0.21,
      `${id}: earthen plinth bottom -0.22m (${b.min[1]})`,
    );
  } else {
    assert.ok(Math.abs(b.min[1]) <= 0.002, `${id}: grounded Y=0 (${b.min[1]})`);
  }
}

const GLASS_MATERIALS = new Set(['SpaceGlassTeal', 'SpaceGlassSky']);

const MODULE_SPECS = [
  // Hallway
  {
    space: 'hallway',
    id: 'locker-bank',
    prefix: 'HallwayLockerBank_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGrassGreen',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [1.52, 2.092, 0.696],
  },
  {
    space: 'hallway',
    id: 'water-fountain',
    prefix: 'HallwayWaterFountain_',
    expectedMeshes: 8,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlowTeal',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceTurquoise',
    ],
    dims: [0.829, 1.31, 0.446],
  },
  {
    space: 'hallway',
    id: 'hallway-bench',
    prefix: 'HallwayBench_',
    expectedMeshes: 8,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpacePeach',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [1.6, 0.86, 0.5],
  },
  {
    space: 'hallway',
    id: 'trophy-display-case',
    prefix: 'HallwayTrophyCase_',
    expectedMeshes: 10,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceGlassTeal',
      'SpaceGlowWarm',
      'SpaceIndigo',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [1.56, 1.988, 0.504],
  },
  {
    space: 'hallway',
    id: 'room-signpost',
    prefix: 'HallwayRoomSignpost_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceGlowWarm',
      'SpaceGrassGreen',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [0.653, 1.955, 0.42],
  },
  {
    space: 'hallway',
    id: 'hallway-runner-rug',
    prefix: 'HallwayRunnerRug_',
    expectedMeshes: 7,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
    ],
    dims: [2.55, 0.036, 1.18],
  },
  // Schoolyard
  {
    space: 'schoolyard',
    id: 'courtyard-ground-tile',
    prefix: 'YardGroundTile_',
    expectedMeshes: 5,
    expectedMaterials: [
      'SpaceBrick',
      'SpaceGrassGreen',
      'SpaceLeafGreen',
      'SpaceSand',
      'SpaceTerracotta',
    ],
    dims: [2.0, 0.225, 2.0],
    topZ0: true,
  },
  {
    space: 'schoolyard',
    id: 'courtyard-tree',
    prefix: 'YardTree_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceBrick',
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceDeepGreen',
      'SpaceGrassGreen',
      'SpaceLeafGreen',
      'SpacePeach',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.356, 3.239, 1.896],
  },
  {
    space: 'schoolyard',
    id: 'picnic-table',
    prefix: 'YardPicnicTable_',
    expectedMeshes: 7,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceSlateDark',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.08, 2.285, 2.08],
  },
  {
    space: 'schoolyard',
    id: 'garden-planter-bench',
    prefix: 'YardPlanterBench_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceBrick',
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceDeepGreen',
      'SpaceGrassGreen',
      'SpaceLeafGreen',
      'SpacePeach',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.328, 1.044, 0.88],
  },
  {
    space: 'schoolyard',
    id: 'basketball-hoop',
    prefix: 'YardBasketballHoop_',
    expectedMeshes: 7,
    expectedMaterials: [
      'SpaceCerulean',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [1.31, 3.17, 1.335],
  },
  {
    space: 'schoolyard',
    id: 'schoolyard-gazebo-arch',
    prefix: 'YardPergolaArch_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCreamLight',
      'SpaceDeepGreen',
      'SpaceGlowWarm',
      'SpaceGrassGreen',
      'SpaceLeafGreen',
      'SpacePeach',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.46, 2.653, 1.2],
  },
  // Library
  {
    space: 'library',
    id: 'tall-bookshelf-arch',
    prefix: 'LibTallBookshelf_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceDeepGreen',
      'SpaceLavender',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [1.82, 2.27, 0.664],
  },
  {
    space: 'library',
    id: 'reading-table',
    prefix: 'LibReadingTable_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceDeepGreen',
      'SpaceGlowWarm',
      'SpaceLavender',
      'SpaceSlateDark',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.2, 1.138, 1.12],
  },
  {
    space: 'library',
    id: 'reading-nook-armchair',
    prefix: 'LibReadingArmchair_',
    expectedMeshes: 7,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceLavender',
      'SpaceSlateDark',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [1.288, 0.966, 0.792],
  },
  {
    space: 'library',
    id: 'librarian-checkout-desk',
    prefix: 'LibCheckoutDesk_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGrassGreen',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [2.16, 1.24, 0.98],
  },
  {
    space: 'library',
    id: 'book-return-cart',
    prefix: 'LibBookCart_',
    expectedMeshes: 9,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceDeepGreen',
      'SpaceLavender',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWoodLight',
    ],
    dims: [0.88, 1.05, 0.44],
  },
  {
    space: 'library',
    id: 'library-floor-globe-lamp',
    prefix: 'LibGlobeAndLamp_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlowWarm',
      'SpaceGrassGreen',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpacePeach',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceWood',
    ],
    dims: [1.26, 1.859, 0.66],
  },
  // Lab
  {
    space: 'lab',
    id: 'lab-workbench',
    prefix: 'LabWorkbench_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlassSky',
      'SpaceLavender',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [2.2, 1.355, 1.06],
  },
  {
    space: 'lab',
    id: 'lab-stool',
    prefix: 'LabStool_',
    expectedMeshes: 4,
    expectedMaterials: [
      'SpaceButter',
      'SpaceSlateDark',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [0.366, 0.6, 0.37],
  },
  {
    space: 'lab',
    id: 'microscope-station',
    prefix: 'LabMicroscopeStation_',
    expectedMeshes: 11,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlassSky',
      'SpaceGlowWarm',
      'SpaceLeafGreen',
      'SpaceSkyBlue',
      'SpaceSlateDark',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [0.575, 0.441, 0.315],
  },
  {
    space: 'lab',
    id: 'chemistry-glassware-rack',
    prefix: 'LabGlasswareRack_',
    expectedMeshes: 13,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamPale',
      'SpaceGlassSky',
      'SpaceGlowTeal',
      'SpaceGlowWarm',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
      'SpaceWoodLight',
    ],
    dims: [0.707, 0.3, 0.274],
  },
  {
    space: 'lab',
    id: 'fume-hood-cabinet',
    prefix: 'LabFumeHood_',
    expectedMeshes: 8,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlassSky',
      'SpaceGlowWarm',
      'SpaceSlateDark',
      'SpaceTurquoise',
    ],
    dims: [1.64, 2.185, 0.723],
  },
  {
    space: 'lab',
    id: 'science-display-shelf',
    prefix: 'LabScienceShelf_',
    expectedMeshes: 12,
    expectedMaterials: [
      'SpaceButter',
      'SpaceCoral',
      'SpaceCreamLight',
      'SpaceCreamPale',
      'SpaceGlassSky',
      'SpaceGrassGreen',
      'SpaceLavender',
      'SpaceLeafGreen',
      'SpaceSlateDark',
      'SpaceTerracotta',
      'SpaceTurquoise',
      'SpaceWood',
    ],
    dims: [1.42, 2.06, 0.46],
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/${spec.space}/${spec.id}.glb`;
  const { bytes, json: g } = readGlb(rel);
  totalBytes += bytes;

  assert.ok(
    bytes <= 128 * 1024,
    `${spec.space}/${spec.id}: compact modular GLB (${bytes} <= 128 KiB)`,
  );
  assert.equal(g.animations?.length ?? 0, 0, `${spec.id}: zero animations`);
  assert.equal(g.cameras?.length ?? 0, 0, `${spec.id}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${spec.id}: zero punctual lights`,
  );
  assert.equal(g.skins?.length ?? 0, 0, `${spec.id}: static module no skins`);

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
    if (GLASS_MATERIALS.has(mat.name)) {
      assert.equal(
        mat.alphaMode,
        'BLEND',
        `${spec.id} ${mat.name}: translucent glass BLEND`,
      );
    } else {
      assert.notEqual(
        mat.alphaMode,
        'BLEND',
        `${spec.id} ${mat.name}: opaque material`,
      );
    }
  }

  const bounds = unionGltfBounds(g);
  checkGroundedBounds(
    `${spec.space}/${spec.id}`,
    bounds,
    spec.dims[0],
    spec.dims[1],
    spec.dims[2],
    Boolean(spec.topZ0),
  );
}

assert.ok(
  totalBytes <= 1024 * 1024,
  `total Other Spaces 24-asset kit ${totalBytes} <= 1 MiB`,
);

console.log(
  `[test-other-spaces] PASS: ${MODULE_SPECS.length}/24 modular Other Spaces GLBs validated across 4 spaces (${totalBytes} bytes total).`,
);
