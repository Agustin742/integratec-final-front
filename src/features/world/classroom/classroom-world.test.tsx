import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import { ClassroomWorld } from './classroom-world';

const canvas = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
}));

vi.mock('../world-canvas', () => ({
  WorldCanvas: (props: {
    label: string;
    scopeKey?: string;
    framing?: string;
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
  ClassroomScene: () => <div data-testid="classroom-scene" />,
}));

test('mounts the classroom scene inside the classroom-framed canvas', () => {
  render(<ClassroomWorld label="Escena" scopeKey="aula-1" />);
  const region = screen.getByRole('region', { name: 'Escena' });
  expect(within(region).getByTestId('classroom-scene')).toBeInTheDocument();
  expect(canvas.props.scopeKey).toBe('aula-1');
  expect(canvas.props.framing ?? 'classroom').toBe('classroom');
});
