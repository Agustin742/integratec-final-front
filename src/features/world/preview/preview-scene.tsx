import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import type { RandomSource } from './preview-scene-plan';

const loadScene = () =>
  import('./preview-scene-3d').then((module) => ({
    default: module.PreviewScene3D,
  }));

/** A failed chunk or render keeps the page; only the decoration is lost. */
class SceneBoundary extends Component<
  { readonly fallback: ReactNode; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface PreviewSceneProps {
  /** Accessible name of the scene, as one decorative image. */
  readonly label: string;
  readonly random?: RandomSource;
}

/**
 * Host of the animated 3D welcome scene. It imports no Three.js: the scene is
 * a lazy chunk, requested only when the browser has WebGL 2, and every failure
 * leaves the same quiet empty box. The caller sizes it.
 */
export function PreviewScene({ label, random }: PreviewSceneProps) {
  const [Scene] = useState(() => lazy(loadScene));
  const [unavailable, setUnavailable] = useState(false);
  const onUnavailable = useCallback(() => setUnavailable(true), []);

  const fallback = (
    <div
      data-preview-fallback
      aria-hidden="true"
      className="size-full bg-primary-foreground/10"
    />
  );
  // Three.js needs WebGL 2; without it the chunk is not worth downloading.
  if (unavailable || typeof window.WebGL2RenderingContext === 'undefined') {
    return fallback;
  }
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Scene label={label} random={random} onUnavailable={onUnavailable} />
      </Suspense>
    </SceneBoundary>
  );
}
