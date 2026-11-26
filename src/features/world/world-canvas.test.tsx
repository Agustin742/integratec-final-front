import { StrictMode, useEffect, useRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
} from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import type { CanvasProps, RootState } from '@react-three/fiber';
import {
  DEFAULT_SCOPE,
  clearAssetCache,
  createConfiguredGltfLoader,
  getAssetCacheSize,
  loadGlbAsset,
  setGlbLoaderForTests,
} from './asset-cache';
import { WorldCanvas } from './world-canvas';

const renderer = vi.hoisted(() => ({
  props: {} as CanvasProps,
  dispose: vi.fn(),
  fail: false,
  failure: new Error('creation failed'),
  delayOnCreated: false,
  created: undefined as CanvasProps['onCreated'],
  params: undefined as { alpha?: boolean } | undefined,
}));
const state = {
  camera: new OrthographicCamera(),
  size: { width: 360, height: 480 },
  invalidate: vi.fn(),
};
vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  WebGLRenderer: class {
    capabilities = { isWebGL2: true };
    extensions = { has: () => false, get: () => null };
    constructor(params: { alpha?: boolean }) {
      renderer.params = params;
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
      try {
        const glInstance =
          typeof props.gl === 'function'
            ? props.gl({ canvas: canvas.current! })
            : undefined;
        if (renderer.delayOnCreated) {
          renderer.created = props.onCreated;
          return () => renderer.dispose();
        }
        props.onCreated?.({
          gl: Object.assign(
            {
              domElement: canvas.current,
              capabilities: { isWebGL2: true },
              extensions: { has: () => false, get: () => null },
            },
            glInstance,
          ),
        } as unknown as RootState);
      } catch (reason) {
        const event = new Event('unhandledrejection', { cancelable: true });
        Object.defineProperty(event, 'reason', { value: reason });
        window.dispatchEvent(event);
      }
      return () => renderer.dispose();
    }, []);
    return (
      <>
        <canvas ref={canvas} />
        {props.children}
      </>
    );
  },
}));
let intersect: (visible: boolean) => void;
let intersectBatch: (visibilities: boolean[]) => void;
const disconnect = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  renderer.fail = false;
  renderer.delayOnCreated = false;
  renderer.created = undefined;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        const fire = (visibilities: boolean[]) =>
          callback(
            visibilities.map(
              (isIntersecting) =>
                ({ isIntersecting }) as IntersectionObserverEntry,
            ),
            this as unknown as IntersectionObserver,
          );
        intersect = (visible) => fire([visible]);
        intersectBatch = fire;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  clearAssetCache({ disposeDecoders: true });
  setGlbLoaderForTests(null);
  vi.restoreAllMocks();
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
test('uses the newest queued intersection entry when several arrive', () => {
  render(<WorldCanvas label="Technical world" />);
  act(() => intersectBatch([true, false]));
  expect(renderer.props.frameloop).toBe('never');
  act(() => intersectBatch([false, true]));
  expect(renderer.props.frameloop).toBe('demand');
});
test('renders the shared fallback once when the scene subtree throws', () => {
  function BrokenScene(): never {
    throw new Error('scene failure');
  }
  const view = render(
    <WorldCanvas label="Technical world">
      <BrokenScene />
    </WorldCanvas>,
  );
  const statuses = screen.getAllByRole('status');
  expect(statuses).toHaveLength(1);
  expect(statuses[0]).toHaveTextContent('La vista 3D no está disponible');
  expect(view.container.querySelector('canvas')).toBeNull();
});
test('keeps the canvas mounted while scene children suspend', () => {
  function Suspender(): never {
    throw new Promise<void>(() => {});
  }
  const view = render(
    <WorldCanvas label="Technical world">
      <Suspender />
    </WorldCanvas>,
  );
  expect(view.container.querySelector('canvas')).not.toBeNull();
  expect(screen.queryByText('Preparando la vista 3D…')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Technical world' })).toBeVisible();
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
test('does not expose canvas fallback content while WebGL renders', () => {
  render(<WorldCanvas label="Technical world" />);
  expect(renderer.props.fallback).toBeUndefined();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(
    screen.queryByText('La vista 3D no está disponible'),
  ).not.toBeInTheDocument();
});
test('announces loading outside the busy container until the canvas is ready', () => {
  renderer.delayOnCreated = true;
  render(<WorldCanvas label="Technical world" />);
  const region = screen.getByRole('region', { name: 'Technical world' });
  expect(region).toHaveAttribute('aria-busy', 'true');
  const loading = screen.getByText('Preparando la vista 3D…');
  expect(loading.closest('[aria-busy="true"]')).toBeNull();
  act(() => {
    renderer.created?.({
      gl: {
        domElement: document.createElement('canvas'),
        capabilities: { isWebGL2: true },
        extensions: { has: () => false, get: () => null },
      },
    } as unknown as RootState);
  });
  expect(screen.queryByText('Preparando la vista 3D…')).not.toBeInTheDocument();
  expect(region).toHaveAttribute('aria-busy', 'false');
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
test('configures KTX2 renderer support inside createRenderer before onCreated runs', () => {
  const detectSupport = vi.spyOn(KTX2Loader.prototype, 'detectSupport');
  renderer.delayOnCreated = true;
  render(<WorldCanvas label="Technical world" />);
  createConfiguredGltfLoader();
  expect(detectSupport).toHaveBeenCalledTimes(1);
});
test('preserves scoped caches and KTX2 renderer support across StrictMode and unscoped unmount', async () => {
  const detectSupport = vi.spyOn(KTX2Loader.prototype, 'detectSupport');
  const makeGltf = () => {
    const group = new Group();
    group.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));
    return {
      scene: group,
      scenes: [group],
      animations: [],
      cameras: [],
      asset: {},
    } as unknown as GLTF;
  };
  setGlbLoaderForTests({
    loadAsync: vi.fn(async () => makeGltf()),
  });

  await loadGlbAsset('/models/classroom.glb', { scopeKey: 'classroom-42' });
  await loadGlbAsset('/models/reference.glb');
  expect(getAssetCacheSize('classroom-42')).toBe(1);
  expect(getAssetCacheSize(DEFAULT_SCOPE)).toBe(1);

  const view = render(
    <StrictMode>
      <WorldCanvas label="Technical world" />
    </StrictMode>,
  );

  expect(getAssetCacheSize('classroom-42')).toBe(1);
  detectSupport.mockClear();
  createConfiguredGltfLoader();
  expect(detectSupport).toHaveBeenCalledTimes(1);

  view.unmount();

  expect(getAssetCacheSize(DEFAULT_SCOPE)).toBe(0);
  expect(getAssetCacheSize('classroom-42')).toBe(1);
  detectSupport.mockClear();
  createConfiguredGltfLoader();
  expect(detectSupport).toHaveBeenCalledTimes(1);
});

test('frames the avatar from the front when asked, keeping the classroom framing as the default', () => {
  state.size = { width: 224, height: 280 };
  render(<WorldCanvas label="Avatar" framing="avatar" />);
  expect(state.camera.position.x).toBeCloseTo(0);
  expect(state.camera.position.z).toBeGreaterThan(1);
  state.size = { width: 360, height: 480 };
  render(<WorldCanvas label="Classroom" />);
  expect(state.camera.position.x).toBeCloseTo(state.camera.position.z);
});
test('frames the whole classroom by default and the small reference on request', () => {
  state.size = { width: 360, height: 480 };
  render(<WorldCanvas label="Classroom" />);
  const classroomHeight = state.camera.top;
  render(<WorldCanvas label="Reference" framing="reference" />);
  expect(state.camera.top).toBeLessThan(classroomHeight);
});
test('leaves the camera to the scene when the framing is follow', () => {
  state.size = { width: 360, height: 480 };
  state.camera = new OrthographicCamera();
  const before = state.camera.projectionMatrix.clone();
  render(<WorldCanvas label="Follow" framing="follow" />);
  expect(state.camera.projectionMatrix.equals(before)).toBe(true);
});
test('lets a host size the canvas and drop the loading line', () => {
  renderer.delayOnCreated = true;
  const { container } = render(
    <WorldCanvas
      label="Preview"
      role="img"
      canvasClassName="aspect-[4/5] w-full"
      loading={null}
    />,
  );
  expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.queryByText('Preparando la vista 3D…')).not.toBeInTheDocument();
  const sizer = container.querySelector('canvas')!.parentElement!;
  expect(sizer).toHaveClass('aspect-[4/5]');
  expect(sizer.style.height).toBe('');
});
test('keeps the default sizing and role for existing callers', () => {
  const { container } = render(<WorldCanvas label="Technical world" />);
  expect(screen.getByRole('region', { name: 'Technical world' })).toBeVisible();
  const sizer = container.querySelector('canvas')!.parentElement!;
  expect(sizer.style.height).toBe('clamp(20rem, 60vh, 32rem)');
});
test('reports unavailability once on context loss instead of rendering its own fallback', () => {
  const onUnavailable = vi.fn();
  const { container } = render(
    <WorldCanvas label="Preview" onUnavailable={onUnavailable} />,
  );
  expect(onUnavailable).not.toHaveBeenCalled();
  fireEvent(
    container.querySelector('canvas')!,
    new Event('webglcontextlost', { cancelable: true }),
  );
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});
test('reports unavailability when the renderer cannot be created', () => {
  renderer.fail = true;
  const onUnavailable = vi.fn();
  render(<WorldCanvas label="Preview" onUnavailable={onUnavailable} />);
  expect(onUnavailable).toHaveBeenCalledTimes(1);
});

test('associates an optional visually hidden description with the canvas host', () => {
  render(
    <WorldCanvas label="Technical world" description="Usá las flechas." />,
  );
  const region = screen.getByRole('region', { name: 'Technical world' });
  expect(region).toHaveAccessibleDescription('Usá las flechas.');
  expect(screen.getByText('Usá las flechas.')).toHaveClass('sr-only');
});

test('adds no description when none is given', () => {
  render(<WorldCanvas label="Technical world" />);
  const region = screen.getByRole('region', { name: 'Technical world' });
  expect(region).not.toHaveAttribute('aria-describedby');
});

test('centers the fallback below the floating top bar when fill is true', () => {
  renderer.fail = true;
  render(<WorldCanvas label="Full world" fill />);
  const fallback = screen.getByRole('status');
  expect(fallback).toHaveTextContent('La vista 3D no está disponible');
  expect(fallback.parentElement).toHaveClass(
    'flex',
    'h-full',
    'items-center',
    'justify-center',
    'p-4',
    'pt-28',
  );
});
test('keeps the canvas opaque unless a transparent one is requested', () => {
  const opaque = render(<WorldCanvas label="Technical world" />);
  expect(renderer.params?.alpha).toBe(false);
  opaque.unmount();

  render(<WorldCanvas label="Decorative world" transparent />);
  expect(renderer.params?.alpha).toBe(true);
});
