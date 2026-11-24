import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hairOptionsFor,
  topOptionsFor,
  type Avatar,
} from '@/features/profile/avatar-options';
import { resolveAvatarParts } from './avatar-parts';

const PUBLIC_DIR = path.resolve(__dirname, '../../../../public');
const fileFor = (url: string) => path.join(PUBLIC_DIR, url);

const base: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

describe('resolveAvatarParts', () => {
  it('maps a configuration to the part URLs and colors', () => {
    expect(resolveAvatarParts(base)).toEqual({
      bodyUrl: '/models/avatars/female/body.glb',
      hairUrl: '/models/avatars/shared/hair-afro.glb',
      topUrl: '/models/avatars/female/top-basic-tshirt.glb',
      hairColor: '#AF6D63',
      clothingColor: '#75B7DA',
    });
  });

  it('omits parts that are not in the catalog', () => {
    const parts = resolveAvatarParts({
      ...base,
      bodyId: 'male',
      hairId: 'original',
      topId: 'tshirt',
    } as unknown as Avatar);
    expect(parts.bodyUrl).toBe('/models/avatars/male/body.glb');
    expect(parts.hairUrl).toBeNull();
    expect(parts.topUrl).toBeNull();
  });

  describe.each(['male', 'female'] as const)('%s catalog files', (bodyId) => {
    it('has a GLB for every hair option', () => {
      const missing = hairOptionsFor(bodyId)
        .map(
          ({ value }) =>
            resolveAvatarParts({ ...base, bodyId, hairId: value }).hairUrl,
        )
        .filter((url) => url === null || !existsSync(fileFor(url)));
      expect(missing).toEqual([]);
    });

    it('has a GLB for every top option', () => {
      const missing = topOptionsFor(bodyId)
        .map(
          ({ value }) =>
            resolveAvatarParts({ ...base, bodyId, topId: value }).topUrl,
        )
        .filter((url) => url === null || !existsSync(fileFor(url)));
      expect(missing).toEqual([]);
    });
  });

  it('falls back to default colors for anything but #RRGGBB', () => {
    const parts = resolveAvatarParts({
      ...base,
      hairColor: 'red',
      clothingColor: 'url(#x)',
    } as unknown as Avatar);
    expect(parts.hairColor).toBe('#6C4D48');
    expect(parts.clothingColor).toBe('#5B4F96');
  });
});
