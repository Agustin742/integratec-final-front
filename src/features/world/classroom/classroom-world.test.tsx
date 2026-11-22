import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { worldMessages } from '../messages';
import { ClassroomWorld } from './classroom-world';

const canvas = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
  sceneProps: {} as Record<string, unknown>,
  profile: {
    data: undefined as undefined | { avatar: unknown },
  },
}));

vi.mock('@/features/profile/use-own-profile', () => ({
  useOwnProfile: () => ({ query: { data: canvas.profile.data } }),
}));
vi.mock('../world-canvas', () => ({
  WorldCanvas: (props: {
    label: string;
    scopeKey?: string;
    framing?: string;
    description?: string;
    children?: ReactNode;
  }) => {
    canvas.props = props;
    return (
      <div role="region" aria-label={props.label}>
        {props.children}
      </div>
    );
  },
}));
vi.mock('./classroom-scene', () => ({
  ClassroomScene: (props: Record<string, unknown>) => {
    canvas.sceneProps = props;
    return <div data-testid="classroom-scene" />;
  },
}));

beforeEach(() => {
  canvas.profile.data = undefined;
});

test('mounts the classroom scene inside the classroom-framed canvas', () => {
  render(<ClassroomWorld label="Escena" scopeKey="aula-1" />);
  const region = screen.getByRole('region', { name: 'Escena' });
  expect(within(region).getByTestId('classroom-scene')).toBeInTheDocument();
  expect(canvas.props.scopeKey).toBe('aula-1');
  expect(canvas.props.framing ?? 'classroom').toBe('classroom');
});

test('describes the controls for assistive technology', () => {
  render(<ClassroomWorld label="Escena" scopeKey="aula-1" />);
  expect(canvas.props.description).toBe(worldMessages.classroomControls);
});

test('hands the confirmed profile avatar and the intent listener to the scene', () => {
  const avatar = { bodyId: 'male' };
  canvas.profile.data = { avatar };
  const onIntentChange = vi.fn();
  render(
    <ClassroomWorld
      label="Escena"
      scopeKey="aula-1"
      onIntentChange={onIntentChange}
    />,
  );
  expect(canvas.sceneProps).toMatchObject({
    avatar,
    scopeKey: 'aula-1',
    onIntentChange,
  });
});

test('renders the scene without an avatar while the profile is unavailable', () => {
  render(<ClassroomWorld label="Escena" scopeKey="aula-1" />);
  expect(screen.getByTestId('classroom-scene')).toBeInTheDocument();
  expect(canvas.sceneProps.avatar).toBeUndefined();
});

test('forwards interactable state and callbacks to ClassroomScene', () => {
  const onHoverInteractable = vi.fn();
  const onSelectInteractable = vi.fn();
  render(
    <ClassroomWorld
      label="Escena"
      scopeKey="aula-1"
      highlightedInteractableId="board"
      ownDeskIndex={3}
      petReactionNonce={2}
      interactionLocked={true}
      onHoverInteractable={onHoverInteractable}
      onSelectInteractable={onSelectInteractable}
    />,
  );
  expect(canvas.sceneProps).toMatchObject({
    highlightedInteractableId: 'board',
    ownDeskIndex: 3,
    petReactionNonce: 2,
    interactionLocked: true,
    onHoverInteractable,
    onSelectInteractable,
  });
});
