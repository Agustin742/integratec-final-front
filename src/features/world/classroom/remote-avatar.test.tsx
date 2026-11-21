import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import { RemoteAvatar } from './remote-avatar';

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
  AvatarModel: (props: { animation?: string; scopeKey?: string }) => {
    frame.renders += 1;
    return (
      <div data-testid="remote-avatar-model" data-animation={props.animation}>
        {props.scopeKey}
      </div>
    );
  },
}));

const avatar: Avatar = {
  bodyId: 'male',
  hairId: 'dreads',
  topId: 'hoodie',
  hairColor: '#353849',
  clothingColor: '#5B4F96',
};

const tick = (delta = 0.05) =>
  act(() => {
    frame.callback?.({}, delta);
  });

beforeEach(() => {
  frame.callback = null;
  frame.renders = 0;
  frame.invalidate.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('RemoteAvatar', () => {
  test('renders Idle initially and switches to Walk while interpolating toward a new server pose', () => {
    const { rerender } = render(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 0, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );

    const model = screen.getByTestId('remote-avatar-model');
    expect(model).toHaveAttribute('data-animation', 'Idle');
    expect(model).toHaveTextContent('room-1');
    const baseline = frame.renders;

    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 2, z: 0, rotation: Math.PI / 2 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );

    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Walk',
    );
    const afterWalkFlip = frame.renders;
    expect(afterWalkFlip).toBeGreaterThan(baseline);

    // Intermediate ticks stay in Walk without extra React renders.
    tick(0.05);
    tick(0.05);
    expect(frame.renders).toBe(afterWalkFlip);

    // Settling returns to Idle.
    for (let i = 0; i < 40; i += 1) {
      tick(0.05);
    }
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Idle',
    );
  });

  test('renders placeholder body until base avatar is resolved', () => {
    const { container } = render(
      <RemoteAvatar
        userId="remote-2"
        status="reconnecting"
        targetPose={{ x: 1, z: 1, rotation: 0 }}
      />,
    );
    expect(screen.queryByTestId('remote-avatar-model')).not.toBeInTheDocument();
    expect(container.querySelector('capsulegeometry')).not.toBeNull();
  });
});
