import {
  isHairAllowed,
  isTopAllowed,
  type Avatar,
} from '@/features/profile/avatar-options';

const AVATAR_MODELS_PATH = '/models/avatars';
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Same defaults as the 2D `AvatarPreview`, so both stay visually aligned. */
export const DEFAULT_HAIR_COLOR = '#6C4D48';
export const DEFAULT_CLOTHING_COLOR = '#5B4F96';

export interface AvatarParts {
  readonly bodyUrl: string;
  /** `null` when the hair is not available for the chosen body. */
  readonly hairUrl: string | null;
  /** `null` when the top is not available for the chosen body. */
  readonly topUrl: string | null;
  readonly hairColor: string;
  readonly clothingColor: string;
}

/** Only `#RRGGBB` reaches a material; anything else gets the default. */
export function safeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

/**
 * Maps an avatar configuration to the modular GLB files that draw it.
 * Allowed combinations are reused from the profile rules so a disallowed
 * hair/top never points at a file that does not exist.
 */
export function resolveAvatarParts(avatar: Avatar): AvatarParts {
  const folder = `${AVATAR_MODELS_PATH}/${avatar.bodyId}`;
  return {
    bodyUrl: `${folder}/body.glb`,
    hairUrl: isHairAllowed(avatar)
      ? `${folder}/hair-${avatar.hairId}.glb`
      : null,
    topUrl: isTopAllowed(avatar) ? `${folder}/top-${avatar.topId}.glb` : null,
    hairColor: safeHexColor(avatar.hairColor, DEFAULT_HAIR_COLOR),
    clothingColor: safeHexColor(avatar.clothingColor, DEFAULT_CLOTHING_COLOR),
  };
}
