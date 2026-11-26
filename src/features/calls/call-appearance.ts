import {
  BODY_OPTIONS,
  CLOTHING_COLOR_OPTIONS,
  HAIR_COLOR_OPTIONS,
  hairOptionsFor,
  reconcileAvatarChoices,
  topOptionsFor,
  type Avatar,
} from '@/features/profile/avatar-options';
import type { CallAppearanceView } from './call-room-client';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function pick<T extends string>(
  value: string,
  options: readonly { readonly value: T }[],
): T | null {
  return options.find((option) => option.value === value)?.value ?? null;
}

/**
 * Converts the untyped call appearance into a renderable `Avatar`. A missing
 * or unknown body yields `null` (the stage then shows the 2D/initial tile);
 * hair and top that do not fit the body are reconciled like the profile form.
 */
export function toAvatar(appearance: CallAppearanceView): Avatar | null {
  const bodyId = pick(appearance.bodyId, BODY_OPTIONS);
  if (!bodyId) return null;
  const hairId =
    pick(appearance.hairId, [
      ...hairOptionsFor('male'),
      ...hairOptionsFor('female'),
    ]) ?? hairOptionsFor(bodyId)[0]?.value;
  const topId =
    pick(appearance.topId, [
      ...topOptionsFor('male'),
      ...topOptionsFor('female'),
    ]) ?? topOptionsFor(bodyId)[0]?.value;
  if (!hairId || !topId) return null;
  const color = <T extends string>(
    value: string,
    options: readonly { readonly value: T }[],
  ): T => (HEX_COLOR.test(value) ? (value as T) : options[0]?.value) as T;
  return reconcileAvatarChoices({
    bodyId,
    hairId,
    topId,
    hairColor: color(appearance.hairColor, HAIR_COLOR_OPTIONS),
    clothingColor: color(appearance.clothingColor, CLOTHING_COLOR_OPTIONS),
  });
}
