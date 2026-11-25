import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { Mesh } from 'three';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Avatar } from '@/features/profile/avatar-options';
import type { NpcView } from '../npc/npc-view';
import { ClassroomScene } from './classroom-scene';

const nav = vi.hoisted(() => ({
  options: null as unknown,
  onFloorClick: vi.fn(),
  clearDestination: vi.fn(),
  localAvatarProps: null as unknown,
  remoteAvatars: [] as unknown[],
  remoteMounts: 0,
  remoteUnmounts: 0,
  highlightProps: null as unknown,
  kitProps: null as unknown,
  doorProps: null as unknown,
  botProps: null as unknown as Record<string, unknown> | null,
  petProps: null as unknown as Record<string, unknown> | null,
  trackerProps: null as unknown as {
    interactables: { id: string }[];
    onChange?: unknown;
    onAnchor?: unknown;
  } | null,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: { invalidate: () => void }) => unknown) =>
    select({ invalidate: vi.fn() }),
}));

vi.mock('./use-classroom-navigation', () => ({
  useClassroomNavigation: (options: unknown) => {
    nav.options = options;
    return {
      controller: { poseRef: { current: { x: 0, z: 0, rotation: 0 } } },
      marker: { object: new Mesh() },
      onFloorClick: nav.onFloorClick,
      clearDestination: nav.clearDestination,
    };
  },
}));
vi.mock('./local-avatar', () => ({
  LocalAvatar: (props: unknown) => {
    nav.localAvatarProps = props;
    return <div data-testid="local-avatar" />;
  },
}));
vi.mock('./follow-camera', () => ({ FollowCamera: () => null }));
vi.mock('./proximity-tracker', () => ({
  ProximityTracker: (props: never) => {
    nav.trackerProps = props;
    return null;
  },
}));
vi.mock('./remote-avatar', () => ({
  RemoteAvatar: (props: unknown) => {
    nav.remoteAvatars.push(props);
    useEffect(() => {
      nav.remoteMounts += 1;
      return () => {
        nav.remoteUnmounts += 1;
      };
    }, []);
    return <div data-testid="remote-avatar" />;
  },
}));
vi.mock('./kit/classroom-kit', () => ({
  ClassroomKit: (props: unknown) => {
    nav.kitProps = props;
    return <div data-testid="classroom-kit" />;
  },
}));
vi.mock('./classroom-door', () => ({
  ClassroomDoor: (props: unknown) => {
    nav.doorProps = props;
    return <div data-testid="classroom-door" />;
  },
}));
vi.mock('../npc/tutor-bot', () => ({
  TutorBot: (props: Record<string, unknown>) => {
    nav.botProps = props;
    return <div data-testid="tutor-bot" />;
  },
}));
vi.mock('../npc/classroom-pet', () => ({
  ClassroomPet: (props: Record<string, unknown>) => {
    nav.petProps = props;
    return <div data-testid="classroom-pet" />;
  },
}));
vi.mock('./interactable-highlight', () => ({
  InteractableHighlight: (props: unknown) => {
    nav.highlightProps = props;
    return <div data-testid="interactable-highlight" />;
  },
}));

const avatar: Avatar = {
  bodyId: 'female',
  hairId: 'afro',
  topId: 'basic-tshirt',
  hairColor: '#AF6D63',
  clothingColor: '#75B7DA',
};

