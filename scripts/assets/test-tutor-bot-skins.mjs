import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('../../', import.meta.url);
const BASE_BOT_GLB_REL = 'public/models/bot/tutor-bot.glb';
const MAX_ASSET_BYTES = 1024 * 1024; // 1 MiB (FD8)

const SKINS = [
  {
    id: 'boca',
    prefix: 'BotSkin_Boca_',
    meshes: [
      'BotSkin_Boca_AntennaBall',
      'BotSkin_Boca_Collar',
      'BotSkin_Boca_Crest',
      'BotSkin_Boca_Jersey',
    ],
  },
  {
    id: 'seleccion',
    prefix: 'BotSkin_Seleccion_',
    meshes: [
      'BotSkin_Seleccion_Collar',
      'BotSkin_Seleccion_CrestAndStars',
      'BotSkin_Seleccion_Headband',
      'BotSkin_Seleccion_Jersey',
    ],
  },
  {
    id: 'folklore',
    prefix: 'BotSkin_Folklore_',
    meshes: [
      'BotSkin_Folklore_Beret',
      'BotSkin_Folklore_Poncho',
      'BotSkin_Folklore_Scarf',
    ],
  },
  {
    id: 'guardapolvo',
    prefix: 'BotSkin_Guardapolvo_',
    meshes: [
      'BotSkin_Guardapolvo_CollarAndButtons',
      'BotSkin_Guardapolvo_Glasses',
      'BotSkin_Guardapolvo_PocketAndTools',
      'BotSkin_Guardapolvo_Smock',
    ],
  },
  {
    id: 'scientist',
    prefix: 'BotSkin_Scientist_',
    meshes: [
      'BotSkin_Scientist_AtomTopper',
      'BotSkin_Scientist_Goggles',
      'BotSkin_Scientist_InnerShirt',
      'BotSkin_Scientist_LabCoat',
    ],
  },
  {
    id: 'graduate',
    prefix: 'BotSkin_Graduate_',
    meshes: [
      'BotSkin_Graduate_Gown',
      'BotSkin_Graduate_Mortarboard',
      'BotSkin_Graduate_Stole',
      'BotSkin_Graduate_Tassel',
    ],
  },
  {
    id: 'gamer',
    prefix: 'BotSkin_Gamer_',
    meshes: [
      'BotSkin_Gamer_BoomMic',
      'BotSkin_Gamer_Headset',
      'BotSkin_Gamer_Hoodie',
    ],
  },
];

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

