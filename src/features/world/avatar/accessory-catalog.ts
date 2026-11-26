import type { Avatar } from '@/features/profile/avatar-options';

/**
 * Pure catalog and rules for equippable avatar accessories (head, face, back,
 * hand, neck, ears). No rendering here: the composer receives the results as
 * part inputs. Rules come from docs/art/{head-accessories-everyday,
 * head-accessories-special,back-accessories,face-accessories,hand-items,
 * neck-ears}.md and are checked against the GLBs.
 */

export type AvatarBodyId = Avatar['bodyId'];
export type AccessorySlot = 'head' | 'face' | 'back' | 'hand' | 'neck' | 'ears';

export interface AccessorySpec {
  /** Shop item code, `<slot>_<asset id with "-" replaced by "_">`. */
  readonly code: string;
  readonly slot: AccessorySlot;
  /** Asset id without slot prefix, for example `backwards-cap`. */
  readonly assetId: string;
  /** Fixed `AvatarAccessoryTint` color (no user choice yet). */
  readonly fixedColor: string;
  url(bodyId: AvatarBodyId): string;
}

const AVATARS_ROOT = '/models/avatars';

/** Back items that fit every body. */
const SHARED_BACK_ASSETS: ReadonlySet<string> = new Set(['wings']);

/** Ear items were exported with the neck prefix (`neck-ears.md`). */
const FILE_PREFIX: Readonly<Record<AccessorySlot, string>> = {
  head: 'head',
  face: 'face',
  back: 'back',
  hand: 'hand',
  neck: 'neck',
  ears: 'neck',
};

/** Neck items, and back items except wings, are fitted to each body. */
function isShared(slot: AccessorySlot, assetId: string): boolean {
  if (slot === 'neck') return false;
  return slot !== 'back' || SHARED_BACK_ASSETS.has(assetId);
}

/**
 * `[slot, assetId, fixedColor]`; colors come from the art-direction palette
 * and are mirrored by the backend shop seed.
 */
const ACCESSORY_ROWS: readonly (readonly [AccessorySlot, string, string])[] = [
  ['head', 'headband', '#F5B5AB'],
  ['head', 'cap', '#75B7DA'],
  ['head', 'backwards-cap', '#E66861'],
  ['head', 'beanie', '#7EBA8B'],
  ['head', 'headphones', '#B5A7D6'],
  ['head', 'graduation-cap', '#5B4F96'],
  ['head', 'top-hat', '#353849'],
  ['head', 'crown', '#F7D86B'],
  ['head', 'astronaut-helmet', '#FFF9EB'],
  ['face', 'face-paint', '#E66861'],
  ['face', 'round-glasses', '#AF7B52'],
  ['face', 'square-glasses', '#5B4F96'],
  ['face', 'face-mask', '#A9E7F4'],
  ['face', 'sunglasses', '#353849'],
  ['face', 'masquerade-mask', '#C77DAA'],
  ['back', 'backpack', '#62CFC7'],
  ['back', 'rolling-backpack', '#5B4F96'],
  ['back', 'racket', '#65B96A'],
  ['back', 'guitar', '#AF7B52'],
  ['back', 'superhero-cape', '#E66861'],
  ['back', 'wings', '#FFF9EB'],
  ['hand', 'pencil', '#F7D86B'],
  ['hand', 'book', '#5B4F96'],
  ['hand', 'ruler', '#A9E7F4'],
  ['hand', 'mug', '#E66861'],
  ['hand', 'phone', '#353849'],
  ['hand', 'mate', '#AF7B52'],
  ['hand', 'magnifying-glass', '#75B7DA'],
  ['hand', 'paintbrush', '#C77DAA'],
  ['hand', 'tablet', '#62CFC7'],
  ['hand', 'trophy', '#F7D86B'],
  ['neck', 'scarf', '#E66861'],
  ['neck', 'necklace', '#B5A7D6'],
  ['neck', 'bow-tie', '#5B4F96'],
  ['neck', 'lanyard-badge', '#62CFC7'],
  ['neck', 'bandana', '#7EBA8B'],
  ['neck', 'achievement-medal', '#F7D86B'],
  ['ears', 'earrings', '#F5B5AB'],
  ['ears', 'star-earrings', '#F7D86B'],
  ['ears', 'ear-cuffs', '#B5A7D6'],
];

function buildSpec(
  slot: AccessorySlot,
  assetId: string,
  fixedColor: string,
): AccessorySpec {
  const folder = isShared(slot, assetId) ? 'shared' : null;
  const file = `${FILE_PREFIX[slot]}-${assetId}.glb`;
  return {
    code: `${slot}_${assetId.replaceAll('-', '_')}`,
    slot,
    assetId,
    fixedColor,
    url: (bodyId) => `${AVATARS_ROOT}/${folder ?? bodyId}/${file}`,
  };
}

const CATALOG: ReadonlyMap<string, AccessorySpec> = new Map(
  ACCESSORY_ROWS.map(([slot, assetId, color]) => {
    const spec = buildSpec(slot, assetId, color);
    return [spec.code, spec] as const;
  }),
);

export const ACCESSORY_CODES: readonly string[] = [...CATALOG.keys()];

