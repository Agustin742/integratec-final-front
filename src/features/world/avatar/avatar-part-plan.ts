import type { Avatar } from '@/features/profile/avatar-options';
import {
  resolveAccessory,
  resolveHairMorphs,
  resolveHeadwearHiding,
  type AccessorySlot,
  type AccessorySpec,
} from './accessory-catalog';
import { resolveAvatarParts, resolveHairUrl } from './avatar-parts';
import {
  ACCESSORY_TINT_MATERIAL,
  HAIR_TINT_MATERIAL,
  TOP_TINT_MATERIAL,
  type AvatarPartKind,
} from './compose-avatar';

/** Shop item codes worn in each accessory slot; `null`/absent means empty. */
export interface AvatarEquipped {
  readonly head?: string | null | undefined;
  readonly face?: string | null | undefined;
  readonly back?: string | null | undefined;
  readonly hand?: string | null | undefined;
  readonly neck?: string | null | undefined;
  readonly ears?: string | null | undefined;
}

export interface PlannedPart {
  readonly key: AvatarPartKind;
  readonly url: string;
  readonly tints: Readonly<Record<string, string>>;
  readonly hiddenMeshes?: readonly string[];
  readonly morphs?: Readonly<Record<string, number>>;
}

export interface AvatarPartPlan {
  readonly bodyUrl: string;
  /** Hair, top and equipped accessories, in attach order. */
  readonly parts: readonly PlannedPart[];
}

const ACCESSORY_SLOTS: readonly AccessorySlot[] = [
  'head',
  'face',
  'back',
  'hand',
  'neck',
  'ears',
];

/** Unknown codes, or codes that belong to another slot, are simply not worn. */
function wornSpec(
  equipped: AvatarEquipped | undefined,
  slot: AccessorySlot,
): AccessorySpec | null {
  const code = equipped?.[slot];
  const spec = code ? resolveAccessory(code) : null;
  return spec?.slot === slot ? spec : null;
}

/**
 * Everything the avatar needs to load and compose, as plain data: the base
 * hair and top plus each equipped accessory, with the hair/accessory hiding
 * and back-tuck rules already applied.
 */
export function planAvatarParts(
  avatar: Avatar,
  equipped?: AvatarEquipped,
): AvatarPartPlan {
  const base = resolveAvatarParts(avatar);
  const head = wornSpec(equipped, 'head');
  const back = wornSpec(equipped, 'back');
  const hiding = resolveHeadwearHiding(avatar.hairId, head?.assetId ?? null);
  const parts: PlannedPart[] = [];

  if (base.hairUrl) {
    const morphs = resolveHairMorphs(hiding.hairId, back?.assetId ?? null);
    parts.push({
      key: 'hair',
      url: resolveHairUrl(hiding.hairId),
      tints: { [HAIR_TINT_MATERIAL]: base.hairColor },
      ...(hiding.hairHidden.length > 0
        ? { hiddenMeshes: hiding.hairHidden }
        : {}),
      ...(Object.keys(morphs).length > 0 ? { morphs } : {}),
    });
  }
  if (base.topUrl) {
    parts.push({
      key: 'top',
      url: base.topUrl,
      tints: { [TOP_TINT_MATERIAL]: base.clothingColor },
    });
  }
  for (const slot of ACCESSORY_SLOTS) {
    const spec = wornSpec(equipped, slot);
    if (!spec) continue;
    parts.push(
      accessoryPart(
        slot,
        spec,
        avatar,
        slot === 'head' && base.hairUrl ? hiding.headHidden : [],
      ),
    );
  }
  return { bodyUrl: base.bodyUrl, parts };
}

function accessoryPart(
  slot: AccessorySlot,
  spec: AccessorySpec,
  avatar: Avatar,
  hiddenMeshes: readonly string[] = [],
): PlannedPart {
  return {
    key: slot,
    url: spec.url(avatar.bodyId),
    tints: { [ACCESSORY_TINT_MATERIAL]: spec.fixedColor },
    ...(hiddenMeshes.length > 0 ? { hiddenMeshes } : {}),
  };
}
