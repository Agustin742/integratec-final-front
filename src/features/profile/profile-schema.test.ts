import { describe, expect, test } from 'vitest';
import {
  FREE_HAIR_IDS,
  FREE_TOP_IDS,
  avatarsEqual,
  describeAvatar,
  hairOptionsFor,
  reconcileAvatarChoices,
  topOptionsFor,
  type Avatar,
} from './avatar-options';
import { avatarFormSchema, displayNameFormSchema } from './profile-schema';

const baseAvatar: Avatar = {
  bodyId: 'male',
  hairId: 'afro',
  topId: 'hoodie',
  hairColor: '#6C4D48',
  clothingColor: '#5B4F96',
};

describe('displayNameFormSchema', () => {
  test('trims surrounding spaces and preserves Unicode names', () => {
    const parsed = displayNameFormSchema.parse({
      displayName: '  Prof. Ana María 👩‍🏫  ',
    });
    expect(parsed.displayName).toBe('Prof. Ana María 👩‍🏫');
  });

  test.each([
    '',
    '   ',
    'Ana\nLópez',
    'Ana\u0007López',
    'Ana\u2028López',
    'Ana\u2029López',
    '\u200B\u2800',
    'a'.repeat(101),
  ])('rejects invalid display name %j', (displayName) => {
    expect(displayNameFormSchema.safeParse({ displayName }).success).toBe(
      false,
    );
  });

  test('accepts a 100-character display name after trimming', () => {
    const parsed = displayNameFormSchema.parse({
      displayName: `  ${'a'.repeat(100)}  `,
    });
    expect(parsed.displayName).toHaveLength(100);
  });
});

describe('avatarFormSchema and avatar options', () => {
  test('accepts every catalog hair and top for both bodies', () => {
    for (const bodyId of ['male', 'female'] as const) {
      for (const { value } of hairOptionsFor(bodyId)) {
        expect(
          avatarFormSchema.safeParse({ ...baseAvatar, bodyId, hairId: value })
            .success,
        ).toBe(true);
      }
      for (const { value } of topOptionsFor(bodyId)) {
        expect(
          avatarFormSchema.safeParse({ ...baseAvatar, bodyId, topId: value })
            .success,
        ).toBe(true);
      }
    }
  });

  test('rejects legacy and unknown hair and top ids', () => {
    for (const hairId of ['original', 'nope']) {
      expect(
        avatarFormSchema.safeParse({ ...baseAvatar, hairId }).success,
      ).toBe(false);
    }
    for (const topId of ['tank', 'tshirt', 'nope']) {
      expect(avatarFormSchema.safeParse({ ...baseAvatar, topId }).success).toBe(
        false,
      );
    }
  });

  test('reconcileAvatarChoices keeps valid choices on a body switch and resets unknown ones', () => {
    const maleDreads: Avatar = {
      ...baseAvatar,
      bodyId: 'male',
      hairId: 'dreads',
      topId: 'tank-top',
    };
    const switched = { ...maleDreads, bodyId: 'female' as const };
    expect(reconcileAvatarChoices(switched)).toBe(switched);

    const legacy = {
      ...baseAvatar,
      hairId: 'original',
      topId: 'tshirt',
    } as unknown as Avatar;
    expect(reconcileAvatarChoices(legacy)).toEqual({
      ...baseAvatar,
      hairId: hairOptionsFor('male')[0].value,
      topId: topOptionsFor('male')[0].value,
    });
  });

  test('free sets are subsets of the catalog with the agreed members', () => {
    const hair = hairOptionsFor('male').map((o) => o.value);
    const tops = topOptionsFor('male').map((o) => o.value);
    expect(hair).toHaveLength(23);
    expect(tops).toHaveLength(15);
    expect([...FREE_HAIR_IDS].sort()).toEqual([
      'afro',
      'bob',
      'bun',
      'buzz-cut',
      'classic-short',
      'long-straight',
      'middle-part',
      'ponytail',
      'short-curls',
    ]);
    expect([...FREE_TOP_IDS].sort()).toEqual([
      'basic-tshirt',
      'school-smock',
      'school-sweatshirt',
      'tank-top',
    ]);
    expect([...FREE_HAIR_IDS].every((id) => hair.includes(id))).toBe(true);
    expect([...FREE_TOP_IDS].every((id) => tops.includes(id))).toBe(true);
  });

  test('exposes contract-aligned option subsets, equality, and description', () => {
    expect(hairOptionsFor('male')).toEqual(hairOptionsFor('female'));
    expect(topOptionsFor('male')).toEqual(topOptionsFor('female'));
    expect(avatarsEqual(baseAvatar, { ...baseAvatar })).toBe(true);
    expect(
      avatarsEqual(baseAvatar, { ...baseAvatar, hairColor: '#E5AD58' }),
    ).toBe(false);
    expect(describeAvatar(baseAvatar)).toBe(
      'Masculino, Afro, Castaño, Buzo con capucha, Violeta',
    );
  });
});
