import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { Avatar } from './avatar-options';
import { AvatarPreviewView } from './avatar-preview-view';

// Isolated file: a rejected `vi.mock` factory result is cached after first import.
vi.mock('./avatar-preview-3d', () => {
  throw new Error('chunk failed');
});

const avatar: Avatar = {
  bodyId: 'male',
  hairId: 'afro',
  topId: 'hoodie',
  hairColor: '#6C4D48',
  clothingColor: '#5B4F96',
};

test('keeps the 2D preview when the 3D chunk cannot load', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<AvatarPreviewView avatar={avatar} />);
  await vi.waitFor(() => expect(logged).toHaveBeenCalled());
  expect(container.querySelector('[data-avatar-preview]')).not.toBeNull();
  expect(screen.getByRole('img')).toBeInTheDocument();
});
