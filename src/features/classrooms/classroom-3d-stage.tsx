import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router';
import { CLASSROOM_LAYOUT, type AvatarInput } from '@/realtime';
import type {
  AvatarEquipped,
  Pose,
  RemoteClassroomParticipant,
} from '../world';
import {
  deriveClassroomInteractables,
  indexClassroomInteractables,
  type ClassroomInteractable,
} from '../world/classroom/classroom-interactables';
import { worldMessages } from '../world/messages';
import type { NpcSpeech, NpcView, NpcViews } from '../world/npc/npc-view';
import { PerformanceProbeRuntime } from '../world/performance-monitor';
import { PerformanceStatsOverlay } from '../world/performance-stats-overlay';
import { WorldFallback } from '../world/world-fallback';
import {
  ClassroomWorldHud,
  type InteractableFeedback,
} from './classroom-3d-hud';
import {
  canTargetByProximity,
  proximityActionLabel,
} from './classroom-proximity';
import { useClassroomDesks } from './desks/classroom-desks-api';
import { classroomMessages } from './messages';
import { useOptionalClassroomPanels } from './panels/classroom-panels';
import { NpcSpeechBubble } from './npc-speech-bubble';
import { anchorProximityPrompt, ProximityPrompt } from './proximity-prompt';
import { useInteractKey } from './use-interact-key';

export interface Classroom3DStageProps {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  readonly scopeKey?: string;
  readonly classroomId?: string;
  readonly petName?: string | null;
  readonly selfPose?: Pose | undefined;
  readonly selfEquipped?: AvatarEquipped | undefined;
  readonly connectionKey?: string | undefined;
  readonly frozen?: boolean | undefined;
  readonly remoteParticipants?:
    readonly RemoteClassroomParticipant[] | undefined;
  readonly onIntentChange?: ((intent: AvatarInput) => void) | undefined;
  /** Synced NPC state by id; the tutor bot rests at home while it is absent. */
  readonly npcs?: NpcViews | undefined;
  /** Text of an NPC phrase reaction, resolved from its synced phrase id. */
  readonly resolveNpcPhrase?:
    ((npc: NpcView) => string | undefined) | undefined;
  /**
   * The local user pressed E or clicked a roaming NPC (`npcId` is its key in
   * the synced NPC map). The realtime layer sends `npc:interact` from here.
   */
  readonly onInteractNpc?: ((npcId: string) => void) | undefined;
  /** Fired when the canvas measures sustained low fps (#56). */
  readonly onSustainedLowFps?: () => void;
  /**
   * Floating content pinned to the top of the world (navbar, alerts, offers).
   * The host wraps each card in `pointer-events-auto`.
   */
  readonly topSlot?: ReactNode;
  /** Floating content anchored at the bottom-left (compact presence). */
  readonly presenceSlot?: ReactNode;
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
    return this.state.failed ? (
      <div className="flex h-full items-center justify-center p-4 pt-28">
        <WorldFallback />
      </div>
    ) : (
      this.props.children
    );
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
  selfPose,
  selfEquipped,
  connectionKey,
  frozen,
  remoteParticipants,
  onIntentChange,
  npcs,
  resolveNpcPhrase,
  onInteractNpc,
  onSustainedLowFps,
  topSlot,
  presenceSlot,
}: Classroom3DStageProps) {
  const resolvedClassroomId = classroomId ?? scopeKey ?? '';
  return (
    <Classroom3DStageContent
      key={resolvedClassroomId}
      headingRef={headingRef}
      scopeKey={scopeKey}
      classroomId={resolvedClassroomId}
      petName={petName}
      selfPose={selfPose}
      selfEquipped={selfEquipped}
      connectionKey={connectionKey}
      frozen={frozen}
      remoteParticipants={remoteParticipants}
      onIntentChange={onIntentChange}
      npcs={npcs}
      resolveNpcPhrase={resolveNpcPhrase}
      onInteractNpc={onInteractNpc}
      onSustainedLowFps={onSustainedLowFps}
      topSlot={topSlot}
      presenceSlot={presenceSlot}
    />
  );
}

/**
 * The stage is a full-screen layer, so the page behind it must not scroll.
 * Restores the previous value on unmount (2D switch, route change).
 */
