import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { AvatarModelProps, WorldCanvasProps } from '@/features/world';
import { PREVIEW_STEP_MS } from '@/features/world/preview/use-show-step';
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
  topId: 'basic-tshirt',
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
  expect(world.model).toMatchObject({
    avatar,
    animation: 'Wave',
    face: 'happy',
  });
  expect(container.querySelector('[data-avatar-preview]')).toBeNull();
});

test('follows the draft as the user changes options', async () => {
  const { rerender } = render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  const next = { ...avatar, hairId: 'classic-short' as const };
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

test('keeps a visible loading state while the 3D avatar loads', async () => {
  render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  // The canvas announcement is not suppressed and the model keeps an
  // in-scene placeholder while the avatar files download.
  expect(world.canvas?.loading).not.toBeNull();
  expect(world.model?.fallback).toBeTruthy();
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
      avatar={{ ...avatar, bodyId: 'male', hairId: 'afro', topId: 'tank-top' }}
    />,
  );
  expect(await screen.findByTestId('canvas-3d')).toBeInTheDocument();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const step = () => act(() => vi.advanceTimersByTime(PREVIEW_STEP_MS));

test('waves, rests and waves again, wearing the equipped accessories', async () => {
  const equipped = { hand: 'hand_mate', neck: 'neck_scarf', ears: null };
  const { rerender } = render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  vi.useFakeTimers();
  rerender(<AvatarPreviewView avatar={avatar} equipped={equipped} />);
  expect(world.model).toMatchObject({ equipped });
});

test('alternates the wave with the idle pose', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  const clips = [world.model?.animation];
  for (let i = 0; i < 3; i += 1) {
    step();
    clips.push(world.model?.animation);
  }
  expect(clips).toEqual(['Wave', 'Idle', 'Idle', 'Wave']);
});

test('holds the idle pose under reduced motion', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<AvatarPreviewView avatar={avatar} />);
  await screen.findByTestId('canvas-3d');
  step();
  expect(world.model).toMatchObject({ animation: 'Idle' });
});
