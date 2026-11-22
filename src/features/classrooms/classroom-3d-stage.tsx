import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router';
import type { ClassroomInteractable } from '../world/classroom/classroom-interactables';
import { PerformanceProbeRuntime } from '../world/performance-monitor';
import { PerformanceStatsOverlay } from '../world/performance-stats-overlay';
import { worldMessages } from '../world/messages';
import { WorldFallback } from '../world/world-fallback';
import {
  ClassroomInteractablesBar,
  type InteractableFeedback,
} from './classroom-interactables-bar';
import { useClassroomDesks } from './desks/classroom-desks-api';
import { classroomMessages } from './messages';
import { useOptionalClassroomPanels } from './panels/classroom-panels';

export interface Classroom3DStageProps {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  readonly scopeKey?: string;
  readonly classroomId?: string;
  readonly petName?: string | null;
  /** Fired when the canvas measures sustained low fps (#56). */
  readonly onSustainedLowFps?: () => void;
}

type ClearAssetCacheFn = (options?: {
  scopeKey?: string;
  disposeDecoders?: boolean;
}) => void;

let loadedClearAssetCache: ClearAssetCacheFn | null = null;

const loadClassroomWorld = () =>
  import('../world').then((module) => {
    loadedClearAssetCache = module.clearAssetCache;
    return { default: module.ClassroomWorld };
  });

/** Same lazy chunk as the classroom world, so the probe never eagerly loads three. */
const loadWorldProbe = () =>
  import('../world').then((module) => ({
    default: module.PerformanceProbe,
  }));

/**
 * Clears GLB assets/decoders only if the lazy `../world` chunk has been loaded,
 * keeping `three` out of the initial `ClassroomWorkspace` / 2D Classic bundle.
 */
export function clearLoadedWorldAssets(options?: {
  scopeKey?: string;
  disposeDecoders?: boolean;
}): void {
  loadedClearAssetCache?.(options);
}

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
export function Classroom3DStage({
  headingRef,
  scopeKey,
  classroomId,
  petName,
  onSustainedLowFps,
}: Classroom3DStageProps) {
  const resolvedClassroomId = classroomId ?? scopeKey ?? '';
  return (
    <Classroom3DStageContent
      key={resolvedClassroomId}
      headingRef={headingRef}
      scopeKey={scopeKey}
      classroomId={resolvedClassroomId}
      petName={petName}
      onSustainedLowFps={onSustainedLowFps}
    />
  );
}

