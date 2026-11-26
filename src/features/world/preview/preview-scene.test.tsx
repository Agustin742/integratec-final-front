import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PreviewScene } from './preview-scene';
import type { PreviewScene3DProps } from './preview-scene-3d';

const lazyScene = vi.hoisted(() => ({
  props: null as null | PreviewScene3DProps,
  throws: false,
}));

vi.mock('./preview-scene-3d', () => ({
  PreviewScene3D: (props: PreviewScene3DProps) => {
    if (lazyScene.throws) throw new Error('chunk or render failure');
    lazyScene.props = props;
    return <div data-testid="scene-3d" />;
  },
}));

const fallback = () => document.querySelector('[data-preview-fallback]');

beforeEach(() => {
  lazyScene.props = null;
  lazyScene.throws = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('stays quiet and loads no 3D code without WebGL', async () => {
  render(<PreviewScene label="Escena" />);
  await act(async () => {});

  expect(fallback()).toHaveAttribute('aria-hidden', 'true');
  expect(fallback()).toBeEmptyDOMElement();
  expect(lazyScene.props).toBeNull();
});

test('loads the 3D scene with the injected randomness', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  const random = () => 0.1;
  render(<PreviewScene label="Escena" random={random} />);

  expect(await screen.findByTestId('scene-3d')).toBeInTheDocument();
  expect(lazyScene.props).toMatchObject({ label: 'Escena', random });
});

test('swaps to the quiet fallback when 3D becomes unavailable', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  render(<PreviewScene label="Escena" />);
  await screen.findByTestId('scene-3d');

  act(() => lazyScene.props?.onUnavailable());

  expect(screen.queryByTestId('scene-3d')).toBeNull();
  expect(fallback()).not.toBeNull();
});

test('contains a failed load without breaking the page around it', async () => {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  lazyScene.throws = true;
  render(
    <>
      <PreviewScene label="Escena" />
      <button type="button">Ingresar</button>
    </>,
  );

  await waitFor(() => expect(fallback()).not.toBeNull());
  expect(screen.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
});
