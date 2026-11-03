import { describe, expect, it } from 'vitest';
import manifest from './integration-catalogue.json';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';

const fixture = () => structuredClone(manifest);
describe('appearance catalogue boundary', () => {
  it('projects the real approved catalogue without assembly metadata', () => {
    const parsed = parseAppearanceCatalogue(manifest);
    expect(parsed.bodies.map(body => body.id)).toEqual(['male', 'female']);
    const ids = [
      [['afro', 'dreads'], ['hoodie', 'tank', 'uniform-primary', 'uniform-secondary'], ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack']],
      [['original', 'afro'], ['tshirt', 'hoodie', 'tank', 'uniform-primary', 'uniform-secondary'], ['glasses', 'cap', 'headphones', 'earrings']],
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
      [0, 'uniform-primary', 'Uniforme primaria', '/models/avatars/male/uniforms/primary-trousers/coat-tie.glb'],
      [0, 'uniform-secondary', 'Uniforme secundaria', '/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb'],
      [1, 'uniform-primary', 'Uniforme primaria', '/models/avatars/female/uniforms/primary-trousers/coat-tie.glb'],
      [1, 'uniform-secondary', 'Uniforme secundaria', '/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb'],
    ] as const;

    it.each(expected)('exposes body %i option %s as a single-file upper-body top', (bodyIndex, id, label, path) => {
      const parsed = parseAppearanceCatalogue(manifest);
      const option = parsed.bodies[bodyIndex].tops.find(top => top.id === id)!;
      expect(option).toEqual({ id, label, path, slot: 'top', tintMaterials: [], detailMaterials: [] });
      expect(option).not.toHaveProperty('extraPaths');
      expect(option).not.toHaveProperty('hideBodyMeshes');
      expect(toAppearanceChoices(parsed)[parsed.bodies[bodyIndex].id].tops.find(top => top.id === id)).toEqual({ id, label });
    });

    it('rejects the retired per-garment variant ids and companion fields', () => {
      for (const mutate of [
        (value: Raw) => Object.assign(uniform(value, 0, 'uniform-primary'), { id: 'uniform-primary-trousers' }),
        (value: Raw) => Object.assign(uniform(value, 1, 'uniform-secondary'), { id: 'uniform-secondary-skirt' }),
        (value: Raw) => Object.assign(uniform(value, 0, 'uniform-primary'), { extraPaths: ['/models/avatars/male/uniforms/primary-trousers/trousers.glb'] }),
        (value: Raw) => Object.assign(uniform(value, 1, 'uniform-primary'), { hideBodyMeshes: ['Pants', 'boots'] }),
        (value: Raw) => Object.assign(uniform(value, 0, 'hoodie'), { hideBodyMeshes: ['Pants', 'boots'] }),
        (value: Raw) => Object.assign(uniform(value, 0, 'hoodie'), { extraPaths: [] }),
      ]) {
        const value = raw(); mutate(value);
        expect(() => parseAppearanceCatalogue(value)).toThrow();
      }
    });

    it.each([
      ['other variant', 0, 'uniform-primary', '/models/avatars/male/uniforms/secondary-trousers/polo-sweater.glb'],
      ['cross-body', 0, 'uniform-secondary', '/models/avatars/female/uniforms/secondary-trousers/polo-sweater.glb'],
      ['skirt folder', 1, 'uniform-primary', '/models/avatars/female/uniforms/primary-skirt/coat-tie.glb'],
      ['trousers module', 1, 'uniform-primary', '/models/avatars/female/uniforms/primary-trousers/trousers.glb'],
      ['regular top path', 0, 'uniform-primary', '/models/avatars/male/top-uniform-primary.glb'],
      ['remote', 0, 'uniform-secondary', 'https://evil.test/polo-sweater.glb'],
      ['traversal', 1, 'uniform-secondary', '/models/avatars/female/uniforms/secondary-trousers/../polo-sweater.glb'],
      ['query', 1, 'uniform-primary', '/models/avatars/female/uniforms/primary-trousers/coat-tie.glb?x=1'],
    ])('rejects uniform main path substitution: %s', (_name, bodyIndex, id, path) => {
      const value = raw();
      Object.assign(uniform(value, bodyIndex, id), { path });
      expect(() => parseAppearanceCatalogue(value)).toThrow();
    });

    it('rejects uniform ids outside the top slot and unapproved extra tops', () => {
      const hair = raw();
      hair.bodies[0].hair[0] = { ...uniform(hair, 0, 'uniform-primary'), slot: 'hair' };
      expect(() => parseAppearanceCatalogue(hair)).toThrow();
      const male = raw();
      male.bodies[0].tops.push({ ...uniform(male, 1, 'uniform-primary'), id: 'uniform-primary-skirt' });
      expect(() => parseAppearanceCatalogue(male)).toThrow();
    });

    it('keeps the five-option limit per slot: accepts five tops, rejects a sixth, and accepts five hair options', () => {
      const tops = raw();
      expect(parseAppearanceCatalogue(manifest).bodies[1].tops).toHaveLength(5);
      tops.bodies[1].tops.push({ ...tops.bodies[1].tops[0], id: 'jacket', path: '/models/avatars/female/top-jacket.glb' });
      expect(() => parseAppearanceCatalogue(tops)).toThrow();
      const hair = raw();
      hair.bodies[0].hair.push(...['classic-short', 'fade', 'long-tied'].map(id => ({ ...hair.bodies[0].hair[0], id, path: `/models/avatars/male/hair-${id}.glb` })));
      expect(parseAppearanceCatalogue(hair).bodies[0].hair).toHaveLength(5);
      hair.bodies[0].hair.push({ ...hair.bodies[0].hair[0], id: 'extra' });
      expect(() => parseAppearanceCatalogue(hair)).toThrow();
    });
  });
});
