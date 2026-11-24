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
    id: 'wall-solid',
    prefix: 'ShellWallSolid_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellCreamLight',
      'ShellCreamPale',
      'ShellTerracotta',
      'ShellWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.0, 1.0], 'wall-solid 2m bay X');
      assert.ok(b.min[1] >= -0.002 && b.max[1] <= 2.66, 'wall-solid height');
      assert.ok(
        b.min[2] >= -0.26 && b.max[2] <= 0.06,
        'wall-solid Z thickness',
      );
    },
  },
  {
    id: 'wall-window',
    prefix: 'ShellWallWindow_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellCreamLight',
      'ShellCreamPale',
      'ShellTerracotta',
      'ShellWood',
    ],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.0, 1.0], 'wall-window 2m bay X');
      assert.ok(b.min[1] >= -0.002 && b.max[1] <= 2.66, 'wall-window height');
      assert.ok(
        b.min[2] >= -0.26 && b.max[2] <= 0.06,
        'wall-window Z thickness',
      );
    },
  },
  {
    id: 'wall-corner',
    prefix: 'ShellWallCorner_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellCreamLight',
      'ShellCreamPale',
      'ShellTerracotta',
      'ShellWood',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.26 && b.max[0] <= 0.01, 'wall-corner X');
      assert.ok(b.min[1] >= -0.002 && b.max[1] <= 2.66, 'wall-corner height');
      assert.ok(b.min[2] >= -0.26 && b.max[2] <= 0.01, 'wall-corner Z');
    },
  },
  {
    id: 'floor-tile',
    prefix: 'ShellFloorTile_',
    expectedMeshes: 3,
    expectedMaterials: ['ShellSandTileA', 'ShellWood'],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-0.5, 0.5], 'floor-tile 1m X');
      closeVec([b.min[2], b.max[2]], [-0.5, 0.5], 'floor-tile 1m Z');
      assert.ok(
        b.min[1] >= -0.19 && Math.abs(b.max[1]) <= 0.002,
        'floor-tile top at Y=0',
      );
    },
  },
  {
    id: 'floor-threshold',
    prefix: 'ShellFloorThreshold_',
    expectedMeshes: 2,
    expectedMaterials: ['ShellCoralAccent', 'ShellWood'],
    checkBounds(b) {
      closeVec(
        [b.min[0], b.max[0]],
        [-1.0, 1.0],
        'floor-threshold 2m doorway width',
      );
      assert.ok(
        b.min[1] >= -0.19 && b.max[1] <= 0.005,
        'floor-threshold flush top',
      );
      assert.ok(b.min[2] >= -0.002 && b.max[2] <= 0.13, 'floor-threshold Z');
    },
  },
  {
    id: 'window',
    prefix: 'ShellWindow_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellCreamPale',
      'ShellGlassHighlight',
      'ShellGlassTeal',
      'ShellWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -0.9 && b.max[0] <= 0.9,
        'window fits inside 2m bay',
      );
      assert.ok(b.min[1] >= 0.8 && b.max[1] <= 2.25, 'window Y opening');
      assert.ok(b.min[2] >= -0.27 && b.max[2] <= 0.17, 'window Z thickness');
    },
  },
  {
    id: 'window-curtains',
    prefix: 'ShellWindowCurtains_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellButter',
      'ShellCoralAccent',
      'ShellCurtainPeach',
      'ShellWood',
    ],
    checkBounds(b) {
      assert.ok(
        b.min[0] >= -1.02 && b.max[0] <= 1.02,
        'curtains fit bay width',
      );
      assert.ok(
        b.min[1] >= 0.94 && b.max[1] <= 2.42,
        'curtains clear floor & wall top',
      );
      assert.ok(
        b.min[2] >= -0.02 && b.max[2] <= 0.26,
        'curtains sit on room side',
      );
    },
  },
  {
    id: 'baseboard-wall',
    prefix: 'ShellBaseboardWall_',
    expectedMeshes: 2,
    expectedMaterials: ['ShellCreamPale', 'ShellWood'],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.0, 1.0], 'baseboard-wall 2m X');
      assert.ok(b.min[1] >= -0.002 && b.max[1] <= 0.2, 'baseboard-wall height');
      assert.ok(b.min[2] >= -0.003 && b.max[2] <= 0.07, 'baseboard-wall Z');
    },
  },
  {
    id: 'baseboard-cutaway',
    prefix: 'ShellBaseboardCutaway_',
    expectedMeshes: 1,
    expectedMaterials: ['ShellWood'],
    checkBounds(b) {
      closeVec([b.min[0], b.max[0]], [-1.0, 1.0], 'baseboard-cutaway 2m X');
      assert.ok(
        b.min[1] >= -0.19 && b.max[1] <= 0.18,
        'baseboard-cutaway height',
      );
      assert.ok(b.min[2] >= -0.002 && b.max[2] <= 0.13, 'baseboard-cutaway Z');
    },
  },
  {
    id: 'baseboard-doorway-post',
    prefix: 'ShellBaseboardDoorPost_',
    expectedMeshes: 3,
    expectedMaterials: ['ShellCoralAccent', 'ShellCreamPale', 'ShellWood'],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.1 && b.max[0] <= 0.1, 'doorway-post X');
      assert.ok(b.min[1] >= -0.19 && b.max[1] <= 0.27, 'doorway-post height');
      assert.ok(b.min[2] >= -0.1 && b.max[2] <= 0.1, 'doorway-post Z');
    },
  },
  {
    id: 'ceiling-light',
    prefix: 'ShellCeilingLight_',
    expectedMeshes: 4,
    expectedMaterials: [
      'ShellBulbGlow',
      'ShellButter',
      'ShellTerracotta',
      'ShellWood',
    ],
    checkBounds(b) {
      assert.ok(b.min[0] >= -0.31 && b.max[0] <= 0.31, 'ceiling-light X');
      assert.ok(
        b.min[1] >= -0.46 && b.max[1] <= 0.005,
        'ceiling-light Y mount pivot at 0 (>=2.20m when mounted at Y=2.65)',
      );
      assert.ok(b.min[2] >= -0.31 && b.max[2] <= 0.31, 'ceiling-light Z');
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/shell/${spec.id}.glb`;
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
    if (mat.name === 'ShellGlassTeal' || mat.name === 'ShellGlassHighlight') {
      assert.equal(
        mat.alphaMode,
        'BLEND',
        `${spec.id} ${mat.name}: BLEND glass`,
      );
    }
  }

  const bounds = unionGltfBounds(g);
  spec.checkBounds(bounds);
}

assert.ok(
  totalBytes <= 512 * 1024,
  `total modular shell kit ${totalBytes} <= 512 KiB`,
);

console.log(
  `[test-classroom-shell] PASS: ${MODULE_SPECS.length}/11 modular shell GLBs validated (${totalBytes} bytes total).`,
);
