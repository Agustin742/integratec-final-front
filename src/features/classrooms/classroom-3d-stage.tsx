import { lazy, Suspense, useState, type RefObject } from 'react';
import { classroomMessages } from './messages';

export interface Classroom3DStageProps {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
}

const loadWorldCanvas = () =>
  import('../world').then((module) => ({
    default: module.WorldCanvas,
  }));

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
        <Suspense fallback={null}>
          <LazyWorldCanvas label={classroomMessages.viewMode.canvasLabel} />
        </Suspense>
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