beforeEach(() => {
  nav.onFloorClick.mockClear();
  nav.remoteAvatars.length = 0;
  nav.remoteMounts = 0;
  nav.remoteUnmounts = 0;
  nav.clearDestination.mockClear();
  nav.highlightProps = null;
  nav.kitProps = null;
  nav.doorProps = null;
  nav.botProps = null;
  nav.petProps = null;
  nav.trackerProps = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ClassroomScene', () => {
  test('renders the local avatar with the profile avatar and classroom scope', () => {
    render(<ClassroomScene avatar={avatar} scopeKey="room-1" />);
    expect(screen.getByTestId('local-avatar')).toBeInTheDocument();
    expect(nav.localAvatarProps).toMatchObject({ avatar, scopeKey: 'room-1' });
  });

  test('mounts the modular shell kit with the derived placements and classroom scope', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('classroom-kit')).toBeInTheDocument();
    const { placements, scopeKey } = nav.kitProps as {
      placements: { moduleId: string }[];
      scopeKey: string;
    };
    expect(scopeKey).toBe('room-1');
    expect(placements.filter((p) => p.moduleId === 'floor-tile')).toHaveLength(
      192,
    );
    expect(placements.some((p) => p.moduleId === 'wall-solid')).toBe(true);
    expect(
      placements.filter((p) => p.moduleId === 'student-desk'),
    ).toHaveLength(12);
    expect(
      placements.filter((p) => p.moduleId === 'student-chair'),
    ).toHaveLength(12);
    expect(placements.some((p) => p.moduleId === 'teacher-desk')).toBe(true);
  });

  test('draws each desk decor on top of its desk', () => {
    render(
      <ClassroomScene
        scopeKey="room-1"
        deskDecor={[{ deskIndex: 2, code: 'desk_lamp' }]}
      />,
    );
    const { placements } = nav.kitProps as {
      placements: { moduleId: string; position: number[] }[];
    };
    expect(placements.map((p) => p.moduleId)).toEqual(['desk-decor-lamp']);
    expect(placements[0]?.position[1]).toBe(0.75);
  });

  test('draws the door outside the kit batch, driven by the local pose', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('classroom-door')).toBeInTheDocument();
    const { placements } = nav.kitProps as {
      placements: { moduleId: string }[];
    };
    expect(placements.some((p) => p.moduleId === 'door')).toBe(false);
    const { poseRef, scopeKey } = nav.doorProps as {
      poseRef: unknown;
      scopeKey: string;
    };
    expect(scopeKey).toBe('room-1');
    expect(poseRef).toBe(
      (nav.localAvatarProps as { controller: { poseRef: unknown } }).controller
        .poseRef,
    );
  });

  test('mounts the tutor bot idle at its home in front of the station when no NPC state arrives', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('tutor-bot')).toBeInTheDocument();
    const { npc, scopeKey } = nav.botProps as {
      npc: { id: string; x: number; z: number; state: string };
      scopeKey: string;
    };
    expect(scopeKey).toBe('room-1');
    expect(npc).toMatchObject({ id: 'tutorBot', state: 'idle' });
    expect(npc.x).toBeCloseTo(-5.611, 2);
    expect(npc.z).toBeCloseTo(1.05, 2);
  });

  test('mounts the pet asleep on its bed when no NPC state arrives', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('classroom-pet')).toBeInTheDocument();
    const { npc, scopeKey } = nav.petProps as {
      npc: { id: string; x: number; z: number; state: string };
      scopeKey: string;
    };
    expect(scopeKey).toBe('room-1');
    expect(npc).toMatchObject({ id: 'pet', state: 'sleeping' });
    expect(npc.x).toBeCloseTo(6.73, 2);
  });

  test('feeds the pet its synced NPC state', () => {
    const synced: NpcView = {
      id: 'pet',
      x: 2,
      z: -3,
      rotation: 1,
      state: 'emote',
      emote: 'Meow',
      reaction: '',
      phraseId: -1,
      reactionSeq: 5,
      reactingSessionId: '',
    };
    render(
      <ClassroomScene scopeKey="room-1" npcs={new Map([['pet', synced]])} />,
    );
    expect(nav.petProps).toMatchObject({ npc: synced });
  });

  test('feeds the bot the synced NPC state and its resolved phrase text', () => {
    const synced: NpcView = {
      id: 'tutorBot',
      x: 1,
      z: 2,
      rotation: 0,
      state: 'reacting',
      emote: '',
      reaction: 'phrase',
      phraseId: 4,
      reactionSeq: 3,
      reactingSessionId: 's1',
    };
    const resolveNpcPhrase = vi.fn(() => 'La luna orbita la Tierra');
    render(
      <ClassroomScene
        scopeKey="room-1"
        npcs={new Map([['tutorBot', synced]])}
        resolveNpcPhrase={resolveNpcPhrase}
      />,
    );
    expect(nav.botProps).toMatchObject({
      npc: synced,
      phraseText: 'La luna orbita la Tierra',
    });
    expect(resolveNpcPhrase).toHaveBeenCalledWith(synced);
  });

  test('shares live NPC positions with proximity and highlight', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    const live = (nav.botProps as { positions: unknown }).positions;
    expect(live).toBeInstanceOf(Map);
    expect((nav.petProps as { positions: unknown }).positions).toBe(live);
    expect((nav.trackerProps as { npcPositions?: unknown }).npcPositions).toBe(
      live,
    );
    expect(
      (nav.highlightProps as { npcPositions?: unknown }).npcPositions,
    ).toBe(live);
  });

  test('still renders without a profile avatar', () => {
    render(<ClassroomScene scopeKey="room-1" />);
    expect(screen.getByTestId('local-avatar')).toBeInTheDocument();
    expect(
      (nav.localAvatarProps as { avatar?: Avatar }).avatar,
    ).toBeUndefined();
  });

  test('passes the intent listener and interactionLocked through to navigation and highlight', () => {
    const onIntentChange = vi.fn();
    render(
      <ClassroomScene
        scopeKey="room-1"
        onIntentChange={onIntentChange}
        highlightedInteractableId="board"
        ownDeskIndex={2}
        interactionLocked={true}
      />,
    );
    expect(nav.options).toMatchObject({
      scopeKey: 'room-1',
      onIntentChange,
      interactionLocked: true,
    });
    expect(nav.highlightProps).toMatchObject({
      highlightedId: undefined,
      ownDeskIndex: 2,
    });
  });

  test('routes clicks on the scene root to the floor handler when no interactable is hit', () => {
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

  test('tracks proximity only for interactables the host accepts', () => {
    const onProximityChange = vi.fn();
    const onProximityAnchor = vi.fn();
    render(
      <ClassroomScene
        isProximityTarget={(item) => item.id === 'shop' || item.id === 'pet'}
        onProximityChange={onProximityChange}
        onProximityAnchor={onProximityAnchor}
      />,
    );
    expect(nav.trackerProps?.interactables.map((item) => item.id)).toEqual([
      'shop',
      'pet',
    ]);
    expect(nav.trackerProps?.onChange).toBe(onProximityChange);
    expect(nav.trackerProps?.onAnchor).toBe(onProximityAnchor);
  });

  test('has no proximity candidates unless the host opts in', () => {
    render(<ClassroomScene />);
    expect(nav.trackerProps?.interactables).toEqual([]);
  });

  test('forwards highlight props when unlocked', () => {
    render(
      <ClassroomScene
        scopeKey="room-1"
        highlightedInteractableId="shop"
        ownDeskIndex={1}
      />,
    );
    expect(nav.highlightProps).toMatchObject({
      highlightedId: 'shop',
      ownDeskIndex: 1,
    });
  });

  test('remounts remote avatars when scopeKey changes even for the same userId', () => {
    const participants = [
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
    ];
    const { rerender } = render(
      <ClassroomScene scopeKey="room-1" remoteParticipants={participants} />,
    );
    expect(nav.remoteMounts).toBe(1);
    expect(nav.remoteUnmounts).toBe(0);

    // Same classroom keeps the existing remote avatar mounted.
    rerender(
      <ClassroomScene
        scopeKey="room-1"
        remoteParticipants={[{ ...participants[0]!, x: 2 }]}
      />,
    );
    expect(nav.remoteMounts).toBe(1);
    expect(nav.remoteUnmounts).toBe(0);

    // Switching classroom scope remounts RemoteAvatar so poses never interpolate across rooms.
    rerender(
      <ClassroomScene
        scopeKey="room-2"
        remoteParticipants={[{ ...participants[0]!, x: -3, z: 4 }]}
      />,
    );
    expect(nav.remoteMounts).toBe(2);
    expect(nav.remoteUnmounts).toBe(1);
  });
});
