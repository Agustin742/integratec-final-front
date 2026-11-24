import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import { REMOTE_AVATAR_SHARED_ASSETS, RemoteAvatar } from './remote-avatar';

const frame = vi.hoisted(() => ({
  callback: null as null | ((state: unknown, delta: number) => void),
  frameloop: 'demand' as 'demand' | 'never',
  invalidate: vi.fn(),
  renders: 0,
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    frame.callback = callback;
  },
  useThree: (select?: (state: unknown) => unknown) => {
    const state = {
      invalidate: frame.invalidate,
      frameloop: frame.frameloop,
    };
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

function getReactProps(element: Element): Record<string, unknown> {
  const key = Object.keys(element).find((prop) =>
    prop.startsWith('__reactProps$'),
  );
  if (!key) return {};
  return (element as unknown as Record<string, Record<string, unknown>>)[key]!;
}

beforeEach(() => {
  frame.callback = null;
  frame.frameloop = 'demand';
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
      'Run',
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

  test('renders placeholder body with shared geometry/material and does not dispose shared assets on unmount', () => {
    const disposeSpies = [
      vi.spyOn(REMOTE_AVATAR_SHARED_ASSETS.shadowGeometry, 'dispose'),
      vi.spyOn(REMOTE_AVATAR_SHARED_ASSETS.shadowOnlineMaterial, 'dispose'),
      vi.spyOn(
        REMOTE_AVATAR_SHARED_ASSETS.shadowReconnectingMaterial,
        'dispose',
      ),
      vi.spyOn(REMOTE_AVATAR_SHARED_ASSETS.placeholderGeometry, 'dispose'),
      vi.spyOn(
        REMOTE_AVATAR_SHARED_ASSETS.placeholderOnlineMaterial,
        'dispose',
      ),
      vi.spyOn(
        REMOTE_AVATAR_SHARED_ASSETS.placeholderReconnectingMaterial,
        'dispose',
      ),
    ];

    const { container, unmount } = render(
      <>
        <RemoteAvatar
          userId="remote-online"
          status="online"
          targetPose={{ x: 0, z: 0, rotation: 0 }}
        />
        <RemoteAvatar
          userId="remote-reconnecting"
          status="reconnecting"
          targetPose={{ x: 1, z: 1, rotation: 0 }}
        />
      </>,
    );

    expect(screen.queryByTestId('remote-avatar-model')).not.toBeInTheDocument();
    const placeholders = container.querySelectorAll(
      'mesh[name="remote-avatar-placeholder"]',
    );
    const shadows = container.querySelectorAll(
      'mesh[name="remote-avatar-shadow"]',
    );
    expect(placeholders).toHaveLength(2);
    expect(shadows).toHaveLength(2);

    const onlinePlaceholder = getReactProps(placeholders[0]!);
    const reconnectingPlaceholder = getReactProps(placeholders[1]!);
    expect(onlinePlaceholder.geometry).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderGeometry,
    );
    expect(reconnectingPlaceholder.geometry).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderGeometry,
    );
    expect(onlinePlaceholder.material).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderOnlineMaterial,
    );
    expect(reconnectingPlaceholder.material).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderReconnectingMaterial,
    );
    expect(onlinePlaceholder.dispose).toBeNull();
    expect(reconnectingPlaceholder.dispose).toBeNull();

    const onlineShadow = getReactProps(shadows[0]!);
    const reconnectingShadow = getReactProps(shadows[1]!);
    expect(onlineShadow.geometry).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.shadowGeometry,
    );
    expect(reconnectingShadow.geometry).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.shadowGeometry,
    );
    expect(onlineShadow.material).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.shadowOnlineMaterial,
    );
    expect(reconnectingShadow.material).toBe(
      REMOTE_AVATAR_SHARED_ASSETS.shadowReconnectingMaterial,
    );
    expect(onlineShadow.dispose).toBeNull();
    expect(reconnectingShadow.dispose).toBeNull();

    expect(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderOnlineMaterial.transparent,
    ).toBe(false);
    expect(
      REMOTE_AVATAR_SHARED_ASSETS.placeholderReconnectingMaterial.transparent,
    ).toBe(true);

    unmount();
    for (const spy of disposeSpies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  test('wakes interpolation via invalidate when frameloop transitions from never to demand', () => {
    frame.frameloop = 'never';
    const { rerender } = render(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 0, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );

    // Pose update while hidden must not invalidate yet.
    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 2, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    expect(frame.invalidate).not.toHaveBeenCalled();

    // Returning to demand wakes the loop so queued interpolation runs.
    frame.frameloop = 'demand';
    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 2, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    expect(frame.invalidate).toHaveBeenCalledTimes(1);

    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Run',
    );
  });

  test('sanitizes non-finite initial pose and ignores non-finite targetPose updates', () => {
    const { rerender } = render(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{
          x: Number.NaN,
          z: Number.POSITIVE_INFINITY,
          rotation: Number.NEGATIVE_INFINITY,
        }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );

    // Non-finite initial pose defaults to origin without walking.
    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Idle',
    );

    // Non-finite update is ignored and does not trigger invalidate or walking.
    frame.invalidate.mockClear();
    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: Number.NaN, z: 3, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    expect(frame.invalidate).not.toHaveBeenCalled();
    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Idle',
    );

    // Valid target resumes normal interpolation.
    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 1.5, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    expect(frame.invalidate).toHaveBeenCalled();
    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Run',
    );
  });

  test('resets moving state back to Idle via microtask if userId changes on a reused instance', async () => {
    const { rerender } = render(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 0, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );

    rerender(
      <RemoteAvatar
        userId="remote-1"
        status="online"
        targetPose={{ x: 2, z: 0, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    tick(0.05);
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Run',
    );

    rerender(
      <RemoteAvatar
        userId="remote-2"
        status="online"
        targetPose={{ x: -2, z: 3, rotation: 0 }}
        avatar={avatar}
        scopeKey="room-1"
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('remote-avatar-model')).toHaveAttribute(
      'data-animation',
      'Idle',
    );
  });
});
