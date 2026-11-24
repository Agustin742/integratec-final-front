import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_CODES,
  resolveAccessory,
  resolveHairMorphs,
  resolveHeadwearHiding,
} from './accessory-catalog';

const BODIES = ['male', 'female'] as const;

function publicPath(url: string): string {
  return resolve(process.cwd(), 'public', url.replace(/^\//, ''));
}

function glbJson(url: string): { nodes?: { name?: string }[] } {
  const buffer = readFileSync(publicPath(url));
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

/** Names of every node in a GLB, read from its JSON chunk. */
function glbNodeNames(url: string): string[] {
  return (glbJson(url).nodes ?? []).map((node) => node.name ?? '');
}

const HAIR_IDS = [
  'buzz-cut',
  'classic-short',
  'short-curls',
  'bob',
  'middle-part',
  'long-straight',
  'ponytail',
  'bun',
  'afro',
  'side-part',
  'fringe',
  'wavy',
  'messy',
  'long-curls',
  'long-wavy',
  'half-up',
  'braid',
  'two-braids',
  'dreads',
  'two-pigtails',
  'box-braids',
  'soft-mohawk',
  'afro-with-headband',
];
const LONG_HAIR = [
  'long-straight',
  'long-wavy',
  'long-curls',
  'braid',
  'two-braids',
  'half-up',
  'box-braids',
  'dreads',
];
const HEAD_IDS = [
  'headband',
  'cap',
  'backwards-cap',
  'beanie',
  'headphones',
  'graduation-cap',
  'top-hat',
  'crown',
  'astronaut-helmet',
];

describe('resolveAccessory', () => {
  it('covers the 21 shop accessory codes', () => {
    expect(ACCESSORY_CODES).toHaveLength(21);
  });

  it.each(
    ACCESSORY_CODES.flatMap((code) =>
      BODIES.map((body) => [code, body] as const),
    ),
  )('%s resolves to an existing GLB for %s', (code, body) => {
    const spec = resolveAccessory(code);
    expect(spec).not.toBeNull();
    expect(spec?.code).toBe(code);
    expect(spec?.fixedColor).toMatch(/^#[0-9A-F]{6}$/);
    expect(existsSync(publicPath(spec?.url(body) ?? ''))).toBe(true);
  });

  it('uses shared models for head, face and wings, per-body models for other back items', () => {
    expect(resolveAccessory('head_crown')?.url('male')).toBe(
      '/models/avatars/shared/head-crown.glb',
    );
    expect(resolveAccessory('face_face_paint')?.url('female')).toBe(
      '/models/avatars/shared/face-face-paint.glb',
    );
    expect(resolveAccessory('back_wings')?.url('female')).toBe(
      '/models/avatars/shared/back-wings.glb',
    );
    expect(resolveAccessory('back_guitar')?.url('female')).toBe(
      '/models/avatars/female/back-guitar.glb',
    );
    expect(resolveAccessory('back_rolling_backpack')?.url('male')).toBe(
      '/models/avatars/male/back-rolling-backpack.glb',
    );
  });

  it('exposes slot and asset id', () => {
    expect(resolveAccessory('head_backwards_cap')).toMatchObject({
      slot: 'head',
      assetId: 'backwards-cap',
    });
    expect(resolveAccessory('back_superhero_cape')).toMatchObject({
      slot: 'back',
      assetId: 'superhero-cape',
    });
  });

  it('returns null for unknown codes instead of throwing', () => {
    expect(resolveAccessory('head_unknown')).toBeNull();
    expect(resolveAccessory('')).toBeNull();
    expect(resolveAccessory('cap_blue')).toBeNull();
    expect(resolveAccessory('constructor')).toBeNull();
  });
});

describe('resolveHeadwearHiding', () => {
  it('hides the afro cloud under a cap but keeps the cap submesh', () => {
    const result = resolveHeadwearHiding('afro', 'cap');
    expect(result.hairHidden).toEqual(['HairAfro_Cloud']);
    expect(result.hairHidden).not.toContain('HairAfro_Cap');
    expect(result.headHidden).toEqual([]);
  });

  it('hides nothing for buzz-cut under a cap', () => {
    expect(resolveHeadwearHiding('buzz-cut', 'cap')).toMatchObject({
      hairHidden: [],
      headHidden: [],
    });
  });

  it('applies the hat table to every crown-covering hat', () => {
    for (const hat of [
      'cap',
      'backwards-cap',
      'beanie',
      'top-hat',
      'crown',
      'graduation-cap',
    ]) {
      expect(resolveHeadwearHiding('bun', hat).hairHidden).toEqual([
        'HairBun_Bun',
      ]);
      expect(resolveHeadwearHiding('half-up', hat).hairHidden).toEqual([
        'HairHalfUp_HalfUpTie',
      ]);
    }
  });

  it('does not hide hair under headphones or a headband', () => {
    expect(resolveHeadwearHiding('bun', 'headphones').hairHidden).toEqual([]);
    expect(resolveHeadwearHiding('bob', 'headband').hairHidden).toEqual([]);
  });

  it('hides bob curtain and bangs inside the astronaut helmet, keeping the cap', () => {
    expect(resolveHeadwearHiding('bob', 'astronaut-helmet').hairHidden).toEqual(
      ['HairBob_Curtain', 'HairBob_Bangs'],
    );
  });

  it('keeps short hair fully visible inside the astronaut helmet', () => {
    for (const hair of [
      'buzz-cut',
      'classic-short',
      'fringe',
      'short-curls',
      'side-part',
      'soft-mohawk',
    ]) {
      expect(
        resolveHeadwearHiding(hair, 'astronaut-helmet').hairHidden,
      ).toEqual([]);
    }
  });

  it('never hides a hair cap submesh', () => {
    for (const hair of HAIR_IDS) {
      for (const head of [...HEAD_IDS, null]) {
        const { hairHidden } = resolveHeadwearHiding(hair, head);
        expect(hairHidden.filter((name) => name.endsWith('_Cap'))).toEqual([]);
      }
    }
  });

  it('swaps the afro for the fitted headband afro and suppresses the loose headband', () => {
    const result = resolveHeadwearHiding('afro', 'headband');
    expect(result.hairId).toBe('afro-with-headband');
    expect(result.hairHidden).toEqual([]);
    expect(result.headHidden).toEqual([
      'HeadHeadband_Band',
      'HeadHeadband_Trim',
    ]);
  });

  it('suppresses a redundant headband over the afro-with-headband hair', () => {
    const result = resolveHeadwearHiding('afro-with-headband', 'headband');
    expect(result.hairId).toBe('afro-with-headband');
    expect(result.headHidden).toEqual([
      'HeadHeadband_Band',
      'HeadHeadband_Trim',
    ]);
  });

  it('hides the sewn-in headband of the fitted afro under a hat', () => {
    expect(
      resolveHeadwearHiding('afro-with-headband', 'cap').hairHidden,
    ).toEqual(['HairAfroWithHeadband_Cloud', 'HairAfroWithHeadband_Headband']);
  });

  it('keeps the hair id and hides nothing without a head accessory', () => {
    expect(resolveHeadwearHiding('afro', null)).toEqual({
      hairId: 'afro',
      hairHidden: [],
      headHidden: [],
    });
    expect(resolveHeadwearHiding('unknown-hair', 'cap').hairHidden).toEqual([]);
  });

  it('only hides names that exist in the hair and head GLBs', () => {
    for (const hair of HAIR_IDS) {
      for (const head of HEAD_IDS) {
        const result = resolveHeadwearHiding(hair, head);
        const hairNodes = glbNodeNames(
          `/models/avatars/shared/hair-${result.hairId}.glb`,
        );
        const headNodes = glbNodeNames(
          `/models/avatars/shared/head-${head}.glb`,
        );
        for (const name of result.hairHidden) expect(hairNodes).toContain(name);
        for (const name of result.headHidden) expect(headNodes).toContain(name);
      }
    }
  });
});

describe('resolveHairMorphs', () => {
  it('tucks long hair when any back accessory is equipped', () => {
    for (const hair of LONG_HAIR) {
      expect(resolveHairMorphs(hair, 'backpack')).toEqual({ BackTuck: 1 });
    }
  });

  it('does nothing without a back accessory', () => {
    for (const hair of LONG_HAIR) {
      expect(resolveHairMorphs(hair, null)).toEqual({});
    }
  });

  it('does nothing for hair without the morph target', () => {
    expect(resolveHairMorphs('afro', 'wings')).toEqual({});
    expect(resolveHairMorphs('bob', 'guitar')).toEqual({});
  });

  it('lists exactly the hair GLBs that carry the BackTuck morph', () => {
    const withMorph = HAIR_IDS.filter((hair) => {
      const buffer = readFileSync(
        publicPath(`/models/avatars/shared/hair-${hair}.glb`),
      );
      return buffer
        .subarray(20, 20 + buffer.readUInt32LE(12))
        .toString('utf8')
        .includes('"BackTuck"');
    });
    expect([...withMorph].sort()).toEqual([...LONG_HAIR].sort());
  });
});
