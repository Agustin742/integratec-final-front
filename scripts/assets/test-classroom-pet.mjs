import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const GLB_REL = 'public/models/pets/cat/body.glb';
const MAX_PET_GLB_BYTES = 1024 * 1024; // 1 MiB (FD8)

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

const EXPECTED_MESHES = [
  'Pet_Ears',
  'Pet_Eyes',
  'Pet_FrontLegs',
  'Pet_Head',
  'Pet_HindLegs',
  'Pet_Mouth',
  'Pet_Neck',
  'Pet_Nose',
  'Pet_Paws',
  'Pet_Tail',
  'Pet_Torso',
  'Pet_Whiskers',
];

const EXPECTED_BONES = [
  ['DEF-root', null],
  ['DEF-pelvis', 'DEF-root'],
  ['DEF-spine', 'DEF-pelvis'],
  ['DEF-spine.001', 'DEF-spine'],
  ['DEF-spine.002', 'DEF-spine.001'],
  ['DEF-neck', 'DEF-spine.002'],
  ['DEF-head', 'DEF-neck'],
  ['DEF-ear.L', 'DEF-head'],
  ['DEF-ear.R', 'DEF-head'],
  ['DEF-jaw', 'DEF-head'],
  ['DEF-tail.001', 'DEF-pelvis'],
  ['DEF-tail.002', 'DEF-tail.001'],
  ['DEF-tail.003', 'DEF-tail.002'],
  ['DEF-tail.004', 'DEF-tail.003'],
  ['DEF-shoulder.L', 'DEF-spine.002'],
  ['DEF-front_upper.L', 'DEF-shoulder.L'],
  ['DEF-front_lower.L', 'DEF-front_upper.L'],
  ['DEF-front_paw.L', 'DEF-front_lower.L'],
  ['DEF-shoulder.R', 'DEF-spine.002'],
  ['DEF-front_upper.R', 'DEF-shoulder.R'],
  ['DEF-front_lower.R', 'DEF-front_upper.R'],
  ['DEF-front_paw.R', 'DEF-front_lower.R'],
  ['DEF-hind_thigh.L', 'DEF-pelvis'],
  ['DEF-hind_shin.L', 'DEF-hind_thigh.L'],
  ['DEF-hind_hock.L', 'DEF-hind_shin.L'],
  ['DEF-hind_paw.L', 'DEF-hind_hock.L'],
  ['DEF-hind_thigh.R', 'DEF-pelvis'],
  ['DEF-hind_shin.R', 'DEF-hind_thigh.R'],
  ['DEF-hind_hock.R', 'DEF-hind_shin.R'],
  ['DEF-hind_paw.R', 'DEF-hind_hock.R'],
];

const EXPECTED_MATERIALS = [
  'PetCoatMarking',
  'PetCoatPrimary',
  'PetCoatSecondary',
  'PetEye',
  'PetEyeHighlight',
  'PetFaceLine',
  'PetInnerEarNose',
  'PetMouthInterior',
];

const { bytes, json: g } = readGlb(GLB_REL);

assert.ok(
  bytes <= MAX_PET_GLB_BYTES,
  `${GLB_REL}: exceeds 1 MB FD8 budget (${bytes} B)`,
);
assert.ok(
  g.extensionsUsed?.includes('KHR_draco_mesh_compression'),
  `${GLB_REL}: Draco compression required`,
);
const EXPECTED_ANIMATIONS = ['AskForPets', 'Meow', 'Sleep', 'Walk'];

assert.equal(
  g.animations?.length ?? 0,
  EXPECTED_ANIMATIONS.length,
  `${GLB_REL}: exact 4 animation clips`,
);
const actualAnimNames = (g.animations ?? []).map((a) => a.name).sort();
assert.deepEqual(
  actualAnimNames,
  EXPECTED_ANIMATIONS,
  `${GLB_REL}: expected clip names (Walk, Sleep, Meow, AskForPets)`,
);
for (const anim of g.animations) {
  const channels = anim.channels ?? [];
  assert.ok(channels.length > 0, `${GLB_REL}: ${anim.name} has channels`);
  let maxTime = 0;
  let hasBones = false;
  const morphNodes = new Set();
  for (const ch of channels) {
    const path = ch.target?.path;
    if (path === 'translation' || path === 'rotation') hasBones = true;
    if (path === 'weights' && ch.target?.node !== undefined) {
      morphNodes.add(g.nodes?.[ch.target.node]?.name);
    }
    const sampler = anim.samplers?.[ch.sampler];
    const inputAcc = g.accessors?.[sampler?.input];
    if (inputAcc?.max?.[0] !== undefined) {
      maxTime = Math.max(maxTime, inputAcc.max[0]);
    }
  }
  assert.ok(maxTime > 0.5, `${GLB_REL}: ${anim.name} positive duration`);
  assert.ok(hasBones, `${GLB_REL}: ${anim.name} drives skeleton bones`);
  assert.ok(
    morphNodes.has('Pet_Eyes') && morphNodes.has('Pet_Mouth'),
    `${GLB_REL}: ${anim.name} drives Pet_Eyes & Pet_Mouth morphs`,
  );
}
assert.equal(g.cameras?.length ?? 0, 0, `${GLB_REL}: zero cameras`);
assert.equal(
  g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
  0,
  `${GLB_REL}: zero lights`,
);

