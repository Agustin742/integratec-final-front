import { act, render, screen } from '@testing-library/react';
import { Mesh } from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import { LocalAvatar } from './local-avatar';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  invalidate: vi.fn(),
  renders: 0,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = { invalidate: frame.invalidate };
    return select ? select(state) : state;
  },
}));
vi.mock('../avatar/avatar-model', () => ({
  AvatarModel: (props: {
    animation?: string;
    scopeKey?: string;
    equipped?: { head?: string | null };
  }) => {
    frame.renders += 1;
    return (
      <div
        data-testid="avatar-model"
        data-animation={props.animation}
        data-head={props.equipped?.head ?? ''}
      >
        {props.scopeKey}
      </div>
    );
  },
}));

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

function makeController(moving: () => boolean) {
  return {
    step: vi.fn(() => ({
      pose: { x: 1, z: 2, rotation: 0.5 },
      moving: moving(),
      arrived: false,
    })),
    hasDestination: vi.fn(() => false),
    poseRef: { current: { x: -6, z: 5, rotation: Math.PI } },
  };
}

const tick = (delta = 1 / 60) =>
  act(() => {
    frame.callback?.({}, delta);
  });

beforeEach(() => {
  frame.callback = null;
  frame.renders = 0;
  frame.invalidate.mockClear();
  // R3F intrinsics (<mesh>, <capsuleGeometry>) are unknown DOM tags here.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('LocalAvatar', () => {
  test('passes the equipped accessories to the avatar model', () => {
    render(
      <LocalAvatar
        controller={makeController(() => false)}
        marker={new Mesh()}
        avatar={avatar}
        equipped={{ head: 'head_crown' }}
      />,
    );
    expect(screen.getByTestId('avatar-model')).toHaveAttribute(
      'data-head',
      'head_crown',
    );
  });

  test('renders the profile avatar idle, scoped to the classroom', () => {
    const controller = makeController(() => false);
    render(
      <LocalAvatar
        controller={controller}
        marker={new Mesh()}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    const model = screen.getByTestId('avatar-model');
    expect(model).toHaveAttribute('data-animation', 'Idle');
    expect(model).toHaveTextContent('room-1');
  });

  test('switches to Walk while moving and back to Idle, re-rendering only on flips', () => {
    let moving = false;
    const controller = makeController(() => moving);
    render(
      <LocalAvatar
        controller={controller}
        marker={new Mesh()}
        avatar={avatar}
      />,
    );
    const baseline = frame.renders;
    moving = true;
    tick();
    expect(screen.getByTestId('avatar-model')).toHaveAttribute(
      'data-animation',
      'Walk',
    );
    const afterFlip = frame.renders;
    expect(afterFlip).toBeGreaterThan(baseline);
    for (let i = 0; i < 20; i += 1) tick();
    expect(frame.renders).toBe(afterFlip);
    moving = false;
    tick();
    expect(screen.getByTestId('avatar-model')).toHaveAttribute(
      'data-animation',
      'Idle',
    );
  });

  test('requests frames only while moving', () => {
    let moving = true;
    const controller = makeController(() => moving);
    render(
      <LocalAvatar
        controller={controller}
        marker={new Mesh()}
        avatar={avatar}
      />,
    );
    frame.invalidate.mockClear();
    tick();
    expect(frame.invalidate).toHaveBeenCalledTimes(1);
    moving = false;
    tick();
    expect(frame.invalidate).toHaveBeenCalledTimes(1);
  });

  test('shows a placeholder body, not the model, without a profile avatar', () => {
    const controller = makeController(() => false);
    const { container } = render(
      <LocalAvatar controller={controller} marker={new Mesh()} />,
    );
    expect(screen.queryByTestId('avatar-model')).not.toBeInTheDocument();
    expect(container.querySelector('capsulegeometry')).not.toBeNull();
  });
});
