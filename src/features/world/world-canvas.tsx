import {
  Component,
  Suspense,
  useEffect,
  useId,
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
import { cn } from '@/lib/utils';
import {
  CLASSROOM_BOUNDS,
  frameAvatarCamera,
  frameCamera,
  framePreviewCamera,
} from './camera';
import {
  DEFAULT_SCOPE,
  clearAssetCache,
  configureKtx2RendererSupport,
} from './asset-cache';
import { worldMessages as copy } from './messages';
import { WorldFallback } from './world-fallback';

export type WorldFraming =
  'classroom' | 'follow' | 'avatar' | 'preview' | 'reference';

export interface WorldCanvasProps {
  children?: ReactNode;
  label: string;
  /** Changing `scopeKey` or unmounting disposes cached scene assets. */
  scopeKey?: string;
  /**
   * Camera framing: the whole isometric classroom (default), a scene-owned
   * follow camera (`follow`, driven by a child such as `FollowCamera`), one
   * standing avatar, a character with scenery at its sides (`preview`), or the
   * small 6x4 m technical reference.
   */
  framing?: WorldFraming;
  /** Landmark role of the host; `img` suits a decorative preview. */
  role?: 'region' | 'img';
  /** Sizing classes for the canvas box; defaults to the classroom height. */
  canvasClassName?: string;
  /** Extra classes for the landmark host that wraps the canvas box. */
  hostClassName?: string;
  /**
   * Centers the fallback below a floating top bar when filling a full-screen
   * host (#128).
   */
  fill?: boolean;
  /** Visually hidden text that describes the canvas (for example its controls). */
  description?: string;
  /** Replaces the loading announcement; `null` hides it. */
  loading?: ReactNode;
  /**
   * Called once when 3D cannot be shown (renderer creation failure or context
   * loss). The host still renders the shared fallback, so a caller that shows
   * its own alternative should unmount the canvas in response.
   */
  onUnavailable?: () => void;
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
    // The host owner renders the shared fallback when `onError` fires;
    // rendering its own would mount the status node twice.
    return this.state.failed ? null : this.props.children;
  }
}

function CameraFraming({ framing }: { framing: WorldFraming }) {
  const { camera, size, invalidate } = useThree();
  useLayoutEffect(() => {
    if (framing === 'follow') return;
    if (camera instanceof OrthographicCamera) {
      if (framing === 'avatar')
        frameAvatarCamera(camera, size.width, size.height);
      else if (framing === 'preview')
        framePreviewCamera(camera, size.width, size.height);
      else if (framing === 'reference')
        frameCamera(camera, size.width, size.height);
      else frameCamera(camera, size.width, size.height, CLASSROOM_BOUNDS);
      invalidate();
    }
  }, [camera, framing, size.width, size.height, invalidate]);
  return null;
}

export function WorldCanvas({
  children,
  label,
  scopeKey,
  framing = 'classroom',
  role = 'region',
  canvasClassName,
  hostClassName,
  fill = false,
  description,
  loading,
  onUnavailable,
}: WorldCanvasProps) {
  const descriptionId = useId();
  const host = useRef<HTMLDivElement>(null);
  const creationErrors = useRef(new Set<unknown>());
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);
  useEffect(() => {
    if (failed) onUnavailableRef.current?.();
  }, [failed]);

  useEffect(() => {
    return () => {
      clearAssetCache({ scopeKey: scopeKey ?? DEFAULT_SCOPE });
    };
  }, [scopeKey]);

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
      // Fast scrolling can queue several entries per callback; only the
      // newest describes the current geometry.
      observer = new IntersectionObserver((entries) => {
        const newest = entries[entries.length - 1];
        if (newest) setVisible(newest.isIntersecting);
      });
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
      configureKtx2RendererSupport(renderer);
      return renderer;
    } catch (error) {
      creationErrors.current.add(error);
      throw error;
    }
  };

  return (
    <>
      {/* The loading announcement lives outside the busy region: a live
          region under an `aria-busy` ancestor can be held back by screen
          readers. `role="status"` already implies polite live semantics. */}
      {!failed &&
        !canvas &&
        (loading === undefined ? <p role="status">{copy.loading}</p> : loading)}
      <div
        ref={host}
        role={role}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={!failed && !canvas}
        className={cn('min-w-0', hostClassName)}
      >
        {description && (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        )}
        {failed ? (
          fill ? (
            <div className="flex h-full items-center justify-center p-4 pt-28">
              <WorldFallback />
            </div>
          ) : (
            <WorldFallback />
          )
        ) : (
          <SceneBoundary onError={() => setFailed(true)}>
            <div
              className={canvasClassName}
              style={
                canvasClassName
                  ? undefined
                  : { height: 'clamp(20rem, 60vh, 32rem)', width: '100%' }
              }
            >
              <Canvas
                orthographic
                camera={{ manual: true }}
                dpr={[1, 2]}
                frameloop={visible && tabVisible ? 'demand' : 'never'}
                gl={createRenderer}
                onCreated={({ gl }) => {
                  configureKtx2RendererSupport(gl);
                  setCanvas(gl.domElement);
                }}
              >
                <CameraFraming framing={framing} />
                {/* Keep future loader suspensions inside the R3F subtree
                    instead of rethrowing past Canvas and replacing the whole
                    section with the outer loading fallback. */}
                <Suspense fallback={null}>{children}</Suspense>
              </Canvas>
            </div>
          </SceneBoundary>
        )}
      </div>
    </>
  );
}
