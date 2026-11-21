import { fireEvent, render, screen } from '@testing-library/react';
import { Mesh } from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import { ClassroomScene } from './classroom-scene';

const nav = vi.hoisted(() => ({
  options: null as unknown,
  onFloorClick: vi.fn(),
  localAvatarProps: null as unknown,
  remoteAvatars: [] as unknown[],
}));

vi.mock('./use-classroom-navigation', () => ({
  useClassroomNavigation: (options: unknown) => {
    nav.options = options;
    return {
      controller: { poseRef: { current: { x: 0, z: 0, rotation: 0 } } },
      marker: { object: new Mesh() },
      onFloorClick: nav.onFloorClick,
    };
  },
}));
vi.mock('./local-avatar', () => ({
  LocalAvatar: (props: unknown) => {
    nav.localAvatarProps = props;
    return <div data-testid="local-avatar" />;
  },
}));
vi.mock('./remote-avatar', () => ({
  RemoteAvatar: (props: unknown) => {
    nav.remoteAvatars.push(props);
    return <div data-testid="remote-avatar" />;
  },
}));

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

beforeEach(() => {
  nav.onFloorClick.mockClear();
  nav.remoteAvatars.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ClassroomScene', () => {
  test('renders the local avatar with the profile avatar and classroom scope', () => {
    render(<ClassroomScene avatar={avatar} scopeKey="room-1" />);
    expect(screen.getByTestId('local-avatar')).toBeInTheDocument();
    expect(nav.localAvatarProps).toMatchObject({ avatar, scopeKey: 'room-1' });
  });

  test('still renders without a profile avatar', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('local-avatar')).toBeInTheDocument();
    expect(
      (nav.localAvatarProps as { avatar?: Avatar }).avatar,
    ).toBeUndefined();
  });

  test('passes the intent listener through to the navigation', () => {
    const onIntentChange = vi.fn();
    render(
      <ClassroomScene scopeKey="room-1" onIntentChange={onIntentChange} />,
    );
    expect(nav.options).toMatchObject({ scopeKey: 'room-1', onIntentChange });
  });

  test('routes clicks on the scene root to the floor handler', () => {
    const { container } = render(<ClassroomScene scopeKey="room-1" />);
    fireEvent.click(container.querySelector('primitive')!);
    expect(nav.onFloorClick).toHaveBeenCalledTimes(1);
  });

  test('forwards server pose, connection key, freeze state, and renders remote avatars', () => {
    const selfPose = { x: 1, z: 4, rotation: 0.5 };
    render(
      <ClassroomScene
        avatar={avatar}
        scopeKey="room-1"
        selfPose={selfPose}
        connectionKey="room-1:session-1"
        frozen
        remoteParticipants={[
          {
            userId: 'remote-1',
            displayName: 'Profe Ana',
            role: 'TEACHER',
            status: 'online',
            x: 0,
            z: -3,
            rotation: 0,
            avatar,
          },
        ]}
      />,
    );
    expect(nav.options).toMatchObject({
      scopeKey: 'room-1',
      serverPose: selfPose,
      connectionKey: 'room-1:session-1',
      frozen: true,
    });
    expect(screen.getAllByTestId('remote-avatar')).toHaveLength(1);
    expect(nav.remoteAvatars[0]).toMatchObject({
      userId: 'remote-1',
      status: 'online',
      targetPose: { x: 0, z: -3, rotation: 0 },
      avatar,
      scopeKey: 'room-1',
    });
  });
});
