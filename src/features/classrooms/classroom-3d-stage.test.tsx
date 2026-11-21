import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Classroom3DStage } from './classroom-3d-stage';
import { classroomMessages } from './messages';

const world = vi.hoisted(() => ({
  props: {} as Record<string, unknown>,
}));

vi.mock('../world', () => ({
  clearAssetCache: vi.fn(),
  ClassroomWorld: (props: { label: string; scopeKey?: string }) => {
    world.props = props;
    return (
      <div role="region" aria-label={props.label}>
        <span data-testid="scene-host" />
      </div>
    );
  },
}));

afterEach(() => vi.unstubAllGlobals());

test('mounts the lazy classroom world with the stage label and scope', async () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  render(<Classroom3DStage scopeKey="aula-7" />);
  const region = await screen.findByRole('region', {
    name: classroomMessages.viewMode.canvasLabel,
  });
  expect(within(region).getByTestId('scene-host')).toBeInTheDocument();
  expect(world.props.scopeKey).toBe('aula-7');
});
