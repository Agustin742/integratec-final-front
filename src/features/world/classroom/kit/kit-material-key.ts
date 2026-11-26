import type { Material, MeshStandardMaterial } from 'three';

/**
 * What makes two kit materials look the same. The shell, furniture, interactive
 * and decoration GLBs each ship their own copy of the same palette under
 * different names (`FurnWood`, `IntWood`, `DecWood`), so batching by name
 * would spend one draw call per prefix instead of one per colour.
 */
export interface MaterialAppearance {
  /** Linear RGB, as stored in glTF and in the loaded three material. */
  readonly color: readonly [number, number, number];
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: readonly [number, number, number];
  readonly opacity: number;
  readonly transparent: boolean;
  readonly doubleSided: boolean;
  readonly vertexColors: boolean;
  readonly alphaTest: number;
  readonly flatShading: boolean;
}

const fixed = (value: number, digits: number): string => value.toFixed(digits);
const channels = (rgb: readonly number[]): string =>
  rgb.map((channel) => fixed(channel, 3)).join(',');

/**
 * Stable key of an appearance. Roughness and metalness are rounded to one
 * decimal: the palette's 0.62 to 0.66 spread is imperceptible, a glossy 0.38
 * stays apart.
 */
export function materialAppearanceKey(appearance: MaterialAppearance): string {
  return [
    channels(appearance.color),
    `r${fixed(appearance.roughness, 1)}`,
    `m${fixed(appearance.metalness, 1)}`,
    `e${channels(appearance.emissive)}`,
    `o${fixed(appearance.opacity, 2)}${appearance.transparent ? 't' : ''}`,
    appearance.doubleSided ? 'ds' : 'fs',
    appearance.vertexColors ? 'vc' : '',
    `a${fixed(appearance.alphaTest, 2)}`,
    appearance.flatShading ? 'flat' : 'smooth',
  ].join('|');
}

/** Any of these makes a material unique: textures are compared by identity, not by value. */
const TEXTURE_SLOTS = [
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
] as const;

const DOUBLE_SIDE = 2;

/**
 * Appearance key of a loaded standard material, or `null` when it cannot be
 * compared by value (other material types, any texture).
 */
export function threeMaterialAppearanceKey(material: Material): string | null {
  if (material.type !== 'MeshStandardMaterial') return null;
  const standard = material as MeshStandardMaterial;
  if (TEXTURE_SLOTS.some((slot) => standard[slot])) return null;
  return materialAppearanceKey({
    color: [standard.color.r, standard.color.g, standard.color.b],
    roughness: standard.roughness,
    metalness: standard.metalness,
    emissive: [standard.emissive.r, standard.emissive.g, standard.emissive.b],
    opacity: standard.opacity,
    transparent: standard.transparent,
    doubleSided: standard.side === DOUBLE_SIDE,
    vertexColors: standard.vertexColors,
    alphaTest: standard.alphaTest,
    flatShading: standard.flatShading,
  });
}
