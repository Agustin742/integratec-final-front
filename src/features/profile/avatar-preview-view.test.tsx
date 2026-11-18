import { act, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { AvatarModelProps, WorldCanvasProps } from '@/features/world';
import { describeAvatar, type Avatar } from './avatar-options';
import { AvatarPreviewView } from './avatar-preview-view';
import { profileMessages } from './messages';

// The 3D host and the model are covered by their own tests; here only the
// wiring and the fallback decisions of the profile preview matter.
const world = vi.hoisted(() => ({
  canvas: null as
    null | (Record<string, unknown> & { onUnavailable?: () => void }),
  model: null as
    | null
    | ({ onBodyError?: (error: unknown) => void } & Record<string, unknown>),
}));
vi.mock('@/features/world', () => ({
  WorldCanvas: (props: WorldCanvasProps) => {
    world.canvas = props as unknown as typeof world.canvas;
    return (
      <div data-testid="canvas-3d" role={props.role} aria-label={props.label}>
        {props.children}
      </div>
    );
  },
  WarmLighting: () => null,
  AvatarModel: (props: AvatarModelProps) => {
    world.model = props as unknown as typeof world.model;
    return null;
  },
}));

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};
const name = `${profileMessages.avatar.previewAlt} ${describeAvatar(avatar)}`;

beforeEach(() => {
  world.canvas = null;
  world.model = null;
});

test('shows the draft avatar in a 3D host named like the 2D preview', async () => {
  const { container } = render(<AvatarPreviewView avatar={avatar} />);
  const host = await screen.findByTestId('canvas-3d');
  expect(host).toHaveAttribute('role', 'img');
  expect(host).toHaveAccessibleName(name);
  expect(world.canvas).toMatchObject({
    framing: 'avatar',
    scopeKey: 'profile-avatar-preview',
  });
  expect(world.model).toMatchObject({ avatar, animation: 'Idle' });
  expect(container.querySelector('[data-avatar-preview]')).toBeNull();
});

test('follows the draft as the user changes options', async () => {
  const { rerender } = render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  const next = { ...avatar, hairId: 'original' as const };
  rerender(<AvatarPreviewView avatar={next} />);
  expect(world.model).toMatchObject({ avatar: next });
  expect(screen.getByTestId('canvas-3d')).toHaveAccessibleName(
    `${profileMessages.avatar.previewAlt} ${describeAvatar(next)}`,
  );
});

test('keeps the same accessible name on the 2D preview while the 3D chunk loads', () => {
  render(<AvatarPreviewView avatar={avatar} />);
  expect(screen.getByRole('img', { name })).toBeInTheDocument();
});

test('falls back to the 2D preview when WebGL is unavailable or lost', async () => {
  const { container } = render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  act(() => world.canvas?.onUnavailable?.());
  expect(screen.queryByTestId('canvas-3d')).toBeNull();
  expect(container.querySelector('[data-avatar-preview]')).not.toBeNull();
  expect(screen.getByRole('img', { name })).toBeInTheDocument();
});

test('falls back to the 2D preview when the body model fails, and retries 3D for another body', async () => {
  const { container, rerender } = render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  act(() => world.model?.onBodyError?.(new Error('body failed')));
  expect(screen.queryByTestId('canvas-3d')).toBeNull();
  expect(container.querySelector('[data-avatar-preview]')).not.toBeNull();
  rerender(
    <AvatarPreviewView
      avatar={{ ...avatar, bodyId: 'male', hairId: 'afro', topId: 'tank' }}
    />,
  );
  expect(await screen.findByTestId('canvas-3d')).toBeInTheDocument();
});
