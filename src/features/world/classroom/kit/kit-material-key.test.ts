import {
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three';
import { describe, expect, it } from 'vitest';
import { glbMaterialKeys } from './glb-materials.test-utils';
import {
  materialAppearanceKey,
  threeMaterialAppearanceKey,
  type MaterialAppearance,
} from './kit-material-key';

const base: MaterialAppearance = {
  color: [0.43, 0.198, 0.084],
  roughness: 0.78,
  metalness: 0,
  emissive: [0, 0, 0],
  opacity: 1,
  transparent: false,
  doubleSided: true,
  vertexColors: false,
  alphaTest: 0,
  flatShading: false,
};

describe('materialAppearanceKey', () => {
  it('ignores sub-perceptual roughness differences', () => {
    expect(materialAppearanceKey({ ...base, roughness: 0.8 })).toBe(
      materialAppearanceKey(base),
    );
  });

  it('separates different colours, glow, glossiness and transparency', () => {
    const key = materialAppearanceKey(base);
    const differs = (change: Partial<MaterialAppearance>) =>
      materialAppearanceKey({ ...base, ...change }) !== key;
    expect(differs({ color: [0.5, 0.2, 0.08] })).toBe(true);
    expect(differs({ emissive: [1, 0.87, 0.68] })).toBe(true);
    expect(differs({ roughness: 0.38 })).toBe(true);
    expect(differs({ transparent: true, opacity: 0.54 })).toBe(true);
    expect(differs({ doubleSided: false })).toBe(true);
    expect(differs({ vertexColors: true })).toBe(true);
    expect(differs({ alphaTest: 0.5 })).toBe(true);
    expect(differs({ flatShading: true })).toBe(true);
  });
});

describe('threeMaterialAppearanceKey', () => {
  it('matches the key read from the GLB JSON for the same material', () => {
    // FurnWood in furniture/board.glb: double sided, roughness 0.78.
    const material = new MeshStandardMaterial({
      roughness: 0.78,
      metalness: 0,
      side: 2,
    });
    material.color.setRGB(0.429, 0.198, 0.084);
    expect(
      glbMaterialKeys('/models/scenes/classroom/furniture/board.glb'),
    ).toContain(`MeshStandardMaterial|${threeMaterialAppearanceKey(material)}`);
  });

  it.each([
    'map',
    'lightMap',
    'bumpMap',
    'normalMap',
    'displacementMap',
    'envMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'roughnessMap',
    'metalnessMap',
  ] as const)(
    'declines a material with a %s so it keeps its own key',
    (slot) => {
      const material = new MeshStandardMaterial();
      material[slot] = {} as never;
      expect(threeMaterialAppearanceKey(material)).toBeNull();
    },
  );

  it('separates vertex colours, alpha test and flat shading', () => {
    const key = threeMaterialAppearanceKey(new MeshStandardMaterial());
    for (const change of [
      { vertexColors: true },
      { alphaTest: 0.5 },
      { flatShading: true },
    ]) {
      expect(
        threeMaterialAppearanceKey(new MeshStandardMaterial(change)),
      ).not.toBe(key);
    }
  });

  it('declines other material types', () => {
    expect(threeMaterialAppearanceKey(new MeshBasicMaterial())).toBeNull();
    expect(threeMaterialAppearanceKey(new MeshPhysicalMaterial())).toBeNull();
  });
});