// Verify semantic mesh names and node hierarchy
const meshNames = (g.meshes ?? []).map((m) => m.name).sort();
assert.deepEqual(
  meshNames,
  EXPECTED_MESHES,
  `${GLB_REL}: exact 12 Pet_* meshes`,
);

const meshNodes = (g.nodes ?? []).filter((n) => n.mesh !== undefined);
assert.equal(meshNodes.length, 12, `${GLB_REL}: 12 mesh nodes`);
for (const n of meshNodes) {
  assert.ok(
    EXPECTED_MESHES.includes(n.name),
    `${GLB_REL}: clean mesh node name (${n.name})`,
  );
  assert.ok(n.skin === 0, `${GLB_REL}: ${n.name} bound to skin 0`);
  assert.ok(
    !n.translation && !n.rotation && !n.scale && !n.matrix,
    `${GLB_REL}: ${n.name} identity transform`,
  );
}

const rigNode = (g.nodes ?? []).find((n) => n.name === 'PetCatRig');
assert.ok(rigNode, `${GLB_REL}: PetCatRig node required`);
assert.ok(
  !rigNode.translation &&
    !rigNode.rotation &&
    !rigNode.scale &&
    !rigNode.matrix,
  `${GLB_REL}: PetCatRig identity transform`,
);

// Verify 30-bone skeleton and exact parent hierarchy
assert.equal(g.skins?.length ?? 0, 1, `${GLB_REL}: single skin required`);
const skin = g.skins[0];
assert.equal(skin.joints.length, 30, `${GLB_REL}: 30 canonical bones`);

const parentByIdx = new Map();
(g.nodes ?? []).forEach((n, idx) => {
  (n.children ?? []).forEach((c) => parentByIdx.set(c, idx));
});
const actualHierarchy = skin.joints
  .map((jIdx) => {
    const pIdx = parentByIdx.get(jIdx);
    const pNode = pIdx !== undefined ? g.nodes[pIdx] : undefined;
    const pName = pNode && skin.joints.includes(pIdx) ? pNode.name : null;
    return [g.nodes[jIdx].name, pName];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

assert.deepEqual(
  actualHierarchy,
  [...EXPECTED_BONES].sort((a, b) => a[0].localeCompare(b[0])),
  `${GLB_REL}: exact 30-bone quadruped hierarchy`,
);

// Verify morph targets on Pet_Eyes and Pet_Mouth
const eyesMesh = g.meshes.find((m) => m.name === 'Pet_Eyes');
assert.deepEqual(
  eyesMesh?.extras?.targetNames,
  ['EyesClosed', 'EyesHappy'],
  `${GLB_REL}: Pet_Eyes morph targets`,
);
for (const prim of eyesMesh.primitives) {
  assert.equal(prim.targets?.length, 2, `${GLB_REL}: Pet_Eyes 2 targets/prim`);
}

const mouthMesh = g.meshes.find((m) => m.name === 'Pet_Mouth');
assert.deepEqual(
  mouthMesh?.extras?.targetNames,
  ['Meow', 'Happy'],
  `${GLB_REL}: Pet_Mouth morph targets`,
);
for (const prim of mouthMesh.primitives) {
  assert.equal(prim.targets?.length, 2, `${GLB_REL}: Pet_Mouth 2 targets/prim`);
}

// Verify materials (no .001 suffixes, metallicFactor === 0)
const matNames = (g.materials ?? []).map((m) => m.name).sort();
assert.deepEqual(
  matNames,
  EXPECTED_MATERIALS,
  `${GLB_REL}: exact 8 Pet* materials`,
);
for (const mat of g.materials) {
  const metal = mat.pbrMetallicRoughness?.metallicFactor ?? 0;
  assert.equal(metal, 0, `${GLB_REL}: ${mat.name} non-metallic`);
}

// Verify grounded Y = 0 bounds, feline standing height, and +Z forward facing
const b = unionGltfBounds(g);
assert.ok(
  Math.abs(b.min[1]) <= 0.003,
  `${GLB_REL}: grounded Y=0 (${b.min[1]})`,
);
assert.ok(
  b.max[1] >= 0.38 && b.max[1] <= 0.48,
  `${GLB_REL}: standing height (${b.max[1]})`,
);
assert.ok(
  b.max[2] >= 0.25 && b.min[2] <= -0.3,
  `${GLB_REL}: facing +Z nose-to-tail bounds (${b.min[2]}..${b.max[2]})`,
);

console.log(
  `[test-classroom-pet] PASS: ${GLB_REL} (${bytes} B, 12 meshes, 30 bones, 4 morph targets, 4 clips [Walk, Sleep, Meow, AskForPets], 8 materials, height=${b.max[1].toFixed(3)}m)`,
);
