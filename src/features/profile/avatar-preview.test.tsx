import { screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { describeAvatar, type Avatar } from './avatar-options';
import { AvatarPreview } from './avatar-preview';
import { profileMessages } from './messages';

test('keeps each supported hairstyle and garment described when the preview changes', async () => {
  const avatars: readonly Avatar[] = [
    {
      bodyId: 'male',
      hairId: 'afro',
      topId: 'hoodie',
      hairColor: '#6C4D48',
      clothingColor: '#5B4F96',
    },
    {
      bodyId: 'male',
      hairId: 'dreads',
      topId: 'tank-top',
      hairColor: '#353849',
      clothingColor: '#F2C85C',
    },
    {
      bodyId: 'female',
      hairId: 'classic-short',
      topId: 'basic-tshirt',
      hairColor: '#E5AD58',
      clothingColor: '#75B7DA',
    },
    {
      // Catalog styles without their own silhouette still render and describe.
      bodyId: 'female',
      hairId: 'two-pigtails',
      topId: 'winter-coat',
      hairColor: '#C77DAA',
      clothingColor: '#7EBA8B',
    },
  ];
  const { rerender, container } = render(<AvatarPreview avatar={avatars[0]} />);

  for (const avatar of avatars) {
    rerender(<AvatarPreview avatar={avatar} />);
    expect(
      screen.getByRole('img', {
        name: `${profileMessages.avatar.previewAlt} ${describeAvatar(avatar)}`,
      }),
    ).toBeVisible();
    expect(screen.getAllByRole('img')).toHaveLength(1);
    await expectAccessible(container);
  }
});