/** Fixed colors by shop code, for seed metadata to mirror. */
export const ACCESSORY_FIXED_COLORS: Readonly<Record<string, string>> =
  Object.fromEntries(
    [...CATALOG.values()].map((spec) => [spec.code, spec.fixedColor]),
  );

/** Returns the spec of a shop item code, or null when it is not an accessory. */
export function resolveAccessory(code: string): AccessorySpec | null {
  return CATALOG.get(code) ?? null;
}

// --- Hair vs. head accessories ---------------------------------------------

/** Hair asset id to node-name prefix, `afro-with-headband` -> `HairAfroWithHeadband`. */
function hairNodePrefix(hairId: string): string {
  const pascal = hairId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return `Hair${pascal}`;
}

function hairNodes(hairId: string, parts: readonly string[]): string[] {
  const prefix = hairNodePrefix(hairId);
  return parts.map((part) => `${prefix}_${part}`);
}

/** Hats that cover the crown (`head-accessories-everyday/special.md`). */
const CROWN_COVERING_HATS: ReadonlySet<string> = new Set([
  'cap',
  'backwards-cap',
  'beanie',
  'top-hat',
  'crown',
  'graduation-cap',
]);

/** Hair parts hidden under a crown-covering hat; `_Cap` is never listed. */
const HAT_HIDDEN_HAIR_PARTS: Readonly<Record<string, readonly string[]>> = {
  afro: ['Cloud'],
  'afro-with-headband': ['Cloud', 'Headband'],
  bun: ['Bun'],
  'soft-mohawk': ['Crest'],
  messy: ['TousledTufts'],
  ponytail: ['Tail', 'HairTie'],
  'two-pigtails': ['Pigtails'],
  'half-up': ['HalfUpTie'],
};

/**
 * Hair parts hidden inside the closed astronaut helmet. Short styles fit
 * inside the dome. Braids are optional in the doc (no shell pokes) and stay.
 */
const HELMET_HIDDEN_HAIR_PARTS: Readonly<Record<string, readonly string[]>> = {
  afro: ['Cloud'],
  'afro-with-headband': ['Cloud', 'Headband'],
  bob: ['Curtain', 'Bangs'],
  wavy: ['Curtain'],
  messy: ['Curtain', 'TousledTufts'],
  'middle-part': ['Curtain', 'CurtainBangs'],
  'long-straight': ['Curtain'],
  'long-wavy': ['Curtain'],
  'long-curls': ['Curtain', 'Curls'],
  ponytail: ['Tail', 'HairTie'],
  'two-pigtails': ['Pigtails'],
  bun: ['Bun'],
  'half-up': ['Curtain', 'HalfUpTie'],
  dreads: ['Locs'],
};

const AFRO_WITH_HEADBAND = 'afro-with-headband';
const HEADBAND_NODES = ['HeadHeadband_Band', 'HeadHeadband_Trim'] as const;

export interface HeadwearHiding {
  /** Hair asset to load; the fitted afro replaces `afro` under a headband. */
  readonly hairId: string;
  /** Hair node names to hide; `_Cap` is never included (never bald). */
  readonly hairHidden: readonly string[];
  /** Head accessory node names to hide. */
  readonly headHidden: readonly string[];
}

/**
 * Which submeshes to hide so the hair never pokes through the equipped head
 * accessory. Unknown hair or accessory ids hide nothing.
 */
export function resolveHeadwearHiding(
  hairId: string,
  headAssetId: string | null,
): HeadwearHiding {
  if (!headAssetId) return { hairId, hairHidden: [], headHidden: [] };

  if (headAssetId === 'headband') {
    // The fitted afro already has the band built in; the loose one is dropped.
    const fitted = hairId === 'afro' || hairId === AFRO_WITH_HEADBAND;
    return {
      hairId: fitted ? AFRO_WITH_HEADBAND : hairId,
      hairHidden: [],
      headHidden: fitted ? [...HEADBAND_NODES] : [],
    };
  }

  const table = CROWN_COVERING_HATS.has(headAssetId)
    ? HAT_HIDDEN_HAIR_PARTS
    : headAssetId === 'astronaut-helmet'
      ? HELMET_HIDDEN_HAIR_PARTS
      : undefined;
  const parts = table && Object.hasOwn(table, hairId) ? table[hairId] : [];
  return { hairId, hairHidden: hairNodes(hairId, parts), headHidden: [] };
}

// --- Hair vs. back accessories ---------------------------------------------

/** Long hair GLBs that carry the `BackTuck` morph target. */
const BACK_TUCK_HAIR: ReadonlySet<string> = new Set([
  'long-straight',
  'long-wavy',
  'long-curls',
  'braid',
  'two-braids',
  'half-up',
  'box-braids',
  'dreads',
]);

export const BACK_TUCK_MORPH = 'BackTuck';

/** Morph influences for the hair: long hair tucks whenever a back item is worn. */
export function resolveHairMorphs(
  hairId: string,
  backAssetId: string | null,
): Record<string, number> {
  return backAssetId && BACK_TUCK_HAIR.has(hairId)
    ? { [BACK_TUCK_MORPH]: 1 }
    : {};
}
