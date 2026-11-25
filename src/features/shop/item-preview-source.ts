import { resolveAccessory } from '@/features/world/avatar/accessory-catalog';
import type { ShopCatalogItemDto } from './shop-schema';

/**
 * Where an item's visual preview comes from. The catalog carries no image
 * URL; avatar accessories are drawn from the same catalog that dresses the
 * avatar (looked up by shop code), everything else gets a category
 * illustration.
 */
export type ItemPreviewSource =
  | {
      readonly type: 'glb';
      readonly url: string;
      /** `AvatarAccessoryTint` color the avatar wears. */
      readonly tint: string;
    }
  | { readonly type: 'illustration' };

/** Body-fitted items need one body to preview; both share the same design. */
const PREVIEW_BODY = 'male';

export function resolveItemPreview(
  item: Pick<ShopCatalogItemDto, 'kind' | 'code' | 'metadata'>,
): ItemPreviewSource {
  const spec =
    item.kind === 'AVATAR_ACCESSORY' ? resolveAccessory(item.code) : null;
  return spec === null
    ? { type: 'illustration' }
    : { type: 'glb', url: spec.url(PREVIEW_BODY), tint: spec.fixedColor };
}
