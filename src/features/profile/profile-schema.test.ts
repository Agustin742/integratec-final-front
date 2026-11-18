import { describe, expect, test } from 'vitest';
import {
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
  test('enforces body/hair/top compatibility rules from the contract', () => {
    expect(
      avatarFormSchema.safeParse({
        ...baseAvatar,
        bodyId: 'male',
        hairId: 'original',
      }).success,
    ).toBe(false);

    expect(
      avatarFormSchema.safeParse({
        ...baseAvatar,
        bodyId: 'male',
        topId: 'tshirt',
      }).success,
    ).toBe(false);

    expect(
      avatarFormSchema.safeParse({
        ...baseAvatar,
        bodyId: 'female',
        hairId: 'dreads',
      }).success,
    ).toBe(false);

    expect(
      avatarFormSchema.safeParse({
        ...baseAvatar,
        bodyId: 'female',
        hairId: 'original',
        topId: 'tshirt',
      }).success,
    ).toBe(true);
  });

  test('reconcileAvatarChoices resets only incompatible hair/top on body switch', () => {
    const maleDreads: Avatar = {
      ...baseAvatar,
      bodyId: 'male',
      hairId: 'dreads',
      topId: 'tank',
    };
    const reconciled = reconcileAvatarChoices({
      ...maleDreads,
      bodyId: 'female',
    });
    expect(reconciled).toEqual({
      ...maleDreads,
      bodyId: 'female',
      hairId: 'afro',
      topId: 'tank',
    });
    expect(reconcileAvatarChoices(reconciled)).toBe(reconciled);
  });

  test('exposes contract-aligned option subsets, equality, and description', () => {
    expect(hairOptionsFor('male').map((o) => o.value)).toEqual([
      'afro',
      'dreads',
    ]);
    expect(hairOptionsFor('female').map((o) => o.value)).toEqual([
      'afro',
      'original',
    ]);
    expect(topOptionsFor('male').map((o) => o.value)).toEqual([
      'hoodie',
      'tank',
    ]);
    expect(topOptionsFor('female').map((o) => o.value)).toEqual([
      'hoodie',
      'tank',
      'tshirt',
    ]);
    expect(avatarsEqual(baseAvatar, { ...baseAvatar })).toBe(true);
    expect(
      avatarsEqual(baseAvatar, { ...baseAvatar, hairColor: '#E5AD58' }),
    ).toBe(false);
    expect(describeAvatar(baseAvatar)).toBe(
      'Masculino, Afro, Castaño, Buzo con capucha, Violeta',
    );
  });
});