const ALL_INTERACTABLES = deriveClassroomInteractables(CLASSROOM_LAYOUT);
const INTERACTABLES_BY_ID = indexClassroomInteractables(ALL_INTERACTABLES);

/** Without a realtime connection (previews, tests) interacting with an NPC does nothing. */
const NOOP_INTERACT_NPC = (): void => undefined;

/** Pet greetings fade on their own; errors with a retry never do. */
const PET_FEEDBACK_MS = 3500;

function useLockPageScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, []);
}

function Classroom3DStageContent({
  headingRef,
  scopeKey,
  classroomId,
  petName,
  selfPose,
  selfEquipped,
  connectionKey,
  frozen,
  remoteParticipants,
  onIntentChange,
  npcs,
  resolveNpcPhrase,
  onInteractNpc = NOOP_INTERACT_NPC,
  onSustainedLowFps,
  topSlot,
  presenceSlot,
}: {
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  readonly scopeKey?: string;
  readonly classroomId: string;
  readonly petName?: string | null;
  readonly selfPose?: Pose | undefined;
  readonly selfEquipped?: AvatarEquipped | undefined;
  readonly connectionKey?: string | undefined;
  readonly frozen?: boolean | undefined;
  readonly remoteParticipants?:
    readonly RemoteClassroomParticipant[] | undefined;
  readonly onIntentChange?: ((intent: AvatarInput) => void) | undefined;
  readonly npcs?: NpcViews | undefined;
  readonly resolveNpcPhrase?:
    ((npc: NpcView) => string | undefined) | undefined;
  readonly onInteractNpc?: ((npcId: string) => void) | undefined;
  readonly onSustainedLowFps?: () => void;
  readonly topSlot?: ReactNode;
  readonly presenceSlot?: ReactNode;
}) {
  useLockPageScroll();
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
  // Object the local avatar stands next to (set by the world, id changes only).
  const [proximityId, setProximityId] = useState<string | undefined>(undefined);
  const promptAnchorRef = useRef<HTMLDivElement | null>(null);
  const [petReactionNonce, setPetReactionNonce] = useState(0);
  const [feedback, setFeedback] = useState<InteractableFeedback | null>(null);
  const [npcSpeech, setNpcSpeech] = useState<NpcSpeech | undefined>(undefined);
  const npcBubbleRef = useRef<HTMLDivElement | null>(null);

  const interactionLocked = panels?.hasActivePanel ?? false;

  const trimmedPetName = petName?.trim() ?? '';
  const resolvedPetName =
    trimmedPetName.length > 0
      ? trimmedPetName
      : classroomMessages.interactables.petDefaultName;

  // Ids a click could act on right now; only these can be proximity targets.
  const availableKey = ALL_INTERACTABLES.filter((item) =>
    canTargetByProximity(item, {
      canOpenPanel: (key) => panels?.canOpenPanel(key) ?? false,
      myDeskIndex: desks.myDeskIndex,
    }),
  )
    .map((item) => item.id)
    .join('|');
  const proximityTargetIds = useMemo(
    () => new Set(availableKey.split('|')),
    [availableKey],
  );
  const isProximityTarget = useCallback(
    (item: ClassroomInteractable) => proximityTargetIds.has(item.id),
    [proximityTargetIds],
  );
  const proximityTarget =
    !interactionLocked && proximityId && proximityTargetIds.has(proximityId)
      ? INTERACTABLES_BY_ID.get(proximityId)
      : undefined;

  /**
   * Highlight precedence: while a panel is open nothing is highlighted;
   * otherwise the HUD hover/focus (or world hover) wins, and the object the
   * avatar stands next to is highlighted when none of those is active.
   */
  const effectiveHighlightedId = interactionLocked
    ? undefined
    : (highlightedId ?? proximityTarget?.id);

  const restoreStageHeadingFocus = useCallback(() => {
    if (headingRef?.current?.isConnected) {
      headingRef.current.focus();
    }
  }, [headingRef]);

  useEffect(() => {
    if (feedback?.kind !== 'pet') return;
    const timer = window.setTimeout(() => setFeedback(null), PET_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

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

      if (interactable.interactionClass === 'npc') {
        if (interactable.npcId) onInteractNpc(interactable.npcId);
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
      onInteractNpc,
      navigate,
      panels,
      restoreStageHeadingFocus,
    ],
  );

  const handleOpenPanel = useCallback(
    (key: string, invoker: HTMLElement) => {
      if (interactionLocked) return;
      const copy = classroomMessages.interactables;
      if (
        !panels ||
        !panels.canOpenPanel(key) ||
        !panels.openPanel(key, invoker)
      ) {
        setFeedback({ kind: 'denied', text: copy.panelDenied });
        return;
      }
      setHighlightedId(undefined);
      setFeedback(null);
    },
    [interactionLocked, panels],
  );

  useInteractKey(true, () => {
    if (!proximityTarget) return false;
    handleActivateInteractable(proximityTarget);
    return true;
  });

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
      className="fixed inset-0 z-30 overflow-hidden bg-background text-foreground"
    >
      {supportsBrowserObservers ? (
        <StageBoundary>
          <div
            className="absolute inset-0"
            onPointerLeave={() => setHighlightedId(undefined)}
          >
            <Suspense
              fallback={
                <p
                  role="status"
                  className="absolute inset-x-0 top-1/2 text-center text-sm text-foreground"
                >
                  {worldMessages.loading}
                </p>
              }
            >
              <LazyClassroomWorld
                fill
                label={classroomMessages.viewMode.canvasLabel}
                scopeKey={scopeKey}
                selfPose={selfPose}
                selfEquipped={selfEquipped}
                connectionKey={connectionKey}
                frozen={frozen}
                remoteParticipants={remoteParticipants}
                onIntentChange={onIntentChange}
                highlightedInteractableId={effectiveHighlightedId}
                ownDeskIndex={desks.myDeskIndex}
                petReactionNonce={petReactionNonce}
                interactionLocked={interactionLocked}
                onHoverInteractable={handleHoverInteractable}
                onSelectInteractable={(item) =>
                  handleActivateInteractable(item)
                }
                isProximityTarget={isProximityTarget}
                onProximityChange={setProximityId}
                onProximityAnchor={(anchor) =>
                  anchorProximityPrompt(promptAnchorRef.current, anchor)
                }
                npcs={npcs}
                resolveNpcPhrase={resolveNpcPhrase}
                onNpcSpeech={setNpcSpeech}
                onNpcSpeechAnchor={(anchor) =>
                  anchorProximityPrompt(npcBubbleRef.current, anchor)
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
          className="absolute inset-0 bg-tray/50 p-4"
        >
          <canvas aria-hidden="true" className="block size-full" />
        </div>
      )}

      {/* Click-through overlay: only the floating cards take pointer events. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3 sm:p-4">
          {topSlot}
        </div>
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
          {presenceSlot}
        </div>
        <ProximityPrompt
          anchorRef={promptAnchorRef}
          action={
            proximityTarget
              ? proximityActionLabel(proximityTarget, resolvedPetName)
              : undefined
          }
          onActivate={(invoker) => {
            if (proximityTarget) {
              handleActivateInteractable(proximityTarget, invoker);
            }
          }}
        />
        <NpcSpeechBubble anchorRef={npcBubbleRef} speech={npcSpeech} />
        <ClassroomWorldHud
          highlightedId={effectiveHighlightedId}
          myDeskIndex={desks.myDeskIndex}
          feedback={effectiveFeedback}
          canOpenPanel={canOpenPanel}
          onFocusInteractable={handleHoverInteractable}
          onOpenPanel={handleOpenPanel}
        />
      </div>
      {/* Kept after the floating bar so heading levels stay in order, for screen readers and as the Alt+M focus target. */}
      <div className="sr-only">
        <h3
          id="classroom-3d-heading"
          ref={headingRef}
          tabIndex={-1}
          className="outline-none"
        >
          {classroomMessages.viewMode.stage3dHeading}
        </h3>
        <p>{classroomMessages.viewMode.stage3dDescription}</p>
      </div>

      <PerformanceStatsOverlay runtime={performanceRuntime} />
    </section>
  );
}
