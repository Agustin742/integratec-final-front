import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  Bone,
  BufferGeometry,
  Group,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
} from 'three';
import { describe, expect, it } from 'vitest';
import { TUTOR_BOT_SKINS } from '@/realtime/contracts.generated';
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
