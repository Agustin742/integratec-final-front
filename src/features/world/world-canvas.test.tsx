import { Children, StrictMode, useEffect, useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { OrthographicCamera } from 'three';
import type { CanvasProps, RootState } from '@react-three/fiber';
import { WorldCanvas } from './world-canvas';

const renderer = vi.hoisted(() => ({
  props: {} as CanvasProps,
  dispose: vi.fn(),
  fail: false,
  unsupported: false,
  failure: new Error('creation failed'),
}));
const state = {
  camera: new OrthographicCamera(),
  size: { width: 360, height: 480 },
  invalidate: vi.fn(),
};
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    constructor() {
      if (renderer.fail) throw renderer.failure;
    }
  },
}));
vi.mock('@react-three/fiber', () => ({
  useThree: () => state,
  Canvas: (props: CanvasProps) => {
    renderer.props = props;
    const canvas = useRef<HTMLCanvasElement>(null);
    const initialProps = useRef(props);
    useEffect(() => {
      const props = initialProps.current;
      if (renderer.unsupported) return;
      try {
        if (typeof props.gl === 'function')
          props.gl({ canvas: canvas.current! });
        props.onCreated?.({ gl: { domElement: canvas.current } } as RootState);
      } catch (reason) {
        const event = new Event('unhandledrejection', { cancelable: true });
        Object.defineProperty(event, 'reason', { value: reason });
        window.dispatchEvent(event);
      }
      return () => renderer.dispose();
    }, []);
    return renderer.unsupported ? (
      props.fallback
    ) : (
      <>
        <canvas ref={canvas} />
        {Children.toArray(props.children)[0]}
      </>
    );
  },
}));
let intersect: (visible: boolean) => void;
const disconnect = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  renderer.fail = false;
  renderer.unsupported = false;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = (visible) =>
          callback(
            [{ isIntersecting: visible } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});

test('caps DPR, owns an orthographic camera and starts paused until visibility is known', () => {
  render(<WorldCanvas label="Technical world" />);
  expect(screen.getByRole('region', { name: 'Technical world' })).toBeVisible();
  expect(renderer.props.orthographic).toBe(true);
  expect(renderer.props.dpr).toEqual([1, 2]);
  expect(renderer.props.frameloop).toBe('never');
  act(() => intersect(true));
  expect(renderer.props.frameloop).toBe('demand');
});
test('pauses for offscreen and hidden tabs and resumes demand only when both visible', () => {
  render(<WorldCanvas label="Technical world" />);
  act(() => intersect(true));
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: true,
  });
  fireEvent(document, new Event('visibilitychange'));
  expect(renderer.props.frameloop).toBe('never');
  act(() => intersect(false));
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  fireEvent(document, new Event('visibilitychange'));
  expect(renderer.props.frameloop).toBe('never');
  act(() => intersect(true));
  expect(renderer.props.frameloop).toBe('demand');
});
test('never starts a frame loop when initially hidden, including reduced motion', () => {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: true,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  render(<WorldCanvas label="Technical world" />);
  act(() => intersect(true));
  expect(renderer.props.frameloop).toBe('never');
});
test('updates projection from renderer resize dimensions', () => {
  const { rerender } = render(<WorldCanvas label="Technical world" />);
  state.size = { width: 1280, height: 560 };
  rerender(<WorldCanvas label="Technical world" />);
  expect(
    (state.camera.right - state.camera.left) /
      (state.camera.top - state.camera.bottom),
  ).toBeCloseTo(1280 / 560);
});
test('shows a truthful DOM alternative on context loss and releases the renderer subtree', () => {
  const { container } = render(<WorldCanvas label="Technical world" />);
  const canvas = container.querySelector('canvas')!;
  const remove = vi.spyOn(canvas, 'removeEventListener');
  fireEvent(canvas, new Event('webglcontextlost', { cancelable: true }));
  expect(screen.getByRole('status')).toHaveTextContent(
    'La vista 3D no está disponible',
  );
  expect(
    screen.getByText(/modo clásico 2D todavía no está disponible/),
  ).toBeVisible();
  expect(container.querySelector('canvas')).toBeNull();
  expect(remove).toHaveBeenCalledWith('webglcontextlost', expect.any(Function));
  expect(renderer.dispose).toHaveBeenCalled();
});
test('handles actual renderer creation rejection without claiming a working 2D route', () => {
  renderer.fail = true;
  render(<WorldCanvas label="Technical world" />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'La vista 3D no está disponible',
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
test('supplies accessible fallback content when Canvas detects unsupported WebGL', () => {
  renderer.unsupported = true;
  render(<WorldCanvas label="Technical world" />);
  expect(screen.getByRole('status')).toHaveTextContent(
    'La vista 3D no está disponible',
  );
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
test('checks offscreen bounds and cleans fallback listeners without IntersectionObserver', () => {
  vi.stubGlobal('IntersectionObserver', undefined);
  const bounds = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 900, 360, 320));
  const remove = vi.spyOn(window, 'removeEventListener');
  const view = render(<WorldCanvas label="Technical world" />);
  expect(renderer.props.frameloop).toBe('never');
  bounds.mockReturnValue(new DOMRect(0, 0, 360, 320));
  fireEvent.scroll(window);
  expect(renderer.props.frameloop).toBe('demand');
  view.unmount();
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), true);
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  bounds.mockRestore();
});
test('does not swallow unrelated promise failures', () => {
  render(<WorldCanvas label="Technical world" />);
  const event = new Event('unhandledrejection', { cancelable: true });
  Object.defineProperty(event, 'reason', { value: new Error('unrelated') });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
test('cleans observer/listeners on StrictMode unmount and supports a fresh remount', () => {
  const removeDocument = vi.spyOn(document, 'removeEventListener');
  const removeWindow = vi.spyOn(window, 'removeEventListener');
  const view = render(
    <StrictMode>
      <WorldCanvas label="Technical world" />
    </StrictMode>,
  );
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(removeDocument).toHaveBeenCalledWith(
    'visibilitychange',
    expect.any(Function),
  );
  expect(removeWindow).toHaveBeenCalledWith(
    'unhandledrejection',
    expect.any(Function),
  );
  expect(renderer.dispose).toHaveBeenCalled();
  render(<WorldCanvas label="Technical world" />);
  act(() => intersect(true));
  expect(renderer.props.frameloop).toBe('demand');
});
