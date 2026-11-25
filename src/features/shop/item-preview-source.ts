import type { ShopCatalogItemDto } from './shop-schema';

/**
 * Where an item's visual preview comes from. The catalog carries no image
 * URL; `metadata.assetId` is the only render hint the API returns
 * (`ShopCatalogItemDto.metadata`: "Server-defined item metadata for client
 * asset rendering"). Avatar accessories have a matching GLB under
 * `public/models/avatars/`; everything else gets a category illustration.
 */
export type ItemPreviewSource =
  | { readonly type: 'glb'; readonly url: string }
  | { readonly type: 'illustration' };

const AVATAR_ACCESSORY_MODELS: Readonly<Record<string, string>> = {
  cap: '/models/avatars/male/accessory-cap.glb',
  backpack: '/models/avatars/male/accessory-backpack.glb',
  headphones: '/models/avatars/male/accessory-headphones.glb',
  glasses: '/models/avatars/male/accessory-round-glasses.glb',
};

const SQUARE_GLASSES_URL = '/models/avatars/male/accessory-square-glasses.glb';

export function resolveItemPreview(
  item: Pick<ShopCatalogItemDto, 'kind' | 'code' | 'metadata'>,
): ItemPreviewSource {
  if (item.kind !== 'AVATAR_ACCESSORY') {
    return { type: 'illustration' };
  }
  const assetId = item.metadata.assetId;
  if (typeof assetId !== 'string') {
    return { type: 'illustration' };
  }
  if (assetId === 'glasses' && item.code.includes('square')) {
    return { type: 'glb', url: SQUARE_GLASSES_URL };
  }
  const url = Object.hasOwn(AVATAR_ACCESSORY_MODELS, assetId)
    ? AVATAR_ACCESSORY_MODELS[assetId]
    : undefined;
  return url === undefined ? { type: 'illustration' } : { type: 'glb', url };
}
