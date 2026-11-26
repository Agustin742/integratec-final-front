import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  type Object3D,
} from 'three';
import { describe, expect, it } from 'vitest';
import { TUTOR_BOT_SKINS } from '@/realtime/contracts.generated';
import { mergeSkinnedByMaterial } from './merge-skinned-by-material';
import {
  BOT_HIDEABLE_MESHES,
  planBotSkin,
  wearBotSkin,
} from './tutor-bot-skin';

function skinned(name: string, bones: Bone[]): SkinnedMesh {
  const mesh = new SkinnedMesh(
    new BufferGeometry(),
    new MeshStandardMaterial(),
  );
  mesh.name = name;
  mesh.bind(new Skeleton(bones), mesh.matrixWorld);
  return mesh;
}

function rig(names: readonly string[]) {
  const scene = new Group();
  const bones = names.map((name) => {
    const bone = new Bone();
    bone.name = name;
    scene.add(bone);
    return bone;
  });
  return { scene, bones };
}

function baseBot() {
  const { scene, bones } = rig(['DEF-spine', 'DEF-head']);
  for (const name of [
    'Bot_Torso',
    'Bot_UpperArms',
    'Bot_Forearms',
    'Bot_Face_Happy',
  ]) {
    scene.add(skinned(name, bones));
  }
  return { model: scene, bones };
}

function skinScene(boneNames = ['DEF-head', 'DEF-spine']) {
  const { scene, bones } = rig(boneNames);
  scene.add(skinned('BotSkin_Jersey', bones));
  return scene;
}

const visible = (root: Group, name: string) =>
  root.getObjectByName(name)?.visible;

describe('planBotSkin', () => {
  it('has nothing to load for the default bot', () => {
    expect(planBotSkin('none')).toBeNull();
    expect(planBotSkin('pirate')).toBeNull();
  });

  it.each(TUTOR_BOT_SKINS.filter((skin) => skin !== 'none'))(
    'points %s at its model and hides only hideable base meshes',
    (skin) => {
      const plan = planBotSkin(skin)!;
      expect(plan.url).toBe(`/models/bot/skins/skin-${skin}.glb`);
      expect(
        existsSync(resolve(process.cwd(), 'public', plan.url.slice(1))),
      ).toBe(true);
      expect(plan.hidden).toContain('Bot_Torso');
      for (const name of plan.hidden) {
        expect(BOT_HIDEABLE_MESHES).toContain(name);
      }
    },
  );

  it('keeps the arms for short sleeves and hides them for long ones', () => {
    expect(planBotSkin('boca')?.hidden).toEqual(['Bot_Torso']);
    expect(planBotSkin('gamer')?.hidden).toEqual([
      'Bot_Torso',
      'Bot_UpperArms',
      'Bot_Forearms',
    ]);
  });
});

describe('wearBotSkin', () => {
  it('binds the skin to the bot bones by name and hides what it covers', () => {
    const { model, bones } = baseBot();
    const source = skinScene();

    const remove = wearBotSkin(model, source, ['Bot_Torso']);

    const jersey = model.getObjectByName('BotSkin_Jersey') as SkinnedMesh;
    expect(jersey.skeleton.bones).toEqual([bones[1], bones[0]]);
    expect(visible(model, 'Bot_Torso')).toBe(false);
    expect(visible(model, 'Bot_UpperArms')).toBe(true);
    expect(visible(model, 'Bot_Face_Happy')).toBe(true);
    // The cached skin scene is never moved into the bot.
    expect(source.getObjectByName('BotSkin_Jersey')).toBeDefined();

    remove?.();

    expect(model.getObjectByName('BotSkin_Jersey')).toBeUndefined();
    expect(visible(model, 'Bot_Torso')).toBe(true);
  });

  it('leaves the default bot when the skin does not fit the rig', () => {
    const { model } = baseBot();

    expect(
      wearBotSkin(model, skinScene(['DEF-tail']), ['Bot_Torso']),
    ).toBeNull();
    expect(wearBotSkin(model, new Group(), ['Bot_Torso'])).toBeNull();
    expect(model.getObjectByName('BotSkin_Jersey')).toBeUndefined();
    expect(visible(model, 'Bot_Torso')).toBe(true);
  });
});

interface GlbDocument {
  readonly nodes: { name?: string; mesh?: number }[];
  readonly meshes: { primitives: { material?: number }[] }[];
  readonly skins: { joints: number[] }[];
}

function readGlb(file: string): GlbDocument {
  const buffer = readFileSync(
    resolve(process.cwd(), 'public/models/bot', file),
  );
  const json = buffer.subarray(20, 20 + buffer.readUInt32LE(12));
  return JSON.parse(json.toString('utf8')) as GlbDocument;
}

const jointNames = (doc: GlbDocument) =>
  doc.skins.flatMap((skin) =>
    skin.joints.map((index) => doc.nodes[index]!.name!),
  );

/**
 * The base bot's meshes as `GLTFLoader` builds them: a mesh with several
 * primitives becomes a group with the node name, whose children are
 * suffixed (`Bot_Torso_1`).
 */
function baseBotAsLoaded() {
  const doc = readGlb('tutor-bot.glb');
  const { scene, bones } = rig(['DEF-spine']);
  const materials = new Map<number, MeshStandardMaterial>();
  const primitiveCounts = new Map<string, number>();
  for (const node of doc.nodes) {
    if (node.mesh === undefined) continue;
    const { primitives } = doc.meshes[node.mesh]!;
    primitiveCounts.set(node.name!, primitives.length);
    const parts = primitives.map((primitive, index) => {
      const id = primitive.material!;
      materials.set(id, materials.get(id) ?? new MeshStandardMaterial());
      const geometry = new BufferGeometry();
      geometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(9), 3),
      );
      const mesh = new SkinnedMesh(geometry, materials.get(id));
      mesh.name =
        primitives.length === 1 ? node.name! : `${node.name!}_${index + 1}`;
      mesh.bind(new Skeleton(bones), mesh.matrixWorld);
      return mesh;
    });
    if (parts.length === 1) {
      scene.add(parts[0]!);
      continue;
    }
    const group = new Group();
    group.name = node.name!;
    group.add(...parts);
    scene.add(group);
  }
  return { scene, primitiveCounts };
}

const drawnUnder = (node: Object3D) => {
  let count = 0;
  node.traverse((child) => {
    if ((child as SkinnedMesh).isSkinnedMesh) count += 1;
  });
  return count;
};

describe('committed bot models', () => {
  it('keeps every hideable part, with all its primitives, apart when merging', () => {
    const { scene, primitiveCounts } = baseBotAsLoaded();

    mergeSkinnedByMaterial(scene, BOT_HIDEABLE_MESHES);

    for (const name of BOT_HIDEABLE_MESHES) {
      const part = scene.getObjectByName(name);
      expect(part, name).toBeDefined();
      // Nothing of this part moved out, and nothing foreign moved in.
      expect(drawnUnder(part!), name).toBe(primitiveCounts.get(name));
    }
  });

  it.each(TUTOR_BOT_SKINS.filter((skin) => skin !== 'none'))(
    'has every joint of the %s skin in the base rig',
    (skin) => {
      const base = new Set(jointNames(readGlb('tutor-bot.glb')));
      const joints = jointNames(readGlb(`skins/skin-${skin}.glb`));

      expect(joints.length).toBeGreaterThan(0);
      expect(joints.filter((joint) => !base.has(joint))).toEqual([]);
    },
  );
});
