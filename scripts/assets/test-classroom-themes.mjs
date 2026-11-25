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

function checkHotSwapFootprint(id, b, minH, maxH) {
  assert.ok(
    b.min[0] >= -0.94 &&
      b.min[0] <= -0.9 &&
      b.max[0] >= 0.9 &&
      b.max[0] <= 0.94,
    `${id}: hot-swappable ~1.84m X width (${b.min[0]}..${b.max[0]})`,
  );
  assert.ok(Math.abs(b.min[1]) <= 0.002, `${id}: grounded Y=0 (${b.min[1]})`);
  assert.ok(
    b.max[1] >= minH && b.max[1] <= maxH,
    `${id}: expected arch height ${minH}..${maxH}m (got ${b.max[1]})`,
  );
  assert.ok(
    b.min[2] >= -0.51 &&
      b.min[2] <= -0.47 &&
      b.max[2] >= 0.47 &&
      b.max[2] <= 0.51,
    `${id}: hot-swappable ~0.98m Z depth (${b.min[2]}..${b.max[2]})`,
  );
}

const MODULE_SPECS = [
  {
    id: 'warm',
    prefix: 'ThemeWarm_',
    expectedMeshes: 10,
    expectedMaterials: [
      'ThemeButter',
      'ThemeCoral',
      'ThemeCreamPale',
      'ThemeGlowWarm',
      'ThemeLeafGreen',
      'ThemePeach',
      'ThemeSlateDark',
      'ThemeTerracotta',
      'ThemeWood',
      'ThemeWoodLight',
    ],
    checkBounds(b) {
      checkHotSwapFootprint('warm', b, 1.9, 2.02);
    },
  },
  {
    id: 'night',
    prefix: 'ThemeNight_',
    expectedMeshes: 9,
    expectedMaterials: [
      'ThemeButter',
      'ThemeCerulean',
      'ThemeCreamPale',
      'ThemeGlowWarm',
      'ThemeIndigo',
      'ThemeLavender',
      'ThemePeach',
      'ThemeSlateDark',
      'ThemeWood',
    ],
    checkBounds(b) {
      checkHotSwapFootprint('night', b, 2.05, 2.18);
    },
  },
  {
    id: 'space',
    prefix: 'ThemeSpace_',
    expectedMeshes: 10,
    expectedMaterials: [
      'ThemeButter',
      'ThemeCoral',
      'ThemeCreamPale',
      'ThemeGlowWarm',
      'ThemeGrassGreen',
      'ThemeIndigo',
      'ThemePeach',
      'ThemeSkyBlue',
      'ThemeSlateDark',
      'ThemeTurquoise',
    ],
    checkBounds(b) {
      checkHotSwapFootprint('space', b, 1.98, 2.1);
    },
  },
  {
    id: 'forest',
    prefix: 'ThemeForest_',
    expectedMeshes: 11,
    expectedMaterials: [
      'ThemeButter',
      'ThemeCoral',
      'ThemeCreamPale',
      'ThemeDeepGreen',
      'ThemeGrassGreen',
      'ThemeLeafGreen',
      'ThemePeach',
      'ThemeSlateDark',
      'ThemeTerracotta',
      'ThemeWood',
      'ThemeWoodLight',
    ],
    checkBounds(b) {
      checkHotSwapFootprint('forest', b, 1.95, 2.06);
    },
  },
  {
    id: 'holiday',
    prefix: 'ThemeHoliday_',
    expectedMeshes: 10,
    expectedMaterials: [
      'ThemeButter',
      'ThemeCoral',
      'ThemeCreamPale',
      'ThemeDeepGreen',
      'ThemeGlowWarm',
      'ThemeLeafGreen',
      'ThemePeach',
      'ThemeSlateDark',
      'ThemeTurquoise',
      'ThemeWood',
    ],
    checkBounds(b) {
      checkHotSwapFootprint('holiday', b, 2.02, 2.15);
    },
  },
];

let totalBytes = 0;

for (const spec of MODULE_SPECS) {
  const rel = `public/models/scenes/classroom/themes/${spec.id}.glb`;
  const { bytes, json: g } = readGlb(rel);
  totalBytes += bytes;

  assert.ok(
    bytes <= 96 * 1024,
    `${spec.id}: compact modular GLB (${bytes} <= 96 KiB)`,
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
  `total modular classroom themes kit ${totalBytes} <= 320 KiB`,
);

console.log(
  `[test-classroom-themes] PASS: ${MODULE_SPECS.length}/5 modular classroom-theme GLBs validated (${totalBytes} bytes total).`,
);