function binding(g, skin) {
  const parents = new Map();
  (g.nodes ?? []).forEach((n, i) =>
    (n.children ?? []).forEach((c) => parents.set(c, i)),
  );
  return skin.joints
    .map((i) => {
      const n = g.nodes[i];
      return {
        name: n.name,
        parent: g.nodes[parents.get(i)]?.name ?? null,
        translation: n.translation ?? [0, 0, 0],
        rotation: n.rotation ?? [0, 0, 0, 1],
        scale: n.scale ?? [1, 1, 1],
        matrix: n.matrix ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function close(a, b, label) {
  assert.equal(a.length, b.length, label);
  a.forEach((v, i) =>
    assert.ok(Math.abs(v - b[i]) < 1e-4, `${label}[${i}]: ${v} != ${b[i]}`),
  );
}

const { json: baseG } = readGlb(BASE_BOT_GLB_REL);
const baseJointNames = baseG.skins[0].joints
  .map((i) => baseG.nodes[i].name)
  .sort();
assert.equal(baseJointNames.length, 26, 'base TutorBotRig has 26 bones');
const refBinding = binding(baseG, baseG.skins[0]);

let totalBytes = 0;

for (const spec of SKINS) {
  const relPath = `public/models/bot/skins/skin-${spec.id}.glb`;
  const { bytes, json: g } = readGlb(relPath);
  totalBytes += bytes;

  assert.ok(
    bytes <= MAX_ASSET_BYTES,
    `${relPath}: exceeds 1 MB FD8 budget (${bytes} B)`,
  );
  assert.ok(
    g.extensionsUsed?.includes('KHR_draco_mesh_compression'),
    `${relPath}: Draco compression required`,
  );
  assert.equal(g.animations?.length ?? 0, 0, `${relPath}: zero animations`);
  assert.equal(g.cameras?.length ?? 0, 0, `${relPath}: zero cameras`);
  assert.equal(
    g.extensions?.KHR_lights_punctual?.lights?.length ?? 0,
    0,
    `${relPath}: zero lights`,
  );

  for (const node of g.nodes ?? []) {
    assert.equal(node.camera, undefined, `${relPath}: no node camera`);
    assert.equal(
      node.extensions?.KHR_lights_punctual,
      undefined,
      `${relPath}: no node light`,
    );
    assert.ok(
      !node.name?.startsWith('Icosphere'),
      `${relPath}: no importer Icosphere (${node.name})`,
    );
    assert.ok(
      !node.name?.startsWith('Bot_'),
      `${relPath}: no base Bot_* mesh leaked (${node.name})`,
    );
  }

  assert.equal(g.skins?.length ?? 0, 1, `${relPath}: single TutorBotRig skin`);
  const skin = g.skins[0];
  assert.deepEqual(
    skin.joints.map((i) => g.nodes[i].name).sort(),
    baseJointNames,
    `${relPath}: exact 26 canonical TutorBotRig bones`,
  );
  binding(g, skin).forEach((joint, i) => {
    const expected = refBinding[i];
    assert.equal(joint.name, expected.name);
    assert.equal(joint.parent, expected.parent);
    for (const key of ['translation', 'rotation', 'scale']) {
      close(joint[key], expected[key], `${relPath} ${joint.name} ${key}`);
    }
    assert.equal(joint.matrix === null, expected.matrix === null);
    if (joint.matrix) {
      close(joint.matrix, expected.matrix, `${relPath} ${joint.name} matrix`);
    }
  });

  const meshNames = (g.meshes ?? []).map((m) => m.name).sort();
  assert.deepEqual(
    meshNames,
    [...spec.meshes].sort(),
    `${relPath}: exact semantic BotSkin_* meshes`,
  );

  const meshNodes = (g.nodes ?? []).filter((n) => n.mesh !== undefined);
  assert.equal(
    meshNodes.length,
    spec.meshes.length,
    `${relPath}: mesh node count`,
  );
  for (const node of meshNodes) {
    assert.ok(
      node.name.startsWith(spec.prefix),
      `${relPath}: mesh prefix (${node.name})`,
    );
    assert.equal(node.skin, 0, `${relPath}: ${node.name} skinned to skin 0`);
    close(
      node.translation ?? [0, 0, 0],
      [0, 0, 0],
      `${relPath} ${node.name} translation`,
    );
    close(
      node.rotation ?? [0, 0, 0, 1],
      [0, 0, 0, 1],
      `${relPath} ${node.name} rotation`,
    );
    close(
      node.scale ?? [1, 1, 1],
      [1, 1, 1],
      `${relPath} ${node.name} scale`,
    );
    assert.equal(node.matrix, undefined, `${relPath} ${node.name} no matrix`);

    for (const prim of g.meshes[node.mesh].primitives) {
      assert.ok(
        prim.attributes.JOINTS_0 !== undefined,
        `${relPath} ${node.name}: JOINTS_0 required`,
      );
      assert.ok(
        prim.attributes.WEIGHTS_0 !== undefined,
        `${relPath} ${node.name}: WEIGHTS_0 required`,
      );
      assert.ok(
        prim.extensions?.KHR_draco_mesh_compression,
        `${relPath} ${node.name}: Draco required`,
      );
    }
  }

  for (const mat of g.materials ?? []) {
    assert.ok(
      !/\.\d{3}$/.test(mat.name),
      `${relPath}: clean material name without .001 suffix (${mat.name})`,
    );
    assert.match(
      mat.name,
      /^BotSkin/,
      `${relPath}: BotSkin* semantic material (${mat.name})`,
    );
    const metal = mat.pbrMetallicRoughness?.metallicFactor ?? 0;
    assert.equal(metal, 0, `${relPath}: ${mat.name} non-metallic`);
    const base = mat.pbrMetallicRoughness?.baseColorFactor;
    if (Array.isArray(base)) {
      const isPetGreen =
        Math.abs(base[0] - 0.13) < 0.025 &&
        Math.abs(base[1] - 0.485) < 0.025 &&
        Math.abs(base[2] - 0.144) < 0.025;
      assert.equal(
        isPetGreen,
        false,
        `${relPath}: ${mat.name} must not reuse Michi petGreen #65B96A`,
      );
    }
  }

  console.log(
    `PASS skin-${spec.id}.glb: ${bytes} B, ${spec.meshes.length} skinned meshes, 26 TutorBotRig bones, 0 anims`,
  );
}

console.log(
  `ALL ${SKINS.length} TUTOR BOT SKINS PASSED (${totalBytes} bytes combined).`,
);
