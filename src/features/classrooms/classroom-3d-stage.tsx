import {
  Component,
  lazy,
  Suspense,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { worldMessages } from '../world/messages';
import { WorldFallback } from '../world/world-fallback';
import { classroomMessages } from './messages';

export interface Classroom3DStageProps {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
}

const loadWorldCanvas = () =>
  import('../world').then((module) => ({
    default: module.WorldCanvas,
  }));

/**
 * Local boundary: a failed 3D chunk load or render error shows the truthful
 * world fallback inside the stage, so the workspace header and its 2D Classic
 * Mode switch stay available instead of the route error page replacing them.
 */
class StageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <WorldFallback /> : this.props.children;
  }
}

/**
 * 3D isometric classroom viewport for non-parent members (`#34`,
 * `rules/3d-world-and-camera.md`). Kept lazy so 2D users and parent views do
 * not eagerly execute Three.js initialization, while unmounting cleanly when
 * switching to Classic 2D Mode.
 */
export function Classroom3DStage({ headingRef }: Classroom3DStageProps) {
  const [LazyWorldCanvas] = useState(() => lazy(loadWorldCanvas));
  const supportsBrowserObservers = typeof ResizeObserver !== 'undefined';

  return (
    <section
      aria-labelledby="classroom-3d-heading"
      className="min-w-0 space-y-3 rounded-2xl border border-edge bg-card p-5 text-card-foreground shadow-panel"
    >
      <div className="min-w-0 space-y-1">
        <h3
          id="classroom-3d-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-lg font-semibold text-foreground outline-none"
        >
          {classroomMessages.viewMode.stage3dHeading}
        </h3>
        <p className="max-w-prose text-sm text-pretty text-muted-foreground">
          {classroomMessages.viewMode.stage3dDescription}
        </p>
      </div>

      {supportsBrowserObservers ? (
        <StageBoundary>
          <Suspense fallback={<p role="status">{worldMessages.loading}</p>}>
            <LazyWorldCanvas label={classroomMessages.viewMode.canvasLabel} />
          </Suspense>
        </StageBoundary>
      ) : (
        <div
          role="region"
          aria-label={classroomMessages.viewMode.canvasLabel}
          className="min-w-0 rounded-xl border border-edge bg-tray/50 p-4"
        >
          <canvas aria-hidden="true" className="block h-48 w-full rounded-lg" />
        </div>
      )}
    </section>
  );
}
