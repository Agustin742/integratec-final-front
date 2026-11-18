import { describe, expect, it } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import { resolveAvatarParts } from './avatar-parts';

const base: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

describe('resolveAvatarParts', () => {
  it('maps a configuration to the part URLs and colors', () => {
    expect(resolveAvatarParts(base)).toEqual({
      bodyUrl: '/models/avatars/female/body.glb',
      hairUrl: '/models/avatars/female/hair-afro.glb',
      topUrl: '/models/avatars/female/top-tshirt.glb',
      hairColor: '#AF6D63',
      clothingColor: '#75B7DA',
    });
  });

  it('omits parts that do not exist for the body', () => {
    const parts = resolveAvatarParts({
      ...base,
      bodyId: 'male',
      hairId: 'original',
      topId: 'tshirt',
    });
    expect(parts.bodyUrl).toBe('/models/avatars/male/body.glb');
    expect(parts.hairUrl).toBeNull();
    expect(parts.topUrl).toBeNull();
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
