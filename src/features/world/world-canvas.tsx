import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  OrthographicCamera,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { frameCamera } from './camera';
import { worldMessages as copy } from './messages';

export interface WorldCanvasProps {
  children?: ReactNode;
  label: string;
}

function WorldFallback() {
  return (
    <div
      role="status"
      className="space-y-2 rounded-xl border border-edge bg-card p-5"
    >
      <p className="font-semibold">{copy.unavailable}</p>
      <p>{copy.alternative}</p>
    </div>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? <WorldFallback /> : this.props.children;
  }
}

function CameraFraming() {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      frameCamera(camera, size.width, size.height);
      invalidate();
    }
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

export function WorldCanvas({ children, label }: WorldCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const creationErrors = useRef(new Set<unknown>());
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    // R3F 9.4 configures its renderer asynchronously without a rejection boundary.
    // Handle only the exact errors thrown by this host's renderer factory.
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!creationErrors.current.delete(event.reason)) return;
      event.preventDefault();
      setFailed(true);
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    const element = host.current;
    let observer: IntersectionObserver | undefined;
    const checkBounds = () => {
      const rect = element?.getBoundingClientRect();
      setVisible(
        !!rect &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.right > 0 &&
          rect.top < window.innerHeight &&
          rect.left < window.innerWidth,
      );
    };
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(([entry]) =>
        setVisible(entry.isIntersecting),
      );
      observer.observe(element);
    } else {
      checkBounds();
      window.addEventListener('scroll', checkBounds, true);
      window.addEventListener('resize', checkBounds);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      observer?.disconnect();
      window.removeEventListener('scroll', checkBounds, true);
      window.removeEventListener('resize', checkBounds);
    };
  }, []);

  useEffect(() => {
    if (!canvas || failed) return;
    const onLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [canvas, failed]);

  const createRenderer: NonNullable<CanvasProps['gl']> = (defaults) => {
    try {
      const renderer = new WebGLRenderer({
        ...defaults,
        antialias: true,
        alpha: false,
      });
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      return renderer;
    } catch (error) {
      creationErrors.current.add(error);
      throw error;
    }
  };

  return (
    <div
      ref={host}
      role="region"
      aria-label={label}
      aria-busy={!failed && !canvas}
      className="min-w-0"
    >
      {failed ? (
        <WorldFallback />
      ) : (
        <SceneBoundary onError={() => setFailed(true)}>
          {!canvas && <p aria-live="polite">{copy.loading}</p>}
          <div style={{ height: 'clamp(20rem, 60vh, 32rem)', width: '100%' }}>
            <Canvas
              orthographic
              camera={{ manual: true }}
              dpr={[1, 2]}
              frameloop={visible && tabVisible ? 'demand' : 'never'}
              gl={createRenderer}
              fallback={<WorldFallback />}
              onCreated={({ gl }) => setCanvas(gl.domElement)}
            >
              <CameraFraming />
              {children}
            </Canvas>
          </div>
        </SceneBoundary>
      )}
    </div>
  );
}