function Classroom3DStageContent({
  headingRef,
  scopeKey,
  classroomId,
  petName,
  onSustainedLowFps,
}: {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  readonly scopeKey?: string;
  readonly classroomId: string;
  readonly petName?: string | null;
  readonly onSustainedLowFps?: () => void;
}) {
  const [LazyClassroomWorld] = useState(() => lazy(loadClassroomWorld));
  const [LazyWorldProbe] = useState(() => lazy(loadWorldProbe));
  const supportsBrowserObservers = typeof ResizeObserver !== 'undefined';
  const [performanceRuntime] = useState(() => new PerformanceProbeRuntime());

  const navigate = useNavigate();
  const panels = useOptionalClassroomPanels();
  const desks = useClassroomDesks(classroomId, classroomId.trim().length > 0);

  const [highlightedId, setHighlightedId] = useState<string | undefined>(
    undefined,
  );
  const [petReactionNonce, setPetReactionNonce] = useState(0);
  const [feedback, setFeedback] = useState<InteractableFeedback | null>(null);

  const interactionLocked = panels?.hasActivePanel ?? false;
  const effectiveHighlightedId = interactionLocked ? undefined : highlightedId;

  const trimmedPetName = petName?.trim() ?? '';
  const resolvedPetName =
    trimmedPetName.length > 0
      ? trimmedPetName
      : classroomMessages.interactables.petDefaultName;

  const restoreStageHeadingFocus = useCallback(() => {
    if (headingRef?.current?.isConnected) {
      headingRef.current.focus();
    }
  }, [headingRef]);

  const handleRetryDesks = useCallback(() => {
    setFeedback({
      kind: 'info',
      text: classroomMessages.interactables.desksLoading,
    });
    desks.retry();
  }, [desks]);

  const handleActivateInteractable = useCallback(
    (interactable: ClassroomInteractable | null, invoker?: HTMLElement) => {
      if (interactionLocked) return;
      const copy = classroomMessages.interactables;

      if (interactable === null) {
        if (desks.status === 'pending' || desks.status === 'idle') {
          setFeedback({ kind: 'info', text: copy.desksLoading });
        } else if (desks.status === 'error') {
          setFeedback({
            kind: 'denied',
            text: copy.desksUnavailable,
            retry: {
              label: copy.retryDesksAction,
              onClick: handleRetryDesks,
            },
          });
        } else {
          setFeedback({ kind: 'denied', text: copy.noAssignedDeskShort });
        }
        return;
      }

      if (interactable.interactionClass === 'decorative') {
        setPetReactionNonce((nonce) => nonce + 1);
        setFeedback({
          kind: 'pet',
          text: copy.petGreeting(resolvedPetName),
        });
        return;
      }

      if (interactable.interactionClass === 'direct_transition') {
        setHighlightedId(undefined);
        setFeedback(null);
        void navigate('/');
        return;
      }

      if (interactable.type === 'student-desk') {
        if (desks.status === 'pending' || desks.status === 'idle') {
          setFeedback({ kind: 'info', text: copy.desksLoading });
          return;
        }
        if (desks.status === 'error') {
          setFeedback({
            kind: 'denied',
            text: copy.desksUnavailable,
            retry: {
              label: copy.retryDesksAction,
              onClick: handleRetryDesks,
            },
          });
          return;
        }
        if (desks.myDeskIndex === null) {
          setFeedback({ kind: 'denied', text: copy.noAssignedDesk });
          return;
        }
        if (interactable.deskIndex !== desks.myDeskIndex) {
          setFeedback({ kind: 'denied', text: copy.foreignDesk });
          return;
        }
      }

      const panelKey = interactable.panelKey;
      if (!panelKey || !panels || !panels.canOpenPanel(panelKey)) {
        setFeedback({ kind: 'denied', text: copy.panelDenied });
        return;
      }

      const opened = panels.openPanel(
        panelKey,
        invoker,
        invoker ? undefined : restoreStageHeadingFocus,
      );
      if (!opened) {
        setFeedback({ kind: 'denied', text: copy.panelDenied });
        return;
      }

      setHighlightedId(undefined);
      setFeedback(null);
    },
    [
      interactionLocked,
      desks.status,
      desks.myDeskIndex,
      handleRetryDesks,
      resolvedPetName,
      navigate,
      panels,
      restoreStageHeadingFocus,
    ],
  );

  const handleHoverInteractable = useCallback((id: string | undefined) => {
    setHighlightedId(id);
  }, []);

  const canOpenPanel = useCallback(
    (key: string) => panels?.canOpenPanel(key) ?? false,
    [panels],
  );

  const effectiveFeedback =
    desks.status === 'ready' &&
    feedback?.text === classroomMessages.interactables.desksLoading
      ? null
      : feedback;

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

      <ClassroomInteractablesBar
        highlightedId={effectiveHighlightedId}
        myDeskIndex={desks.myDeskIndex}
        desksStatus={desks.status}
        petName={petName}
        feedback={effectiveFeedback}
        canOpenPanel={canOpenPanel}
        onFocusInteractable={handleHoverInteractable}
        onActivateInteractable={handleActivateInteractable}
      />

      {supportsBrowserObservers ? (
        <StageBoundary>
          <div onPointerLeave={() => setHighlightedId(undefined)}>
            <Suspense fallback={<p role="status">{worldMessages.loading}</p>}>
              <LazyClassroomWorld
                label={classroomMessages.viewMode.canvasLabel}
                scopeKey={scopeKey}
                highlightedInteractableId={effectiveHighlightedId}
                ownDeskIndex={desks.myDeskIndex}
                petReactionNonce={petReactionNonce}
                interactionLocked={interactionLocked}
                onHoverInteractable={handleHoverInteractable}
                onSelectInteractable={(item) =>
                  handleActivateInteractable(item)
                }
              >
                <LazyWorldProbe
                  runtime={performanceRuntime}
                  onSustainedLowFps={onSustainedLowFps}
                />
              </LazyClassroomWorld>
            </Suspense>
          </div>
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
      <PerformanceStatsOverlay runtime={performanceRuntime} />
    </section>
  );
}
