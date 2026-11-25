import { describe, expect, it } from 'vitest';
import { toAvatar } from './call-appearance';

const base = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
  items: {},
};

describe('toAvatar', () => {
  it('maps a valid appearance', () => {
    expect(toAvatar(base)).toEqual({
      bodyId: 'female',
      hairId: 'afro',
      topId: 'tshirt',
      hairColor: '#AF6D63',
      clothingColor: '#75B7DA',
    });
  });

  it('reconciles hair and top that do not fit the body', () => {
    const avatar = toAvatar({ ...base, bodyId: 'male', topId: 'tshirt' });
    expect(avatar?.topId).toBe('hoodie');
  });

  it('returns null when the body is unknown or missing', () => {
    expect(toAvatar({ ...base, bodyId: '' })).toBeNull();
    expect(toAvatar({ ...base, bodyId: 'robot' })).toBeNull();
  });
});
