import { describe, expect, it } from 'vitest';
import { toAvatar } from './call-appearance';

const base = {
  bodyId: 'female',
  hairId: 'classic-short',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
  items: {},
};

describe('toAvatar', () => {
  it('maps a valid appearance', () => {
    expect(toAvatar(base)).toEqual({
      bodyId: 'female',
      hairId: 'classic-short',
      topId: 'basic-tshirt',
      hairColor: '#AF6D63',
      clothingColor: '#75B7DA',
    });
  });

  it('falls back to the first catalog option for unknown hair or top ids', () => {
    const avatar = toAvatar({ ...base, hairId: 'mullet', topId: 'cape' });
    expect(avatar?.hairId).toBe('buzz-cut');
    expect(avatar?.topId).toBe('school-smock');
  });

  it('returns null when the body is unknown or missing', () => {
    expect(toAvatar({ ...base, bodyId: '' })).toBeNull();
    expect(toAvatar({ ...base, bodyId: 'robot' })).toBeNull();
  });
});
