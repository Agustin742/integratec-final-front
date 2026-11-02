import type { AvatarBody } from './AvatarCustomizer';
import type { AppearanceAsset, AppearanceBody, AppearanceCatalogue, AppearanceChoices } from './avatar-appearance';

/** School uniform options: main garment plus the exact companion GLBs, all in one variant folder. */
const uniforms: Record<AvatarBody, Record<string, { main: string; extras: readonly string[] }>> = {
  male: {
    'uniform-primary-trousers': { main: 'coat-tie', extras: ['trousers', 'shoes'] },
    'uniform-secondary-trousers': { main: 'polo-sweater', extras: ['trousers', 'shoes'] },
  },
  female: {
    'uniform-primary-trousers': { main: 'coat-tie', extras: ['trousers', 'shoes'] },
    'uniform-primary-skirt': { main: 'coat-tie', extras: ['skirt', 'shoes'] },
    'uniform-secondary-trousers': { main: 'polo-sweater', extras: ['trousers', 'shoes'] },
    'uniform-secondary-skirt': { main: 'polo-sweater', extras: ['skirt', 'shoes'] },
  },
};
const uniformHiddenMeshes = ['Pants', 'boots'] as const;
const maxOptions: Record<AppearanceAsset['slot'], number> = { hair: 5, top: 7, accessory: 5 };

const approved = {
  male: { hair: ['classic-short', 'fade', 'afro', 'dreads', 'long-tied'], top: ['tshirt', 'hoodie', 'shirt', 'tank', 'jacket', ...Object.keys(uniforms.male)], accessory: ['round-glasses', 'square-glasses', 'cap', 'headphones', 'backpack'] },
  female: { hair: ['original', 'bob', 'high-ponytail', 'bun', 'afro'], top: ['tshirt', 'hoodie', 'blouse', 'tank', 'jacket', ...Object.keys(uniforms.female)], accessory: ['glasses', 'cap', 'headphones', 'earrings', 'handbag'] },
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid appearance catalogue object');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw Error('Invalid appearance catalogue string');
  return value;
}
function materials(value: unknown): string[] {
  if (!Array.isArray(value)) throw Error('Invalid appearance material list');
  const result = value.map(text);
  if (new Set(result).size !== result.length) throw Error('Duplicate appearance material');
  return result;
}
function exactList(value: unknown, expected: readonly string[]): string[] {
  if (!Array.isArray(value) || value.length !== expected.length || value.some((item, index) => item !== expected[index])) {
    throw Error('Unapproved appearance companion list');
  }
  return [...expected];
}
function assets(value: unknown, body: AvatarBody, slot: AppearanceAsset['slot']): AppearanceAsset[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxOptions[slot]) throw Error('Expected between one and the maximum number of appearance options');
  const seen = new Set<string>();
  return value.map(item => {
    const asset = record(item);
    const id = text(asset.id);
    if (!approved[body][slot].includes(id) || seen.has(id) || asset.slot !== slot) throw Error('Invalid appearance option or slot');
    seen.add(id);
    // Exact repository paths prevent remote URLs, traversal, encoding and cross-body substitutions.
    const uniform = slot === 'top' ? uniforms[body][id] : undefined;
    const folder = `/models/avatars/${body}/uniforms/${id.replace(/^uniform-/, '')}`;
    const path = uniform ? `${folder}/${uniform.main}.glb` : `/models/avatars/${body}/${slot}-${id}.glb`;
    if (asset.path !== path) throw Error('Unapproved appearance asset path');
    const common = { id, label: text(asset.label), path, slot,
      tintMaterials: materials(asset.tintMaterials), detailMaterials: materials(asset.detailMaterials) };
    if (!uniform) {
      if (asset.extraPaths !== undefined || asset.hideBodyMeshes !== undefined) throw Error('Unexpected appearance companion fields');
      return common;
    }
    return { ...common,
      extraPaths: exactList(asset.extraPaths, uniform.extras.map(file => `${folder}/${file}.glb`)),
      hideBodyMeshes: exactList(asset.hideBodyMeshes, uniformHiddenMeshes) };
  });
}
/** Validate unknown manifest JSON; retain only render contract fields, never assembly metadata.
 * Throws on invalid catalogue. The caller owns loading/error feedback, not a silent fallback.
 */
export function parseAppearanceCatalogue(value: unknown): AppearanceCatalogue {
  const root = record(value);
  if (root.version !== 1 || !Array.isArray(root.bodies) || root.bodies.length !== 2) throw Error('Invalid appearance catalogue version or bodies');
  const seen = new Set<AvatarBody>();
  const bodies: AppearanceBody[] = root.bodies.map(item => {
    const body = record(item);
    const id = body.id;
    if ((id !== 'male' && id !== 'female') || seen.has(id)) throw Error('Invalid or duplicate appearance body');
    seen.add(id);
    if (body.path !== `/models/avatars/${id}/body.glb` || body.rigFamily !== `${id}-v1`) throw Error('Unapproved appearance body or rig');
    return { id, path: body.path, rigFamily: body.rigFamily,
      hair: assets(body.hair, id, 'hair'), tops: assets(body.tops, id, 'top'), accessories: assets(body.accessories, id, 'accessory') };
  });
  return { version: 1, bodies };
}
/** UI choices preserve manifest order and labels; null/no-accessory is supplied by the UI. */
export function toAppearanceChoices(catalogue: AppearanceCatalogue): AppearanceChoices {
  const choices = (id: AvatarBody) => {
    const body = catalogue.bodies.find(body => body.id === id);
    if (!body) throw Error('Missing appearance body');
    const options = (items: readonly AppearanceAsset[]) => items.map(({ id, label }) => ({ id, label }));
    return { hair: options(body.hair), tops: options(body.tops), accessories: options(body.accessories) };
  };
  return { male: choices('male'), female: choices('female') };
}
