import {
  hairOptionsFor,
  topOptionsFor,
} from '@/features/profile/avatar-options';
import {
  resolveAccessory,
  type AvatarBodyId,
} from '@/features/world/avatar/accessory-catalog';
import {
  DEFAULT_CLOTHING_COLOR,
  DEFAULT_HAIR_COLOR,
  resolveAvatarParts,
} from '@/features/world/avatar/avatar-parts';
import { resolveDeskDecorModule } from '@/features/world/classroom/desk-decor';
import { getKitModuleUrl } from '@/features/world/classroom/kit/classroom-kit-manifest';
import type { ShopCatalogItemDto } from './shop-schema';

/** A hair style or top, drawn on a body so that it reads as what it is. */
export interface WornPreviewSource {
  readonly type: 'worn';
  readonly part: 'hair' | 'top';
  readonly url: string;
  readonly bodyUrl: string;
  /** Color of the part's tintable material. */
  readonly tint: string;
}

/**
 * Where an item's visual preview comes from. The catalog carries no image
 * URL; avatar accessories, styles and desk decor are drawn from the same
 * models the classroom uses (looked up by shop code), everything else gets a
 * category illustration.
 */
export type ItemPreviewSource =
  | {
      readonly type: 'glb';
      readonly url: string;
      /** `AvatarAccessoryTint` color the avatar wears. */
      readonly tint?: string;
    }
  | WornPreviewSource
  | { readonly type: 'illustration' };

/** One avatar piece: a style by catalog id, or an accessory by shop code. */
export type AvatarPreviewRef =
  | {
      readonly type: 'hair' | 'top';
      readonly id: string;
      /** `#RRGGBB`; the avatar's default color when absent. */
      readonly color?: string;
    }
  | { readonly type: 'accessory'; readonly code: string };

/** The shop does not know the buyer's body; every item fits both. */
const DEFAULT_PREVIEW_BODY: AvatarBodyId = 'male';

/** Style shop codes are `<hair|top>_<style id with "-" replaced by "_">`. */
const STYLE_CODE = /^(hair|top)_(.+)$/;

export function resolveAvatarPreview(
  ref: AvatarPreviewRef,
  bodyId: AvatarBodyId,
): ItemPreviewSource {
  if (ref.type === 'accessory') {
    const spec = resolveAccessory(ref.code);
    return spec === null
      ? { type: 'illustration' }
      : { type: 'glb', url: spec.url(bodyId), tint: spec.fixedColor };
  }
  const isHair = ref.type === 'hair';
  const option = (isHair ? hairOptionsFor : topOptionsFor)(bodyId).find(
    ({ value }) => value === ref.id,
  );
  if (option === undefined) return { type: 'illustration' };
  const color =
    ref.color ?? (isHair ? DEFAULT_HAIR_COLOR : DEFAULT_CLOTHING_COLOR);
  const parts = resolveAvatarParts({
    bodyId,
    hairId: option.value,
    topId: option.value,
    hairColor: color,
    clothingColor: color,
  } as Parameters<typeof resolveAvatarParts>[0]);
  const url = isHair ? parts.hairUrl : parts.topUrl;
  return url === null
    ? { type: 'illustration' }
    : {
        type: 'worn',
        part: ref.type,
        url,
        bodyUrl: parts.bodyUrl,
        tint: isHair ? parts.hairColor : parts.clothingColor,
      };
}

export function resolveItemPreview(
  item: Pick<ShopCatalogItemDto, 'kind' | 'code' | 'metadata'>,
  bodyId: AvatarBodyId = DEFAULT_PREVIEW_BODY,
): ItemPreviewSource {
  if (item.kind === 'DESK_UPGRADE') {
    const moduleId = resolveDeskDecorModule(item.code);
    return moduleId === null
      ? { type: 'illustration' }
      : { type: 'glb', url: getKitModuleUrl(moduleId) };
  }
  if (item.kind === 'AVATAR_ACCESSORY') {
    return resolveAvatarPreview({ type: 'accessory', code: item.code }, bodyId);
  }
  const style =
    item.kind === 'AVATAR_STYLE' ? STYLE_CODE.exec(item.code) : null;
  return style === null
    ? { type: 'illustration' }
    : resolveAvatarPreview(
        {
          type: style[1] as 'hair' | 'top',
          id: style[2]!.replaceAll('_', '-'),
        },
        bodyId,
      );
}
