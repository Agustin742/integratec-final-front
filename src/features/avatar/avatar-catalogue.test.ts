import { describe, expect, it } from 'vitest';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';

const fixture = () => structuredClone(manifest);
describe('appearance catalogue boundary', () => {
  it('projects the real approved catalogue without assembly metadata', () => {
    const parsed = parseAppearanceCatalogue(manifest);
    expect(parsed.bodies.map(body => body.id)).toEqual(['male', 'female']);
    const ids = [
      [['afro', 'dreads'], ['hoodie', 'tank', 'uniform-primary-trousers', 'uniform-secondary-trousers'], ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack']],
      [['original', 'afro'], ['tshirt', 'hoodie', 'tank', 'uniform-primary-trousers', 'uniform-primary-skirt', 'uniform-secondary-trousers', 'uniform-secondary-skirt'], ['glasses', 'cap', 'headphones', 'earrings']],
    ];
    parsed.bodies.forEach((body, index) => {
      expect([body.hair, body.tops, body.accessories].map(list => list.map(item => item.id))).toEqual(ids[index]);
      expect(body.hair[0]).not.toHaveProperty('assembly');
      expect(toAppearanceChoices(parsed)[body.id].hair[0]).toEqual({ id: body.hair[0].id, label: body.hair[0].label });
    });
    expect(parsed.bodies[1].tops[1].path).toBe('/models/avatars/female/top-hoodie.glb');
  });
  it.each([null, {}, { version: 2, bodies: [] }])('rejects malformed roots %j', value => {
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('requires both bodies exactly once', () => {
    const value = fixture();
    value.bodies[1] = value.bodies[0];
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it('requires non-empty unique entries and correct slots and material arrays', () => {
    for (const mutate of [
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair = []; },
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[1].id = v.bodies[0].hair[0].id; },
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[0].slot = 'top'; },
      (v: ReturnType<typeof fixture>) => { v.bodies[0].hair[0].tintMaterials = [null as unknown as string]; },
    ]) {
      const value = fixture(); mutate(value);
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    }
  });
  it('validates body paths, rig identity and required strings', () => {
    for (const patch of [{ path: '/models/avatars/female/body.glb' }, { rigFamily: '' }, { id: 'other' }]) {
      const value = fixture(); Object.assign(value.bodies[0], patch);
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    }
    const value = fixture(); value.bodies[0].hair[0].label = '';
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });
  it.each(['https://evil.test/a.glb', '//evil.test/a.glb', '/models/avatars/male/../body.glb', '/models/avatars/male/%2e%2e/body.glb', '/models/avatars/male/unknown.glb', '/models/avatars/female/hair-original.glb', '/models/avatars/male/hair-classic-short.glb?x=1'])('rejects unsafe or mismatched paths %s', path => {
    const value = fixture(); value.bodies[0].hair[0].path = path;
    expect(() => parseAppearanceCatalogue(value)).toThrow();
  });

  describe('school uniform wardrobe options', () => {
    type Raw = { bodies: { tops: Record<string, unknown>[]; hair: Record<string, unknown>[] }[] };
    const raw = () => structuredClone(manifest) as unknown as Raw;
    const uniform = (value: Raw, body: number, id: string) => {
      const option = value.bodies[body].tops.find(top => top.id === id);
      if (!option) throw Error(`Missing fixture uniform ${id}`);
      return option;
    };
    const expected = [
      [0, 'uniform-primary-trousers', 'Uniforme primaria', '/models/avatars/male/uniforms/primary-trousers/coat-tie.glb', ['trousers', 'shoes']],
      [0, 'uniform-secondary-trousers', 'Uniforme secundaria', '/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb', ['trousers', 'shoes']],
      [1, 'uniform-primary-trousers', 'Uniforme primaria (pantalón)', '/models/avatars/female/uniforms/primary-trousers/coat-tie.glb', ['trousers', 'shoes']],
      [1, 'uniform-primary-skirt', 'Uniforme primaria (pollera)', '/models/avatars/female/uniforms/primary-skirt/coat-tie.glb', ['skirt', 'shoes']],
      [1, 'uniform-secondary-trousers', 'Uniforme secundaria (pantalón)', '/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb', ['trousers', 'shoes']],
      [1, 'uniform-secondary-skirt', 'Uniforme secundaria (pollera)', '/models/avatars/female/uniforms/secondary-skirt/polo-sweater.glb', ['skirt', 'shoes']],
    ] as const;

    it.each(expected)('exposes body %i option %s with its exact companion garments', (bodyIndex, id, label, path, extras) => {
      const parsed = parseAppearanceCatalogue(manifest);
      const option = parsed.bodies[bodyIndex].tops.find(top => top.id === id)!;
      const folder = path.slice(0, path.lastIndexOf('/'));
      expect(option).toMatchObject({ label, path, slot: 'top', tintMaterials: [], detailMaterials: [], hideBodyMeshes: ['Pants', 'boots'] });
      expect(option.extraPaths).toEqual(extras.map(file => `${folder}/${file}.glb`));
      expect(toAppearanceChoices(parsed)[parsed.bodies[bodyIndex].id].tops.find(top => top.id === id)).toEqual({ id, label });
    });

    it('leaves regular options without companion garments or hidden body meshes', () => {
      const parsed = parseAppearanceCatalogue(manifest);
      for (const top of parsed.bodies.flatMap(body => body.tops).filter(top => !top.id.startsWith('uniform-'))) {
        expect(top.extraPaths).toBeUndefined();
        expect(top.hideBodyMeshes).toBeUndefined();
      }
    });

    it.each([
      ['remote companion', ['https://evil.test/trousers.glb', '/models/avatars/male/uniforms/primary-trousers/shoes.glb']],
      ['traversal companion', ['/models/avatars/male/uniforms/primary-trousers/../trousers.glb', '/models/avatars/male/uniforms/primary-trousers/shoes.glb']],
      ['query companion', ['/models/avatars/male/uniforms/primary-trousers/trousers.glb?x=1', '/models/avatars/male/uniforms/primary-trousers/shoes.glb']],
      ['cross-body companion', ['/models/avatars/female/uniforms/primary-trousers/trousers.glb', '/models/avatars/male/uniforms/primary-trousers/shoes.glb']],
      ['other variant companion', ['/models/avatars/male/uniforms/secondary-trousers/trousers.glb', '/models/avatars/male/uniforms/primary-trousers/shoes.glb']],
      ['reordered companions', ['/models/avatars/male/uniforms/primary-trousers/shoes.glb', '/models/avatars/male/uniforms/primary-trousers/trousers.glb']],
      ['missing companion', ['/models/avatars/male/uniforms/primary-trousers/trousers.glb']],
      ['extra companion', ['/models/avatars/male/uniforms/primary-trousers/trousers.glb', '/models/avatars/male/uniforms/primary-trousers/shoes.glb', '/models/avatars/male/top-hoodie.glb']],
      ['non-array companions', '/models/avatars/male/uniforms/primary-trousers/trousers.glb'],
      ['absent companions', undefined],
    ])('rejects uniform with %s', (_name, extraPaths) => {
      const value = raw();
      Object.assign(uniform(value, 0, 'uniform-primary-trousers'), { extraPaths });
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    });

    it.each([
      ['body mesh', ['Pants', 'Body']],
      ['missing mesh', ['Pants']],
      ['reordered meshes', ['boots', 'Pants']],
      ['extra mesh', ['Pants', 'boots', 'Head']],
      ['non-array', 'Pants'],
      ['absent', undefined],
    ])('rejects uniform with %s hideBodyMeshes', (_name, hideBodyMeshes) => {
      const value = raw();
      Object.assign(uniform(value, 1, 'uniform-primary-skirt'), { hideBodyMeshes });
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    });

    it('rejects uniform main path substitutions and regular option extension fields', () => {
      for (const mutate of [
        (value: Raw) => Object.assign(uniform(value, 0, 'uniform-primary-trousers'), { path: '/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb' }),
        (value: Raw) => Object.assign(uniform(value, 0, 'uniform-primary-trousers'), { path: '/models/avatars/male/top-uniform-primary-trousers.glb' }),
        (value: Raw) => Object.assign(uniform(value, 1, 'uniform-secondary-skirt'), { path: '/models/avatars/male/uniforms/secondary-skirt/polo-sweater.glb' }),
        (value: Raw) => Object.assign(uniform(value, 0, 'hoodie'), { hideBodyMeshes: ['Pants', 'boots'] }),
        (value: Raw) => Object.assign(uniform(value, 0, 'hoodie'), { extraPaths: [] }),
      ]) {
        const value = raw(); mutate(value);
        expect(() => parseAppearanceCatalogue(value)).toThrow();
      }
    });

    it('rejects a female skirt option on the male body and uniform ids outside the top slot', () => {
      const male = raw();
      male.bodies[0].tops.push({ ...uniform(male, 1, 'uniform-primary-skirt') });
      expect(() => parseAppearanceCatalogue(male)).toThrow();
      const hair = raw();
      hair.bodies[0].hair[0] = { ...uniform(hair, 0, 'uniform-primary-trousers'), slot: 'hair' };
      expect(() => parseAppearanceCatalogue(hair)).toThrow();
    });

    it('accepts seven tops but rejects an eighth, and still accepts five hair options', () => {
      const tops = raw();
      tops.bodies[1].tops.push({ ...tops.bodies[1].tops[0], id: 'jacket', path: '/models/avatars/female/top-jacket.glb' });
      expect(() => parseAppearanceCatalogue(tops)).toThrow();
      expect(parseAppearanceCatalogue(manifest).bodies[1].tops).toHaveLength(7);
      const hair = raw();
      hair.bodies[0].hair.push(...['classic-short', 'fade', 'long-tied'].map(id => ({ ...hair.bodies[0].hair[0], id, path: `/models/avatars/male/hair-${id}.glb` })));
      expect(parseAppearanceCatalogue(hair).bodies[0].hair).toHaveLength(5);
    });
  });
});
