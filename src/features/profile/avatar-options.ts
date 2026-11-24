import type { components } from '@/api/schema.generated';
import { profileMessages } from './messages';

/** Base avatar exactly as the contract defines it (`AvatarDto`). */
export type Avatar = components['schemas']['AvatarDto'];
export type AvatarField = keyof Avatar;

export const AVATAR_FIELDS = [
  'bodyId',
  'hairId',
  'topId',
  'hairColor',
  'clothingColor',
] as const satisfies readonly AvatarField[];

export interface AvatarOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

function toOptions<TValue extends string>(
  labels: Readonly<Record<TValue, string>>,
  allowed?: readonly TValue[],
): readonly AvatarOption<TValue>[] {
  const values = (allowed ?? Object.keys(labels)) as TValue[];
  return values.map((value) => ({ value, label: labels[value] }));
}

const optionLabels = profileMessages.options;

export const BODY_OPTIONS = toOptions<Avatar['bodyId']>(optionLabels.bodyId);
export const HAIR_COLOR_OPTIONS = toOptions<Avatar['hairColor']>(
  optionLabels.hairColor,
);
export const CLOTHING_COLOR_OPTIONS = toOptions<Avatar['clothingColor']>(
  optionLabels.clothingColor,
);

type HairId = Avatar['hairId'];
type TopId = Avatar['topId'];

/** Styles every account owns from the start; the rest are shop unlocks. */
export const FREE_HAIR_IDS: ReadonlySet<HairId> = new Set<HairId>([
  'buzz-cut',
  'classic-short',
  'short-curls',
  'bob',
  'middle-part',
  'long-straight',
  'ponytail',
  'bun',
  'afro',
]);
export const FREE_TOP_IDS: ReadonlySet<TopId> = new Set<TopId>([
  'school-smock',
  'school-sweatshirt',
  'basic-tshirt',
  'tank-top',
]);

/**
 * The catalog is the same for both bodies (`AvatarDto` descriptions). The
 * label maps are `Record`s over the contract unions, so their keys are the
 * complete catalog and a new contract id fails to compile until labelled.
 */
const ALL_HAIR_IDS = Object.keys(optionLabels.hairId) as HairId[];
const ALL_TOP_IDS = Object.keys(optionLabels.topId) as TopId[];
const HAIR_BY_BODY: Record<Avatar['bodyId'], readonly HairId[]> = {
  male: ALL_HAIR_IDS,
  female: ALL_HAIR_IDS,
};
const TOP_BY_BODY: Record<Avatar['bodyId'], readonly TopId[]> = {
  male: ALL_TOP_IDS,
  female: ALL_TOP_IDS,
};

export function hairOptionsFor(
  bodyId: Avatar['bodyId'],
): readonly AvatarOption<Avatar['hairId']>[] {
  return toOptions(optionLabels.hairId, HAIR_BY_BODY[bodyId]);
}

export function topOptionsFor(
  bodyId: Avatar['bodyId'],
): readonly AvatarOption<Avatar['topId']>[] {
  return toOptions(optionLabels.topId, TOP_BY_BODY[bodyId]);
}

export function isHairAllowed(avatar: Avatar): boolean {
  return HAIR_BY_BODY[avatar.bodyId].includes(avatar.hairId);
}

export function isTopAllowed(avatar: Avatar): boolean {
  return TOP_BY_BODY[avatar.bodyId].includes(avatar.topId);
}

/**
 * Keeps hair and top valid for the chosen body. Returns the same object when
 * nothing needs to change so callers can detect an adjustment by identity.
 */
export function reconcileAvatarChoices(avatar: Avatar): Avatar {
  const hairId = isHairAllowed(avatar)
    ? avatar.hairId
    : HAIR_BY_BODY[avatar.bodyId][0];
  const topId = isTopAllowed(avatar)
    ? avatar.topId
    : TOP_BY_BODY[avatar.bodyId][0];
  if (hairId === avatar.hairId && topId === avatar.topId) {
    return avatar;
  }
  return { ...avatar, hairId, topId };
}

export function avatarsEqual(a: Avatar, b: Avatar): boolean {
  return AVATAR_FIELDS.every((field) => a[field] === b[field]);
}

/** Plain-language description used as the preview's accessible name. */
export function describeAvatar(avatar: Avatar): string {
  return [
    optionLabels.bodyId[avatar.bodyId],
    optionLabels.hairId[avatar.hairId],
    optionLabels.hairColor[avatar.hairColor],
    optionLabels.topId[avatar.topId],
    optionLabels.clothingColor[avatar.clothingColor],
  ].join(', ');
}
