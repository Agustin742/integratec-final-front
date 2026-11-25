import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const MAX_AVATAR_BYTES = 1024 * 1024;

const CANONICAL_16 = [
  'Idle',
  'Walk',
  'Run',
  'Sit',
  'SitWrite',
  'RaiseHand',
  'Wave',
  'Cheer',
  'Clap',
  'Think',
  'Nod',
  'ShakeHead',
  'Sad',
  'Dance',
  'TeacherExplain',
  'TeacherPoint',
];

const TRANSITION_4 = ['SitStart', 'SitEnd', 'ThinkStart', 'ThinkEnd'];
const LEGACY_RENAMED = ['Yes', 'No', 'Celebrate'];
const EXPECTED_MORPHS = ['Blink', 'Happy', 'Sad', 'Angry'];

function readGlb(relPath) {
  const bytes = fs.readFileSync(new URL(relPath, root));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, `${relPath}: glTF magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${relPath}: glTF v2`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${relPath}: byteLength`);
  const jsonLen = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  const binHdr = 20 + jsonLen;
  const binLen = bytes.readUInt32LE(binHdr);
  const bin = bytes.subarray(binHdr + 8, binHdr + 8 + binLen);
  return { size: bytes.length, json, bin };
}

function jointMap(g) {
  const parents = new Map();
  (g.nodes ?? []).forEach((n, i) => {
    (n.children ?? []).forEach((c) => parents.set(c, i));
  });
  const map = new Map();
  for (const idx of g.skins[0].joints) {
    const n = g.nodes[idx];
    map.set(n.name, {
      parent: g.nodes[parents.get(idx)]?.name ?? null,
      translation: n.translation ?? [0, 0, 0],
      rotation: n.rotation ?? [0, 0, 0, 1],
      scale: n.scale ?? [1, 1, 1],
    });
  }
  return map;
}

function assertCloseVec(a, b, label) {
  assert.equal(a.length, b.length, label);
  for (let i = 0; i < a.length; i += 1) {
    assert.ok(
      Math.abs(a[i] - b[i]) < 1e-4,
      `${label}[${i}]: ${a[i]} != ${b[i]}`,
    );
  }
}

function clipDuration(g, anim) {
  let maxT = 0;
  for (const s of anim.samplers ?? []) {
    const acc = g.accessors[s.input];
    if (acc?.max?.[0] !== undefined && acc.max[0] > maxT) {
      maxT = acc.max[0];
    }
  }
  return maxT;
}

function verifyBody(relPath, expectedJoints, expectedMorphMeshes) {
  const { size, json: g } = readGlb(relPath);
  assert.ok(
    size <= MAX_AVATAR_BYTES,
    `${relPath}: exceeds 1 MB FD8 budget (${size} B)`,
  );
  assert.ok(
    g.extensionsUsed?.includes('KHR_draco_mesh_compression'),
    `${relPath}: Draco compression required`,
  );
  assert.equal(g.scenes?.length, 1, `${relPath}: single clean scene`);
  assert.equal(g.cameras?.length ?? 0, 0, `${relPath}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${relPath}: zero lights`,
  );
  assert.equal(
    (g.nodes ?? []).some((n) => n.name?.startsWith('Icosphere')),
    false,
    `${relPath}: no importer Icosphere`,
  );

  assert.equal(g.skins?.length, 1, `${relPath}: single skin`);
  const joints = jointMap(g);
  assert.equal(
    joints.size,
    expectedJoints,
    `${relPath}: expected ${expectedJoints} joints`,
  );

  for (const meshName of expectedMorphMeshes) {
    const mesh = (g.meshes ?? []).find((m) => m.name === meshName);
    assert.ok(mesh, `${relPath}: missing morph mesh ${meshName}`);
    assert.deepEqual(
      mesh.extras?.targetNames,
      EXPECTED_MORPHS,
      `${relPath}: ${meshName} morph targets`,
    );
  }

  const byName = new Map((g.animations ?? []).map((a) => [a.name, a]));
  for (const legacy of LEGACY_RENAMED) {
    assert.equal(
      byName.has(legacy),
      false,
      `${relPath}: unmigrated legacy clip ${legacy} must be removed`,
    );
  }
  for (const required of [...CANONICAL_16, ...TRANSITION_4]) {
    const anim = byName.get(required);
    assert.ok(anim, `${relPath}: missing clip ${required}`);
    assert.ok(
      anim.channels.length >= 15,
      `${relPath}: ${required} has too few channels (${anim.channels.length})`,
    );
    assert.ok(
      clipDuration(g, anim) > 0.4,
      `${relPath}: ${required} duration must be > 0.4s`,
    );
  }

  const sadAnim = byName.get('Sad');
  assert.ok(
    sadAnim.channels.some((c) => c.target?.path === 'weights'),
    `${relPath}: Sad clip must animate facial morph weights`,
  );

  return { size, joints, animCount: g.animations.length };
}

const male = verifyBody('public/models/avatars/male/body.glb', 34, [
  'Cube',
  'Cube.001',
]);
const female = verifyBody('public/models/avatars/female/body.glb', 41, [
  'Cube.022',
  'Cube.023',
]);

for (const [name, mj] of male.joints) {
  const fj = female.joints.get(name);
  assert.ok(fj, `female/body.glb missing canonical joint ${name}`);
  assert.equal(
    fj.parent,
    mj.parent,
    `joint ${name} parent mismatch: ${fj.parent} != ${mj.parent}`,
  );
  assertCloseVec(fj.translation, mj.translation, `${name}.translation`);
  assertCloseVec(fj.rotation, mj.rotation, `${name}.rotation`);
  assertCloseVec(fj.scale, mj.scale, `${name}.scale`);
}

console.log(
  `[test-avatar-animations] PASS: male/body.glb (${male.size} B, 34 joints, ${male.animCount} clips), female/body.glb (${female.size} B, 41 joints, ${female.animCount} clips), all 16 canonical clips + 4 transitions verified.`,
);
