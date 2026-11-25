import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const BOT_GLB_REL = 'public/models/bot/tutor-bot.glb';
const STATION_GLB_REL = 'public/models/bot/bot-station.glb';
const ICON_SVG_REL = 'public/icons/tutor-bot.svg';
const MAX_ASSET_BYTES = 1024 * 1024; // 1 MiB (FD8)

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

function assertNonMetallicPalette(relPath, g, expectedMaterials) {
  const matNames = (g.materials ?? []).map((m) => m.name).sort();
  assert.deepEqual(
    matNames,
    expectedMaterials,
    `${relPath}: exact semantic materials (no .001 suffixes)`,
  );
  for (const mat of g.materials ?? []) {
    const metal = mat.pbrMetallicRoughness?.metallicFactor ?? 0;
    assert.equal(metal, 0, `${relPath}: ${mat.name} non-metallic`);
    // Ensure Michi's petGreen (#65B96A -> linear ~0.130, 0.485, 0.144) is never used
    const base = mat.pbrMetallicRoughness?.baseColorFactor;
    if (Array.isArray(base)) {
      const isPetGreen =
        Math.abs(base[0] - 0.13) < 0.025 &&
        Math.abs(base[1] - 0.485) < 0.025 &&
        Math.abs(base[2] - 0.144) < 0.025;
      assert.equal(
        isPetGreen,
        false,
        `${relPath}: ${mat.name} must not reuse petGreen #65B96A`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 1. Verify Tutor Bot 3D model (tutor-bot.glb)
// ---------------------------------------------------------------------------
const EXPECTED_BOT_MESHES = [
  'Bot_Antenna',
  'Bot_EarPods',
  'Bot_Face_Happy',
  'Bot_Face_Sleeping',
  'Bot_Face_Surprised',
  'Bot_Face_Talking',
  'Bot_Face_Thinking',
  'Bot_Forearms',
  'Bot_Hands',
  'Bot_Head',
  'Bot_HoverBase',
  'Bot_Neck',
  'Bot_ScreenBase',
  'Bot_ScreenBezel',
  'Bot_Torso',
  'Bot_UpperArms',
];

const EXPECTED_BOT_BONES = [
  ['DEF-root', null],
  ['DEF-pelvis', 'DEF-root'],
  ['DEF-thruster', 'DEF-pelvis'],
  ['DEF-spine', 'DEF-pelvis'],
  ['DEF-spine.001', 'DEF-spine'],
  ['DEF-neck', 'DEF-spine.001'],
  ['DEF-head', 'DEF-neck'],
  ['DEF-ear.L', 'DEF-head'],
  ['DEF-ear.R', 'DEF-head'],
  ['DEF-antenna.001', 'DEF-head'],
  ['DEF-antenna.002', 'DEF-antenna.001'],
  ['DEF-face_happy', 'DEF-head'],
  ['DEF-face_thinking', 'DEF-head'],
  ['DEF-face_talking', 'DEF-head'],
  ['DEF-face_surprised', 'DEF-head'],
  ['DEF-face_sleeping', 'DEF-head'],
  ['DEF-shoulder.L', 'DEF-spine.001'],
  ['DEF-upper_arm.L', 'DEF-shoulder.L'],
  ['DEF-forearm.L', 'DEF-upper_arm.L'],
  ['DEF-hand.L', 'DEF-forearm.L'],
  ['DEF-thumb.L', 'DEF-hand.L'],
  ['DEF-shoulder.R', 'DEF-spine.001'],
  ['DEF-upper_arm.R', 'DEF-shoulder.R'],
  ['DEF-forearm.R', 'DEF-upper_arm.R'],
  ['DEF-hand.R', 'DEF-forearm.R'],
  ['DEF-thumb.R', 'DEF-hand.R'],
];

const EXPECTED_BOT_MATERIALS = [
  'BotAccentTint',
  'BotBezelSlate',
  'BotFaceCheek',
  'BotFaceGlow',
  'BotGlowWarm',
  'BotHighlightButter',
  'BotHighlightTurquoise',
  'BotScreenGlass',
  'BotShellTint',
];

const EXPECTED_BOT_ANIMS = [
  'Celebrate',
  'Encourage',
  'Face_Happy',
  'Face_Sleeping',
  'Face_Surprised',
  'Face_Talking',
  'Face_Thinking',
  'IdleHover',
  'Talk',
  'Think',
  'Wave',
];

const EXPECTED_FACE_MORPHS = {
  Bot_Face_Happy: ['Blink'],
  Bot_Face_Thinking: ['ThinkPulse'],
  Bot_Face_Talking: ['MouthTalk'],
  Bot_Face_Surprised: ['SurprisedPop'],
  Bot_Face_Sleeping: ['SleepFloat'],
};

const { bytes: botBytes, json: botG } = readGlb(BOT_GLB_REL);
assert.ok(
  botBytes <= MAX_ASSET_BYTES,
  `${BOT_GLB_REL}: exceeds 1 MB FD8 budget (${botBytes} B)`,
);
assert.ok(
  botG.extensionsUsed?.includes('KHR_draco_mesh_compression'),
  `${BOT_GLB_REL}: Draco compression required`,
);
assert.equal(botG.cameras?.length ?? 0, 0, `${BOT_GLB_REL}: zero cameras`);
assert.equal(
  botG.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
  0,
  `${BOT_GLB_REL}: zero lights`,
);

const botMeshNames = (botG.meshes ?? []).map((m) => m.name).sort();
assert.deepEqual(
  botMeshNames,
  EXPECTED_BOT_MESHES,
  `${BOT_GLB_REL}: exact 16 Bot_* meshes`,
);

const botMeshNodes = (botG.nodes ?? []).filter((n) => n.mesh !== undefined);
assert.equal(botMeshNodes.length, 16, `${BOT_GLB_REL}: 16 mesh nodes`);
for (const n of botMeshNodes) {
  assert.ok(
    EXPECTED_BOT_MESHES.includes(n.name),
    `${BOT_GLB_REL}: clean mesh node name (${n.name})`,
  );
  assert.equal(n.skin, 0, `${BOT_GLB_REL}: ${n.name} bound to skin 0`);
  assert.ok(
    !n.translation && !n.rotation && !n.scale && !n.matrix,
    `${BOT_GLB_REL}: ${n.name} identity transform`,
  );
}

const botRigNode = (botG.nodes ?? []).find((n) => n.name === 'TutorBotRig');
assert.ok(botRigNode, `${BOT_GLB_REL}: TutorBotRig node required`);
assert.ok(
  !botRigNode.translation &&
    !botRigNode.rotation &&
    !botRigNode.scale &&
    !botRigNode.matrix,
  `${BOT_GLB_REL}: TutorBotRig identity transform`,
);

assert.equal(
  botG.skins?.length ?? 0,
  1,
  `${BOT_GLB_REL}: single skin required`,
);
const skin = botG.skins[0];
assert.equal(skin.joints.length, 26, `${BOT_GLB_REL}: 26 canonical bones`);

const parentByIdx = new Map();
(botG.nodes ?? []).forEach((n, idx) => {
  (n.children ?? []).forEach((c) => parentByIdx.set(c, idx));
});
const actualHierarchy = skin.joints
  .map((jIdx) => {
    const pIdx = parentByIdx.get(jIdx);
    const pNode = pIdx !== undefined ? botG.nodes[pIdx] : undefined;
    const pName = pNode && skin.joints.includes(pIdx) ? pNode.name : null;
    return [botG.nodes[jIdx].name, pName];
  })
  .sort((a, b) => a[0].localeCompare(b[0]));

assert.deepEqual(
  actualHierarchy,
  [...EXPECTED_BOT_BONES].sort((a, b) => a[0].localeCompare(b[0])),
  `${BOT_GLB_REL}: exact 26-bone hierarchy`,
);

for (const [mname, expectedTargets] of Object.entries(EXPECTED_FACE_MORPHS)) {
  const m = botG.meshes.find((mesh) => mesh.name === mname);
  assert.deepEqual(
    m?.extras?.targetNames,
    expectedTargets,
    `${BOT_GLB_REL}: ${mname} morph targets`,
  );
  for (const prim of m.primitives) {
    assert.equal(
      prim.targets?.length,
      expectedTargets.length,
      `${BOT_GLB_REL}: ${mname} prim target count`,
    );
  }
}

const animNames = (botG.animations ?? []).map((a) => a.name).sort();
assert.deepEqual(
  animNames,
  EXPECTED_BOT_ANIMS,
  `${BOT_GLB_REL}: exact 11 animation clips`,
);
for (const anim of botG.animations) {
  assert.ok(
    anim.channels.length > 0 && anim.samplers.length > 0,
    `${BOT_GLB_REL}: animation ${anim.name} has channels`,
  );
}

assertNonMetallicPalette(BOT_GLB_REL, botG, EXPECTED_BOT_MATERIALS);

const botBounds = unionGltfBounds(botG);
assert.ok(
  Math.abs(botBounds.min[1]) <= 0.003,
  `${BOT_GLB_REL}: grounded Y=0 (${botBounds.min[1]})`,
);
assert.ok(
  botBounds.max[1] >= 0.8 && botBounds.max[1] <= 0.94,
  `${BOT_GLB_REL}: rest height (${botBounds.max[1]})`,
);
assert.ok(
  botBounds.max[2] >= 0.12 && botBounds.min[2] <= -0.12,
  `${BOT_GLB_REL}: facing +Z depth bounds (${botBounds.min[2]}..${botBounds.max[2]})`,
);

// ---------------------------------------------------------------------------
// 2. Verify Bot Station 3D model (bot-station.glb)
// ---------------------------------------------------------------------------
const EXPECTED_STATION_MESHES = [
  'Station_BackConsole',
  'Station_Books',
  'Station_ChargeRing',
  'Station_DockPedestal',
  'Station_LampGlobe',
  'Station_LampStem',
  'Station_Pouf',
  'Station_Rug',
  'Station_StudySign',
];

const EXPECTED_STATION_MATERIALS = [
  'StationButter',
  'StationCoral',
  'StationCreamPale',
  'StationLavender',
  'StationPeach',
  'StationSkyBlue',
  'StationSlateDark',
  'StationTurquoise',
  'StationWarmGlow',
  'StationWood',
  'StationWoodLight',
];

const { bytes: stBytes, json: stG } = readGlb(STATION_GLB_REL);
assert.ok(
  stBytes <= MAX_ASSET_BYTES,
  `${STATION_GLB_REL}: exceeds 1 MB FD8 budget (${stBytes} B)`,
);
assert.ok(
  stG.extensionsUsed?.includes('KHR_draco_mesh_compression'),
  `${STATION_GLB_REL}: Draco compression required`,
);
assert.equal(
  stG.animations?.length ?? 0,
  0,
  `${STATION_GLB_REL}: zero animations`,
);
assert.equal(stG.cameras?.length ?? 0, 0, `${STATION_GLB_REL}: zero cameras`);
assert.equal(
  stG.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
  0,
  `${STATION_GLB_REL}: zero lights`,
);
assert.deepEqual(
  (stG.meshes ?? []).map((m) => m.name).sort(),
  EXPECTED_STATION_MESHES,
  `${STATION_GLB_REL}: exact 9 Station_* meshes`,
);
assertNonMetallicPalette(STATION_GLB_REL, stG, EXPECTED_STATION_MATERIALS);

const stBounds = unionGltfBounds(stG);
assert.ok(
  Math.abs(stBounds.min[1]) <= 0.003,
  `${STATION_GLB_REL}: grounded Y=0 (${stBounds.min[1]})`,
);
assert.ok(
  stBounds.max[1] >= 1.15 && stBounds.max[1] <= 1.55,
  `${STATION_GLB_REL}: lamp height (${stBounds.max[1]})`,
);

// ---------------------------------------------------------------------------
// 3. Verify 2D Bot Icon (public/icons/tutor-bot.svg)
// ---------------------------------------------------------------------------
const svgText = fs.readFileSync(new URL(ICON_SVG_REL, root), 'utf8');
assert.ok(
  Buffer.byteLength(svgText, 'utf8') <= 10 * 1024,
  `${ICON_SVG_REL}: SVG under 10 KB`,
);
assert.ok(svgText.includes('<svg'), `${ICON_SVG_REL}: valid SVG root`);
assert.ok(
  svgText.includes('viewBox="0 0 64 64"'),
  `${ICON_SVG_REL}: 64x64 viewBox`,
);
const svgWithoutXmlns = svgText.replaceAll('http://www.w3.org/2000/svg', '');
assert.equal(
  /<script/i.test(svgText) || /https?:\/\//i.test(svgWithoutXmlns),
  false,
  `${ICON_SVG_REL}: no script or external URLs`,
);
assert.ok(
  svgText.includes('#B5A7D6') && svgText.includes('#FFF9EB'),
  `${ICON_SVG_REL}: uses Tutor Corner lavender & cream palette`,
);
assert.equal(
  svgText.toUpperCase().includes('#65B96A'),
  false,
  `${ICON_SVG_REL}: must not reuse petGreen #65B96A`,
);

console.log(
  `[test-tutor-bot] PASS: ${BOT_GLB_REL} (${botBytes} B, 16 meshes, 26 bones, 5 morphs, 11 clips), ${STATION_GLB_REL} (${stBytes} B, 9 meshes), ${ICON_SVG_REL} (${Buffer.byteLength(svgText, 'utf8')} B)`,
);
